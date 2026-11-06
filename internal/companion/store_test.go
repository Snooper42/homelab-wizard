package companion

import (
	"path/filepath"
	"sync"
	"testing"
	"time"
)

// A change made by another process while homelab serve notes a phone's last
// visit is kept: the visit's save never brings back a phone removed, or a
// right taken away, a moment before (N22). Each Store is a process of its
// own: its mutex is no help, the file's lock is.
func TestAChangeFromAnotherProcessIsNeverSavedOver(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(s *Store, phone string) error
		check  func(t *testing.T, d Device, found bool)
	}{
		{
			name:   "removed",
			change: func(s *Store, phone string) error { _, err := s.Remove(phone); return err },
			check: func(t *testing.T, d Device, found bool) {
				if found {
					t.Errorf("a removed phone came back: %+v", d)
				}
			},
		},
		{
			name:   "no more changes",
			change: func(s *Store, phone string) error { _, err := s.SetCanChange(phone, false); return err },
			check: func(t *testing.T, d Device, found bool) {
				if !found || d.CanChange {
					t.Errorf("Can make changes came back: %+v (found %v)", d, found)
				}
			},
		},
		{
			name:   "Finances off",
			change: func(s *Store, phone string) error { _, err := s.SetFinances(phone, "off"); return err },
			check: func(t *testing.T, d Device, found bool) {
				if !found || d.Finances != "" {
					t.Errorf("Finances came back: %+v (found %v)", d, found)
				}
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "data", "phones.json")
			app := NewStore(path)
			code, err := app.NewPairing("Anna's phone", true, FinancesEdit)
			if err != nil {
				t.Fatal(err)
			}
			_, token, err := app.Pair(code, "")
			if err != nil {
				t.Fatal(err)
			}

			// homelab serve: a visit an hour on, so it notes the time. Its
			// clock is read after the store is, and that is when the app's
			// change starts, in a process of its own.
			serve := NewStore(path)
			var once sync.Once
			changed := make(chan error, 1)
			serve.Now = func() time.Time {
				once.Do(func() {
					go func() { changed <- tc.change(app, "Anna's phone") }()
					// Long enough for a change that takes no lock to be
					// saved; one that waits for the lock waits on.
					select {
					case err := <-changed:
						changed <- err
					case <-time.After(300 * time.Millisecond):
					}
				})
				return time.Now().Add(time.Hour)
			}
			serve.Lookup(token)
			if err := <-changed; err != nil {
				t.Fatal(err)
			}
			d, found := NewStore(path).Lookup(token)
			tc.check(t, d, found)
		})
	}
}

// Many saves at once from as many processes all land: none fails on a
// temporary file another is renaming, and none is lost.
func TestPairingsAtOnceAreAllKept(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "phones.json")
	const n = 20
	var wg sync.WaitGroup
	errs := make(chan error, n)
	for range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			s := NewStore(path)
			code, err := s.NewPairing("", false, "")
			if err == nil {
				_, _, err = s.Pair(code, "Phone")
			}
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	if got := len(NewStore(path).Devices()); got != n {
		t.Errorf("%d of %d phones kept", got, n)
	}
}
