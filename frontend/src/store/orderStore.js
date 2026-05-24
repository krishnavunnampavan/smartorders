import { create } from 'zustand'
import cartAPI from '../api/cart'

// ── Price helpers ─────────────────────────────────────────────────────────────

const SIZE_MULTIPLIERS = {
  '50ml':  0.10, '100ml': 0.18, '200ml': 0.30,
  '375ml': 0.52, '500ml': 0.70, '750ml': 1.00,
  '1L':    1.28, '1.75L': 1.95,
}

export function calcUnitPrice(baseUnitPrice, sizeLabel, unit, casePackSize = 12) {
  if (!baseUnitPrice) return null
  const mult = SIZE_MULTIPLIERS[sizeLabel] ?? 1.0
  const sizePrice = baseUnitPrice * mult
  const half = Math.max(1, Math.floor(casePackSize / 2))
  const bottlesMap = { 'Bottle': 1, 'Half Case': half, 'Case': casePackSize, 'Mixed Case': casePackSize }
  const bpu = bottlesMap[unit] ?? 1
  return { unitPrice: +(sizePrice * bpu).toFixed(2), bottlesPerUnit: bpu }
}

function parseCasePack(packStr) {
  if (!packStr) return 12
  const n = parseInt(String(packStr).split('/')[0], 10)
  return isNaN(n) ? 12 : n
}

function makeKey(item) {
  return `${item.product_id}__${item.selected_size}__${item.selected_unit}`
}

// Normalize a server cart item: add _key and convenience aliases
function normalize(item) {
  return { ...item, _key: makeKey(item) }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useOrderStore = create((set, get) => ({
  currentOrder: null,
  items: [],           // normalized server cart items (each has .id and ._key)
  wsStatus: 'disconnected',   // 'connecting' | 'connected' | 'disconnected'
  connectionCount: 0,

  setCurrentOrder: (order) => set({ currentOrder: order }),
  setWsStatus: (status) => set({ wsStatus: status }),
  setConnectionCount: (count) => set({ connectionCount: count }),

  // ── Load from server on startup ───────────────────────────────────────────
  loadCart: async () => {
    try {
      const cart = await cartAPI.getCart()
      set({ items: (cart.items || []).map(normalize) })
    } catch (_) {}
  },

  // ── Server-push handlers (called by useCartSync) ──────────────────────────
  setItems: (serverItems) => set({ items: serverItems.map(normalize) }),

  addItemFromServer: (item) => {
    const normed = normalize(item)
    set((s) => {
      const exists = s.items.find((i) => i.id === normed.id)
      if (exists) return { items: s.items.map((i) => i.id === normed.id ? normed : i) }
      return { items: [...s.items, normed] }
    })
  },

  updateItemFromServer: (item) => {
    const normed = normalize(item)
    set((s) => ({ items: s.items.map((i) => i.id === normed.id ? normed : i) }))
  },

  removeItemFromServer: (itemId) =>
    set((s) => ({ items: s.items.filter((i) => i.id !== itemId) })),

  clearItemsFromServer: () => set({ items: [] }),

  // ── Mutations (go through API; server pushes update via WebSocket) ─────────

  addItem: async (product, sizeOption, unitOption, quantity = 1) => {
    const casePack = parseCasePack(product.pack)
    const calc = calcUnitPrice(
      product.unit_price, sizeOption.size_label, unitOption.unit_label, casePack
    ) || { unitPrice: product.unit_price || 0, bottlesPerUnit: unitOption.bottles_per_unit || 1 }

    try {
      await cartAPI.addItem({
        product_id:       String(product.product_id || product.id),
        selected_size:    sizeOption.size_label,
        selected_unit:    unitOption.unit_label,
        bottles_per_unit: calc.bottlesPerUnit,
        quantity,
        unit_price:       +(product.unit_price || 0),
        case_price:       +(product.case_price || 0),
        effective_price:  calc.unitPrice || 0,
        price_status:     product.price_status || 'STABLE',
        price_change:     +(product.price_change || 0),
        source:           product.source || 'manual',
        added_by:         'manager',
      })
      // Server will push ITEM_ADDED / ITEM_UPDATED back via WebSocket
    } catch (_) {}
  },

  // Update by DB id
  updateItem: async (itemId, updates) => {
    try {
      await cartAPI.updateItem(itemId, updates)
    } catch (_) {}
  },

  // Remove by DB id
  removeItem: async (itemId) => {
    // Optimistic removal
    set((s) => ({ items: s.items.filter((i) => i.id !== itemId) }))
    try {
      await cartAPI.removeItem(itemId)
    } catch (_) {}
  },

  clearCart: async () => {
    set({ items: [] })
    try { await cartAPI.clearCart() } catch (_) {}
  },

  submitCart: async () => {
    try {
      const result = await cartAPI.submitCart()
      set({ items: [], currentOrder: result })
      return result
    } catch (_) { return null }
  },

  // ── _key-based helpers (used by FloatingOrderCart inline selectors) ────────

  updateItemSize: async (key, sizeLabel) => {
    const item = get().items.find((i) => i._key === key)
    if (!item) return
    const calc = calcUnitPrice(
      item.unit_price, sizeLabel, item.selected_unit,
      parseCasePack(item.case_pack)
    ) || { unitPrice: item.effective_price, bottlesPerUnit: item.bottles_per_unit }
    try {
      await cartAPI.updateItem(item.id, {
        selected_size:    sizeLabel,
        bottles_per_unit: calc.bottlesPerUnit,
        effective_price:  calc.unitPrice || 0,
      })
    } catch (_) {}
  },

  updateItemUnit: async (key, unitLabel) => {
    const item = get().items.find((i) => i._key === key)
    if (!item) return
    const calc = calcUnitPrice(
      item.unit_price, item.selected_size, unitLabel,
      parseCasePack(item.case_pack)
    ) || { unitPrice: item.effective_price, bottlesPerUnit: item.bottles_per_unit }
    try {
      await cartAPI.updateItem(item.id, {
        selected_unit:    unitLabel,
        bottles_per_unit: calc.bottlesPerUnit,
        effective_price:  calc.unitPrice || 0,
      })
    } catch (_) {}
  },

  updateItemQty: async (key, quantity) => {
    const item = get().items.find((i) => i._key === key)
    if (!item) return
    // Optimistic
    set((s) => ({
      items: s.items.map((i) => i._key === key ? { ...i, quantity, total_bottles: quantity * (i.bottles_per_unit || 1) } : i),
    }))
    try {
      await cartAPI.updateItem(item.id, { quantity })
    } catch (_) {}
  },

  // ── Legacy compat wrappers ────────────────────────────────────────────────

  addResolvedItem: (item) => {
    const s = get()
    const sizeOpt = { size_label: item.selected_size || '750ml' }
    const unitOpt = { unit_label: item.selected_unit || 'Case', bottles_per_unit: item.bottles_per_unit || 1 }
    const exists = s.items.find((i) => i.product_id === (item.product_id || item.id))
    if (exists) {
      get().updateItemQty(exists._key, exists.quantity + (item.quantity || 1))
      return
    }
    get().addItem(
      { ...item, product_id: item.product_id || item.id },
      sizeOpt, unitOpt, item.quantity || 1
    )
  },

  removeResolvedItem: async (product_id) => {
    const item = get().items.find((i) => i.product_id === product_id)
    if (item) await get().removeItem(item.id)
  },

  updateResolvedQty: (product_id, quantity) => {
    const item = get().items.find((i) => i.product_id === product_id)
    if (item) get().updateItemQty(item._key, quantity)
  },

  clearItems: () => get().clearCart(),
  clearResolvedItems: () => get().clearCart(),
}))
