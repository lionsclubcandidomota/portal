@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao foi encontrado. Instale o Node.js e tente novamente.
  pause
  exit /b 1
)
node tools\homologation-server.mjs --open
if errorlevel 1 (
  echo.
  echo Nao foi possivel iniciar a homologacao.
  pause
  exit /b 1
)
endlocal
