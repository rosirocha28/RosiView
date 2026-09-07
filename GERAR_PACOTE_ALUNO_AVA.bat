@echo off
title Gerador de Pacote AVA - RosiView (IFES)
cd /d "%~dp0"

echo ============================================================
echo      GERADOR DE PACOTE DE DISTRIBUICAO PARA O AVA
echo             RosiView - IFES Serra
echo ============================================================
echo.

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\gerar_pacote_aluno_ava.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] Ocorreu um erro durante a geracao do pacote - Codigo: %ERRORLEVEL%
)

echo.
pause
