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

# Where install.ps1 looks for it, under the name the installer gives it.
$dir = Join-Path $env:ProgramFiles 'Snooper42\Homelab Wizard'
$exe = Join-Path $dir 'Homelab Wizard.exe'
if (-not (Test-Path -LiteralPath $exe)) {
    Get-ChildItem -LiteralPath $dir -ErrorAction SilentlyContinue | Format-Table Name, Length | Out-String | Write-Output
    throw "The installer put no Homelab Wizard.exe in $dir."
}
foreach ($f in 'homelab.exe', 'homelab-run.exe', 'homelab-kit.tar.gz') {
    if (-not (Test-Path -LiteralPath (Join-Path $dir $f))) { throw "$f is not beside the app in $dir." }
}
& (Join-Path $dir 'homelab.exe') version
if ($LASTEXITCODE) { throw "homelab.exe version exited with $LASTEXITCODE." }

$app = Start-Process -FilePath $exe -PassThru
# Its window, by its title: the app may start its tray as a second process.
$window = $null
for ($i = 0; $i -lt 30 -and -not $window; $i++) {
    Start-Sleep -Seconds 1
    $window = Get-Process -Name 'Homelab Wizard' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*Homelab Wizard*' } | Select-Object -First 1
}
if (-not $window) {
    Get-Process -Name 'Homelab Wizard' -ErrorAction SilentlyContinue | Format-Table Id, MainWindowHandle, MainWindowTitle | Out-String | Write-Output
    throw 'The app shows no window titled Homelab Wizard within 30 seconds.'
}
Start-Sleep -Seconds 10
$app.Refresh()
if ($app.HasExited) { throw "The app quit after it opened its window, with $($app.ExitCode)." }

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
[System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($screen.Left, $screen.Top, 0, 0, $bmp.Size)
New-Item -ItemType Directory -Force (Split-Path -Parent $Shot) | Out-Null
$bmp.Save((Join-Path (Resolve-Path (Split-Path -Parent $Shot)) (Split-Path -Leaf $Shot)))
Get-Process -Name 'Homelab Wizard' -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Output "The installer put the app in $dir with the CLI beside it, and the app starts (window: $($window.MainWindowTitle)); screenshot: $Shot"
