// Teste de fumaça do app empacotado: abre, grava alguns segundos pelo --alternar e confere o arquivo.
// Uso: node scripts/fumaca.js <executável do app> [argumentos extras]
const { spawn, spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const [exe, ...extras] = process.argv.slice(2);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const abrir = (...args) => spawn(exe, [...extras, ...args], { stdio: 'inherit' });

const pastas = ['Movies', 'Videos'].map((p) => path.join(os.homedir(), p, 'Reuniões'));
const gravacoes = () => pastas.flatMap((p) => (fs.existsSync(p) ? fs.readdirSync(p).map((f) => path.join(p, f)) : []));

(async () => {
  const antes = new Set(gravacoes());
  const app = abrir();
  await espera(8000);
  abrir('--alternar');
  await espera(6000);
  abrir('--alternar');
  await espera(5000);
  app.kill();

  const novas = gravacoes().filter((f) => !antes.has(f));
  if (novas.length !== 1) throw new Error(`Esperava 1 gravação nova, achei ${novas.length}`);
  const [arquivo] = novas;
  const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'json', arquivo]));
  const tipos = info.streams.map((s) => s.codec_type).sort().join(',');
  // Duração pelo último pacote de vídeo: o WebM do MediaRecorder sai sem duração no cabeçalho.
  const pts = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', arquivo])
    .toString().trim().split(/\s+/).map(Number);
  const duracao = Math.max(...pts);
  console.log(`${arquivo}: ${tipos}, ${duracao}s, ${fs.statSync(arquivo).size} bytes`);
  if (tipos !== 'audio,video') throw new Error(`Faixas erradas: ${tipos}`);
  if (!(duracao > 3)) throw new Error(`Duração curta demais: ${duracao}`);
  // EXIGIR_AUDIO=1 onde o CI toca um tom no sistema: a faixa de áudio existe sempre (a mixagem gera
  // silêncio sem fonte), então só o volume prova que o áudio do sistema entrou.
  if (process.env.EXIGIR_AUDIO) {
    const { stderr } = spawnSync('ffmpeg', ['-i', arquivo, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
    const media = Number(/mean_volume: (-?[\d.]+) dB/.exec(stderr)?.[1]);
    console.log(`Volume médio: ${media} dB`);
    if (!(media > -35)) throw new Error(`Áudio do sistema não entrou (volume médio ${media} dB)`);
  }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
