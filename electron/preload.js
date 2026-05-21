const { contextBridge, ipcRenderer } = require('electron')

// Expose a safe API surface to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
  },
  // Allow the renderer to trigger native notifications
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
})
