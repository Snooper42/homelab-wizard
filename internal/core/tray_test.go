package core

import (
	"bufio"
	"errors"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// useTraySocket points the menu bar item's socket at a folder of the
// test's own, and the old address at nothing.
func useTraySocket(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "hw", "tray.sock")
	savedSock, savedAddr := TraySocket, TrayAddr
	TraySocket = func() string { return path }
	TrayAddr = "127.0.0.1:1"
	t.Cleanup(func() { TraySocket, TrayAddr = savedSock, savedAddr })
	return path
}

// Item 105/166: the menu bar item listened on 127.0.0.1:47231, which any
// account on the computer could reach (and send "quit") or hold first,
// so this account's item never started. It now listens on a socket in
// the account's own folder; one holding the old port changes nothing.
func TestTheTrayListensWhereOnlyThisAccountCan(t *testing.T) {
	path := useTraySocket(t)
	squatter, err := net.Listen("tcp", "127.0.0.1:0") // another account, holding the old address
	if err != nil {
		t.Fatal(err)
	}
	defer squatter.Close()
	TrayAddr = squatter.Addr().String()

	l, err := ListenTray()
	if err != nil {
		t.Fatalf("the tray didn't start with the old port held: %v", err)
	}
	defer l.Close()
	if runtime.GOOS != "windows" {
		fi, err := os.Stat(path)
		if err != nil || fi.Mode().Perm() != 0o600 {
			t.Errorf("the socket's mode is %v (%v), not 0600", fi.Mode().Perm(), err)
		}
		if di, err := os.Stat(filepath.Dir(path)); err != nil || di.Mode().Perm() != 0o700 {
			t.Errorf("its folder's mode is %v (%v), not 0700", di.Mode().Perm(), err)
		}
	}
	asked := make(chan string, 1)
	go func() {
		c, err := l.Accept()
		if err != nil {
			return
		}
		line, _ := bufio.NewReader(c).ReadString('\n')
		asked <- strings.TrimSpace(line)
		c.Close()
	}()
	if !QuitTray() {
		t.Fatal("QuitTray didn't reach the tray on its socket")
	}
	if got := <-asked; got != "quit" {
		t.Errorf("the tray was sent %q", got)
	}
}

func TestASecondTrayDoesNotStartAndAStaleSocketIsReplaced(t *testing.T) {
	path := useTraySocket(t)
	l, err := ListenTray()
	if err != nil {
		t.Fatal(err)
	}
	go func() {
		for {
			c, err := l.Accept()
			if err != nil {
				return
			}
			c.Close()
		}
	}()
	if _, err := ListenTray(); !errors.Is(err, ErrTrayRunning) {
		t.Errorf("a second tray: %v, want ErrTrayRunning", err)
	}
	l.Close()
	if runtime.GOOS != "windows" {
		_ = os.WriteFile(path, nil, 0o600) // what a tray that stopped hard can leave
	}
	again, err := ListenTray()
	if err != nil {
		t.Fatalf("after the first stopped: %v", err)
	}
	again.Close()
}

// An older tray, still on the old address, is asked to quit there.
func TestQuitReachesAnOlderTray(t *testing.T) {
	useTraySocket(t)
	old, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer old.Close()
	TrayAddr = old.Addr().String()
	go func() {
		if c, err := old.Accept(); err == nil {
			c.Close()
		}
	}()
	if !QuitTray() {
		t.Error("an older tray on the old address wasn't asked")
	}
}

// QuitTray sends "quit" to the menu bar item at its address, and says
// false when none listens there.
func TestQuitTray(t *testing.T) {
	useTraySocket(t) // the socket is a folder of the test's own: only the address answers here
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	saved := TrayAddr
	TrayAddr = l.Addr().String()
	t.Cleanup(func() { TrayAddr = saved })
	got := make(chan string, 1)
	go func() {
		c, err := l.Accept()
		if err != nil {
			got <- err.Error()
			return
		}
		line, _ := bufio.NewReader(c).ReadString('\n')
		c.Close()
		got <- strings.TrimSpace(line)
	}()
	if !QuitTray() {
		t.Fatal("QuitTray did not reach the listener")
	}
	if line := <-got; line != "quit" {
		t.Fatalf("sent %q", line)
	}
	l.Close()
	if QuitTray() {
		t.Fatal("QuitTray answered true with nothing listening")
	}
}
