package health

import "time"

// Memory pressure: the apps together using nearly all the memory Docker
// has. Each watchdog run measures it (StepMemory); once it has stayed high
// for MemoryFor, the watchdog alerts once, naming the biggest apps, and
// Status shows them with Stop until it comes down.
const (
	// MemoryHigh is the share of the memory Docker has that counts as high.
	MemoryHigh = 0.9
	// MemoryFor is how long it stays high before the alert: two watchdog
	// runs in a row, at least this far apart, so a moment's peak (an
	// import, a scan) says nothing.
	MemoryFor = 10 * time.Minute
)

// Memory is the apps' memory as the watchdog last measured it.
type Memory struct {
	Used  int64 `json:"used"`  // bytes, all the apps together
	Total int64 `json:"total"` // bytes Docker has
	// Since is the first run in a row it was high; zero while it is not.
	Since time.Time `json:"since,omitzero"`
	// Alerted: high for MemoryFor and said so; Status offers Stop.
	Alerted bool `json:"alerted,omitempty"`
	// Biggest are the apps using the most, largest first (three at most).
	Biggest []AppMemory `json:"biggest,omitempty"`
}

// AppMemory is one app's memory: its catalog id (empty for a container the
// catalog does not know, which Status offers no Stop for) and name.
type AppMemory struct {
	ID    string `json:"id,omitempty"`
	Name  string `json:"name"`
	Bytes int64  `json:"bytes"`
}

// High says the apps use MemoryHigh or more of what Docker has.
func (m Memory) High() bool {
	return m.Total > 0 && float64(m.Used) >= MemoryHigh*float64(m.Total)
}

// StepMemory takes this run's measure. alert is true the first run it has
// been high for MemoryFor (said once, however long it stays high); back is
// true the first run it is no longer high after an alert.
func (s *State) StepMemory(m Memory, now time.Time) (alert, back bool) {
	prev := s.Memory
	if !m.High() {
		back = prev != nil && prev.Alerted
		m.Since, m.Alerted = time.Time{}, false
		s.Memory = &m
		return false, back
	}
	m.Since, m.Alerted = now, false
	if prev != nil && !prev.Since.IsZero() {
		m.Since, m.Alerted = prev.Since, prev.Alerted
	}
	if !m.Alerted && now.Sub(m.Since) >= MemoryFor {
		m.Alerted, alert = true, true
	}
	s.Memory = &m
	return alert, false
}
