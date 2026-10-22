# Installs Homelab Wizard on Windows, or replaces the copy already there.
# In PowerShell:
#
#   irm https://raw.githubusercontent.com/Snooper42/homelab-wizard/main/install.ps1 | iex
#
# It downloads the installer from the repository's Latest release, checks
# it against the SHA-256 checksum GitHub keeps for the file, runs it
# without its pages (Windows asks for an administrator's approval), and
# opens the app. A file PowerShell downloads carries no "downloaded from
# the internet" mark, so SmartScreen does not stop the unsigned installer.
$ErrorActionPreference = 'Stop'
$repo = if ($env:HOMELAB_REPO) { $env:HOMELAB_REPO } else { 'Snooper42/homelab-wizard' }
$asset = 'Homelab-Wizard-Windows-Setup.exe'

Write-Host 'Looking up the newest build...'
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers @{ Accept = 'application/vnd.github+json' }
$file = $release.assets | Where-Object { $_.name -eq $asset } | Select-Object -First 1
if (-not $file -or -not $file.digest) { throw "The Latest release has no $asset with a checksum." }
$want = $file.digest -replace '^sha256:', ''

$dir = Join-Path ([IO.Path]::GetTempPath()) ('homelab-wizard-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $dir | Out-Null
try {
  $setup = Join-Path $dir $asset
  Write-Host "Downloading $asset..."
  $ProgressPreference = 'SilentlyContinue'
  Invoke-WebRequest -Uri $file.browser_download_url -OutFile $setup -UseBasicParsing
  $got = (Get-FileHash -Algorithm SHA256 -LiteralPath $setup).Hash
  if ($got -ne $want) { throw "The download does not match GitHub's checksum (expected $want, got $got); nothing was installed." }

  # A running copy, its tray item, and the background agent hold their
  # files open; they are stopped, and the agent started again after.
  $old = Join-Path $env:ProgramFiles 'Snooper42\Homelab Wizard'
  Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($old + '\', [StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force -ErrorAction SilentlyContinue

  Write-Host 'Installing (Windows asks for your approval)...'
  $p = Start-Process -FilePath $setup -ArgumentList '/S' -Verb RunAs -Wait -PassThru
  if ($p.ExitCode -ne 0) { throw "The installer stopped with code $($p.ExitCode)." }
} finally {
  Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
}

$run = (Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -ErrorAction SilentlyContinue).'homelab-agent'
if ($run) { Start-Process -FilePath 'cmd.exe' -ArgumentList "/s /c ""$run""" -WindowStyle Hidden }

$app = Get-ChildItem -Path (Join-Path $env:ProgramFiles 'Snooper42\Homelab Wizard') -Filter 'homelab-wizard*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
Write-Host 'Opening Homelab Wizard. From now on it updates itself.'
if ($app) { Start-Process -FilePath $app.FullName } else { Write-Host 'Open it from the Start menu: Homelab Wizard.' }
