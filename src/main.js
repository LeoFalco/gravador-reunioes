const { app, BrowserWindow, Tray, Menu, globalShortcut, session, desktopCapturer, ipcMain, nativeImage, shell, Notification, systemPreferences } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { nomeDoArquivo, extensaoDoMime } = require('./nome');

const ATALHO = 'CommandOrControl+Shift+9';
const pasta = path.join(app.getPath('videos'), 'Reuniões');

// parado → iniciando → gravando → parando → parado. O "iniciando" e o "parando" absorvem o segundo toque
// no atalho enquanto a captura abre ou fecha; sem eles nasciam dois gravadores no mesmo arquivo.
let estado = 'parado';
let tray, janela, arquivo, caminhoAtual, saindo = false;

if (process.platform === 'linux') {
  // Atalho global no Wayland só pelo portal.
  app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal');
  // Ubuntu 24.04+ barra o sandbox SUID do AppImage pelo AppArmor, e o app nem abre.
  if (process.env.APPIMAGE) app.commandLine.appendSwitch('no-sandbox');
}

if (!app.requestSingleInstanceLock()) {
  // Segunda instância (ex.: --alternar): o pedido já foi entregue à primeira pelo second-instance.
  app.exit(0);
} else {
  iniciar();
}

function iniciar() {
  // Rodar o app de novo com --alternar liga ou desliga a gravação (útil em script e atalho do sistema).
  app.on('second-instance', (_e, argv) => { if (argv.includes('--alternar')) alternar(); });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', (e) => e.preventDefault());
  // Sair no meio da gravação fecha o arquivo antes, para não perder o último pedaço.
  app.on('before-quit', (e) => {
    if (estado === 'parado') return;
    e.preventDefault();
    saindo = true;
    if (estado === 'gravando') alternar();
  });
  if (process.platform === 'darwin') app.dock?.hide();

  app.whenReady().then(async () => {
    fs.mkdirSync(pasta, { recursive: true });

    // A captura vai sem seletor: a tela principal inteira, com o áudio do sistema por loopback.
    session.defaultSession.setDisplayMediaRequestHandler(async (_req, callback) => {
      try {
        const [tela] = await desktopCapturer.getSources({ types: ['screen'] });
        if (!tela) return callback({});
        // No Linux o loopback do Chromium lê o monitor da saída padrão do PulseAudio/PipeWire.
        callback({ video: tela, audio: 'loopback' });
      } catch (e) {
        console.error('Sem acesso à tela:', e.message);
        callback({});
      }
    });
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, ok) => ok(true));


    janela = new BrowserWindow({
      show: false,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false },
    });
    janela.loadFile(path.join(__dirname, 'gravador.html'));
    janela.webContents.on('console-message', (e) => console.log('[gravador]', e.message));

    tray = new Tray(icone(false));
    // No Mac o clique abre o menu; no Windows e no Linux o clique grava e o botão direito abre o menu.
    if (process.platform !== 'darwin') tray.on('click', alternar);
    atualizarTray();

    // Sem await: na primeira abertura o pedido do microfone fica na tela, e o app precisa já estar de pé.
    if (process.platform === 'darwin') systemPreferences.askForMediaAccess('microphone');

    if (!globalShortcut.register(ATALHO, alternar)) avisar(`Atalho ${ATALHO} já está em uso por outro app.`);
    if (process.argv.includes('--alternar')) janela.webContents.once('did-finish-load', alternar);
  });
}

function alternar() {
  if (!janela) return;
  if (estado === 'parado') {
    estado = 'iniciando';
    janela.webContents.send('iniciar');
  } else if (estado === 'gravando') {
    estado = 'parando';
    janela.webContents.send('parar');
  }
  atualizarTray();
}

ipcMain.on('iniciou', (_e, mime) => {
  caminhoAtual = path.join(pasta, nomeDoArquivo(new Date(), extensaoDoMime(mime)));
  arquivo = fs.createWriteStream(caminhoAtual);
  estado = 'gravando';
  atualizarTray();
  if (saindo) alternar();
});

// Cada pedaço vai direto para o disco, então uma queda no meio da reunião não perde o que já foi gravado.
ipcMain.on('pedaco', (_e, dados) => arquivo?.write(Buffer.from(dados)));

ipcMain.on('terminou', () => fechar((salvo) => avisar(`Gravação salva em ${salvo}`, salvo)));

ipcMain.on('falhou', (_e, msg) => fechar(() => avisar(`Não deu para gravar: ${msg}`)));

function fechar(depois) {
  const salvo = caminhoAtual;
  const concluir = () => {
    estado = 'parado';
    atualizarTray();
    depois(salvo);
    if (saindo) app.quit();
  };
  if (arquivo) arquivo.end(concluir);
  else concluir();
  arquivo = null;
}

function atualizarTray() {
  if (!tray) return;
  const ativo = estado !== 'parado';
  tray.setImage(icone(ativo));
  tray.setToolTip(ativo ? 'Gravando reunião' : 'Gravador de reuniões');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: ativo ? 'Parar gravação' : 'Gravar tela', accelerator: ATALHO, click: alternar, enabled: estado === 'parado' || estado === 'gravando' },
    { label: 'Abrir pasta das gravações', click: () => shell.openPath(pasta) },
    { type: 'separator' },
    // shortcut: o Electron não tem "abrir com o sistema" no Linux; lá o item some até alguém pedir o .desktop de autostart.
    ...(process.platform === 'linux' ? [] : [{
      label: 'Iniciar com o sistema', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    }]),
    { label: 'Sair', click: () => app.quit() },
  ]));
}

function icone(ativo) {
  if (ativo) return nativeImage.createFromPath(path.join(__dirname, 'bandeja-gravando.png'));
  // No Mac o ícone parado é template (o sistema pinta conforme o tema); no Windows e no Linux vai o
  // ícone do app em miniatura, que aparece em barra clara e escura.
  if (process.platform !== 'darwin') return nativeImage.createFromPath(path.join(__dirname, 'bandeja-cor.png')).resize({ width: 16 });
  const img = nativeImage.createFromPath(path.join(__dirname, 'bandeja.png'));
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
