import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      storeKey: null,
      storeId: null,
      storeName: null,
      isOwner: false,

      setAuth: ({ storeKey, storeId, storeName, isOwner }) =>
        set({ storeKey, storeId, storeName, isOwner }),

      logout: () =>
        set({ storeKey: null, storeId: null, storeName: null, isOwner: false }),
    }),
    { name: 'liquorstore-auth' }
  )
)
