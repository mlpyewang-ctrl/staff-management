param(
  [string]$BundleDir = ".offline-native-bundle"
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$bundlePath = Join-Path $root $BundleDir
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$target = Join-Path $bundlePath $timestamp

# Smart dependency install: skip npm ci if package-lock.json unchanged
$lockFile = Join-Path $root 'package-lock.json'
$nodeModules = Join-Path $root 'node_modules'
$checksumFile = Join-Path $root '.node_modules_checksum'

$needsInstall = $true

if ((Test-Path $nodeModules) -and (Test-Path $checksumFile) -and (Test-Path $lockFile)) {
  $currentHash = (Get-FileHash $lockFile -Algorithm SHA256).Hash
  $lastHash = Get-Content $checksumFile -Raw
  if ($currentHash -eq $lastHash) {
    $needsInstall = $false
    Write-Host "[1/5] node_modules is up to date, skipping npm ci"
  }
}

if ($needsInstall) {
  Write-Host "[1/5] install production dependencies"
  pushd $root
  npm ci --omit=dev
  if (-not $?) { throw "npm ci failed" }
  popd

  # Record lock file hash for next comparison
  (Get-FileHash $lockFile -Algorithm SHA256).Hash | Set-Content $checksumFile -NoNewline
} else {
  # Ensure devDependencies are cleaned even if skipping ci
  if (Test-Path $nodeModules) {
    Write-Host "[1/5] pruning dev dependencies"
    pushd $root
    npm prune --omit=dev --silent
    popd
  }
}

# ── Download Prisma engines for CentOS 7 (rhel-openssl-1.0.x) ──
# npm ci on Windows only downloads Windows engines. The offline CentOS server
# needs rhel engines in the @prisma/engines cache or Prisma CLI will try to
# download them at runtime (which fails on an air-gapped server).
$enginesVersion = "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
$platform = "rhel-openssl-1.0.x"
$cacheDir = Join-Path $nodeModules "@prisma/engines/node_modules/.cache/prisma/master/$enginesVersion/$platform"

if (-not (Test-Path (Join-Path $cacheDir "schema-engine"))) {
  Write-Host "[2/5] downloading Prisma engines for $platform"
  New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

  # Helper to download and verify an engine
  function Download-Engine($name, $url, $destPath) {
    $gzPath = "$destPath.gz"
    curl.exe -sL -o $gzPath $url
    if (-not (Test-Path $gzPath)) { throw "Failed to download $name from $url" }

    # Decompress with Node.js (gzip is always available via node)
    node -e "const fs=require('fs'),zlib=require('zlib'); fs.writeFileSync('$destPath', zlib.gunzipSync(fs.readFileSync('$gzPath')));"
    if (-not (Test-Path $destPath)) { throw "Failed to decompress $name" }

    # Write SHA256 checksums
    $hash = (Get-FileHash $destPath -Algorithm SHA256).Hash.ToLower()
    $gzHash = (Get-FileHash $gzPath -Algorithm SHA256).Hash.ToLower()
    $hash | Set-Content -NoNewline "$destPath.sha256"
    $gzHash | Set-Content -NoNewline "$gzPath.sha256"

    Remove-Item $gzPath
  }

  # Schema engine (required for prisma db push / migrate)
  Download-Engine "schema-engine" `
    "https://binaries.prisma.sh/all_commits/$enginesVersion/$platform/schema-engine.gz" `
    (Join-Path $cacheDir "schema-engine")

  # Query engine library (required for Prisma Client on CentOS)
  Download-Engine "libquery-engine" `
    "https://binaries.prisma.sh/all_commits/$enginesVersion/$platform/libquery_engine.so.node.gz" `
    (Join-Path $cacheDir "libquery-engine")

  Write-Host "  engines cached for $platform"
} else {
  Write-Host "[2/5] Prisma engines for $platform already cached"
}

# Prisma CLI (ensureBinariesExist) looks for engines directly in
# node_modules/@prisma/engines/ with platform-specific filenames,
# NOT in the deep cache subdirectory. Copy them there.
$enginesRoot = Join-Path $nodeModules "@prisma/engines"
if (-not (Test-Path (Join-Path $enginesRoot "schema-engine-$platform"))) {
  Copy-Item -Path (Join-Path $cacheDir "schema-engine") -Destination (Join-Path $enginesRoot "schema-engine-$platform") -Force
}
if (-not (Test-Path (Join-Path $enginesRoot "libquery_engine-$platform.so.node"))) {
  Copy-Item -Path (Join-Path $cacheDir "libquery-engine") -Destination (Join-Path $enginesRoot "libquery_engine-$platform.so.node") -Force
}

Write-Host "[3/5] build application"
pushd $root
npm run build
if (-not $?) { throw "npm run build failed" }
popd

Write-Host "[4/5] prepare bundle directory"
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
  'scripts',
  '.next',
  'node_modules'
)

foreach ($item in $items) {
  $src = Join-Path $root $item
  if (Test-Path $src) {
    Copy-Item -Path $src -Destination $target -Recurse -Force
  }
}

Write-Host "[5/5] create tar.gz archive"
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
