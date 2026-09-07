' ==============================================================================
' RosiView - Inicializador Silencioso em Background (Zero Terminal Preto)
' IFES - Sistemas de Controle Integrado
' ==============================================================================
Option Explicit

Dim WshShell, fso, scriptDir, splashScript, cmd

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
splashScript = scriptDir & "\scripts\splash.ps1"

' Executa o PowerShell com janela completamente oculta (WindowStyle 0 = Oculto)
' O parâmetro False indica que o VBScript encerra imediatamente sem travar
cmd = "powershell.exe -STA -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & splashScript & """"
WshShell.Run cmd, 0, False
