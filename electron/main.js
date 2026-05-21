const { app, BrowserWindow, Menu, shell, Tray, nativeImage } = require('electron')
const path = require('path')
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow = null
let tray = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'LiquorStore Pro',
    backgroundColor: '#0d1117',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    icon: path.join(__dirname, 'icon.png'),
  })

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // In production: load from the bundled frontend dist
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

function createTray() {
  const iconPath = path.join(__dirname, 'tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('LiquorStore Pro')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open LiquorStore Pro', click: () => { mainWindow?.show() ?? createWindow() } },
    { label: 'New Order', click: () => {
      mainWindow?.show()
      mainWindow?.webContents.executeJavaScript("window.location.href='/orders/new'")
    }},
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]))
  tray.on('double-click', () => mainWindow?.show())
}

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Order', accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.executeJavaScript("window.location.href='/orders/new'") },
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+H',
          click: () => mainWindow?.webContents.executeJavaScript("window.location.href='/'") },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About LiquorStore Pro', click: () => {
          const { dialog } = require('electron')
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'LiquorStore Pro',
            message: 'LiquorStore Pro v1.0.0',
            detail: 'Smart Stock Ordering Platform\n\nBuilt with React + FastAPI',
          })
        }},
        { label: 'Open in Browser', click: () => shell.openExternal('http://localhost:5173') },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  createWindow()
  buildMenu()
  // Tray is optional — skip if icon doesn't exist
  try { createTray() } catch (e) { console.log('Tray skipped:', e.message) }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Auto-updater (only in production)
if (!isDev) {
  try {
    const { autoUpdater } = require('electron-updater')
    autoUpdater.checkForUpdatesAndNotify()
    autoUpdater.on('update-downloaded', () => {
      const { dialog } = require('electron')
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version of LiquorStore Pro has been downloaded. Restart to apply.',
        buttons: ['Restart Now', 'Later'],
      }).then(({ response }) => { if (response === 0) autoUpdater.quitAndInstall() })
    })
  } catch (e) {
    console.log('Auto-updater not available:', e.message)
  }
}
