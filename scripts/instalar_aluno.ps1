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

# Determina a pasta de origem dos arquivos localizando onde está o RosiView.exe
$scriptDir = $PSScriptRoot
$sourceDir = $null

$possibleDirs = @(
    (Join-Path $scriptDir "..\app"),
    (Join-Path $scriptDir ".."),
    (Join-Path $scriptDir "app"),
    $scriptDir
)

foreach ($d in $possibleDirs) {
    if (Test-Path (Join-Path $d "RosiView.exe")) {
        try {
            $sourceDir = (Resolve-Path $d).Path
            break
        } catch {}
    }
}

if (-not $sourceDir) {
    $sourceDir = (Resolve-Path (Join-Path $scriptDir "..")).Path
}

# Cria o diretório de destino no perfil do usuário
if (-not (Test-Path $installRoot)) {
    New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
}

# Itens essenciais do aplicativo
$itemsToCopy = @("assets", "css", "js", "scripts", "docs", "launcher", "RosiView.exe", "index.html", "version.json", "manifest.json", "RosiView.vbs", "INICIAR_ROSIVIEW.bat")

foreach ($item in $itemsToCopy) {
    $srcItem = Join-Path $sourceDir $item
    if (Test-Path $srcItem) {
        Copy-Item -Path $srcItem -Destination $installRoot -Recurse -Force
    }
}

Write-Host " [OK] Arquivos instalados em: $installRoot" -ForegroundColor Green

$targetExe = Join-Path $installRoot "RosiView.exe"
$targetVbs = Join-Path $installRoot "RosiView.vbs"
$iconPath = Join-Path $installRoot "assets\rosiview_icon.ico"

# Criação do atalho oficial na Área de Trabalho do aluno
try {
    $WshShell = New-Object -ComObject WScript.Shell
    $Desktop = [System.Environment]::GetFolderPath('Desktop')
    if (-not (Test-Path $Desktop)) {
        $Desktop = $WshShell.SpecialFolders.Item("Desktop")
    }
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
    Write-Host " [OK] Atalho na Area de Trabalho criado com sucesso!" -ForegroundColor Green
} catch {
    Write-Warning "Nao foi possivel criar o atalho na Area de Trabalho: $_"
}

# Criação do atalho no Menu Iniciar do aluno
try {
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
        Write-Host " [OK] Atalho no Menu Iniciar criado com sucesso!" -ForegroundColor Green
    }
} catch {
    Write-Warning "Nao foi possivel criar o atalho no Menu Iniciar: $_"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " [SUCESSO] RosiView instalado com sucesso!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Iniciando o RosiView..." -ForegroundColor Cyan

# Dispara o aplicativo
if (Test-Path $targetExe) {
    Start-Process -FilePath $targetExe -WorkingDirectory $installRoot
} else {
    Start-Process "$env:SystemRoot\System32\wscript.exe" -ArgumentList "`"$targetVbs`"" -WorkingDirectory $installRoot
}

Start-Sleep -Seconds 3
