# ==============================================================================
# RosiView - Instalador Automático de 1 Clique para Alunos (IFES)
# Instala em %LOCALAPPDATA%\RosiView e cria atalho na Área de Trabalho
# ==============================================================================
$ErrorActionPreference = "Stop"
$installRoot = Join-Path $env:LOCALAPPDATA "RosiView"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "             INSTALADOR DO ROSIVIEW - IFES" -ForegroundColor White
Write-Host "       Sistemas de Controle Integrado e Instrumentacao" -ForegroundColor DarkCyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " Instalando o RosiView no seu computador..." -ForegroundColor Yellow

# Determina a pasta de origem dos arquivos
$scriptDir = $PSScriptRoot
$sourceDir = (Resolve-Path (Join-Path $scriptDir "..")).Path
if (Test-Path (Join-Path $sourceDir "app")) {
    $sourceDir = Join-Path $sourceDir "app"
}

# Cria o diretório de destino
if (-not (Test-Path $installRoot)) {
    New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
}

# Itens essenciais do aplicativo
$itemsToCopy = @("assets", "css", "js", "scripts", "launcher", "RosiView.exe", "index.html", "version.json", "manifest.json", "RosiView.vbs", "INICIAR_ROSIVIEW.bat")

foreach ($item in $itemsToCopy) {
    $srcItem = Join-Path $sourceDir $item
    if (Test-Path $srcItem) {
        Copy-Item -Path $srcItem -Destination $installRoot -Recurse -Force
    }
}

Write-Host " [OK] Arquivos instalados em: $installRoot" -ForegroundColor Green

# Criação do atalho oficial na Área de Trabalho do aluno
$WshShell = New-Object -ComObject WScript.Shell
$Desktop = [System.Environment]::GetFolderPath('Desktop')
if (-not (Test-Path $Desktop)) {
    $Desktop = $WshShell.SpecialFolders.Item("Desktop")
}

$targetExe = Join-Path $installRoot "RosiView.exe"
$targetVbs = Join-Path $installRoot "RosiView.vbs"
$iconPath = Join-Path $installRoot "assets\rosiview_icon.ico"
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
$Shortcut.WorkingDirectory = $installRoot
$Shortcut.Description = "RosiView - Instrumentacao Virtual e Controle (IFES)"
$Shortcut.Save()

# Criação do atalho no Menu Iniciar do aluno
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
    $StartShortcut.WorkingDirectory = $installRoot
    $StartShortcut.Description = "RosiView - Instrumentacao Virtual e Controle (IFES)"
    $StartShortcut.Save()
}

Write-Host " [OK] Atalho nativo com icone criado na Area de Trabalho e no Menu Iniciar!" -ForegroundColor Green
Write-Host ""
Write-Host " Iniciando o RosiView pela primeira vez..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Dispara o aplicativo silenciosamente
if (Test-Path $targetExe) {
    Start-Process -FilePath $targetExe -WorkingDirectory $installRoot
} else {
    Start-Process "$env:SystemRoot\System32\wscript.exe" -ArgumentList "`"$targetVbs`"" -WorkingDirectory $installRoot
}

Start-Sleep -Seconds 2
