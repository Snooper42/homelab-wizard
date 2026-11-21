// Package qbitconf writes qBittorrent's first settings file, so its Web UI
// has the homelab's login from its very first start and never prints a
// temporary password (arr-loop item 1d).
package qbitconf

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"regexp"
	"strings"
)

// Path is where the file sits inside qBittorrent's /config folder.
const Path = "qBittorrent/qBittorrent.conf"

// defaults are linuxserver/qbittorrent's own /defaults/qBittorrent.conf
// (checked Nov 19, 2026), which its start-up copies only when there's no
// file yet: written in its place, they must stay.
const defaults = `[AutoRun]
enabled=false
program=

[LegalNotice]
Accepted=true

[Preferences]
Connection\UPnP=false
Connection\PortRangeMin=6881
Downloads\SavePath=/downloads/
Downloads\ScanDirsV2=@Variant(\0\0\0\x1c\0\0\0\0)
Downloads\TempPath=/downloads/incomplete/
WebUI\Address=*
WebUI\ServerDomains=*
`

// hash stores a password as qBittorrent does (Utils::Password::PBKDF2):
// a 16-byte random salt and PBKDF2-HMAC-SHA512 over 100,000 rounds into
// 64 bytes, each base64, joined by ':'.
func hash(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key, err := pbkdf2.Key(sha512.New, password, salt, 100000, 64)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(salt) + ":" + base64.StdEncoding.EncodeToString(key), nil
}

// First is the settings file for a qBittorrent that has never started:
// the image's defaults, with user and password as its Web UI login. The
// password itself isn't in it, only its hash.
func First(user, password string) ([]byte, error) {
	if password == "" {
		return nil, errors.New("no password for qBittorrent")
	}
	if user == "" || strings.ContainsAny(user, "\r\n") {
		return nil, errors.New("qBittorrent's user name must be one line")
	}
	h, err := hash(password)
	if err != nil {
		return nil, err
	}
	// LocalHostAuth=false lets Gluetun hand qBittorrent the VPN's forwarded
	// port from the loopback the two share, from the very first connect
	// (compose/media-automation.yaml, VPN_PORT_FORWARDING_UP_COMMAND).
	return []byte(defaults + `WebUI\LocalHostAuth=false` + "\n" + `WebUI\Username=` + user + "\n" + `WebUI\Password_PBKDF2="@ByteArray(` + h + `)"` + "\n"), nil
}

var storedRe = regexp.MustCompile(`(?m)^WebUI\\Password_PBKDF2="@ByteArray\(([^)]+)\)"\r?$`)

// Verify reports whether a settings file's Web UI password is password,
// checked as qBittorrent checks it (Utils::Password::PBKDF2::verify).
func Verify(conf []byte, password string) bool {
	m := storedRe.FindSubmatch(conf)
	if m == nil {
		return false
	}
	salt64, key64, ok := strings.Cut(string(m[1]), ":")
	if !ok {
		return false
	}
	salt, err1 := base64.StdEncoding.DecodeString(salt64)
	key, err2 := base64.StdEncoding.DecodeString(key64)
	if err1 != nil || err2 != nil || len(key) == 0 {
		return false
	}
	got, err := pbkdf2.Key(sha512.New, password, salt, 100000, len(key))
	return err == nil && subtle.ConstantTimeCompare(got, key) == 1
}

// SetLogin is a settings file with its Web UI login made user and password
// (only the hash is written), every other line kept: for a qBittorrent made
// before the wizard, whose own password isn't the homelab's. qBittorrent
// writes its settings back when it stops, so it must be stopped first.
func SetLogin(conf []byte, user, password string) ([]byte, error) {
	if password == "" {
		return nil, errors.New("no password for qBittorrent")
	}
	if user == "" || strings.ContainsAny(user, "\r\n") {
		return nil, errors.New("qBittorrent's user name must be one line")
	}
	h, err := hash(password)
	if err != nil {
		return nil, err
	}
	login := []string{`WebUI\Username=` + user, `WebUI\Password_PBKDF2="@ByteArray(` + h + `)"`}
	var out []string
	section, at := "", -1
	for _, line := range strings.Split(strings.TrimRight(string(conf), "\n"), "\n") {
		t := strings.TrimRight(line, "\r")
		if strings.HasPrefix(t, "[") {
			section = t
		}
		if section == "[Preferences]" && (strings.HasPrefix(t, `WebUI\Username=`) || strings.HasPrefix(t, `WebUI\Password_PBKDF2=`)) {
			continue
		}
		out = append(out, line)
		if section == "[Preferences]" && strings.TrimSpace(t) != "" {
			at = len(out) // after the section's last line
		}
	}
	if at < 0 {
		out = append(out, "", "[Preferences]")
		at = len(out)
	}
	out = append(out[:at], append(login, out[at:]...)...)
	return []byte(strings.Join(out, "\n") + "\n"), nil
}
