//go:build windows

package docker

import (
	"fmt"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/Microsoft/go-winio"
)

// listenEngine is where a fake engine listens: a named pipe of its own, as
// Docker Desktop's. host is how DOCKER_HOST names it.
func listenEngine(t *testing.T) (l net.Listener, addr, host string) {
	t.Helper()
	addr = fmt.Sprintf(`\\.\pipe\homelab-test-%d`, time.Now().UnixNano())
	l, err := winio.ListenPipe(addr, nil)
	if err != nil {
		t.Fatal(err)
	}
	return l, addr, "npipe://" + strings.ReplaceAll(addr, `\`, "/")
}
