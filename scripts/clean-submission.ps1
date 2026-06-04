<#
Clean submission script for Windows PowerShell
Run from repository root via: .\scripts\clean-submission.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Join-Path $PSScriptRoot '..' | Resolve-Path -Relative
Set-Location $RepoRoot

$matchNames = @(
  'node_modules','build','dist','coverage','.dart_tool','.next','.gradle','.cache','.flutter-plugins','.flutter-plugins-dependencies'
)

Write-Host "Scanning repository for common build artifacts (this may take a moment)..."

$toDelete = [System.Collections.Generic.List[string]]::new()

foreach ($name in $matchNames) {
  Get-ChildItem -Path . -Directory -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -ieq $name } | ForEach-Object { $toDelete.Add($_.FullName) }
}

# Find log files (exclude node_modules)
Get-ChildItem -Path . -File -Recurse -Force -Include *.log -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notlike '*\node_modules\*' } | ForEach-Object { $toDelete.Add($_.FullName) }

# Unique and sorted
$toDelete = $toDelete | Sort-Object -Unique

if ($toDelete.Count -eq 0) {
  Write-Host "No build artifacts found to delete. Exiting."
  exit 0
}

Write-Host "The following items will be deleted (relative to repo root):"
foreach ($p in $toDelete) { Write-Host " - " (Resolve-Path $p).Path }

$confirm = Read-Host "Proceed and delete the above items? (y/N)"
if ($confirm -notmatch '^[Yy]$') {
  Write-Host "Aborted by user. No files were deleted."
  exit 0
}

# Compute total size before deletion
$totalBytes = 0
foreach ($p in $toDelete) {
  try {
    if (Test-Path $p) {
      if ((Get-Item $p).PSIsContainer) {
        $sum = Get-ChildItem -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum
        $totalBytes += ($sum.Sum -as [long])
      } else {
        $fi = Get-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue
        $totalBytes += ($fi.Length -as [long])
      }
    }
  } catch { }
}

function ConvertTo-HumanReadable([long]$bytes) {
  if ($bytes -lt 1KB) { return "$bytes B" }
  if ($bytes -lt 1MB) { return "{0:N1} KB" -f ($bytes/1KB) }
  if ($bytes -lt 1GB) { return "{0:N1} MB" -f ($bytes/1MB) }
  return "{0:N2} GB" -f ($bytes/1GB)
}

$count = 0
foreach ($p in $toDelete) {
  if (Test-Path $p) {
    try { Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue; $count++ } catch { }
  }
}

Write-Host "Deleted $count items. Freed approximately: $(ConvertTo-HumanReadable $totalBytes)."

# Flutter: run flutter clean if flutter exists
if (Test-Path './flutter_booking_app') {
  if (Get-Command flutter -ErrorAction SilentlyContinue) {
    Write-Host "Running 'flutter clean' in flutter_booking_app..."
    Push-Location './flutter_booking_app'
    try { flutter clean } catch { Write-Warning "flutter clean failed or flutter not configured." }
    Pop-Location
  } else {
    Write-Host "flutter not found in PATH; skipping 'flutter clean'."
  }
}

Write-Host "Clean submission finished. Review and then run 'git status' to confirm." 
