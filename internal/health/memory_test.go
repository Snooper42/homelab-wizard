package health

import (
	"testing"
	"time"
)

// TestMemoryPressure: high on one run says nothing; high again 10 minutes
// or more later alerts, once however long it lasts; coming down after an
// alert says so, once. Status sees it only while the alert stands.
func TestMemoryPressure(t *testing.T) {
	const gib = int64(1) << 30
	t0 := time.Date(2026, 11, 6, 10, 0, 0, 0, time.UTC)
	high := Memory{Used: 15 * gib, Total: 16 * gib, Biggest: []AppMemory{{ID: "immich", Name: "Immich", Bytes: 6 * gib}}}
	low := Memory{Used: 8 * gib, Total: 16 * gib}
	steps := []struct {
		name        string
		m           Memory
		at          time.Duration
		alert, back bool
		shown       bool // in the Summary, for Status
	}{
		{"low: nothing", low, 0, false, false, false},
		{"high once: not yet", high, 15 * time.Minute, false, false, false},
		{"high 5 minutes later: not yet", high, 20 * time.Minute, false, false, false},
		{"high 15 minutes after the first: alert", high, 30 * time.Minute, true, false, true},
		{"still high: said once", high, 45 * time.Minute, false, false, true},
		{"unknown total: not high", Memory{Used: 15 * gib}, 60 * time.Minute, false, true, false},
		{"low again: nothing more", low, 75 * time.Minute, false, false, false},
		{"high once after: not yet", high, 90 * time.Minute, false, false, false},
		{"exactly 90%: high, 10 minutes on: alert", Memory{Used: 9 * gib, Total: 10 * gib}, 100 * time.Minute, true, false, true},
		{"down: back", low, 115 * time.Minute, false, true, false},
	}
	var s State
	for _, st := range steps {
		alert, back := s.StepMemory(st.m, t0.Add(st.at))
		if alert != st.alert || back != st.back {
			t.Fatalf("%s: alert %v back %v, want %v %v", st.name, alert, back, st.alert, st.back)
		}
		if got := s.Summary().Memory != nil; got != st.shown {
			t.Fatalf("%s: shown on Status %v, want %v", st.name, got, st.shown)
		}
	}
	if !s.Memory.Since.IsZero() || s.Memory.Alerted {
		t.Fatalf("down: since %v alerted %v, want both cleared", s.Memory.Since, s.Memory.Alerted)
	}
	// Kept across runs: the record reads back the time it went high.
	s.StepMemory(high, t0)
	data := `{"failing":{},"memory":{"used":1,"total":1,"since":"2026-11-06T10:00:00Z","alerted":true}}`
	if r := parseState([]byte(data)); r.Memory == nil || !r.Memory.Alerted || !r.Memory.Since.Equal(t0) {
		t.Fatalf("read back: %+v", r.Memory)
	}
}
