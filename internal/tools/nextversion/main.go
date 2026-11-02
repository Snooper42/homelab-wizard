// Command nextversion prints the version the release workflow builds a
// push to main as: one more than the newest numbered release, so each
// release is the next number (0.17.0, 0.17.1, … 0.17.10), and after .10 the
// next minor starts at .0 (0.18.0). VERSION is the floor: set to a newer
// minor or major (0.19.0, 1.0.0), the next build is that. A build of a
// commit already released (a re-run) keeps its number.
//
//	go run ./internal/tools/nextversion "$(cat VERSION)" "$(git tag -l 'v*')" "$(git tag --points-at HEAD 'v*')"
package main

import (
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
)

// lastPatch is the highest patch of a minor version; the release after it
// starts the next minor.
const lastPatch = 10

type version struct{ major, minor, patch int }

func (v version) String() string { return fmt.Sprintf("%d.%d.%d", v.major, v.minor, v.patch) }

func (v version) less(o version) bool {
	if v.major != o.major {
		return v.major < o.major
	}
	if v.minor != o.minor {
		return v.minor < o.minor
	}
	return v.patch < o.patch
}

var numbered = regexp.MustCompile(`^v?(\d+)\.(\d+)\.(\d+)$`)

func parse(s string) (version, bool) {
	m := numbered.FindStringSubmatch(strings.TrimSpace(s))
	if m == nil {
		return version{}, false
	}
	var n [3]int
	for i := range n {
		n[i], _ = strconv.Atoi(m[i+1])
	}
	return version{n[0], n[1], n[2]}, true
}

// next is the version to build: floor is VERSION, tags every v* tag, and
// here the v* tags on the commit being built.
func next(floor string, tags, here []string) (string, error) {
	for _, t := range here {
		if v, ok := parse(t); ok {
			return v.String(), nil
		}
	}
	f, ok := parse(floor)
	if !ok {
		return "", fmt.Errorf("VERSION is %q, not a version like 0.17.0", strings.TrimSpace(floor))
	}
	var latest version
	found := false
	for _, t := range tags {
		if v, ok := parse(t); ok && (!found || latest.less(v)) {
			latest, found = v, true
		}
	}
	// A newer minor or major in VERSION, or nothing released yet: VERSION itself.
	if !found || (version{latest.major, latest.minor, 0}).less(version{f.major, f.minor, 0}) {
		return f.String(), nil
	}
	n := version{latest.major, latest.minor, latest.patch + 1}
	if latest.patch >= lastPatch {
		n = version{latest.major, latest.minor + 1, 0}
	}
	if n.less(f) {
		n = f // VERSION asks for a later patch of the same minor
	}
	return n.String(), nil
}

func main() {
	if len(os.Args) != 4 {
		fmt.Fprintln(os.Stderr, `usage: nextversion "<VERSION>" "<every v* tag>" "<the v* tags on HEAD>"`)
		os.Exit(2)
	}
	v, err := next(os.Args[1], strings.Fields(os.Args[2]), strings.Fields(os.Args[3]))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println(v)
}
