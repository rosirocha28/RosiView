$ProgressPreference = "SilentlyContinue"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$localVerPath = Join-Path $projectRoot "version.json"
$localVer = "v0.0"

if (Test-Path $localVerPath) {
    try {
        $localVer = (Get-Content $localVerPath -Raw | ConvertFrom-Json).version
    } catch {}
}

# Se for instalacao de aluno/desktop (sem repositorio .git), remove pastas indevidas como 'android'
$gitDir = Join-Path $projectRoot ".git"
if (-not (Test-Path $gitDir)) {
    $cleanupFolders = @("android", "gabaritos_professor", "dist_ava")
    foreach ($fld in $cleanupFolders) {
        $targetFld = Join-Path $projectRoot $fld
        if (Test-Path $targetFld) {
            Remove-Item -Path $targetFld -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

$remoteVerUrl = "https://raw.githubusercontent.com/rosirocha28/RosiView/main/version.json"
$needsUpdate = $false
$remoteVer = $null

try {
    $req = [System.Net.WebRequest]::Create($remoteVerUrl)
    $req.Timeout = 2500
    $resp = $req.GetResponse()
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $remoteJson = $reader.ReadToEnd() | ConvertFrom-Json
    $reader.Close()
    $resp.Close()
    $remoteVer = $remoteJson.version

    $parseV = { param($v) ($v -replace '^v','').Split('.') | ForEach-Object { [int]$_ } }
    $rParts = &$parseV $remoteVer
    $lParts = &$parseV $localVer

    for ($i = 0; $i -lt [Math]::Max($rParts.Length, $lParts.Length); $i++) {
        $r = if ($i -lt $rParts.Length) { $rParts[$i] } else { 0 }
        $l = if ($i -lt $lParts.Length) { $lParts[$i] } else { 0 }
        if ($r -gt $l) { $needsUpdate = $true; break }
        if ($r -lt $l) { break }
    }
} catch {
    # Sem conexao ou timeout: continua offline normalmente
}

if ($needsUpdate -and $remoteVer) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " [ATUALIZACAO] Nova versao detectada no GitHub: $remoteVer" -ForegroundColor Yellow
    Write-Host " Versao atual: $localVer" -ForegroundColor Gray
    Write-Host " Baixando e instalando atualizacao automatica..." -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""

    $zipUrl = "https://github.com/rosirocha28/RosiView/archive/refs/heads/main.zip"
    $tempZip = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "rosiview_auto_update.zip")
    $tempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "rosiview_auto_" + [System.Guid]::NewGuid().ToString())

    try {
        Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing -TimeoutSec 20
        Expand-Archive -Path $tempZip -DestinationPath $tempDir -Force
        $src = Join-Path $tempDir "RosiView-main"
        if (-not (Test-Path $src)) {
            $src = (Get-ChildItem $tempDir | Select-Object -First 1).FullName
        }
        # Atualiza apenas os arquivos essenciais do Desktop, excluindo Android, gabaritos e pastas de dev
        $excludeItems = @("android", "gabaritos_professor", "dist_ava", ".git", ".github", ".agents", ".gemini", ".vscode")
        Get-ChildItem -Path $src | Where-Object { $excludeItems -notcontains $_.Name -and $_.Name -notmatch '^\.' } | ForEach-Object {
            Copy-Item -Path $_.FullName -Destination $projectRoot -Recurse -Force
        }

        # Garante que a pasta android nao permaneca em instalacoes de aluno (sem .git)
        if (-not (Test-Path (Join-Path $projectRoot ".git")) -and (Test-Path (Join-Path $projectRoot "android"))) {
            Remove-Item -Path (Join-Path $projectRoot "android") -Recurse -Force -ErrorAction SilentlyContinue
        }
        Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host ">>> [OK] RosiView atualizado com sucesso para $remoteVer! <<<" -ForegroundColor Green
        Start-Sleep -Milliseconds 700
    } catch {
        Write-Host "Nao foi possivel concluir a atualizacao automatica agora: $_" -ForegroundColor Yellow
        Write-Host "Abrindo versao local..." -ForegroundColor Gray
        Start-Sleep -Milliseconds 700
    }
} else {
    Write-Host "RosiView $localVer verificado. Abrindo aplicativo..." -ForegroundColor Gray
}

# Abre o aplicativo no navegador padrao
$indexHtml = Join-Path $projectRoot "index.html"
Start-Process $indexHtml
