// Roda numa janela oculta: captura a tela com o áudio do sistema, soma o microfone e grava.
// MP4 primeiro: abre e avança em qualquer player. No Linux o Chromium não tem H.264, mas grava VP9 em MP4.
const FORMATOS = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=vp9,opus', 'video/webm;codecs=vp9,opus', 'video/webm'];

let gravador, faixas = [], contexto;
// Os pedaços vão em fila: arrayBuffer() é assíncrono, e sem a fila o último chegaria depois do onstop e se perderia.
let fila = Promise.resolve();

window.ponte.aoIniciar(async () => {
  try {
    // Sem processamento de voz no áudio do sistema: o ganho automático do Chromium o deixava a -44 dB no Linux.
    const tela = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    faixas.push(...tela.getTracks());

    let mic = null;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      faixas.push(...mic.getTracks());
    } catch (e) {
      console.warn('Sem microfone, segue só com o áudio do sistema:', e.message);
    }

    if (!tela.getAudioTracks().length) console.warn('Sem áudio do sistema; segue só com o microfone.');

    // MediaRecorder grava uma faixa de áudio só, então sistema e microfone se misturam aqui.
    contexto = new AudioContext();
    const destino = contexto.createMediaStreamDestination();
    for (const fonte of [tela, mic]) {
      if (fonte?.getAudioTracks().length) contexto.createMediaStreamSource(fonte).connect(destino);
    }

    const saida = new MediaStream([...tela.getVideoTracks(), ...destino.stream.getAudioTracks()]);
    const mime = FORMATOS.find((f) => MediaRecorder.isTypeSupported(f));
    gravador = new MediaRecorder(saida, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
    gravador.ondataavailable = (e) => {
      if (e.data.size) fila = fila.then(async () => window.ponte.pedaco(await e.data.arrayBuffer()));
    };
    gravador.onstop = () => { limpar(); fila.then(() => window.ponte.terminou()); };
    // Se o usuário encerrar o compartilhamento pelo sistema, a gravação fecha direito.
    tela.getVideoTracks()[0].onended = () => gravador?.state === 'recording' && gravador.stop();

    window.ponte.iniciou(mime);
    gravador.start(1000);
    console.log('Gravando', mime, 'com', faixas.map((f) => `${f.kind}: ${f.label}`).join(', '));
  } catch (e) {
    limpar();
    window.ponte.falhou(e.message);
  }
});

window.ponte.aoParar(() => { if (gravador?.state === 'recording') gravador.stop(); });

function limpar() {
  faixas.forEach((f) => f.stop());
  faixas = [];
  contexto?.close();
  contexto = null;
}
