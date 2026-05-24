import { create } from 'zustand'

// Size multipliers relative to 750ml base price
const SIZE_MULTIPLIERS = {
  '50ml':   0.10,
  '100ml':  0.18,
  '200ml':  0.30,
  '375ml':  0.52,
  '500ml':  0.70,
  '750ml':  1.00,
  '1L':     1.28,
  '1.75L':  1.95,
}

export function calcUnitPrice(baseUnitPrice, sizeLabel, unit, casePackSize = 12) {
  if (!baseUnitPrice) return null
  const mult = SIZE_MULTIPLIERS[sizeLabel] ?? 1.0
  const sizePrice = baseUnitPrice * mult
  const bottlesMap = {
    'Bottle':     1,
    'Half Case':  Math.max(1, Math.floor(casePackSize / 2)),
    'Case':       casePackSize,
    'Mixed Case': casePackSize,
  }
  const bpu = bottlesMap[unit] ?? 1
  return { unitPrice: +(sizePrice * bpu).toFixed(2), bottlesPerUnit: bpu }
}

function parseCasePack(packStr) {
  if (!packStr) return 12
  const n = parseInt(String(packStr).split('/')[0], 10)
  return isNaN(n) ? 12 : n
}

export const useOrderStore = create((set, get) => ({
  currentOrder: null,
  items: [],

  setCurrentOrder: (order) => set({ currentOrder: order }),

  // Primary add — full item object from voice/photo/manual
  addItem: (product, sizeOption, unitOption, quantity = 1) => {
    const state = get()
    const key = `${product.product_id || product.id}__${sizeOption.size_label}__${unitOption.unit_label}`
    const exists = state.items.find((i) => i._key === key)
    const casePackSize = parseCasePack(product.pack)
    const { unitPrice, bottlesPerUnit } = calcUnitPrice(
      product.unit_price, sizeOption.size_label, unitOption.unit_label, casePackSize
    ) || { unitPrice: product.unit_price, bottlesPerUnit: unitOption.bottles_per_unit }

    if (exists) {
      set({
        items: state.items.map((i) =>
          i._key === key ? { ...i, quantity: i.quantity + quantity, totalBottles: (i.quantity + quantity) * bottlesPerUnit } : i
        ),
      })
      return
    }

    const newItem = {
      _key: key,
      product_id: product.product_id || product.id,
      product_name: product.product_name || product.name,
      company_id: product.company_id,
      quantity,
      unit_price: unitPrice,
      base_unit_price: product.unit_price,
      price_status: product.price_status,
      price_change: product.price_change,
      source: product.source || 'manual',
      selected_size: sizeOption.size_label,
      selected_unit: unitOption.unit_label,
      bottles_per_unit: bottlesPerUnit,
      total_bottles: quantity * bottlesPerUnit,
      case_pack: casePackSize,
      size_options: product.size_options || [],
      unit_options: product.unit_options || [],
    }
    set({ items: [...state.items, newItem] })
  },

  // Legacy compat: addResolvedItem — wraps addItem with defaults
  addResolvedItem: (item) => {
    const state = get()
    const sizeOpt = { size_label: item.selected_size || '750ml' }
    const unitOpt = { unit_label: item.selected_unit || 'Case', bottles_per_unit: item.bottles_per_unit || 1 }
    // Check if already present (legacy dedup by product_id only)
    const exists = state.items.find((i) => i.product_id === (item.product_id || item.id))
    if (exists) {
      get().updateItemQty(exists._key, exists.quantity + (item.quantity || 1))
      return
    }
    get().addItem(
      { ...item, product_id: item.product_id || item.id, product_name: item.product_name },
      sizeOpt, unitOpt, item.quantity || 1
    )
  },

  removeItem: (key) =>
    set((state) => ({ items: state.items.filter((i) => i._key !== key) })),

  // Legacy compat
  removeResolvedItem: (product_id) =>
    set((state) => ({ items: state.items.filter((i) => i.product_id !== product_id) })),

  updateItemQty: (key, quantity) =>
    set((state) => ({
      items: state.items.map((i) =>
        i._key === key
          ? { ...i, quantity, total_bottles: quantity * (i.bottles_per_unit || 1) }
          : i
      ),
    })),

  // Legacy compat
  updateResolvedQty: (product_id, quantity) => {
    const state = get()
    const item = state.items.find((i) => i.product_id === product_id)
    if (item) get().updateItemQty(item._key, quantity)
  },

  updateItemSize: (key, sizeLabel) =>
    set((state) => ({
      items: state.items.map((i) => {
        if (i._key !== key) return i
        const { unitPrice, bottlesPerUnit } = calcUnitPrice(
          i.base_unit_price, sizeLabel, i.selected_unit, i.case_pack
        ) || { unitPrice: i.unit_price, bottlesPerUnit: i.bottles_per_unit }
        const newKey = `${i.product_id}__${sizeLabel}__${i.selected_unit}`
        return {
          ...i,
          _key: newKey,
          selected_size: sizeLabel,
          unit_price: unitPrice,
          bottles_per_unit: bottlesPerUnit,
          total_bottles: i.quantity * bottlesPerUnit,
        }
      }),
    })),

  updateItemUnit: (key, unitLabel) =>
    set((state) => ({
      items: state.items.map((i) => {
        if (i._key !== key) return i
        const { unitPrice, bottlesPerUnit } = calcUnitPrice(
          i.base_unit_price, i.selected_size, unitLabel, i.case_pack
        ) || { unitPrice: i.unit_price, bottlesPerUnit: i.bottles_per_unit }
        const newKey = `${i.product_id}__${i.selected_size}__${unitLabel}`
        return {
          ...i,
          _key: newKey,
          selected_unit: unitLabel,
          unit_price: unitPrice,
          bottles_per_unit: bottlesPerUnit,
          total_bottles: i.quantity * bottlesPerUnit,
        }
      }),
    })),

  clearItems: () => set({ items: [] }),
  clearResolvedItems: () => set({ items: [] }),
}))
