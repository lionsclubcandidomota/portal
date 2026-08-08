@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao foi encontrado. Instale o Node.js e tente novamente.
  pause
  exit /b 1
)

echo Verificando integridade do Portal antes da homologacao...
call npm run audit:integrated
if errorlevel 1 (
  echo.
  echo A homologacao nao foi iniciada porque a verificacao integrada encontrou problemas.
  pause
  exit /b 1
)

echo.
echo Abrindo o Portal para revisao manual...
node tools\homologation-server.mjs --open
if errorlevel 1 (
  echo.
  echo Nao foi possivel iniciar a homologacao.
  pause
  exit /b 1
)
endlocal
