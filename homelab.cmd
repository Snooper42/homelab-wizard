@echo off
rem Runs the homelab CLI on Windows, rebuilding it first when Go is installed
rem (install Go once with: winget install GoLang.Go).
setlocal
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "BIN=%ROOT%\bin\homelab.exe"
set "VERSION=dev"
if exist "%ROOT%\VERSION" set /p VERSION=<"%ROOT%\VERSION"
where go >nul 2>nul
if %errorlevel%==0 goto build
if exist "%BIN%" goto run
rem Without Go, the CLI that ships with the desktop app does the job.
for %%A in ("%ProgramFiles%\Snooper42\Homelab Wizard\homelab.exe" "%LOCALAPPDATA%\Programs\Homelab Wizard\homelab.exe") do (
  if exist %%A (
    %%A --root "%ROOT%" %*
    exit /b
  )
)
echo The homelab CLI is written in Go. Install Go once with:  winget install GoLang.Go 1>&2
echo Or install the Homelab Wizard app, which brings its own copy. 1>&2
exit /b 1

:build
pushd "%ROOT%"
go build -trimpath -ldflags "-s -w -X main.version=%VERSION%" -o "%BIN%" ./cmd/homelab
if errorlevel 1 (popd & exit /b 1)
rem Starts the scheduled jobs without a console window.
go build -trimpath -ldflags "-s -w -H=windowsgui" -o "%ROOT%\bin\homelab-run.exe" ./cmd/homelab-run
popd

:run
"%BIN%" --root "%ROOT%" %*
