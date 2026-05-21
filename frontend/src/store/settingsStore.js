import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useSettingsStore = create(
  persist(
    (set) => ({
      aiStatus: { openai: 'not_set', claude: 'not_set' },
      storeInfo: {},
      setAIStatus: (status) => set({ aiStatus: status }),
      setStoreInfo: (info) => set({ storeInfo: info }),
    }),
    { name: 'lsp-settings' }
  )
)
