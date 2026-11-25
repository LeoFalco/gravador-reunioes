// Teste de fumaça do app empacotado: abre, grava alguns segundos pelo --alternar e confere o arquivo.
// Uso: node scripts/fumaca.js <executável do app> [argumentos extras]
const { spawn, execFileSync } = require('node:child_process');
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
  const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type:format=duration', '-of', 'json', arquivo]));
  const tipos = info.streams.map((s) => s.codec_type).sort().join(',');
  const duracao = Number(info.format.duration);
  console.log(`${arquivo}: ${tipos}, ${duracao}s, ${fs.statSync(arquivo).size} bytes`);
  if (tipos !== 'audio,video') throw new Error(`Faixas erradas: ${tipos}`);
  if (!(duracao > 3)) throw new Error(`Duração curta demais: ${duracao}`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
