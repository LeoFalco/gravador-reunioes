const dois = (n) => String(n).padStart(2, '0');

function nomeDoArquivo(d, ext) {
  return `Reunião ${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())} ${dois(d.getHours())}-${dois(d.getMinutes())}-${dois(d.getSeconds())}.${ext}`;
}

const extensaoDoMime = (mime) => (mime?.startsWith('video/mp4') ? 'mp4' : 'webm');

module.exports = { nomeDoArquivo, extensaoDoMime };
