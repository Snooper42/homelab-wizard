package companion

import (
	"bytes"
	"crypto/ecdh"
	"encoding/base64"
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

var updateVectors = flag.Bool("update-vectors", false, "write apple-client/Tests/Resources/TunnelVectors.json")

// TunnelVectors is what the iPhone app's sealing is tested against
// (apple-client/Tests/TunnelSealTests.swift): fixed keys and nonces, and
// what the computer makes of them. A change to the sealing here changes the
// file, and the Swift tests fail until the app's sealing matches.
type TunnelVectors struct {
	PhonePrivate   string        `json:"phonePrivate"`
	PhonePublic    string        `json:"phonePublic"`
	ComputerPublic string        `json:"computerPublic"`
	DeviceID       string        `json:"deviceID"`
	Info           string        `json:"info"`
	Key            string        `json:"key"`
	Request        tunnelVectorM `json:"request"`
	Answer         tunnelVectorM `json:"answer"`
}

type tunnelVectorM struct {
	AD    string `json:"ad"`
	Nonce string `json:"nonce"`
	Plain string `json:"plain"`
	Box   string `json:"box"`
}

func makeTunnelVectors(t *testing.T) TunnelVectors {
	t.Helper()
	b64 := base64.StdEncoding.EncodeToString
	fixed := func(b byte) []byte { return bytes.Repeat([]byte{b}, 32) }
	phone, err := ecdh.X25519().NewPrivateKey(fixed(0x11))
	if err != nil {
		t.Fatal(err)
	}
	computer, err := ecdh.X25519().NewPrivateKey(fixed(0x22))
	if err != nil {
		t.Fatal(err)
	}
	id := "a1b2c3"
	pub, key, err := tunnelKeysWith(computer, phone.PublicKey().Bytes(), id)
	if err != nil {
		t.Fatal(err)
	}
	reqNonce := bytes.Repeat([]byte{0x33}, 12)
	req, _ := json.Marshal(TunnelRequest{Token: "the-device-token", At: 1762700000000, Method: "Status"})
	reqBox, err := sealWith(key, tunnelAsk+id, reqNonce, req)
	if err != nil {
		t.Fatal(err)
	}
	ansNonce := bytes.Repeat([]byte{0x44}, 12)
	ans, _ := json.Marshal(TunnelAnswer{Status: 200, Result: "all up"})
	ansAD := tunnelAnswer + id + "\x00" + b64(reqNonce)
	ansBox, err := sealWith(key, ansAD, ansNonce, ans)
	if err != nil {
		t.Fatal(err)
	}
	return TunnelVectors{
		PhonePrivate: b64(phone.Bytes()), PhonePublic: b64(phone.PublicKey().Bytes()), ComputerPublic: b64(pub),
		DeviceID: id, Info: tunnelInfo, Key: b64(key),
		Request: tunnelVectorM{AD: tunnelAsk + id, Nonce: b64(reqNonce), Plain: string(req), Box: b64(reqBox)},
		Answer:  tunnelVectorM{AD: ansAD, Nonce: b64(ansNonce), Plain: string(ans), Box: b64(ansBox)},
	}
}

// The file the iPhone app's tests read is what the computer's sealing makes
// today (go test ./internal/companion -run TestTunnelVectors -update-vectors
// writes it).
func TestTunnelVectors(t *testing.T) {
	v := makeTunnelVectors(t)
	// The computer opens its own boxes, and the phone's key is the same key.
	key, _ := base64.StdEncoding.DecodeString(v.Key)
	n, _ := base64.StdEncoding.DecodeString(v.Request.Nonce)
	b, _ := base64.StdEncoding.DecodeString(v.Request.Box)
	if plain, err := Open(key, v.Request.AD, n, b); err != nil || string(plain) != v.Request.Plain {
		t.Fatalf("the vector's request doesn't open: %v", err)
	}
	want, _ := json.MarshalIndent(v, "", "  ")
	want = append(want, '\n')
	_, here, _, _ := runtime.Caller(0)
	path := filepath.Join(filepath.Dir(here), "..", "..", "apple-client", "Tests", "Resources", "TunnelVectors.json")
	if *updateVectors {
		if err := os.WriteFile(path, want, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	got, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(got, want) {
		t.Fatalf("apple-client/Tests/Resources/TunnelVectors.json is out of date: go test ./internal/companion -run TestTunnelVectors -update-vectors (%v)", err)
	}
}
