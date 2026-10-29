//go:build !windows

package dockerapi

import (
	"context"
	"net"
	"os"
	"path/filepath"
	"strings"
)

// dial reaches the engine at addr, a unix socket.
func dial(ctx context.Context, addr string) (net.Conn, error) {
	var d net.Dialer
	return d.DialContext(ctx, "unix", addr)
}

// address is the socket a DOCKER_HOST or a context names (unix:///…).
func address(host string) (string, bool) {
	p, ok := strings.CutPrefix(host, "unix://")
	return p, ok && p != ""
}

// listening is whether a socket is at p.
func listening(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.Mode()&os.ModeSocket != 0
}

// defaults are where OrbStack, Docker Desktop, a rootless engine, and the
// system's engine keep their sockets.
func defaults(home string) []string {
	candidates := []string{
		filepath.Join(home, ".orbstack", "run", "docker.sock"),
		filepath.Join(home, ".docker", "run", "docker.sock"), // Docker Desktop on a Mac
		filepath.Join(home, ".docker", "desktop", "docker.sock"),
	}
	if d := os.Getenv("XDG_RUNTIME_DIR"); d != "" {
		candidates = append(candidates, filepath.Join(d, "docker.sock")) // rootless
	}
	return append(candidates, "/var/run/docker.sock", "/run/docker.sock")
}
