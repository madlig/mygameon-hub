const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateAvailable: (callback) => ipcRenderer.on('update_available', (_event, info) => callback(info)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update_downloaded', (_event, info) => callback(info)),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
