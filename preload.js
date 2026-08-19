const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateAvailable: (callback) => ipcRenderer.on('update_available', (_event, info) => callback(info)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update_not_available', (_event, info) => callback(info)),
  onUpdateProgress: (callback) => ipcRenderer.on('update_progress', (_event, progressObj) => callback(progressObj)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update_downloaded', (_event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update_error', (_event, err) => callback(err)),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
