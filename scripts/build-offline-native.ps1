param(
  [string]$BundleDir = ".offline-native-bundle"
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$bundlePath = Join-Path $root $BundleDir
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$target = Join-Path $bundlePath $timestamp

Write-Host "[1/4] install production dependencies"
pushd $root
npm ci --omit=dev
if (-not $?) { throw "npm ci failed" }
popd

Write-Host "[2/4] build application"
pushd $root
npm run build
if (-not $?) { throw "npm run build failed" }
popd

Write-Host "[3/4] prepare bundle directory"
New-Item -ItemType Directory -Force -Path $target | Out-Null

# copy essential files
$items = @(
  'package.json',
  'package-lock.json',
  'next.config.js',
  '.env.prod.example',
  '.env.example',
  'prisma',
  'public',
  '.next',
  'node_modules'
)

foreach ($item in $items) {
  $src = Join-Path $root $item
  if (Test-Path $src) {
    Copy-Item -Path $src -Destination $target -Recurse -Force
  }
}

Write-Host "[4/4] create tar.gz archive"
$archiveName = "staff-management-$timestamp.tar.gz"
$archivePath = Join-Path $bundlePath $archiveName

# use tar.exe (available on Windows 10+) for better Linux compatibility
tar -czf $archivePath -C $target .

Write-Host "========================================"
Write-Host "  Bundle ready: $archivePath"
Write-Host "========================================"
Write-Host "Copy to the offline CentOS 7.9 server and:"
Write-Host "  1. Install Node.js (unofficial builds glibc-217)"
Write-Host "  2. tar -xzf $archiveName"
Write-Host "  3. chmod +x node_modules/.bin/*"
Write-Host "  4. Configure .env (DATABASE_URL for external PostgreSQL)"
Write-Host "  5. Run: npm start"
