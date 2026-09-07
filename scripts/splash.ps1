# ==============================================================================
# RosiView - Tela de Apresentacao (Splash Screen) e Verificador de Atualizacao
# IFES - Sistemas de Controle Integrado
# ==============================================================================
$ProgressPreference = "SilentlyContinue"
$ErrorActionPreference = "SilentlyContinue"

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$localVerPath = Join-Path $projectRoot "version.json"
$localVer = "v0.1"

if (Test-Path $localVerPath) {
    try {
        $localVer = (Get-Content $localVerPath -Raw | ConvertFrom-Json).version
    } catch {}
}

# Definicao XAML da Splash Screen com Icone Ampliado e em Destaque Central
$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="RosiView"
        Width="480" Height="335"
        WindowStartupLocation="CenterScreen"
        WindowStyle="None"
        AllowsTransparency="True"
        Background="Transparent"
        ShowInTaskbar="False"
        Topmost="True">
    <Border CornerRadius="16" Background="#0d1117" BorderBrush="#0284c7" BorderThickness="1.5" Margin="8">
        <Border.Effect>
            <DropShadowEffect Color="#000000" BlurRadius="26" ShadowDepth="4" Opacity="0.85"/>
        </Border.Effect>
        <Grid Margin="24">
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="*"/>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="Auto"/>
            </Grid.RowDefinitions>
            
            <!-- Icone com Destaque Central e Moldura Suave com Brilho -->
            <Border Grid.Row="0" Width="108" Height="108" CornerRadius="22" Background="#131924" BorderBrush="#0284c7" BorderThickness="2" HorizontalAlignment="Center" Margin="0,4,0,14">
                <Border.Effect>
                    <DropShadowEffect Color="#0284c7" BlurRadius="22" ShadowDepth="0" Opacity="0.5"/>
                </Border.Effect>
                <Image x:Name="LogoImage" Width="92" Height="92" HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>

            <!-- Titulo do App -->
            <TextBlock Grid.Row="1" Text="RosiView" FontSize="32" FontWeight="Bold" Foreground="#f8fafc" HorizontalAlignment="Center" FontFamily="Segoe UI"/>

            <!-- Subtitulo IFES -->
            <TextBlock Grid.Row="2" Text="IFES | Sistemas de Controle Integrado" FontSize="12" Foreground="#38bdf8" FontWeight="SemiBold" HorizontalAlignment="Center" FontFamily="Segoe UI" Margin="0,4,0,16"/>

            <!-- Barra de Progresso Discreta -->
            <ProgressBar x:Name="PBar" Grid.Row="4" Height="3.5" IsIndeterminate="True" Margin="20,0,20,10"
                         Background="#161b22" Foreground="#0284c7" BorderThickness="0"/>

            <!-- Mensagem de Status Inferior -->
            <TextBlock x:Name="StatusText" Grid.Row="5" Text="Iniciando RosiView..."
                       FontSize="11" Foreground="#94a3b8" HorizontalAlignment="Center" FontFamily="Segoe UI"/>
        </Grid>
    </Border>
</Window>
"@

$app = New-Object System.Windows.Application
$window = [System.Windows.Markup.XamlReader]::Parse($xaml)
$status = $window.FindName("StatusText")
$logoImg = $window.FindName("LogoImage")

# Carrega o icone oficial sem bloquear o arquivo
$iconPath = Join-Path $projectRoot "assets\rosiview_icon.png"
if (Test-Path $iconPath) {
    try {
        $bitmap = New-Object System.Windows.Media.Imaging.BitmapImage
        $bitmap.BeginInit()
        $bitmap.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
        $bitmap.UriSource = New-Object System.Uri($iconPath)
        $bitmap.EndInit()
        $logoImg.Source = $bitmap
    } catch {}
}

$state = 0
$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds(100)

$timer.add_Tick({
    $script:state++
    
    if ($script:state -eq 1) {
        $status.Text = "Verificando atualizações no GitHub..."
        $timer.Interval = [TimeSpan]::FromMilliseconds(100)
    } elseif ($script:state -eq 2) {
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
            # Sem internet ou timeout -> modo offline
        }

        if ($needsUpdate -and $remoteVer) {
            $status.Text = "Nova versão ($remoteVer) encontrada! Baixando atualização..."
            $zipUrl = "https://github.com/rosirocha28/RosiView/archive/refs/heads/main.zip"
            $tempZip = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "rosiview_auto_update.zip")
            $tempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "rosiview_auto_" + [System.Guid]::NewGuid().ToString())
            
            try {
                Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing -TimeoutSec 25
                Expand-Archive -Path $tempZip -DestinationPath $tempDir -Force
                $src = Join-Path $tempDir "RosiView-main"
                if (-not (Test-Path $src)) {
                    $src = (Get-ChildItem $tempDir | Select-Object -First 1).FullName
                }
                
                # Atualiza os arquivos ignorando gabaritos_professor se existir
                Get-ChildItem -Path $src -Exclude "gabaritos_professor" | ForEach-Object {
                    Copy-Item -Path $_.FullName -Destination $projectRoot -Recurse -Force
                }
                
                Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue
                Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
                $status.Text = "Atualizado para $remoteVer com sucesso! Abrindo..."
            } catch {
                $status.Text = "Abrindo versão local do RosiView..."
            }
        } else {
            if ($remoteVer) {
                $status.Text = "RosiView $localVer atualizado. Abrindo aplicativo..."
            } else {
                $status.Text = "Modo offline ($localVer). Abrindo aplicativo..."
            }
        }
        
        $timer.Interval = [TimeSpan]::FromMilliseconds(650)
    } elseif ($script:state -ge 3) {
        $timer.Stop()
        $window.Close()
        
        # Abre o aplicativo no modo Desktop / Janela de Aplicativo
        $indexHtml = Join-Path $projectRoot "index.html"
        $fileUri = [System.Uri]::new($indexHtml).AbsoluteUri

        # Detecta navegadores Chromium para abrir em modo App dedicado
        $browserCandidates = @(
            "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
            "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
            "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
            "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
            "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
        )

        $appBrowser = $null
        foreach ($b in $browserCandidates) {
            if (Test-Path $b) {
                $appBrowser = $b
                break
            }
        }

        if ($appBrowser) {
            $profileDir = Join-Path $env:LOCALAPPDATA "RosiView\profile"
            Start-Process -FilePath $appBrowser -ArgumentList "--app=`"$fileUri`" --user-data-dir=`"$profileDir`" --no-first-run --no-default-browser-check"
        } else {
            Start-Process $indexHtml
        }
    }
})

$window.Add_Loaded({
    $timer.Start()
})

$app.Run($window) | Out-Null
