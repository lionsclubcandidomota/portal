@echo off
setlocal
cd /d "%~dp0"

echo Preparando a atualizacao do Portal...

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao foi encontrado. Instale o Node.js e tente novamente.
  pause
  exit /b 1
)

if not exist "data\dados.json" (
  echo O arquivo data\dados.json nao foi encontrado. A atualizacao foi interrompida.
  pause
  exit /b 1
)

if not exist "data\modelo.json" (
  echo O arquivo data\modelo.json nao foi encontrado. A atualizacao foi interrompida.
  pause
  exit /b 1
)

echo Limpando arquivos antigos conhecidos...
if exist "assets\css\legacy" rmdir /s /q "assets\css\legacy"
if exist "assets\css\components\clean-ui.css" del /q "assets\css\components\clean-ui.css"
if exist "assets\css\components\structured-content.css" del /q "assets\css\components\structured-content.css"
for %%F in (
  admin-dashboard-v5.8.css agenda-v4.css audit-v4.css base-v4.css components-v4.css
  improvements-v5.css interface-v5.9.css layout-v4.css markdown-v4.css refinement-v5.6.css
  responsive-v4.css styles.css v35.css
) do if exist "assets\css\%%F" del /q "assets\css\%%F"
if exist "assets\templates\birthday-template.png" del /q "assets\templates\birthday-template.png"
if exist "assets\js\modules\treasury.js" del /q "assets\js\modules\treasury.js"
if exist "assets\js\modules\treasury-admin\categories.js" del /q "assets\js\modules\treasury-admin\categories.js"

call npm run release:prepare
if errorlevel 1 goto :erro

echo.
echo Atualizacao 6.36.0 concluida e validada.
echo Uma copia dos dados anteriores foi salva em .portal-backups.
pause
exit /b 0

:erro
echo.
echo A atualizacao foi interrompida porque uma validacao falhou.
echo Consulte as mensagens acima. Os dados anteriores permanecem em .portal-backups quando o backup foi concluido.
pause
exit /b 1
