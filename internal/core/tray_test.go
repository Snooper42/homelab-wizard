package core

import (
	"bufio"
	"net"
	"strings"
	"testing"
)

// QuitTray sends "quit" to the menu bar item at its address, and says
// false when none listens there.
func TestQuitTray(t *testing.T) {
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
