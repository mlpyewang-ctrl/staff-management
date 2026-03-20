param(
  [string]$BundleDir = ".offline-bundle",
  [string]$AppImage = "staff-management-app:offline",
  [string]$PostgresImage = "postgres:16-alpine"
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

Write-Host "[1/5] pull postgres image: $PostgresImage"
docker pull $PostgresImage

Write-Host "[2/5] build app image: $AppImage"
docker build -t $AppImage $root

Write-Host "[3/5] save images"
docker save -o (Join-Path $imagesDir 'app-image.tar') $AppImage
docker save -o (Join-Path $imagesDir 'postgres-image.tar') $PostgresImage

Write-Host "[4/5] copy deployment files"
Copy-Item (Join-Path $root 'docker-compose.prod.yml') (Join-Path $target 'docker-compose.prod.yml') -Force
Copy-Item (Join-Path $root '.env.prod.example') (Join-Path $target '.env.prod.example') -Force
Copy-Item (Join-Path $root 'scripts\docker-entrypoint.sh') (Join-Path $scriptsDir 'docker-entrypoint.sh') -Force
Copy-Item (Join-Path $root 'scripts\install-offline-bundle.sh') (Join-Path $scriptsDir 'install-offline-bundle.sh') -Force

$meta = @"
APP_IMAGE=$AppImage
POSTGRES_IMAGE=$PostgresImage
CREATED_AT=$(Get-Date -Format s)
BUNDLE_DIR=$target
"@
Set-Content -Path (Join-Path $target 'bundle-info.txt') -Value $meta -Encoding utf8

Write-Host "[5/5] bundle ready: $target"
Write-Host "Copy this folder to the offline server, then run:"
Write-Host "  cd $target"
Write-Host "  cp .env.prod.example .env.prod"
Write-Host "  sh scripts/install-offline-bundle.sh"
