const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ponte', {
  plataforma: process.platform,
  aoIniciar: (fn) => ipcRenderer.on('iniciar', fn),
  aoParar: (fn) => ipcRenderer.on('parar', fn),
  iniciou: (mime) => ipcRenderer.send('iniciou', mime),
  pedaco: (dados) => ipcRenderer.send('pedaco', dados),
  terminou: () => ipcRenderer.send('terminou'),
  falhou: (msg) => ipcRenderer.send('falhou', msg),
});
