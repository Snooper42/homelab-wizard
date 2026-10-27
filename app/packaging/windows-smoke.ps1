# Runs the installer silently, as install.ps1 and the app's own update do,
# then finds the app with the CLI, the jobs' starter, and the homelab files
# beside it, starts the app, checks it is still running with its window
# after 20 seconds, and keeps a screenshot.
#
#   app/packaging/windows-smoke.ps1 <Setup.exe> [screenshot.png]
param(
    [Parameter(Mandatory)] [string] $Installer,
    [string] $Shot = 'build\windows-smoke.png'
)
$ErrorActionPreference = 'Stop'

$p = Start-Process -FilePath (Resolve-Path $Installer) -ArgumentList '/S' -Wait -PassThru
if ($p.ExitCode -ne 0) { throw "The installer exited with $($p.ExitCode)." }

$places = @("$env:ProgramFiles\Snooper42\Homelab Wizard", "$env:LOCALAPPDATA\Programs\Homelab Wizard")
$dir = $places | Where-Object { Test-Path (Join-Path $_ 'homelab-wizard.exe') } | Select-Object -First 1
if (-not $dir) { throw "homelab-wizard.exe is in none of: $($places -join '; ')" }
foreach ($f in 'homelab.exe', 'homelab-run.exe', 'homelab-kit.tar.gz') {
    if (-not (Test-Path (Join-Path $dir $f))) { throw "$f is not beside the app in $dir." }
}
& (Join-Path $dir 'homelab.exe') version
if ($LASTEXITCODE) { throw "homelab.exe version exited with $LASTEXITCODE." }

$app = Start-Process -FilePath (Join-Path $dir 'homelab-wizard.exe') -PassThru
Start-Sleep -Seconds 20
$app.Refresh()
if ($app.HasExited) { throw "The app quit within 20 seconds, with $($app.ExitCode)." }
if ($app.MainWindowHandle -eq 0) { throw 'The app runs, but shows no window.' }

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
[System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($screen.Left, $screen.Top, 0, 0, $bmp.Size)
New-Item -ItemType Directory -Force (Split-Path -Parent $Shot) | Out-Null
$bmp.Save((Join-Path (Resolve-Path (Split-Path -Parent $Shot)) (Split-Path -Leaf $Shot)))
Stop-Process -Id $app.Id -Force
Write-Output "The installer put the app in $dir with the CLI beside it, and the app starts (window: $($app.MainWindowTitle)); screenshot: $Shot"
