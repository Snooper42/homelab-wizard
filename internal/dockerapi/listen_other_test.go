//go:build !windows

package dockerapi

import (
	"net"
	"os"
	"path/filepath"
	"testing"
)

// listenEngine is where a fake engine listens: a unix socket, in a short
// folder (a Mac allows a socket's path 104 bytes). host is how
// DOCKER_HOST names it.
func listenEngine(t *testing.T) (l net.Listener, addr, host string) {
	t.Helper()
	dir, err := os.MkdirTemp("", "eng")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	addr = filepath.Join(dir, "d.sock")
	if l, err = net.Listen("unix", addr); err != nil {
		t.Fatal(err)
	}
	return l, addr, "unix://" + addr
}
