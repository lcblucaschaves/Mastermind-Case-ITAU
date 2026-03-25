# Script para configurar e executar o projeto Mastermind (Backend FastAPI + Frontend Angular)

Write-Host "Iniciando configuracao do projeto Mastermind..." -ForegroundColor Green

# Definir caminhos absolutos
$rootPath = Get-Location # .\mastermind
$backendPath = Join-Path $rootPath "backend" # .\mastermind\backend
$frontendPath = Join-Path $rootPath "frontend" # .\mastermind\frontend
$backendPython = Join-Path $backendPath "Scripts\python.exe"
$backendRequirements = Join-Path $backendPath "requirements.txt"

# 1. Configurar Backend (FastAPI)
Write-Host "`nConfigurando Backend..." -ForegroundColor Yellow

# Criar ambiente virtual se não existir
if (-not (Test-Path "backend/Scripts")) {
    Write-Host "Criando ambiente virtual Python..."
    python -m venv backend
}

# Instalar dependências no ambiente virtual do backend
Write-Host "Instalando dependencias do backend..."
& $backendPython -m pip install -q -r $backendRequirements

# 2. Configurar Frontend (Angular)
Write-Host "Configurando Frontend..." -ForegroundColor Yellow

Set-Location $frontendPath

Write-Host "Instalando dependencias Angular..."
npm install --silent 2>$null

# 3. Executar servidores em janelas separadas
Write-Host "`nIniciando servidores..." -ForegroundColor Green

# Iniciar FastAPI em nova janela PowerShell
Write-Host "Abrindo FastAPI em nova janela..."
$backendCmd = "cd '$backendPath'; & '$backendPython' -m uvicorn controller.controller:app --reload --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# Aguardar um pouco
Start-Sleep -Seconds 2

# Iniciar Angular em nova janela PowerShell
Write-Host "Abrindo Angular em nova janela..."
$frontendCmd = "cd '$frontendPath'; ng serve --host 0.0.0.0 --port 4200"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host "`nServidores iniciados em janelas separadas!" -ForegroundColor Green
Write-Host "FastAPI: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Angular: http://localhost:4200" -ForegroundColor Cyan
Write-Host "`nAs janelas do PowerShell permanecerao abertas. Feche-as para parar os servidores." -ForegroundColor Yellow
