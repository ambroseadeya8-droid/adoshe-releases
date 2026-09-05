const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('adosheDesktop', {
  getVersion: () => ipcRenderer.invoke('adoshe:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('adoshe:check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('adoshe:download-update'),
  installUpdate: () => ipcRenderer.invoke('adoshe:install-update'),
  onUpdateEvent: (callback) => ipcRenderer.on('adoshe:update-event', (_event, type, payload) => callback(type, payload))
});
