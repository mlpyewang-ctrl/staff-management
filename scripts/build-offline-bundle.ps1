param(
  [string]$BundleDir = ".offline-bundle",
  [string]$AppImage = "staff-management-app:offline"
)

$ErrorActionPreference = 'Stop'

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "command not found: $Name"
  }
}

Require-Command docker

$root = Split-Path -Parent $PSScriptRoot
$bundlePath = Join-Path $root $BundleDir
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$target = Join-Path $bundlePath $timestamp
$imagesDir = Join-Path $target 'images'
$scriptsDir = Join-Path $target 'scripts'

New-Item -ItemType Directory -Force -Path $imagesDir | Out-Null
New-Item -ItemType Directory -Force -Path $scriptsDir | Out-Null

Write-Host "[1/3] build app image: $AppImage"
docker build -t $AppImage $root

Write-Host "[2/3] save app image"
docker save -o (Join-Path $imagesDir 'app-image.tar') $AppImage

Write-Host "[3/3] copy deployment files"
Copy-Item (Join-Path $root '.env.prod.example') (Join-Path $target '.env.prod.example') -Force
Copy-Item (Join-Path $root 'scripts\deploy-offline.sh') (Join-Path $scriptsDir 'deploy-offline.sh') -Force

$meta = @"
APP_IMAGE=$AppImage
CREATED_AT=$(Get-Date -Format s)
BUNDLE_DIR=$target
"@
Set-Content -Path (Join-Path $target 'bundle-info.txt') -Value $meta -Encoding utf8

Write-Host "bundle ready: $target"
Write-Host "Copy this folder to the offline server, then run:"
Write-Host "  cd $target"
Write-Host "  cp .env.prod.example .env.prod"
Write-Host "  sh scripts/deploy-offline.sh"
