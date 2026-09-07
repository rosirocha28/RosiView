$ErrorActionPreference = "Stop"
try {
    $WshShell = New-Object -ComObject WScript.Shell
    $Desktop = [System.Environment]::GetFolderPath('Desktop')
    
    # Suporte ao OneDrive Desktop se estiver ativo
    if (-not (Test-Path $Desktop)) {
        $Desktop = $WshShell.SpecialFolders.Item("Desktop")
    }

    $projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $targetExe = Join-Path $projectRoot "RosiView.exe"
    $targetVbs = Join-Path $projectRoot "RosiView.vbs"
    $iconPath = Join-Path $projectRoot "assets\rosiview_icon.ico"
    $shortcutPath = Join-Path $Desktop "RosiView.lnk"

    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    if (Test-Path $targetExe) {
        $Shortcut.TargetPath = $targetExe
        $Shortcut.Arguments = ""
        $Shortcut.IconLocation = "$targetExe,0"
    } else {
        $Shortcut.TargetPath = "$env:SystemRoot\System32\wscript.exe"
        $Shortcut.Arguments = "`"$targetVbs`""
        if (Test-Path $iconPath) {
            $Shortcut.IconLocation = "$iconPath,0"
        }
    }
    $Shortcut.WorkingDirectory = $projectRoot
    $Shortcut.Description = "RosiView - Instrumentacao Virtual e Controle (IFES)"
    $Shortcut.Save()

    # Cria também no Menu Iniciar para poder fixar em Iniciar ou na Barra de Tarefas
    $programsFolder = [System.Environment]::GetFolderPath('Programs')
    if (Test-Path $programsFolder) {
        $startShortcutPath = Join-Path $programsFolder "RosiView.lnk"
        $StartShortcut = $WshShell.CreateShortcut($startShortcutPath)
        if (Test-Path $targetExe) {
            $StartShortcut.TargetPath = $targetExe
            $StartShortcut.Arguments = ""
            $StartShortcut.IconLocation = "$targetExe,0"
        } else {
            $StartShortcut.TargetPath = "$env:SystemRoot\System32\wscript.exe"
            $StartShortcut.Arguments = "`"$targetVbs`""
            if (Test-Path $iconPath) {
                $StartShortcut.IconLocation = "$iconPath,0"
            }
        }
        $StartShortcut.WorkingDirectory = $projectRoot
        $StartShortcut.Description = "RosiView - Instrumentacao Virtual e Controle (IFES)"
        $StartShortcut.Save()
    }

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " [OK] Atalho criado com sucesso na Area de Trabalho!" -ForegroundColor Green
    Write-Host " Local: $shortcutPath" -ForegroundColor Gray
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host "Erro ao criar atalho: $_" -ForegroundColor Red
}
