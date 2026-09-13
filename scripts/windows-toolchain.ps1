#!/usr/bin/env pwsh
# Reproducible Windows entrypoint for House Plan's CI-compatible local tools (#557).
# Nothing is added to the persistent PATH and no existing venv is removed.
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('setup', 'check', 'npm', 'node', 'python', 'playwright')]
  [string]$Action = 'check',

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Arguments = @(),

  [string]$ToolRoot = (Join-Path $env:LOCALAPPDATA 'houseplan-toolchain'),
  [string]$VenvPath = '.venv-ci'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$NodeMajor = (Get-Content -LiteralPath (Join-Path $RepoRoot '.nvmrc') -Raw).Trim()
$PythonPin = (Get-Content -LiteralPath (Join-Path $RepoRoot '.python-version') -Raw).Trim()
$ResolvedToolRoot = [IO.Path]::GetFullPath($ToolRoot)
$ResolvedVenv = if ([IO.Path]::IsPathRooted($VenvPath)) {
  [IO.Path]::GetFullPath($VenvPath)
} else {
  [IO.Path]::GetFullPath((Join-Path $RepoRoot $VenvPath))
}

function Get-InstalledNode {
  if (-not (Test-Path -LiteralPath $ResolvedToolRoot -PathType Container)) { return $null }
  $candidates = Get-ChildItem -LiteralPath $ResolvedToolRoot -Directory | ForEach-Object {
    if ($_.Name -match "^node-v($NodeMajor[.]\d+[.]\d+)-win-x64$" -and
      (Test-Path -LiteralPath (Join-Path $_.FullName 'node.exe') -PathType Leaf)) {
      [pscustomobject]@{ Version = [version]$Matches[1]; Directory = $_.FullName }
    }
  }
  return $candidates | Sort-Object Version -Descending | Select-Object -First 1
}

function Install-PortableNode {
  New-Item -ItemType Directory -Path $ResolvedToolRoot -Force | Out-Null
  $releases = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json'
  $release = $releases | Where-Object {
    $_.version -match "^v$NodeMajor[.]" -and $_.files -contains 'win-x64-zip'
  } | Select-Object -First 1
  if (-not $release) { throw "Node $NodeMajor win-x64-zip was not found in the official release index" }

  $archiveName = "node-$($release.version)-win-x64.zip"
  $temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("houseplan-node-" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $temporaryRoot | Out-Null
  try {
    $archive = Join-Path $temporaryRoot $archiveName
    $baseUri = "https://nodejs.org/dist/$($release.version)"
    Invoke-WebRequest -Uri "$baseUri/$archiveName" -OutFile $archive
    $sums = (Invoke-WebRequest -Uri "$baseUri/SHASUMS256.txt").Content
    $sumLine = $sums -split "`n" | Where-Object {
      $_ -match ("\s" + [regex]::Escape($archiveName) + "\s*$")
    } | Select-Object -First 1
    if (-not $sumLine) { throw "SHA-256 for $archiveName was not found" }
    $expected = ($sumLine.Trim() -split '\s+')[0].ToLowerInvariant()
    $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw "SHA-256 mismatch for $archiveName" }

    $expandedRoot = Join-Path $temporaryRoot 'expanded'
    Expand-Archive -LiteralPath $archive -DestinationPath $expandedRoot
    $expandedNode = Join-Path $expandedRoot "node-$($release.version)-win-x64"
    $destination = Join-Path $ResolvedToolRoot "node-$($release.version)-win-x64"
    if (-not (Test-Path -LiteralPath $destination)) {
      Move-Item -LiteralPath $expandedNode -Destination $destination
    }
    Write-Host "Node $($release.version) installed at $destination"
  } finally {
    $safeTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $resolvedTemporary = [IO.Path]::GetFullPath($temporaryRoot)
    if ($resolvedTemporary.StartsWith($safeTemp, [StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $resolvedTemporary -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

function Resolve-Runtimes([bool]$AllowInstall) {
  $node = Get-InstalledNode
  if (-not $node -and $AllowInstall) {
    Install-PortableNode
    $node = Get-InstalledNode
  }
  if (-not $node) {
    throw "Portable Node $NodeMajor is absent. Run: .\scripts\windows-toolchain.ps1 setup"
  }
  $nodeExe = Join-Path $node.Directory 'node.exe'
  $npmCmd = Join-Path $node.Directory 'npm.cmd'
  $npxCmd = Join-Path $node.Directory 'npx.cmd'

  $pythonExe = Join-Path $ResolvedVenv 'Scripts\python.exe'
  $uv = $null
  if ($AllowInstall) {
    $uv = (Get-Command uv -ErrorAction SilentlyContinue).Source
    if (-not $uv) {
      throw 'uv is required. Install it once with: winget install --id astral-sh.uv --source winget'
    }
    & $uv python install $PythonPin
    if ($LASTEXITCODE -ne 0) { throw "uv could not install Python $PythonPin" }
    if (-not (Test-Path -LiteralPath $pythonExe)) {
      & $uv venv --python $PythonPin $ResolvedVenv
      if ($LASTEXITCODE -ne 0) { throw "uv could not create $ResolvedVenv" }
    }
  }
  if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw "Pinned venv is absent. Run: .\scripts\windows-toolchain.ps1 setup"
  }
  $pythonVersion = (& $pythonExe -c 'import sys; print(".".join(map(str, sys.version_info[:2])))').Trim()
  if ($pythonVersion -ne $PythonPin) {
    throw "$ResolvedVenv uses Python $pythonVersion, expected $PythonPin. It was not removed; choose another -VenvPath."
  }
  if ($AllowInstall) {
    $voluptuous = (Select-String -LiteralPath (Join-Path $RepoRoot 'tests_backend\requirements.txt') `
      -Pattern '^voluptuous==\S+$').Line
    & $uv pip install --python $pythonExe pytest pytest-asyncio $voluptuous
    if ($LASTEXITCODE -ne 0) { throw 'uv could not install the native-Windows pure-test dependencies' }
  }
  return [pscustomobject]@{
    NodeDirectory = $node.Directory
    Node = $nodeExe
    Npm = $npmCmd
    Npx = $npxCmd
    Python = $pythonExe
  }
}

function Invoke-Check($runtime) {
  $oldPath = $env:PATH
  try {
    $env:PATH = "$($runtime.NodeDirectory);$oldPath"
    & $runtime.Node (Join-Path $RepoRoot 'scripts\toolchain-pins.mjs') --check "--python=$($runtime.Python)"
    if ($LASTEXITCODE -ne 0) { throw 'Local toolchain does not match the CI pins' }
  } finally {
    $env:PATH = $oldPath
  }
}

function Normalized-Arguments {
  if ($Arguments.Count -gt 0 -and $Arguments[0] -eq '--') {
    if ($Arguments.Count -eq 1) { return @() }
    return $Arguments[1..($Arguments.Count - 1)]
  }
  return $Arguments
}

Push-Location $RepoRoot
try {
  $timer = [Diagnostics.Stopwatch]::StartNew()
  $runtime = Resolve-Runtimes ($Action -eq 'setup')
  $oldPath = $env:PATH
  $env:PATH = "$($runtime.NodeDirectory);$oldPath"
  try {
    if ($Action -eq 'setup') {
      & $runtime.Npm ci --no-audit --no-fund
      if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
      & $runtime.Npx playwright install chromium
      if ($LASTEXITCODE -ne 0) { throw 'Playwright Chromium installation failed' }
      Invoke-Check $runtime
    } elseif ($Action -eq 'check') {
      Invoke-Check $runtime
    } else {
      $forward = @(Normalized-Arguments)
      if ($Action -eq 'npm') { & $runtime.Npm @forward }
      elseif ($Action -eq 'node') { & $runtime.Node @forward }
      elseif ($Action -eq 'python') { & $runtime.Python @forward }
      else { & $runtime.Npx playwright @forward }
      if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
  } finally {
    $env:PATH = $oldPath
  }
  $timer.Stop()
  Write-Host ("House Plan {0}: {1:n1}s" -f $Action, $timer.Elapsed.TotalSeconds)
} finally {
  Pop-Location
}
