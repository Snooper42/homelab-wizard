package qbitconf

import (
	"crypto/pbkdf2"
	"crypto/sha512"
	"encoding/base64"
	"regexp"
	"strings"
	"testing"
)

// verify checks a password the way qBittorrent does
// (Utils::Password::PBKDF2::verify): base64 salt and key, split on ':',
// PBKDF2-HMAC-SHA512 with 100,000 rounds and a 64-byte key.
func verify(t *testing.T, stored, password string) bool {
	t.Helper()
	salt64, key64, ok := strings.Cut(stored, ":")
	if !ok {
		t.Fatalf("no ':' in %q", stored)
	}
	salt, err1 := base64.StdEncoding.DecodeString(salt64)
	key, err2 := base64.StdEncoding.DecodeString(key64)
	if err1 != nil || err2 != nil || len(salt) != 16 || len(key) != 64 {
		t.Fatalf("salt %d bytes (%v), key %d bytes (%v)", len(salt), err1, len(key), err2)
	}
	got, err := pbkdf2.Key(sha512.New, password, salt, 100000, 64)
	if err != nil {
		t.Fatal(err)
	}
	return string(got) == string(key)
}

func TestFirstConfigSignsInWithThePassword(t *testing.T) {
	data, err := First("admin", "s3cret-pw")
	if err != nil {
		t.Fatal(err)
	}
	conf := string(data)
	m := regexp.MustCompile(`(?m)^WebUI\\Password_PBKDF2="@ByteArray\(([^)]+)\)"$`).FindStringSubmatch(conf)
	if m == nil {
		t.Fatalf("no password line:\n%s", conf)
	}
	if !verify(t, m[1], "s3cret-pw") || verify(t, m[1], "other") {
		t.Fatal("the stored hash doesn't check out as qBittorrent checks it")
	}
	if !Verify(data, "s3cret-pw") || Verify(data, "other") || Verify([]byte("[Preferences]\n"), "") {
		t.Fatal("Verify disagrees")
	}
	// The image's own defaults stay (it copies them only when there's no file).
	for _, want := range []string{`WebUI\Username=admin`, "[LegalNotice]\nAccepted=true", `Downloads\SavePath=/downloads/`, `Downloads\TempPath=/downloads/incomplete/`, `WebUI\ServerDomains=*`} {
		if !strings.Contains(conf, want) {
			t.Errorf("missing %q in:\n%s", want, conf)
		}
	}
	if strings.Contains(conf, "s3cret-pw") {
		t.Fatal("the password itself is in the file")
	}
	again, _ := First("admin", "s3cret-pw")
	if string(again) == conf {
		t.Fatal("two files share a salt")
	}
}

func TestFirstConfigNeedsAPassword(t *testing.T) {
	if _, err := First("admin", ""); err == nil {
		t.Fatal("no error for an empty password")
	}
	if _, err := First("ad\nmin", "pw"); err == nil {
		t.Fatal("no error for a user name that would break the file")
	}
}
