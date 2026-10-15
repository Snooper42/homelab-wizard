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
if %errorlevel%==0 (
  pushd "%ROOT%"
  go build -trimpath -ldflags "-s -w -X main.version=%VERSION%" -o "%BIN%" ./cmd/homelab
  if errorlevel 1 (popd & exit /b 1)
  rem Starts the scheduled jobs without a console window.
  go build -trimpath -ldflags "-s -w -H=windowsgui" -o "%ROOT%\bin\homelab-run.exe" ./cmd/homelab-run
  popd
) else if not exist "%BIN%" (
  echo The homelab CLI is written in Go. Install Go once with:  winget install GoLang.Go 1>&2
  exit /b 1
)
"%BIN%" --root "%ROOT%" %*
