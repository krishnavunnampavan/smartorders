import { create } from 'zustand'

export const useOrderStore = create((set, get) => ({
  currentOrder: null,
  items: [],
  resolvedItems: [],

  setCurrentOrder: (order) => set({ currentOrder: order }),

  addResolvedItem: (item) =>
    set((state) => {
      const exists = state.resolvedItems.find(
        (i) => i.product_id === item.product_id
      )
      if (exists) {
        return {
          resolvedItems: state.resolvedItems.map((i) =>
            i.product_id === item.product_id
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
          ),
        }
      }
      return { resolvedItems: [...state.resolvedItems, { ...item, quantity: item.quantity || 1 }] }
    }),

  removeResolvedItem: (product_id) =>
    set((state) => ({
      resolvedItems: state.resolvedItems.filter((i) => i.product_id !== product_id),
    })),

  updateResolvedQty: (product_id, quantity) =>
    set((state) => ({
      resolvedItems: state.resolvedItems.map((i) =>
        i.product_id === product_id ? { ...i, quantity } : i
      ),
    })),

  clearResolvedItems: () => set({ resolvedItems: [] }),
}))
