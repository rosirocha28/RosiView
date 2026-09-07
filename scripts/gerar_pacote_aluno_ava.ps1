# ==============================================================================
# RosiView - Gerador de Pacote para o AVA (Moodle) - Exclusivo do Professor
# Empacota apenas os arquivos públicos dos alunos em um arquivo ZIP limpo
# ==============================================================================
$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
$projectRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path

# 1. Lê a versão atual
$verJsonPath = Join-Path $projectRoot "version.json"
$version = "v0.0"
if (Test-Path $verJsonPath) {
    try {
        $version = (Get-Content $verJsonPath -Raw | ConvertFrom-Json).version
    } catch {}
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "     GERADOR DE PACOTE DE DISTRIBUICAO PARA ALUNOS (AVA)" -ForegroundColor White
Write-Host "     RosiView Versao: $version" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 2. Prepara pastas
$distDir = Join-Path $projectRoot "dist_ava"
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

$zipFileName = "RosiView_Instalador_Aluno.zip"
$outZipPath = Join-Path $distDir $zipFileName

if (Test-Path $outZipPath) {
    Remove-Item -Path $outZipPath -Force
}

$tempStaging = Join-Path ([System.IO.Path]::GetTempPath()) ("rosiview_pkg_" + [System.Guid]::NewGuid().ToString())
$stagingApp = Join-Path $tempStaging "app"
New-Item -ItemType Directory -Path $stagingApp -Force | Out-Null

Write-Host "-> Copiando arquivos essenciais para o pacote do aluno..." -ForegroundColor Yellow

# Copia instalador e guia na raiz do pacote
Copy-Item (Join-Path $projectRoot "Instalar_RosiView.bat") -Destination $tempStaging
Copy-Item (Join-Path $projectRoot "LEIA-ME_ALUNO.txt") -Destination $tempStaging

# Copia manual do aluno em PDF na raiz do pacote e dentro da pasta app/docs
$manualPdf = Join-Path $projectRoot "docs\manual_aluno\manual_rosiview_aluno.pdf"
if (Test-Path $manualPdf) {
    Copy-Item $manualPdf -Destination (Join-Path $tempStaging "Manual_RosiView_Aluno.pdf")
    $dstManualDir = Join-Path $stagingApp "docs\manual_aluno"
    New-Item -ItemType Directory -Path $dstManualDir -Force | Out-Null
    Copy-Item $manualPdf -Destination (Join-Path $dstManualDir "manual_rosiview_aluno.pdf")
    Copy-Item $manualPdf -Destination (Join-Path $stagingApp "docs\Manual_RosiView_Aluno.pdf")
}

# Copia arquivos do app para subpasta app
$appFiles = @("index.html", "version.json", "manifest.json", "RosiView.exe", "RosiView.vbs", "INICIAR_ROSIVIEW.bat", "CRIAR_ATALHO_AREA_DE_TRABALHO.bat")
foreach ($f in $appFiles) {
    $src = Join-Path $projectRoot $f
    if (Test-Path $src) {
        Copy-Item $src -Destination $stagingApp
    }
}

# Copia pastas de recursos
$appFolders = @("assets", "css", "js")
foreach ($fld in $appFolders) {
    $src = Join-Path $projectRoot $fld
    if (Test-Path $src) {
        Copy-Item $src -Destination (Join-Path $stagingApp $fld) -Recurse -Force
    }
}


# Copia pasta scripts (apenas scripts operacionais do aluno, ignorando o gerador)
$srcScripts = Join-Path $projectRoot "scripts"
$dstScripts = Join-Path $stagingApp "scripts"
$rootScripts = Join-Path $tempStaging "scripts"
New-Item -ItemType Directory -Path $dstScripts -Force | Out-Null
New-Item -ItemType Directory -Path $rootScripts -Force | Out-Null

$officialScripts = @("splash.ps1", "criar_atalho.ps1", "iniciar.ps1", "instalar_aluno.ps1")
foreach ($s in $officialScripts) {
    $srcFile = Join-Path $srcScripts $s
    if (Test-Path $srcFile) {
        Copy-Item $srcFile -Destination $dstScripts
    }
}
# Copia também instalar_aluno.ps1 para raiz/scripts para redundância absoluta
Copy-Item (Join-Path $srcScripts "instalar_aluno.ps1") -Destination $rootScripts -Force

# Verificação estrita de segurança: garantir que nenhum gabarito foi copiado
$gabaritoCheck = Get-ChildItem -Path $tempStaging -Recurse -Filter "*gabarito*" -ErrorAction SilentlyContinue
if ($gabaritoCheck) {
    Remove-Item -Path $tempStaging -Recurse -Force
    throw "ERRO DE SEGURANCA: Arquivo confidencial detectado no pacote do aluno!"
}

Write-Host "-> Compactando pacote em arquivo ZIP..." -ForegroundColor Yellow
Compress-Archive -Path (Join-Path $tempStaging "*") -DestinationPath $outZipPath -Force

# Remove pasta temporária
Remove-Item -Path $tempStaging -Recurse -Force -ErrorAction SilentlyContinue

$zipItem = Get-Item $outZipPath
$sizeMB = [math]::Round($zipItem.Length / 1MB, 2)

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " [SUCESSO] Pacote gerado com sucesso para upload no AVA!" -ForegroundColor Green
Write-Host " Arquivo: $outZipPath" -ForegroundColor White
Write-Host " Tamanho: $sizeMB MB" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Instrucoes para disponibilizar no AVA:" -ForegroundColor Cyan
Write-Host " 1. Entre na disciplina no AVA / Moodle."
Write-Host " 2. Adicione uma atividade do tipo 'Arquivo' ou 'Rotulo'."
Write-Host " 3. Faca upload deste arquivo: $zipFileName"
Write-Host " 4. Os alunos so precisam baixar, extrair e clicar em 'Instalar_RosiView.bat'."
Write-Host ""
