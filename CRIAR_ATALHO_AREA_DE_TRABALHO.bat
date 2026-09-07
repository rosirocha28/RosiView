@echo off
title Criar Atalho RosiView
cls
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\criar_atalho.ps1"
pause
