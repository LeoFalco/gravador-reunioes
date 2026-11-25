# Instala ou atualiza o Gravador de Reuniões no Windows.
# irm https://raw.githubusercontent.com/LeoFalco/gravador-reunioes/main/instalar.ps1 | iex
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$instalador = Join-Path $env:TEMP 'gravador-reunioes-setup.exe'
Write-Host 'Baixando para Windows...'
Invoke-WebRequest 'https://github.com/LeoFalco/gravador-reunioes/releases/latest/download/gravador-reunioes-win-x64.exe' -OutFile $instalador
Get-Process 'Gravador de Reunioes' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Process $instalador -ArgumentList '/S' -Wait
Remove-Item $instalador
Start-Process (Join-Path $env:LOCALAPPDATA 'Programs\gravador-reunioes\Gravador de Reunioes.exe')
Write-Host 'Instalado. O ícone fica na bandeja, perto do relógio.'
