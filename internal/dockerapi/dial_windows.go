//go:build windows

package dockerapi

import (
	"context"
	"net"
	"strings"
	"time"

	"github.com/Microsoft/go-winio"
)

// dial reaches the engine at addr: a named pipe (\\.\pipe\docker_engine),
// as Docker Desktop and the Windows engine listen.
func dial(ctx context.Context, addr string) (net.Conn, error) {
	return winio.DialPipeContext(ctx, addr)
}

// pipes are where Docker Desktop and the Windows engine listen when
// DOCKER_HOST and the current context say nothing.
var pipes = []string{`\\.\pipe\docker_engine`, `\\.\pipe\dockerDesktopLinuxEngine`}

// address is the pipe a DOCKER_HOST or a context names
// (npipe:////./pipe/docker_engine), as a path.
func address(host string) (string, bool) {
	p, ok := strings.CutPrefix(host, "npipe://")
	if !ok || p == "" {
		return "", false
	}
	return strings.ReplaceAll(p, "/", `\`), true
}

// listening is whether a pipe answers at p.
func listening(p string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	c, err := winio.DialPipeContext(ctx, p)
	if err != nil {
		return false
	}
	c.Close()
	return true
}

func defaults(string) []string { return pipes }
