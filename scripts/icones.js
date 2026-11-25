// Gera os PNGs dos ícones a partir dos SVGs abaixo, renderizando no próprio Chromium do Electron.
// Uso: npx electron scripts/icones.js
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');

// Tela com um ponto de gravação, no fundo escuro arredondado do padrão de ícone do macOS.
const APP = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="fundo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b3446"/><stop offset="1" stop-color="#11151f"/>
    </linearGradient>
    <radialGradient id="brilho" cx="0.5" cy="0.45" r="0.5">
      <stop offset="0" stop-color="#ff6b5e"/><stop offset="1" stop-color="#e5281b"/>
    </radialGradient>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#fundo)"/>
  <rect x="222" y="262" width="580" height="390" rx="44" fill="none" stroke="#e8ecf3" stroke-width="40"/>
  <path d="M452 652 L432 742 H592 L572 652" fill="#e8ecf3"/>
  <rect x="372" y="732" width="280" height="40" rx="20" fill="#e8ecf3"/>
  <circle cx="512" cy="457" r="150" fill="#e5281b" opacity="0.25"/>
  <circle cx="512" cy="457" r="104" fill="url(#brilho)"/>
</svg>`;

// Bandeja: o mesmo desenho em traço fino. Parado é template (preto, o macOS pinta conforme o tema);
// gravando é vermelho, visível em barra clara e escura.
const bandeja = (cor, ponto) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
  <rect x="1.25" y="2.25" width="13.5" height="9" rx="1.5" fill="none" stroke="${cor}" stroke-width="1.5"/>
  <path d="M6 11.5 L5.5 13.5 H10.5 L10 11.5" fill="${cor}"/>
  <circle cx="8" cy="6.75" r="${ponto}" fill="${cor}"/>
</svg>`;

const alvos = [
  ['icone.png', APP, 1024],
  ['src/bandeja.png', bandeja('#000', 2), 16],
  ['src/bandeja@2x.png', bandeja('#000', 2), 32],
  ['src/bandeja-gravando.png', bandeja('#ff3b30', 2.75), 16],
  ['src/bandeja-gravando@2x.png', bandeja('#ff3b30', 2.75), 32],
  // Windows e Linux: o ícone do app em miniatura, legível em barra clara e escura.
  ['src/bandeja-cor.png', APP, 32],
];

app.whenReady().then(async () => {
  const janela = new BrowserWindow({ show: false, transparent: true, frame: false, webPreferences: { offscreen: true } });
  for (const [arquivo, svg, lado] of alvos) {
    janela.setContentSize(lado, lado);
    const html = `<style>html,body{margin:0;background:transparent}</style><img width="${lado}" height="${lado}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`;
    await janela.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`);
    const img = await janela.webContents.capturePage({ x: 0, y: 0, width: lado, height: lado });
    fs.writeFileSync(path.join(raiz, arquivo), img.resize({ width: lado, height: lado }).toPNG());
    console.log(arquivo);
  }
  app.quit();
});
