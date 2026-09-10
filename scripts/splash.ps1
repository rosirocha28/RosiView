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
$localVer = "v0.4.1"

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

# Definicao XAML da Splash Screen com Design Moderno e Caixa de Logs Formatada
$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="RosiView"
        Width="490" Height="340"
        WindowStartupLocation="CenterScreen"
        WindowStyle="None"
        AllowsTransparency="True"
        Background="Transparent"
        ShowInTaskbar="False"
        Topmost="True">
    <Border CornerRadius="18" Background="#0b0f17" BorderBrush="#0284c7" BorderThickness="1.5" Margin="10">
        <Border.Effect>
            <DropShadowEffect Color="#000000" BlurRadius="28" ShadowDepth="4" Opacity="0.9"/>
        </Border.Effect>
        <Grid Margin="24,20,24,20">
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="Auto"/>
            </Grid.RowDefinitions>
            
            <!-- Icone com Destaque Central e Moldura Suave com Brilho -->
            <Border Grid.Row="0" Width="96" Height="96" CornerRadius="20" Background="#131c2e" BorderBrush="#0284c7" BorderThickness="1.5" HorizontalAlignment="Center" Margin="0,2,0,12">
                <Border.Effect>
                    <DropShadowEffect Color="#0284c7" BlurRadius="20" ShadowDepth="0" Opacity="0.55"/>
                </Border.Effect>
                <Image x:Name="LogoImage" Width="82" Height="82" HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>

            <!-- Titulo do App com Badge de Versao -->
            <StackPanel Grid.Row="1" Orientation="Horizontal" HorizontalAlignment="Center" VerticalAlignment="Center">
                <TextBlock Text="RosiView" FontSize="30" FontWeight="Bold" Foreground="#f8fafc" FontFamily="Segoe UI"/>
                <Border Background="#0369a1" CornerRadius="6" Padding="6,2" Margin="10,2,0,0" VerticalAlignment="Center">
                    <TextBlock x:Name="VerBadge" Text="v0.4.0" FontSize="11" FontWeight="Bold" Foreground="#e0f2fe" FontFamily="Segoe UI"/>
                </Border>
            </StackPanel>

            <!-- Subtitulo IFES -->
            <TextBlock Grid.Row="2" Text="IFES • Sistemas de Controle Integrado" FontSize="12" Foreground="#38bdf8" FontWeight="SemiBold" HorizontalAlignment="Center" FontFamily="Segoe UI" Margin="0,4,0,16"/>

            <!-- Barra de Progresso Elegante -->
            <ProgressBar x:Name="PBar" Grid.Row="3" Height="4" IsIndeterminate="True" Margin="16,0,16,14"
                         Background="#161e2e" Foreground="#38bdf8" BorderThickness="0"/>

            <!-- Caixa de Logs / Status Formatada (Estilo Terminal / Status Card) -->
            <Border Grid.Row="4" Background="#111827" BorderBrush="#1f2937" BorderThickness="1" CornerRadius="8" Padding="14,8" HorizontalAlignment="Stretch" Margin="8,0,8,0">
                <Grid>
                    <Grid.ColumnDefinitions>
                        <ColumnDefinition Width="Auto"/>
                        <ColumnDefinition Width="*"/>
                    </Grid.ColumnDefinitions>
                    
                    <!-- Indicador luminoso de status -->
                    <Ellipse x:Name="StatusDot" Grid.Column="0" Width="7" Height="7" Fill="#38bdf8" VerticalAlignment="Center" Margin="0,0,10,0">
                        <Ellipse.Effect>
                            <DropShadowEffect x:Name="StatusDotGlow" Color="#38bdf8" BlurRadius="6" ShadowDepth="0" Opacity="0.85"/>
                        </Ellipse.Effect>
                    </Ellipse>
                    
                    <!-- Texto do Log / Status -->
                    <TextBlock x:Name="StatusText" Grid.Column="1" Text="Iniciando RosiView..."
                               FontSize="11.5" FontWeight="Medium" Foreground="#e2e8f0" FontFamily="Segoe UI"
                               TextTrimming="CharacterEllipsis" VerticalAlignment="Center"/>
                </Grid>
            </Border>
        </Grid>
    </Border>
</Window>
"@

$app = New-Object System.Windows.Application
$window = [System.Windows.Markup.XamlReader]::Parse($xaml)
$status = $window.FindName("StatusText")
$logoImg = $window.FindName("LogoImage")
$verBadge = $window.FindName("VerBadge")
$statusDot = $window.FindName("StatusDot")
$statusDotGlow = $window.FindName("StatusDotGlow")

if ($verBadge) {
    $verBadge.Text = $localVer
}

$brushConverter = New-Object System.Windows.Media.BrushConverter

function Set-SplashStatus {
    param(
        [string]$Message,
        [string]$ColorHex = "#38bdf8"
    )
    if ($status) { $status.Text = $Message }
    if ($statusDot) {
        $statusDot.Fill = $brushConverter.ConvertFromString($ColorHex)
    }
    if ($statusDotGlow) {
        $statusDotGlow.Color = [System.Windows.Media.ColorConverter]::ConvertFromString($ColorHex)
    }
}

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
        Set-SplashStatus "Verificando atualizações no GitHub..." "#38bdf8"
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
            Set-SplashStatus "Nova versão ($remoteVer) encontrada! Baixando atualização..." "#f59e0b"
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
                Set-SplashStatus "Atualizado para $remoteVer com sucesso! Abrindo..." "#22c55e"
            } catch {
                Set-SplashStatus "Abrindo versão local do RosiView..." "#94a3b8"
            }
        } else {
            if ($remoteVer) {
                Set-SplashStatus "RosiView $localVer atualizado • Abrindo aplicativo..." "#22c55e"
            } else {
                Set-SplashStatus "Modo offline ($localVer) • Abrindo aplicativo..." "#38bdf8"
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
