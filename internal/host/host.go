// Package host describes the machine the homelab runs on: macOS with
// OrbStack and launchd, Linux with Docker Engine and systemd, or Windows
// with Docker Desktop and Task Scheduler. Commands
// take their wording, hints, and job settings from the profile.
package host

import (
	"os"
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
	RemoveRuntime   string // how to take it off the machine, once nothing else uses it
	Scheduler       string // "launchd", "systemd", or "taskscheduler"
	MoreMemory      string // how to give the containers more memory
	InstallOllama   string // how to run Ollama outside a container, where it can use the GPU
	Supported       bool
	// SelfInstall: the homelab can set the runtime up itself (homelab
	// runtime install: Docker in the home folder, run as you).
	SelfInstall bool
	// SteamOS: Valve's SteamOS, whose system folders are read-only.
	SteamOS bool
	// RiskyDirs are folders under ~ where privacy controls or file syncing
	// interfere with containers.
	RiskyDirs []string
}

// Current is the profile for the machine running this program.
func Current() Profile {
	p := For(runtime.GOOS)
	if p.OS == "linux" && isSteamOS(readOSRelease()) {
		p = SteamOS(p)
	}
	return p
}

// readOSRelease is /etc/os-release, or "".
func readOSRelease() string {
	data, _ := os.ReadFile("/etc/os-release")
	return string(data)
}

// isSteamOS reports whether os-release is SteamOS's.
func isSteamOS(osRelease string) bool {
	for _, line := range strings.Split(osRelease, "\n") {
		if k, v, ok := strings.Cut(strings.TrimSpace(line), "="); ok && k == "ID" && strings.Trim(v, `"'`) == "steamos" {
			return true
		}
	}
	return false
}

// SteamOS is the Linux profile for SteamOS: its system folders are
// read-only and replaced by every update, so Docker lives in the home
// folder, run as you (homelab runtime install), and nothing is installed
// with the system's package manager.
func SteamOS(p Profile) Profile {
	p.Name, p.SteamOS = "SteamOS", true
	p.Runtime = "Docker"
	p.InstallRuntime = "Setup › Set up Docker for me (homelab runtime install --apply): Docker in your home folder, run as you, kept across SteamOS updates"
	p.StartRuntime = "systemctl --user start docker"
	p.RuntimeAccess = ""
	p.RuntimeDownload = ""
	p.UpdateRuntime = "homelab runtime install --apply, after updating the homelab"
	p.RemoveRuntime = "systemctl --user disable --now docker, then delete ~/.local/share/homelab-wizard/docker and ~/.local/share/docker"
	p.InstallOllama = "download Ollama's standalone build for Linux into your home folder (https://ollama.com/download/linux; its install script needs a writable system), start it with OLLAMA_HOST=0.0.0.0 ollama serve (Docker run as you reaches this machine only through its home-network address, so Ollama answers the home network too)"
	return p
}

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
			RemoveRuntime: "quit OrbStack, drag it from Applications to the Trash, then delete ~/.orbstack",
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
			RemoveRuntime:   "remove the docker-ce, docker-ce-cli, containerd.io, and docker-compose-plugin packages with your package manager, then sudo rm -rf /var/lib/docker /var/lib/containerd",
			MoreMemory:      "add memory to this machine",
			InstallOllama:   "curl -fsSL https://ollama.com/install.sh | sh, then let the containers reach it, and nothing else on the home network: sudo systemctl edit ollama, add Environment=OLLAMA_HOST=172.17.0.1 under [Service] (Docker's own address on this machine; ip -4 -br addr show docker0 shows it) and After=docker.service under [Unit], then sudo systemctl restart ollama",
			Scheduler:       "systemd", Supported: true, SelfInstall: true,
		}
	case "windows":
		return Profile{
			OS: goos, Name: "Windows", Machine: "this PC", Runtime: "Docker Desktop",
			InstallRuntime:  "install Docker Desktop with the WSL 2 backend (winget install Docker.DockerDesktop)",
			StartRuntime:    "start Docker Desktop and turn on Settings > General > Start Docker Desktop when you sign in",
			RuntimeAccess:   "add your account to the docker-users group (as an administrator: net localgroup docker-users %USERNAME% /add), then sign out and back in",
			RuntimeDownload: "https://www.docker.com/products/docker-desktop/", RuntimeApp: `C:\Program Files\Docker\Docker\Docker Desktop.exe`,
			UpdateRuntime: "update Docker Desktop",
			RemoveRuntime: "Settings > Apps > Installed apps > Docker Desktop > Uninstall",
			MoreMemory:    "raise WSL 2's memory limit (memory= under [wsl2] in %UserProfile%\\.wslconfig, then wsl --shutdown)",
			InstallOllama: "winget install Ollama.Ollama (it starts at sign-in)",
			Scheduler:     "taskscheduler", Supported: true,
			RiskyDirs: []string{"OneDrive", "Desktop", "Documents", "Downloads"},
		}
	}
	return Profile{OS: goos, Name: goos, Machine: "this machine", Runtime: "Docker", InstallRuntime: "install Docker", StartRuntime: "start Docker", UpdateRuntime: "update Docker", RemoveRuntime: "remove Docker",
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

// KeepAwakeItem is the entry in the menu bar item's menu (the tray icon's
// on Windows and Linux) that turns KEEP_AWAKE on and off.
func (p Profile) KeepAwakeItem() string {
	switch p.OS {
	case "darwin":
		return "Keep this Mac awake while plugged in"
	case "windows":
		return "Keep this PC awake while plugged in"
	}
	return "Keep this computer awake while plugged in"
}

// TrayMenu is where that entry is: the menu bar item's menu on a Mac, the
// tray icon's elsewhere.
func (p Profile) TrayMenu() string {
	if p.OS == "darwin" {
		return "the menu bar item's menu"
	}
	return "the tray icon's menu"
}

// Unreachable says why the runtime did not answer (err) and what to do:
// this account is not allowed to use it, or it is not running.
func (p Profile) Unreachable(err error) string {
	if docker.NoAccess(err) && p.RuntimeAccess != "" {
		return "this account may not use " + p.Runtime + " yet: " + p.RuntimeAccess
	}
	return p.Runtime + " is not running: " + p.StartRuntime
}
