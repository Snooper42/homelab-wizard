package ports

import (
	"net"
	"runtime"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/compose"
)

// The host prober against this runner's own sockets.
func TestHostProber(t *testing.T) {
	p := NewHostProber()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := l.Addr().(*net.TCPAddr).Port
	if p.Free("127.0.0.1", port, "tcp") {
		t.Errorf("tcp %d is held, but free", port)
	}
	l.Close()
	if !p.Free("127.0.0.1", port, "tcp") {
		t.Errorf("tcp %d was let go, but not free", port)
	}

	u, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	uport := u.LocalAddr().(*net.UDPAddr).Port
	if p.Free("127.0.0.1", uport, "udp") {
		t.Errorf("udp %d is held, but free", uport)
	}
	u.Close()
	if !p.Free("127.0.0.1", uport, "udp") {
		t.Errorf("udp %d was let go, but not free", uport)
	}

	// A listener netstat saw (the Mac's AirPlay Receiver on 5000) counts,
	// whatever a bind says.
	p.listeners[port] = true
	if p.Free("", port, "tcp") {
		t.Error("a listener netstat saw is free")
	}

	// Docker publishes as root, so a port this account may not bind (below
	// 1024 on Linux) is free unless a socket holds it.
	if !p.Free("127.0.0.1", 1, "tcp") || !p.Free("127.0.0.1", 1, "udp") {
		t.Error("port 1, which nothing holds, is not free")
	}
}

// On Linux, the kernel's tables show a socket that holds a port.
func TestProcHolds(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	port := l.Addr().(*net.TCPAddr).Port
	got := procHolds("127.0.0.1", port, "tcp")
	if want := runtime.GOOS == "linux"; got != want {
		t.Errorf("%s: procHolds = %v, want %v", runtime.GOOS, got, want)
	}
	if procHolds("10.255.255.1", port, "tcp") {
		t.Error("a listener on 127.0.0.1 collides with one on another address")
	}
}

func TestAppBindings(t *testing.T) {
	c, _ := setup(t, nil)
	ntfy, ok := c.Get("ntfy")
	if !ok {
		t.Fatal("no ntfy")
	}
	got := AppBindings(ntfy, compose.MapLookup(map[string]string{"NTFY_PORT": "9999"}))
	if len(got) == 0 || got[0].HostPort != 9999 || got[0].Var != "NTFY_PORT" || got[0].Protocol != "tcp" || got[0].App != ntfy {
		t.Fatalf("%+v", got)
	}
	for _, b := range got {
		if b.Protocol != strings.ToLower(b.Protocol) {
			t.Errorf("protocol %q", b.Protocol)
		}
	}
}
