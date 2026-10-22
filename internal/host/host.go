// Package host describes the machine the homelab runs on: macOS with
// OrbStack and launchd, Linux with Docker Engine and systemd, or Windows
// with Docker Desktop and Task Scheduler. Commands
// take their wording, hints, and job settings from the profile.
package host

import (
	"path/filepath"
	"runtime"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// Profile is what differs between host operating systems.
type Profile struct {
	OS             string // runtime.GOOS value: "darwin" or "linux"
	Name           string // "macOS", "Linux"
	Machine        string // how messages refer to the host: "this Mac"
	Runtime        string // the container runtime the homelab is set up for
	InstallRuntime string // how to install it
	StartRuntime   string // how to start it when it is not running
	RuntimeAccess  string // how to let this account use it, when it is refused
	// RuntimeDownload is the runtime's download page, for people without
	// a package manager; RuntimeApp is the app that starts it, where
	// there is one (its path, or a name for macOS's open -a).
	RuntimeDownload string
	RuntimeApp      string
	UpdateRuntime   string // how to get a newer docker compose
	Scheduler       string // "launchd", "systemd", or "taskscheduler"
	MoreMemory      string // how to give the containers more memory
	InstallOllama   string // how to run Ollama outside a container, where it can use the GPU
	Supported       bool
	// RiskyDirs are folders under ~ where privacy controls or file syncing
	// interfere with containers.
	RiskyDirs []string
}

// Current is the profile for the machine running this program.
func Current() Profile { return For(runtime.GOOS) }

// For returns the profile for a GOOS value.
func For(goos string) Profile {
	switch goos {
	case "darwin":
		return Profile{
			OS: goos, Name: "macOS", Machine: "this Mac", Runtime: "OrbStack",
			InstallRuntime:  "brew install --cask orbstack",
			StartRuntime:    "open OrbStack (open -a OrbStack) and turn on Settings > General > Start at login",
			RuntimeDownload: "https://orbstack.dev/download", RuntimeApp: "OrbStack",
			UpdateRuntime: "update OrbStack",
			MoreMemory:    "raise OrbStack's memory limit (Settings > System)",
			InstallOllama: "brew install ollama && brew services start ollama",
			Scheduler:     "launchd", Supported: true,
			RiskyDirs: []string{"Desktop", "Documents", "Downloads", "Library/Mobile Documents", "Library/CloudStorage"},
		}
	case "linux":
		return Profile{
			OS: goos, Name: "Linux", Machine: "this machine", Runtime: "Docker Engine",
			InstallRuntime:  "install Docker Engine and the compose plugin (https://docs.docker.com/engine/install/), then add yourself to the docker group",
			StartRuntime:    "sudo systemctl enable --now docker",
			RuntimeAccess:   "add your account to the docker group (sudo usermod -aG docker $USER), then log out and back in",
			RuntimeDownload: "https://docs.docker.com/engine/install/",
			UpdateRuntime:   "update the docker-compose-plugin package",
			MoreMemory:      "add memory to this machine",
			InstallOllama:   "curl -fsSL https://ollama.com/install.sh | sh, then let containers reach it: sudo systemctl edit ollama, add Environment=OLLAMA_HOST=0.0.0.0 under [Service], and sudo systemctl restart ollama",
			Scheduler:       "systemd", Supported: true,
		}
	case "windows":
		return Profile{
			OS: goos, Name: "Windows", Machine: "this PC", Runtime: "Docker Desktop",
			InstallRuntime:  "install Docker Desktop with the WSL 2 backend (winget install Docker.DockerDesktop)",
			StartRuntime:    "start Docker Desktop and turn on Settings > General > Start Docker Desktop when you sign in",
			RuntimeAccess:   "add your account to the docker-users group (as an administrator: net localgroup docker-users %USERNAME% /add), then sign out and back in",
			RuntimeDownload: "https://www.docker.com/products/docker-desktop/", RuntimeApp: `C:\Program Files\Docker\Docker\Docker Desktop.exe`,
			UpdateRuntime: "update Docker Desktop",
			MoreMemory:    "raise WSL 2's memory limit (memory= under [wsl2] in %UserProfile%\\.wslconfig, then wsl --shutdown)",
			InstallOllama: "winget install Ollama.Ollama (it starts at sign-in)",
			Scheduler:     "taskscheduler", Supported: true,
			RiskyDirs: []string{"OneDrive", "Desktop", "Documents", "Downloads"},
		}
	}
	return Profile{OS: goos, Name: goos, Machine: "this machine", Runtime: "Docker", InstallRuntime: "install Docker", StartRuntime: "start Docker", UpdateRuntime: "update Docker",
		MoreMemory: "give the container runtime more memory", InstallOllama: "install Ollama from https://ollama.com"}
}

// JobPath is the PATH scheduled jobs run with; launchd and systemd both
// start jobs with a minimal one. Windows jobs keep the user's own.
func (p Profile) JobPath(home string) string {
	if p.OS == "windows" {
		return ""
	}
	dirs := []string{"/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"}
	switch p.OS {
	case "darwin":
		dirs = append([]string{filepath.Join(home, ".orbstack", "bin"), "/opt/homebrew/bin"}, dirs...)
	case "linux":
		dirs = append([]string{filepath.Join(home, ".local", "bin")}, dirs...)
	}
	return strings.Join(dirs, ":")
}

// Unreachable says why the runtime did not answer (err) and what to do:
// this account is not allowed to use it, or it is not running.
func (p Profile) Unreachable(err error) string {
	if docker.NoAccess(err) && p.RuntimeAccess != "" {
		return "this account may not use " + p.Runtime + " yet: " + p.RuntimeAccess
	}
	return p.Runtime + " is not running: " + p.StartRuntime
}
