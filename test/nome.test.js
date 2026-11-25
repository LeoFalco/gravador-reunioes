const test = require('node:test');
const assert = require('node:assert');
const { nomeDoArquivo, extensaoDoMime } = require('../src/nome');

test('nome do arquivo leva data e hora sem caractere proibido no Windows', () => {
  const nome = nomeDoArquivo(new Date(2026, 10, 5, 9, 3, 7), 'mp4');
  assert.strictEqual(nome, 'Reunião 2026-11-05 09-03-07.mp4');
  assert.doesNotMatch(nome, /[:<>"/\\|?*]/);
});

test('extensão segue o formato escolhido', () => {
  assert.strictEqual(extensaoDoMime('video/mp4;codecs=avc1,mp4a.40.2'), 'mp4');
  assert.strictEqual(extensaoDoMime('video/webm;codecs=vp9,opus'), 'webm');
  assert.strictEqual(extensaoDoMime(undefined), 'webm');
});
