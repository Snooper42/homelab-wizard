package media

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The answers as Radarr's /api/v3/movie/lookup, Sonarr's /api/v3/series/lookup,
// and Jellyfin's /Items/RemoteSearch/Movie give them, trimmed.
const (
	radarrFound   = `[{"title":"The Big Lebowski","year":1998,"tmdbId":115},{"title":"The Big Lebowski","year":1998,"tmdbId":115},{"title":"The Making of The Big Lebowski","year":1998},{"title":"","year":2001}]`
	sonarrFound   = `[{"title":"Severance","year":2022,"tvdbId":371980},{"title":"Severance (2006)","year":2006}]`
	jellyfinFound = `[{"Name":"The Big Lebowski","ProductionYear":1998,"ProviderIds":{"Tmdb":"115"}}]`
)

func titleServer(t *testing.T, seen *[]*http.Request, answer func(r *http.Request) (int, string)) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		r.Body = io.NopCloser(strings.NewReader(string(body)))
		r2 := r.Clone(context.Background())
		r2.Body = io.NopCloser(strings.NewReader(string(body)))
		*seen = append(*seen, r2)
		code, text := answer(r)
		w.WriteHeader(code)
		_, _ = w.Write([]byte(text))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestFindTitlesAsksRadarrForAFilmAndListsEachOnce(t *testing.T) {
	var seen []*http.Request
	srv := titleServer(t, &seen, func(r *http.Request) (int, string) { return 200, radarrFound })
	got, err := FindTitles(context.Background(), srv.Client(), "movie", " big lebowski ", []TitleSource{
		{App: "jellyfin", URL: srv.URL, Key: "jf"}, {App: "sonarr", URL: srv.URL, Key: "s"}, {App: "radarr", URL: srv.URL + "/", Key: "r"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(seen) != 1 || seen[0].URL.Path != "/api/v3/movie/lookup" || seen[0].URL.Query().Get("term") != "big lebowski" || seen[0].Header.Get("X-Api-Key") != "r" {
		t.Fatalf("asked %v", seen)
	}
	want := []Title{{"The Big Lebowski", 1998, "Radarr"}, {"The Making of The Big Lebowski", 1998, "Radarr"}}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Errorf("got %+v, want %+v", got, want)
	}
}

func TestFindTitlesAsksSonarrForAShow(t *testing.T) {
	var seen []*http.Request
	srv := titleServer(t, &seen, func(r *http.Request) (int, string) { return 200, sonarrFound })
	got, err := FindTitles(context.Background(), srv.Client(), "show", "severance", []TitleSource{{App: "radarr", URL: srv.URL, Key: "r"}, {App: "sonarr", URL: srv.URL, Key: "s"}})
	if err != nil {
		t.Fatal(err)
	}
	if seen[0].URL.Path != "/api/v3/series/lookup" || seen[0].Header.Get("X-Api-Key") != "s" {
		t.Fatalf("asked %s with %q", seen[0].URL, seen[0].Header.Get("X-Api-Key"))
	}
	if len(got) != 2 || got[0] != (Title{"Severance", 2022, "Sonarr"}) {
		t.Errorf("got %+v", got)
	}
}

func TestFindTitlesFallsBackToJellyfin(t *testing.T) {
	var seen []*http.Request
	srv := titleServer(t, &seen, func(r *http.Request) (int, string) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			return 503, ""
		}
		return 200, jellyfinFound
	})
	got, err := FindTitles(context.Background(), srv.Client(), "movie", "lebowski", []TitleSource{{App: "radarr", URL: srv.URL, Key: "r"}, {App: "jellyfin", URL: srv.URL, Key: "jf"}})
	if err != nil {
		t.Fatal(err)
	}
	jf := seen[1]
	var body struct {
		SearchInfo struct{ Name string }
	}
	_ = json.NewDecoder(jf.Body).Decode(&body)
	if jf.Method != http.MethodPost || jf.URL.Path != "/Items/RemoteSearch/Movie" || body.SearchInfo.Name != "lebowski" || jf.Header.Get("Authorization") != `MediaBrowser Token="jf"` {
		t.Fatalf("asked Jellyfin %s %s %+v %q", jf.Method, jf.URL.Path, body, jf.Header.Get("Authorization"))
	}
	if len(got) != 1 || got[0] != (Title{"The Big Lebowski", 1998, "Jellyfin"}) {
		t.Errorf("got %+v", got)
	}
	// A show goes to Jellyfin's Series search.
	seen = nil
	if _, err := FindTitles(context.Background(), srv.Client(), "show", "x", []TitleSource{{App: "jellyfin", URL: srv.URL, Key: "jf"}}); err != nil || seen[0].URL.Path != "/Items/RemoteSearch/Series" {
		t.Errorf("show: %v, asked %v", err, seen)
	}
}

func TestFindTitlesSaysWhy(t *testing.T) {
	var seen []*http.Request
	srv := titleServer(t, &seen, func(r *http.Request) (int, string) {
		switch r.URL.Query().Get("term") {
		case "refused":
			return 401, ""
		case "garbled":
			return 200, "{"
		}
		return 500, ""
	})
	ctx := context.Background()
	radarr := []TitleSource{{App: "radarr", URL: srv.URL, Key: "r"}}
	for _, c := range []struct {
		kind, term string
		sources    []TitleSource
		want       string
	}{
		{"movie", "x", nil, "nothing here can look titles up"},
		{"movie", "x", []TitleSource{{App: "radarr", URL: srv.URL}, {App: "sonarr", URL: srv.URL, Key: "s"}}, "nothing here can look titles up"},
		{"song", "x", radarr, "no lookup"},
		{"movie", "  ", radarr, "type the name"},
		{"movie", strings.Repeat("x", 201), radarr, "too long"},
		{"movie", "refused", radarr, "Radarr refused its key"},
		{"movie", "garbled", radarr, "couldn't read what Radarr said"},
		{"movie", "other", radarr, "Radarr didn't answer (500)"},
	} {
		if _, err := FindTitles(ctx, srv.Client(), c.kind, c.term, c.sources); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Errorf("%s %q: %v, want %q", c.kind, c.term, err, c.want)
		}
	}
	if _, err := FindTitles(ctx, nil, "movie", "x", nil); !errors.Is(err, ErrNoLookup) {
		t.Errorf("no sources: %v", err)
	}
	srv.Close()
	if _, err := FindTitles(ctx, nil, "movie", "x", radarr); err == nil || !strings.Contains(err.Error(), "is it running") {
		t.Errorf("unreachable: %v", err)
	}
	if _, err := askTitles(ctx, http.DefaultClient, TitleSource{App: "plex"}, "movie", "x"); err == nil {
		t.Error("an app with no lookup answered")
	}
}

func TestArrKeyReadsConfigXML(t *testing.T) {
	dir := t.TempDir()
	if ArrKey(dir) != "" || ArrKey("") != "" {
		t.Error("a key with no config.xml")
	}
	_ = os.WriteFile(filepath.Join(dir, "config.xml"), []byte("<Config><Port>7878</Port><ApiKey> abc123 </ApiKey></Config>"), 0o600)
	if got := ArrKey(dir); got != "abc123" {
		t.Errorf("ArrKey = %q", got)
	}
	_ = os.WriteFile(filepath.Join(dir, "config.xml"), []byte("<Config></Config>"), 0o600)
	if ArrKey(dir) != "" {
		t.Error("a key from a config.xml with none")
	}
}
