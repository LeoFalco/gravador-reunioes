#!/usr/bin/env bash
# Instala ou atualiza o Gravador de Reuniões no macOS e no Linux.
# curl -fsSL https://raw.githubusercontent.com/LeoFalco/gravador-reunioes/main/instalar.sh | bash
set -euo pipefail

base="https://github.com/LeoFalco/gravador-reunioes/releases/latest/download"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

case "$(uname -s)" in
  Darwin)
    arch="$([ "$(uname -m)" = arm64 ] && echo arm64 || echo x64)"
    echo "Baixando para macOS ($arch)..."
    curl -fL# "$base/gravador-reunioes-mac-$arch.zip" -o "$tmp/app.zip"
    ditto -x -k "$tmp/app.zip" "$tmp"
    destino="/Applications"
    [ -w "$destino" ] || destino="$HOME/Applications"
    mkdir -p "$destino"
    osascript -e 'quit app "Gravador de Reunioes"' 2>/dev/null || true
    rm -rf "$destino/Gravador de Reunioes.app"
    mv "$tmp/Gravador de Reunioes.app" "$destino/"
    # O app não é assinado pela Apple: tira a quarentena e assina localmente (ad-hoc) para o Mac abrir.
    xattr -cr "$destino/Gravador de Reunioes.app"
    codesign --force --deep -s - "$destino/Gravador de Reunioes.app" 2>/dev/null
    open "$destino/Gravador de Reunioes.app"
    echo "Instalado em $destino. Na primeira gravação, autorize Gravação de Tela e Microfone em Ajustes do Sistema > Privacidade."
    ;;
  Linux)
    echo "Baixando para Linux..."
    mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications"
    curl -fL# "$base/gravador-reunioes-linux-x86_64.AppImage" -o "$tmp/app"
    pkill -f gravador-reunioes.AppImage 2>/dev/null || true
    install -m 755 "$tmp/app" "$HOME/.local/bin/gravador-reunioes.AppImage"
    cat > "$HOME/.local/share/applications/gravador-reunioes.desktop" <<EOF
[Desktop Entry]
Name=Gravador de Reuniões
Exec=$HOME/.local/bin/gravador-reunioes.AppImage
Type=Application
Categories=AudioVideo;
EOF
    nohup "$HOME/.local/bin/gravador-reunioes.AppImage" >/dev/null 2>&1 &
    echo "Instalado em ~/.local/bin. Precisa de libfuse2 para rodar AppImage (sudo apt install libfuse2)."
    ;;
  *) echo "Sistema não suportado; no Windows use o comando do PowerShell do README." >&2; exit 1 ;;
esac
