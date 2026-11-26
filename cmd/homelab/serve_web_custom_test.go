package main

import (
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// Your own app's settings may be passwords: the web page's AddCustom is
// https only, as Plan and Install are (Q review of #911), and sends them to
// homelab custom add on its input (custom.AddArgs).
func TestWebAddCustomIsHTTPSOnly(t *testing.T) {
	root, _ := repoCopy(t)
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	m := h.webInstallMethods()["AddCustom"]
	if !m.Change || !m.Private {
		t.Errorf("AddCustom: Change %v, Private %v; want both", m.Change, m.Private)
	}
}
