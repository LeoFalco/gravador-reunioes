// Roda numa janela oculta: captura a tela com o áudio do sistema, soma o microfone e grava.
const FORMATOS = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm'];

let gravador, faixas = [], contexto;
// Os pedaços vão em fila: arrayBuffer() é assíncrono, e sem a fila o último chegaria depois do onstop e se perderia.
let fila = Promise.resolve();

window.ponte.aoIniciar(async () => {
  try {
    const tela = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    faixas.push(...tela.getTracks());

    let mic = null;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      faixas.push(...mic.getTracks());
    } catch (e) {
      console.warn('Sem microfone, segue só com o áudio do sistema:', e.message);
    }

    // No Linux o Chromium não entrega o loopback; o áudio do sistema sai do "Monitor of ..." do PulseAudio/PipeWire.
    let monitor = null;
    if (!tela.getAudioTracks().length) {
      const dispositivos = await navigator.mediaDevices.enumerateDevices();
      const saidaDoSistema = dispositivos.find((d) => d.kind === 'audioinput' && /monitor/i.test(d.label));
      if (saidaDoSistema) {
        monitor = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: saidaDoSistema.deviceId } } });
        faixas.push(...monitor.getTracks());
      } else {
        console.warn('Sem áudio do sistema nesta plataforma.');
      }
    }

    // MediaRecorder grava uma faixa de áudio só, então sistema e microfone se misturam aqui.
    contexto = new AudioContext();
    const destino = contexto.createMediaStreamDestination();
    for (const fonte of [tela, monitor, mic]) {
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
