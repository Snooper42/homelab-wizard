// Package storage records how much each person keeps in the homelab: their
// photos and videos in Immich, read from its database by the nightly
// backup and shown on Status.
package storage

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/pgexec"
)

// Person is one person's share.
type Person struct {
	Name  string `json:"name"`
	Email string `json:"email,omitempty"`
	Bytes int64  `json:"bytes"`
}

// Record is the latest reading.
type Record struct {
	When   time.Time `json:"when"`
	Photos []Person  `json:"photos"` // Immich, largest first
}

// Path is where the reading is kept.
func Path(root string) string { return filepath.Join(root, "data", "storage.json") }

// Load reads the reading; none yet is an empty one.
func Load(path string) Record {
	var r Record
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &r)
	}
	if r.Photos == nil {
		r.Photos = []Person{}
	}
	return r
}

// Save writes the reading.
func (r Record) Save(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(r, "", "  ")
	return os.WriteFile(path, append(data, '\n'), 0o600)
}

// immichQueries read each person's quota usage, which Immich keeps up to
// date as files arrive: its schema since 1.137, and before it.
var immichQueries = []string{
	`\copy (select coalesce(nullif(name, ''), email), email, coalesce("quotaUsageInBytes", 0) from "user" where "deletedAt" is null) to stdout with (format csv)`,
	`\copy (select coalesce(nullif(name, ''), email), email, coalesce("quotaUsageInBytes", 0) from users where "deletedAt" is null) to stdout with (format csv)`,
}

// ImmichPhotos reads what each person's photos and videos take in Immich.
func ImmichPhotos(ctx context.Context, ex pgexec.Execer, container string) ([]Person, error) {
	var last error
	for _, q := range immichQueries {
		var b bytes.Buffer
		if err := pgexec.Query(ctx, ex, &b, container, "", q); err != nil {
			last = err
			continue
		}
		rows, err := csv.NewReader(&b).ReadAll()
		if err != nil {
			return nil, err
		}
		out := []Person{}
		for _, r := range rows {
			if len(r) != 3 {
				continue
			}
			n, _ := strconv.ParseInt(r[2], 10, 64)
			out = append(out, Person{Name: r[0], Email: r[1], Bytes: n})
		}
		sort.SliceStable(out, func(i, j int) bool { return out[i].Bytes > out[j].Bytes })
		return out, nil
	}
	return nil, fmt.Errorf("reading Immich's storage per person: %w", last)
}
