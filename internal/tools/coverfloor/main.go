// Command coverfloor checks each package's test coverage against its floor
// (make coverage): it reads a coverage profile (go test -coverprofile) and
// a file of "package percent" lines, and fails when a package is below its
// floor. Floors are raised as tests are added and never lowered without a
// reason in the pull request.
package main

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"path"
	"sort"
	"strconv"
	"strings"
)

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "usage: coverfloor <coverage profile> <floors file>")
		os.Exit(2)
	}
	got, err := coverage(os.Args[1])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	floors, err := readFloors(os.Args[2])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	// The floors name packages within this module (internal/sso).
	if module := modulePath("go.mod"); module != "" {
		short := map[string]float64{}
		for p, v := range got {
			short[strings.TrimPrefix(p, module+"/")] = v
		}
		got = short
	}
	if failed := check(got, floors, os.Stdout); failed > 0 {
		fmt.Printf("%d package(s) below their floor\n", failed)
		os.Exit(1)
	}
}

// coverage is each package's share of statements covered, in percent, from
// a profile's "file:start,end statements count" lines.
func coverage(profile string) (map[string]float64, error) {
	f, err := os.Open(profile)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	type tally struct{ all, hit int }
	seen := map[string]bool{}
	pkgs := map[string]*tally{}
	s := bufio.NewScanner(f)
	for s.Scan() {
		line := s.Text()
		if strings.HasPrefix(line, "mode:") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) != 3 {
			continue
		}
		// A block can appear once per test binary that ran it; count it once.
		block := fields[0]
		n, _ := strconv.Atoi(fields[1])
		count, _ := strconv.Atoi(fields[2])
		file, _, _ := strings.Cut(block, ":")
		pkg := path.Dir(file)
		t := pkgs[pkg]
		if t == nil {
			t = &tally{}
			pkgs[pkg] = t
		}
		if !seen[block] {
			seen[block] = true
			t.all += n
		}
		if count > 0 && !seen[block+" hit"] {
			seen[block+" hit"] = true
			t.hit += n
		}
	}
	out := map[string]float64{}
	for p, t := range pkgs {
		if t.all > 0 {
			out[p] = 100 * float64(t.hit) / float64(t.all)
		}
	}
	return out, s.Err()
}

// modulePath is go.mod's module line, or "".
func modulePath(gomod string) string {
	data, _ := os.ReadFile(gomod)
	for _, line := range strings.Split(string(data), "\n") {
		if m, ok := strings.CutPrefix(strings.TrimSpace(line), "module "); ok {
			return strings.TrimSpace(m)
		}
	}
	return ""
}

// readFloors reads "package percent" lines; # starts a comment.
func readFloors(file string) (map[string]float64, error) {
	data, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}
	out := map[string]float64{}
	for i, line := range strings.Split(string(data), "\n") {
		line, _, _ = strings.Cut(line, "#")
		f := strings.Fields(line)
		if len(f) == 0 {
			continue
		}
		if len(f) != 2 {
			return nil, fmt.Errorf("%s:%d: want a package and a percent", file, i+1)
		}
		v, err := strconv.ParseFloat(strings.TrimSuffix(f[1], "%"), 64)
		if err != nil {
			return nil, fmt.Errorf("%s:%d: %v", file, i+1, err)
		}
		out[f[0]] = v
	}
	return out, nil
}

// check prints each floor's package with its coverage and returns how many
// are below; a package with a floor and no coverage at all counts as 0%.
func check(got, floors map[string]float64, w io.Writer) int {
	var names []string
	for p := range floors {
		names = append(names, p)
	}
	sort.Strings(names)
	failed := 0
	for _, p := range names {
		c := got[p]
		mark := "ok  "
		if c+1e-9 < floors[p] {
			mark, failed = "LOW ", failed+1
		}
		fmt.Fprintf(w, "%s %-60s %5.1f%%  (floor %.0f%%)\n", mark, p, c, floors[p])
	}
	return failed
}
