package core

import (
	"net"
	"time"
)

// TrayAddr is where the menu bar item (the tray icon on Windows and Linux)
// listens while it runs: holding it keeps a second one from starting, and
// a "quit" line sent there makes it quit (homelab quit). A variable only
// so tests can use an address of their own.
var TrayAddr = "127.0.0.1:47231"

// QuitTray asks a running menu bar item to quit; false when none answers.
func QuitTray() bool {
	c, err := net.DialTimeout("tcp", TrayAddr, time.Second)
	if err != nil {
		return false
	}
	defer c.Close()
	_ = c.SetDeadline(time.Now().Add(time.Second))
	_, err = c.Write([]byte("quit\n"))
	return err == nil
}
