package core

import (
	"errors"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/engine"
)

// TraySocket is where the menu bar item (the tray icon on Windows and
// Linux) listens while it runs: holding it keeps a second one from
// starting, and a "quit" line sent there makes it quit (homelab quit). It
// is a socket in this account's own folder, beside the engine's (0700),
// so no other account on the computer can reach it, take it first, or
// quit the item. When that path is too long for a socket (macOS allows
// 104 bytes, as with a long home folder), it is a folder of this
// account's own under the temporary folder instead, which ListenTray
// checks belongs to this account alone. A variable only so tests can use
// a socket of their own.
var TraySocket = func() string {
	return trayPath(filepath.Dir(engine.SocketPath()), os.TempDir(), os.Getuid())
}

// maxSocketPath is the longest socket path every system takes (macOS's
// sun_path holds 104 bytes with its ending zero; Linux's and Windows's 108).
const maxSocketPath = 103

func trayPath(home, tmp string, uid int) string {
	if p := filepath.Join(home, "tray.sock"); len(p) <= maxSocketPath {
		return p
	}
	return filepath.Join(tmp, "homelab-wizard-"+strconv.Itoa(uid), "tray.sock")
}

// TrayAddr is where a menu bar item from before 0.17's tray socket
// listened (any account on the computer could reach it): QuitTray still
// asks one there to quit. A variable only so tests can use their own.
var TrayAddr = "127.0.0.1:47231"

// ErrTrayRunning is ListenTray's answer when a menu bar item already runs.
var ErrTrayRunning = errors.New("the homelab's icon is running already")

// ListenTray is the menu bar item's listener on TraySocket, mode 0600 in
// a 0700 folder. A socket left by an item that stopped is replaced; one
// that answers is not (ErrTrayRunning), as the engine's Serve does.
func ListenTray() (net.Listener, error) {
	path := TraySocket()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	if err := ownFolder(filepath.Dir(path)); err != nil {
		return nil, err
	}
	if c, err := net.DialTimeout("unix", path, time.Second); err == nil {
		c.Close()
		return nil, ErrTrayRunning
	}
	_ = os.Remove(path)
	l, err := net.Listen("unix", path)
	if err != nil {
		return nil, err
	}
	_ = os.Chmod(path, 0o600)
	return l, nil
}

// QuitTray asks a running menu bar item to quit, on its socket or, for one
// from an older version, at TrayAddr; false when none answers.
func QuitTray() bool {
	return sendQuit("unix", TraySocket()) || sendQuit("tcp", TrayAddr)
}

func sendQuit(network, addr string) bool {
	c, err := net.DialTimeout(network, addr, time.Second)
	if err != nil {
		return false
	}
	defer c.Close()
	_ = c.SetDeadline(time.Now().Add(time.Second))
	_, err = c.Write([]byte("quit\n"))
	return err == nil
}
