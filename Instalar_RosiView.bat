@echo off
title Instalador RosiView - IFES
cd /d "%~dp0"

echo ============================================================
echo             INSTALADOR DO ROSIVIEW - IFES
echo       Sistemas de Controle Integrado e Instrumentacao
echo ============================================================
echo.
echo  Iniciando a instalacao automatica...
echo.

set "PS1_PATH="
if exist "%~dp0scripts\instalar_aluno.ps1" set "PS1_PATH=%~dp0scripts\instalar_aluno.ps1"
if exist "%~dp0app\scripts\instalar_aluno.ps1" set "PS1_PATH=%~dp0app\scripts\instalar_aluno.ps1"

if "%PS1_PATH%"=="" (
    echo.
    echo ============================================================
    echo  [ATENCAO - ARQUIVO ZIP NAO EXTRAIDO]
    echo ============================================================
    echo  Os arquivos de instalacao nao foram encontrados nesta pasta.
    echo.
    echo  IMPORTANTE: Voce precisa EXTRAIR o arquivo ZIP antes de instalar!
    echo  1. Clique com o botao direito no arquivo 'RosiView_Instalador_Aluno.zip'
    echo  2. Selecione 'Extrair Tudo...' e confirme.
    echo  3. Abra a nova pasta extraida e clique em 'Instalar_RosiView.bat'
    echo.
    pause
    exit /b 1
)

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%PS1_PATH%"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] Ocorreu um alerta durante a instalacao - Codigo: %ERRORLEVEL%
    pause
)

exit /b 0
