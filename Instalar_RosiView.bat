@echo off
title Instalador RosiView - IFES
cls
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\instalar_aluno.ps1"
exit
