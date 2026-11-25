const { app, BrowserWindow, Tray, Menu, globalShortcut, session, desktopCapturer, ipcMain, nativeImage, shell, Notification, systemPreferences } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { nomeDoArquivo, extensaoDoMime } = require('./nome');

const ATALHO = 'CommandOrControl+Shift+9';
const pasta = path.join(app.getPath('videos'), 'Reuniões');

let tray, janela, arquivo, caminhoAtual;
let gravando = false;

if (!app.requestSingleInstanceLock()) app.quit();
// Rodar o app de novo com --alternar liga ou desliga a gravação (útil em script e atalho do sistema).
app.on('second-instance', (_e, argv) => { if (argv.includes('--alternar')) alternar(); });

if (process.platform === 'darwin') app.dock?.hide();

app.whenReady().then(async () => {
  fs.mkdirSync(pasta, { recursive: true });

  // A captura vai sem seletor: a tela principal inteira, com o áudio do sistema por loopback.
  session.defaultSession.setDisplayMediaRequestHandler(async (_req, callback) => {
    const [tela] = await desktopCapturer.getSources({ types: ['screen'] });
    // Loopback só existe no Windows e no Mac; no Linux o áudio do sistema vem do monitor (ver gravador.js).
    callback(process.platform === 'linux' ? { video: tela } : { video: tela, audio: 'loopback' });
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, ok) => ok(true));

  if (process.platform === 'darwin') await systemPreferences.askForMediaAccess('microphone');

  janela = new BrowserWindow({
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false },
  });
  janela.loadFile(path.join(__dirname, 'gravador.html'));
  janela.webContents.on('console-message', (e) => console.log('[gravador]', e.message));

  tray = new Tray(icone(false));
  atualizarTray();

  if (!globalShortcut.register(ATALHO, alternar)) avisar(`Atalho ${ATALHO} já está em uso por outro app.`);
  if (process.argv.includes('--alternar')) janela.webContents.once('did-finish-load', alternar);
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', (e) => e.preventDefault());

function alternar() {
  janela.webContents.send(gravando ? 'parar' : 'iniciar');
}

ipcMain.on('iniciou', (_e, mime) => {
  caminhoAtual = path.join(pasta, nomeDoArquivo(new Date(), extensaoDoMime(mime)));
  arquivo = fs.createWriteStream(caminhoAtual);
  gravando = true;
  atualizarTray();
});

// Cada pedaço vai direto para o disco, então uma queda no meio da reunião não perde o que já foi gravado.
ipcMain.on('pedaco', (_e, dados) => arquivo?.write(Buffer.from(dados)));

ipcMain.on('terminou', () => {
  const salvo = caminhoAtual;
  arquivo?.end(() => avisar(`Gravação salva em ${salvo}`, salvo));
  arquivo = null;
  gravando = false;
  atualizarTray();
});

ipcMain.on('falhou', (_e, msg) => {
  gravando = false;
  atualizarTray();
  avisar(`Não deu para gravar: ${msg}`);
});

function atualizarTray() {
  tray.setImage(icone(gravando));
  tray.setToolTip(gravando ? 'Gravando reunião' : 'Gravador de reuniões');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: gravando ? 'Parar gravação' : 'Gravar tela', accelerator: ATALHO, click: alternar },
    { label: 'Abrir pasta das gravações', click: () => shell.openPath(pasta) },
    { type: 'separator' },
    { label: 'Iniciar com o sistema', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { label: 'Sair', click: () => app.quit() },
  ]));
}

function icone(ativo) {
  if (ativo) return nativeImage.createFromPath(path.join(__dirname, 'gravando.png'));
  // No Mac o ícone é template (segue o tema da barra); no Windows e no Linux um anel preto some na barra escura.
  if (process.platform !== 'darwin') return nativeImage.createFromPath(path.join(__dirname, '..', 'icone.png')).resize({ width: 16 });
  const img = nativeImage.createFromPath(path.join(__dirname, 'parado.png'));
  img.setTemplateImage(true);
  return img;
}

function avisar(texto, abrir) {
  console.log(texto);
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: 'Gravador de reuniões', body: texto });
  if (abrir) n.on('click', () => shell.showItemInFolder(abrir));
  n.show();
}
