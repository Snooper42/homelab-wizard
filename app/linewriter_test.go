package main

import (
	"bytes"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/ui"
)

func TestLineWriterTakesTheSteps(t *testing.T) {
	var lines []string
	var steps []ui.StepEvent
	w := &lineWriter{emit: func(s string) { lines = append(lines, s) }, step: func(s ui.StepEvent) { steps = append(steps, s) }}
	var out bytes.Buffer
	u := &ui.UI{Out: &out, Progress: true}
	u.Step(2, 5, "Updating %s", "vikunja")
	_, _ = w.Write([]byte(" Container vikunja  Started\n" + out.String() + "  ✓ done"))
	w.Flush()
	if len(steps) != 1 || steps[0] != (ui.StepEvent{N: 2, Total: 5, Text: "Updating vikunja"}) {
		t.Errorf("steps: %+v", steps)
	}
	if strings.Join(lines, "|") != " Container vikunja  Started|  ✓ done" {
		t.Errorf("lines: %q", lines)
	}
	// Without a step handler, a step line is left out, not shown as JSON.
	lines = nil
	w = &lineWriter{emit: func(s string) { lines = append(lines, s) }}
	_, _ = w.Write(out.Bytes())
	if len(lines) != 0 {
		t.Errorf("shown: %q", lines)
	}
}
