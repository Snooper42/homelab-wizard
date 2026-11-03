//go:build windows

package docker

import (
	"fmt"
	"net"
	"os"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/Microsoft/go-winio"
)

// pipes numbers the fake engines' pipes. A name from the clock alone could
// repeat: Windows' clock doesn't move every nanosecond, so two engines made
// one after the other (as TestEventsFromTheAPI does) got the same name, and
// the second pipe was refused (Access is denied).
var pipes atomic.Int64

// listenEngine is where a fake engine listens: a named pipe of its own, as
// Docker Desktop's. host is how DOCKER_HOST names it.
func listenEngine(t *testing.T) (l net.Listener, addr, host string) {
	t.Helper()
	addr = fmt.Sprintf(`\\.\pipe\homelab-test-%d-%d`, os.Getpid(), pipes.Add(1))
	l, err := winio.ListenPipe(addr, nil)
	if err != nil {
		t.Fatal(err)
	}
	return l, addr, "npipe://" + strings.ReplaceAll(addr, `\`, "/")
}
