// Package usage keeps a month of what the apps take from the machine: one
// sample every 5 minutes of the processor (the sum of docker stats' CPU %)
// and memory (bytes), in all and for each app, and when the nightly jobs ran,
// for Analytics' Day, Week and Month (lane D, D2). Nothing leaves the
// machine: the agent writes data/usage-history.json, 1 to 2 MB a month for
// thirty apps, and drops what's older than 31 days.
package usage

import (
	"encoding/json"
	"errors"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

const (
	// Every is how often the agent takes a sample.
	Every = 5 * time.Minute
	// Keep is how long a sample is kept.
	Keep = 31 * 24 * time.Hour
	// MaxPoints is the most points Read gives: a longer span is averaged down to it.
	MaxPoints = 600
)

// Path is where the agent keeps the samples.
func Path(root string) string { return filepath.Join(root, "data", "usage-history.json") }

// Reading is one app's share of a sample.
type Reading struct {
	CPU float64 // percent of one core, as docker stats counts it
	Mem float64 // bytes
}

// FromStats is a sample from docker stats, by container (core.Usage names each by its compose service); two
// containers of the same name add up.
func FromStats(stats []docker.Stat) map[string]Reading {
	out := map[string]Reading{}
	for _, s := range stats {
		r := out[s.Name]
		r.CPU += s.CPU
		r.Mem += MemBytes(s.Mem)
		out[s.Name] = r
	}
	return out
}

// MemBytes reads docker stats' memory ("12.5MiB", "1.2GiB", "512kB") as bytes; 0 when it can't.
func MemBytes(s string) float64 {
	s = strings.TrimSpace(s)
	i := strings.IndexFunc(s, func(r rune) bool { return (r < '0' || r > '9') && r != '.' })
	if i <= 0 {
		return 0
	}
	n, err := strconv.ParseFloat(s[:i], 64)
	if err != nil {
		return 0
	}
	unit := map[string]float64{"B": 1, "KiB": 1 << 10, "MiB": 1 << 20, "GiB": 1 << 30, "TiB": 1 << 40,
		"kB": 1e3, "KB": 1e3, "MB": 1e6, "GB": 1e9, "TB": 1e12}[strings.TrimSpace(s[i:])]
	return n * unit
}

// Series is one app's processor and memory, a value for each time.
type Series struct {
	CPU []float64 `json:"cpu"`
	Mem []float64 `json:"mem"`
}

// Job is when a nightly job (the backup, the updates, the backups' check) started.
type Job struct {
	Name string `json:"name"`
	At   string `json:"at"` // RFC 3339
}

// History is a span of samples, oldest first: a time each, the apps' processor and memory in all, each app's own
// (0 while it wasn't running), and the nightly jobs that started in it.
type History struct {
	At   []string          `json:"at"`  // RFC 3339, in the machine's time zone
	CPU  []float64         `json:"cpu"` // percent, the sum over the apps
	Mem  []float64         `json:"mem"` // bytes
	Apps map[string]Series `json:"apps"`
	Jobs []Job             `json:"jobs"`
}

// stored is the file: one array a column, so a month stays small. The processor is kept to a tenth of a percent, memory in whole MiB.
type stored struct {
	At   []int64               `json:"at"` // Unix seconds
	CPU  []float64             `json:"cpu"`
	Mem  []float64             `json:"mem"`
	Apps map[string]*storedApp `json:"apps"`
	Jobs []storedJob           `json:"jobs,omitempty"`
}

type storedApp struct {
	CPU []float64 `json:"cpu"`
	Mem []float64 `json:"mem"`
}

type storedJob struct {
	Name string `json:"name"`
	At   int64  `json:"at"`
}

func round(v float64, places int) float64 {
	p := math.Pow(10, float64(places))
	return math.Round(v*p) / p
}

// fit makes v n long: cut, or padded with zeros.
func fit(v []float64, n int) []float64 {
	if len(v) >= n {
		return v[:n]
	}
	return append(v, make([]float64, n-len(v))...)
}

// even makes every column as long as At (a file cut short or edited by hand).
func (s *stored) even() {
	n := len(s.At)
	s.CPU, s.Mem = fit(s.CPU, n), fit(s.Mem, n)
	if s.Apps == nil {
		s.Apps = map[string]*storedApp{}
	}
	for id, a := range s.Apps {
		if a == nil {
			delete(s.Apps, id)
			continue
		}
		a.CPU, a.Mem = fit(a.CPU, n), fit(a.Mem, n)
	}
}

func load(data []byte) (stored, error) {
	var s stored
	if len(data) > 0 {
		if err := json.Unmarshal(data, &s); err != nil {
			return stored{}, err
		}
	}
	s.even()
	return s, nil
}

// update changes the file under its lock, written whole, as the savings' history is; a file it can't read starts
// again.
func update(path string, change func(s *stored)) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return lockedfile.Update(path, 0o600, func(old []byte) ([]byte, bool) {
		s, err := load(old)
		if err != nil {
			s, _ = load(nil)
		}
		change(&s)
		data, err := json.Marshal(s)
		return data, err == nil
	})
}

// prune drops what's older than Keep before now, a sample at or after now (the clock put back), and an app with
// nothing left.
func (s *stored) prune(now time.Time) {
	cutoff, at := now.Add(-Keep).Unix(), now.Unix()
	from, to := 0, len(s.At)
	for from < to && s.At[from] < cutoff {
		from++
	}
	for to > from && s.At[to-1] >= at {
		to--
	}
	s.At, s.CPU, s.Mem = s.At[from:to], s.CPU[from:to], s.Mem[from:to]
	for id, a := range s.Apps {
		a.CPU, a.Mem = a.CPU[from:to], a.Mem[from:to]
		used := false
		for i := range a.CPU {
			used = used || a.CPU[i] != 0 || a.Mem[i] != 0
		}
		if !used {
			delete(s.Apps, id)
		}
	}
	jobs := s.Jobs[:0]
	for _, j := range s.Jobs {
		if j.At >= cutoff {
			jobs = append(jobs, j)
		}
	}
	s.Jobs = jobs
}

// Record adds the sample taken at now: each app's reading, and their sum.
func Record(path string, now time.Time, apps map[string]Reading) error {
	return update(path, func(s *stored) {
		s.prune(now)
		cpu, mem := 0.0, 0.0
		for id, r := range apps {
			a := s.Apps[id]
			if a == nil {
				a = &storedApp{CPU: make([]float64, len(s.At)), Mem: make([]float64, len(s.At))}
				s.Apps[id] = a
			}
			a.CPU, a.Mem = append(a.CPU, round(r.CPU, 1)), append(a.Mem, math.Round(r.Mem/(1<<20)))
			cpu, mem = cpu+r.CPU, mem+r.Mem
		}
		s.At = append(s.At, now.Unix())
		s.CPU, s.Mem = append(s.CPU, round(cpu, 1)), append(s.Mem, math.Round(mem/(1<<20)))
		s.even() // the apps not running now get a 0
	})
}

// RecordJob notes that a nightly job started at.
func RecordJob(path, name string, at time.Time) error {
	return update(path, func(s *stored) { s.Jobs = append(s.Jobs, storedJob{Name: name, At: at.Unix()}) })
}

// Read is the last days (1 to 31) before now, oldest first. A span of more than MaxPoints samples is averaged down
// to at most MaxPoints, each point the mean of the samples it stands for, at the last one's time. No file yet is
// an empty history.
func Read(path string, now time.Time, days int) (History, error) {
	h := History{At: []string{}, CPU: []float64{}, Mem: []float64{}, Apps: map[string]Series{}, Jobs: []Job{}}
	days = min(max(days, 1), int(Keep/(24*time.Hour)))
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return h, nil
	}
	if err != nil {
		return h, err
	}
	s, err := load(data)
	if err != nil {
		return h, err
	}
	since := now.Add(-time.Duration(days) * 24 * time.Hour).Unix()
	from := 0
	for from < len(s.At) && s.At[from] < since {
		from++
	}
	n := len(s.At) - from
	step := max(1, (n+MaxPoints-1)/MaxPoints)
	mean := func(v []float64, i, j int, scale float64) float64 {
		sum := 0.0
		for _, x := range v[i:j] {
			sum += x
		}
		return round(sum/float64(j-i), 2) * scale
	}
	apps := map[string]*Series{}
	for id := range s.Apps {
		apps[id] = &Series{CPU: []float64{}, Mem: []float64{}}
	}
	for i := from; i < len(s.At); i += step {
		j := min(i+step, len(s.At))
		h.At = append(h.At, time.Unix(s.At[j-1], 0).In(now.Location()).Format(time.RFC3339))
		h.CPU = append(h.CPU, mean(s.CPU, i, j, 1))
		h.Mem = append(h.Mem, math.Round(mean(s.Mem, i, j, 1<<20)))
		for id, a := range s.Apps {
			apps[id].CPU = append(apps[id].CPU, mean(a.CPU, i, j, 1))
			apps[id].Mem = append(apps[id].Mem, math.Round(mean(a.Mem, i, j, 1<<20)))
		}
	}
	for id, a := range apps {
		h.Apps[id] = *a
	}
	for _, j := range s.Jobs {
		if j.At >= since && j.At <= now.Unix() {
			h.Jobs = append(h.Jobs, Job{Name: j.Name, At: time.Unix(j.At, 0).In(now.Location()).Format(time.RFC3339)})
		}
	}
	return h, nil
}
