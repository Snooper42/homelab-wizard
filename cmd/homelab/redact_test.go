package main

import (
	"strings"
	"testing"
)

// What an app prints of its own secrets never reaches a phone, the
// restart-loop alert, or a report, though .env does not hold it: every
// paired device may read logs, a look-only phone and a kiosk included.
// qBittorrent prints its Web UI admin password until a permanent one is
// set (its docs page says to read it there, on the computer); Jellyfin
// logs request URLs with their api_key.
func TestAnAppsOwnSecretsAreTakenOut(t *testing.T) {
	const pass, key = "Xq7rT2pLm", "0123456789abcdef0123456789abcdef"
	log := strings.Join([]string{
		"The WebUI administrator username is: admin",
		"The WebUI administrator password was not set. A temporary password is provided for this session: " + pass,
		"[INF] HTTP Response 200 to 172.18.0.5. GET /Items?api_key=" + key + "&Limit=1",
		`{"level":"info","password":"` + pass + `"}`,
		"Generated admin password: " + pass,
	}, "\n")
	h := &homelab{root: t.TempDir()}
	for name, out := range map[string]string{
		"a phone's Logs":         h.phoneLog(log),
		"the alert and a report": redact(log, nil),
	} {
		if strings.Contains(out, pass) || strings.Contains(out, key) {
			t.Errorf("%s kept an app's own secret:\n%s", name, out)
		}
		if !strings.Contains(out, "username is: admin") || !strings.Contains(out, "HTTP Response 200") {
			t.Errorf("%s lost the log's plain words:\n%s", name, out)
		}
	}
}
