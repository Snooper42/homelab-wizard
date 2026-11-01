package duplicati

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// The homelab's own records in data/ (finance.json, the ledger, receipts,
// people's welcome pages, sso, the paired phones) go off-site only inside
// the encrypted Secrets job, copied there by the nightly backup. No folder
// Duplicati reads for another job may hold them: only data/appdata (the
// apps' data) of data/ may be mounted as a source.
func TestNoOtherJobReadsTheRecords(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "..", "compose", "system.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	mount := regexp.MustCompile(`^\s*-\s*(\S+?):/source/[^:\s]*`)
	n := 0
	for i, line := range strings.Split(string(data), "\n") {
		m := mount.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		n++
		src := strings.TrimSuffix(filepath.ToSlash(filepath.Clean(m[1])), "/")
		if src == "." || src == "data" || (strings.HasPrefix(src, "data/") && src != "data/appdata" && !strings.HasPrefix(src, "data/appdata/")) {
			t.Errorf("compose/system.yaml:%d mounts %s as a source: the records in data/ would go off-site outside the Secrets job", i+1, m[1])
		}
	}
	if n < 2 {
		t.Fatalf("read only %d source mounts from compose/system.yaml", n)
	}
}
