package media

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

const rumoursID = "0e7f9bd8-ae28-3d16-8c3e-5b0c0c8e5a3d"

// A search answer as MusicBrainz gives it (/ws/2/release/?query=...&fmt=json), trimmed.
const rumoursFound = `{"count":3,"releases":[
 {"id":"0e7f9bd8-ae28-3d16-8c3e-5b0c0c8e5a3d","score":100,"title":"Rumours","date":"1977-02-04","country":"US","track-count":11,
  "artist-credit":[{"name":"Fleetwood Mac","artist":{"id":"x","name":"Fleetwood Mac"}}],"media":[{"format":"Vinyl","track-count":11}]},
 {"id":"1e7f9bd8-ae28-3d16-8c3e-5b0c0c8e5a3d","score":100,"title":"Rumours","date":"1977-02-04","country":"GB","track-count":11,
  "artist-credit":[{"name":"Fleetwood Mac"}],"media":[{"format":"Vinyl","track-count":11}]},
 {"id":"2e7f9bd8-ae28-3d16-8c3e-5b0c0c8e5a3d","score":97,"title":"Rumours","date":"2013","track-count":38,
  "artist-credit":[{"name":"Fleetwood Mac"}],"media":[{"format":"CD","track-count":12},{"format":"CD","track-count":14},{"format":"CD","track-count":12}]},
 {"id":"3e7f9bd8-ae28-3d16-8c3e-5b0c0c8e5a3d","score":80,"title":"Rumours Live","date":"","media":[{"format":"CD","track-count":9},{"format":"DVD","track-count":9}],
  "artist-credit":[{"name":"Lindsey Buckingham","joinphrase":" & "},{"name":"Christine McVie"}]},
 {"id":"not-an-id","title":"Bad"}
]}`

func TestFindAlbumsAsksForWhatsTypedAndListsEachEditionOnce(t *testing.T) {
	var got *http.Request
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r
		_, _ = w.Write([]byte(rumoursFound))
	}))
	defer srv.Close()
	defer func(was string) { MusicBrainz = was }(MusicBrainz)
	MusicBrainz = srv.URL

	albums, err := FindAlbums(context.Background(), srv.Client(), " Fleetwood Mac ", `Rumours "deluxe"`)
	if err != nil {
		t.Fatal(err)
	}
	if q := got.URL.Query().Get("query"); q != `release:"Rumours \"deluxe\"" AND artist:"Fleetwood Mac"` {
		t.Errorf("query = %s", q)
	}
	if got.URL.Path != "/release/" || got.URL.Query().Get("fmt") != "json" {
		t.Errorf("asked %s", got.URL)
	}
	if ua := got.Header.Get("User-Agent"); !strings.Contains(ua, "Homelab Wizard") {
		t.Errorf("User-Agent = %q: MusicBrainz turns away a request that doesn't say who it is", ua)
	}
	want := []Album{
		{ID: rumoursID, Title: "Rumours", Artist: "Fleetwood Mac", Year: "1977", Songs: 11, Format: "Vinyl", Country: "US"},
		{ID: "2e7f9bd8-ae28-3d16-8c3e-5b0c0c8e5a3d", Title: "Rumours", Artist: "Fleetwood Mac", Year: "2013", Songs: 38, Format: "3×CD"},
		{ID: "3e7f9bd8-ae28-3d16-8c3e-5b0c0c8e5a3d", Title: "Rumours Live", Artist: "Lindsey Buckingham & Christine McVie", Songs: 18, Format: "CD + DVD"},
	}
	if len(albums) != len(want) {
		t.Fatalf("got %d albums, want %d: %+v", len(albums), len(want), albums)
	}
	for i := range want {
		if albums[i] != want[i] {
			t.Errorf("album %d = %+v, want %+v", i, albums[i], want[i])
		}
	}
}

func TestFindAlbumsWithNoArtistAsksForTheAlbumAlone(t *testing.T) {
	var q string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q = r.URL.Query().Get("query")
		_, _ = w.Write([]byte(`{"releases":[]}`))
	}))
	defer srv.Close()
	defer func(was string) { MusicBrainz = was }(MusicBrainz)
	MusicBrainz = srv.URL
	albums, err := FindAlbums(context.Background(), srv.Client(), "", "Tusk")
	if err != nil || albums == nil || len(albums) != 0 {
		t.Fatalf("albums = %v, err = %v: none found is an empty list, not an error", albums, err)
	}
	if q != `release:"Tusk"` {
		t.Errorf("query = %s", q)
	}
}

func TestFindAlbumsAsksOnceMoreWhenBusy(t *testing.T) {
	var n atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if n.Add(1) == 1 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		_, _ = w.Write([]byte(rumoursFound))
	}))
	defer srv.Close()
	defer func(was string) { MusicBrainz = was }(MusicBrainz)
	MusicBrainz = srv.URL
	albums, err := FindAlbums(context.Background(), srv.Client(), "Fleetwood Mac", "Rumours")
	if err != nil || len(albums) == 0 || n.Load() != 2 {
		t.Fatalf("albums = %d, err = %v, asked %d times", len(albums), err, n.Load())
	}
}

func TestFindAlbumsSaysWhatWentWrong(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Query().Get("query"), "garbled") {
			_, _ = w.Write([]byte("<html>"))
			return
		}
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer func(was string) { MusicBrainz = was }(MusicBrainz)
	MusicBrainz = srv.URL
	for _, c := range []struct{ artist, album, want string }{
		{"A", "", "say the album's name"},
		{"A", strings.Repeat("x", 201), "too long"},
		{"A", "B", "MusicBrainz didn't answer (503)"},
		{"A", "garbled", "couldn't read what MusicBrainz said"},
	} {
		if _, err := FindAlbums(context.Background(), srv.Client(), c.artist, c.album); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Errorf("FindAlbums(%q, %q) = %v, want %q", c.artist, c.album, err, c.want)
		}
	}
	srv.Close()
	if _, err := FindAlbums(context.Background(), nil, "A", "B"); err == nil || !strings.Contains(err.Error(), "online") {
		t.Errorf("unreachable: %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := FindAlbums(ctx, nil, "A", "B"); err == nil {
		t.Error("a cancelled lookup went on")
	}
}

func TestIsReleaseID(t *testing.T) {
	for s, want := range map[string]bool{rumoursID: true, strings.ToUpper(rumoursID): false, "--library": false, "": false, rumoursID + "x": false} {
		if IsReleaseID(s) != want {
			t.Errorf("IsReleaseID(%q) = %v", s, !want)
		}
	}
}
