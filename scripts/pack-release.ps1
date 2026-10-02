[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^v\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)[1-9]\d{0,2})?$')]
  [string]$Tag,

  [string]$OutputDirectory = 'dist',

  [switch]$CleanInstall,

  [switch]$SkipVerify,

  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [Parameter(Mandatory = $true)]
    [string[]]$ArgumentList
  )

  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($ArgumentList -join ' ')"
  }
}

function Resolve-RepositoryPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepositoryRoot,

    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }

  return [System.IO.Path]::GetFullPath((Join-Path $RepositoryRoot $Path))
}

function Assert-PluginPackage {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PackagePath,

    [Parameter(Mandatory = $true)]
    [string]$ExpectedVersion
  )

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($PackagePath)
  try {
    $entryNames = @($archive.Entries | ForEach-Object { $_.FullName })
    $manifestEntry = $archive.Entries |
      Where-Object { $_.FullName -eq 'manifest.json' -or $_.FullName -eq 'com.esheep.switchbot.sdPlugin/manifest.json' } |
      Select-Object -First 1
    if ($null -eq $manifestEntry) {
      throw 'Package does not contain manifest.json.'
    }

    $reader = [System.IO.StreamReader]::new($manifestEntry.Open())
    try {
      $manifest = $reader.ReadToEnd() | ConvertFrom-Json
    } finally {
      $reader.Dispose()
    }

    if ([string]$manifest.Version -ne $ExpectedVersion) {
      throw "Package version is $($manifest.Version), expected $ExpectedVersion."
    }

    $requiredEntries = @(
      'bin/plugin.js',
      'ui/api-request.js',
      'ui/get-status.js',
      'ui/infrared-remote.js',
      'ui/physical-control.js'
    )
    $missingEntries = foreach ($requiredEntry in $requiredEntries) {
      if (
        -not ($entryNames -contains $requiredEntry) -and
        -not ($entryNames -contains "com.esheep.switchbot.sdPlugin/$requiredEntry")
      ) {
        $requiredEntry
      }
    }
    if ($missingEntries) {
      throw "Package is missing required entries: $($missingEntries -join ', ')"
    }
  } finally {
    $archive.Dispose()
  }
}

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$pluginDirectory = Join-Path $repositoryRoot 'com.esheep.switchbot.sdPlugin'
$manifestPath = Join-Path $pluginDirectory 'manifest.json'
$authenticationPath = Join-Path $pluginDirectory 'ui\authentication.html'
$generatedAssetPaths = @(
  (Join-Path $pluginDirectory 'imgs\action.png'),
  (Join-Path $pluginDirectory 'imgs\action@2x.png'),
  (Join-Path $pluginDirectory 'imgs\key.png'),
  (Join-Path $pluginDirectory 'imgs\key@2x.png'),
  (Join-Path $pluginDirectory 'imgs\plugin.png'),
  (Join-Path $pluginDirectory 'imgs\plugin@2x.png')
)
$temporaryPaths = @($manifestPath, $authenticationPath) + $generatedAssetPaths
$originalFiles = @{}
$runningOnWindows = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
$npmCommand = if ($runningOnWindows) { 'npm.cmd' } else { 'npm' }
$npxCommand = if ($runningOnWindows) { 'npx.cmd' } else { 'npx' }

foreach ($path in $temporaryPaths) {
  $originalFiles[$path] = if (Test-Path -LiteralPath $path) {
    [System.IO.File]::ReadAllBytes($path)
  } else {
    $null
  }
}

Push-Location $repositoryRoot
try {
  Write-Host "Resolving release version for $Tag..."
  $versionOutput = & node 'scripts/release-version.mjs' $Tag
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to resolve release version for $Tag."
  }
  $version = $versionOutput | Select-Object -Last 1 | ConvertFrom-Json

  $resolvedOutputDirectory = Resolve-RepositoryPath -RepositoryRoot $repositoryRoot -Path $OutputDirectory
  $defaultPackagePath = Join-Path $resolvedOutputDirectory 'com.esheep.switchbot.streamDeckPlugin'
  $packagePath = Join-Path $resolvedOutputDirectory "SwitchBot-API-Call-$Tag.streamDeckPlugin"

  if ((Test-Path -LiteralPath $packagePath) -and -not $Force) {
    throw "Output already exists: $packagePath. Re-run with -Force to replace it."
  }
  if (Test-Path -LiteralPath $defaultPackagePath) {
    if (-not $Force) {
      throw "Intermediate output already exists: $defaultPackagePath. Re-run with -Force to replace it."
    }
    Remove-Item -LiteralPath $defaultPackagePath -Force
  }

  if ($CleanInstall -or -not (Test-Path -LiteralPath (Join-Path $repositoryRoot 'node_modules'))) {
    Write-Host 'Installing dependencies with npm ci...'
    Invoke-NativeCommand -FilePath $npmCommand -ArgumentList @('ci')
  }

  Write-Host 'Building plugin...'
  Invoke-NativeCommand -FilePath $npmCommand -ArgumentList @('run', 'build')

  if (-not $SkipVerify) {
    Write-Host 'Running full verification...'
    Invoke-NativeCommand -FilePath $npmCommand -ArgumentList @('run', 'verify')
  } else {
    Write-Warning 'Full verification was skipped.'
  }

  New-Item -ItemType Directory -Force -Path $resolvedOutputDirectory | Out-Null

  Write-Host "Packing Stream Deck plugin version $($version.manifestVersion)..."
  Invoke-NativeCommand -FilePath $npxCommand -ArgumentList @(
    '--no-install',
    'streamdeck',
    'pack',
    'com.esheep.switchbot.sdPlugin',
    '--version',
    [string]$version.manifestVersion,
    '--output',
    $resolvedOutputDirectory,
    '--no-update-check'
  )

  if (-not (Test-Path -LiteralPath $defaultPackagePath)) {
    throw "Expected package was not created: $defaultPackagePath"
  }

  Assert-PluginPackage -PackagePath $defaultPackagePath -ExpectedVersion ([string]$version.manifestVersion)
  Move-Item -LiteralPath $defaultPackagePath -Destination $packagePath -Force:$Force
  $package = Get-Item -LiteralPath $packagePath
  $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $packagePath

  Write-Host ''
  Write-Host "Created: $($package.FullName)"
  Write-Host "Version: $($version.manifestVersion)"
  Write-Host "Size:    $($package.Length) bytes"
  Write-Host "SHA-256: $($hash.Hash)"

  [pscustomobject]@{
    Tag = $Tag
    ManifestVersion = [string]$version.manifestVersion
    Path = $package.FullName
    SizeBytes = $package.Length
    SHA256 = $hash.Hash
  }
} finally {
  foreach ($path in $temporaryPaths) {
    $bytes = $originalFiles[$path]
    if ($null -eq $bytes) {
      if (Test-Path -LiteralPath $path) {
        Remove-Item -LiteralPath $path -Force
      }
    } else {
      $directory = Split-Path -Parent $path
      if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
      }
      [System.IO.File]::WriteAllBytes($path, $bytes)
    }
  }

  Pop-Location
}
