@echo off
title RosiView
if exist "%~dp0RosiView.exe" (
    start "" "%~dp0RosiView.exe"
) else (
    start "" wscript.exe "%~dp0RosiView.vbs"
)
exit
