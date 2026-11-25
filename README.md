# Gravador de Reuniões

Fica na bandeja do sistema e grava a tela inteira com o áudio da reunião (o que sai do computador) e o
seu microfone, mixados num arquivo só. Roda no macOS, no Windows e no Linux.

## Instalar

**macOS e Linux** (Terminal):

```bash
curl -fsSL https://raw.githubusercontent.com/LeoFalco/gravador-reunioes/main/instalar.sh | bash
```

**Windows** (PowerShell):

```powershell
irm https://raw.githubusercontent.com/LeoFalco/gravador-reunioes/main/instalar.ps1 | iex
```

O mesmo comando atualiza para a última versão.

## Usar

| Ação | Como |
| --- | --- |
| Começar e parar | **Ctrl+Shift+9** (no Mac, **⌘+Shift+9**), clique no ícone da bandeja (Windows e Linux) ou menu do ícone → **Gravar tela** |
| Achar as gravações | Menu da bandeja → **Abrir pasta das gravações** (`Filmes/Reuniões` no Mac, `Vídeos/Reuniões` nos outros) |
| Abrir junto com o sistema | Menu da bandeja → **Iniciar com o sistema** (macOS e Windows) |

O ícone fica vermelho enquanto grava. Sair pelo menu no meio de uma gravação fecha o arquivo antes. O vídeo vai sendo gravado no disco a cada segundo: se o
computador cair no meio da reunião, o que já foi gravado fica no arquivo.

Rodar o app de novo com `--alternar` também liga e desliga a gravação, para quem quiser disparar
por script ou por outro atalho.

### Permissões e limites por sistema

- **macOS** (13 ou mais novo): na primeira gravação o sistema pede **Gravação de Tela** e
  **Microfone**. O app não é assinado pela Apple; o instalador assina localmente, e por isso **cada
  atualização revoga a Gravação de Tela sem pedir de novo**. Quando isso acontece, o app avisa e abre
  Ajustes do Sistema → Privacidade e Segurança → Gravação de Tela: desligue e ligue o Gravador de
  Reuniões (ou adicione-o, se não estiver na lista) e abra o app outra vez.
- **Windows**: nada a configurar.
- **Linux**: o áudio do sistema vem da saída padrão do PulseAudio ou do PipeWire. Em Wayland o sistema
  mostra o seletor de tela a cada gravação, e o atalho global depende do portal do ambiente; se ele
  não pegar, crie um atalho do sistema que rode `~/.local/bin/gravador-reunioes.AppImage --alternar`.
  O AppImage precisa do `libfuse2` (`libfuse2t64` no Ubuntu 24.04).

## Desenvolver

```bash
npm install
npm start      # roda da fonte
npm test       # testes de unidade
npm run dist   # empacota para o sistema atual em dist/
```

O pipeline (`.github/workflows/build.yml`) empacota nas três plataformas a cada push. No Windows e
no Linux ele também abre o app empacotado, grava alguns segundos e confere que o arquivo tem vídeo
e áudio (`scripts/fumaca.js`). No macOS o runner não tem como conceder a permissão de Gravação de
Tela, então lá só se confere o build.

Para publicar uma versão: suba o `version` do `package.json`, crie a tag `vX.Y.Z` e faça push dela.
O pipeline cria a release com os instaladores, e o comando de instalação passa a baixar essa versão.
