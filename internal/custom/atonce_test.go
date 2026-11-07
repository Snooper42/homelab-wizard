package custom

import (
	"fmt"
	"sync"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

// Apps added at once (the app and homelab custom add, each a process of
// its own) are all kept, each on a port of its own: none is written over
// by another add that read the file a moment before.
func TestAddsAtOnceAreAllKept(t *testing.T) {
	root := repoCopy(t)
	c, err := catalog.Load(root)
	if err != nil {
		t.Fatal(err)
	}
	const n = 6
	var wg sync.WaitGroup
	errs := make(chan error, n)
	for i := range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			spec := Spec{ID: fmt.Sprintf("wiki-%d", i), Name: fmt.Sprintf("Wiki %d", i), Image: "ghcr.io/requarks/wiki:2", Port: 3000, Category: "productivity"}
			_, _, err := Add(root, c, spec, nil)
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Error(err)
		}
	}
	next, err := catalog.Load(root)
	if err != nil {
		t.Fatal(err)
	}
	if got := len(Apps(next)); got != n {
		t.Errorf("%d of %d apps kept", got, n)
	}
}
