package media

// Name these songs (the Inbox's Needs a look): music with no names on it,
// and the artist and album a person types. MusicBrainz, which beets
// matches against too, is asked which albums those are, and the person
// picks one (Rumours · Fleetwood Mac · 1977 · 11 songs). The engine then
// writes that album's names onto the songs and files them (music_tidy.py
// file --album <id>). Nothing is sent but the two names typed.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

// MusicBrainz is where albums are looked up; a test points it elsewhere.
var MusicBrainz = "https://musicbrainz.org/ws/2"

// musicBrainzAgent is how MusicBrainz asks an app to say who it is
// (its rules turn away requests without one).
const musicBrainzAgent = "Homelab Wizard Tidy Up (https://github.com/Snooper42/homelab-wizard)"

// Album is one album MusicBrainz found: its release id (what the engine is
// handed), its name, artist, year, and how many songs it has. Format and
// Country tell two editions apart ("CD, US" beside "Vinyl, GB").
type Album struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Artist  string `json:"artist"`
	Year    string `json:"year,omitempty"`
	Songs   int    `json:"songs"`
	Format  string `json:"format,omitempty"`
	Country string `json:"country,omitempty"`
}

// maxAlbums is how many the sheet shows: enough for the editions that
// differ, few enough to read.
const maxAlbums = 8

// FindAlbums asks MusicBrainz for the albums called album by artist, the
// closest first. Editions alike in every way the sheet shows (the same
// name, artist, year, songs, and format) are listed once.
func FindAlbums(ctx context.Context, client *http.Client, artist, album string) ([]Album, error) {
	artist, album = strings.TrimSpace(artist), strings.TrimSpace(album)
	if album == "" {
		return nil, errors.New("say the album's name")
	}
	if utf8.RuneCountInString(artist) > 200 || utf8.RuneCountInString(album) > 200 {
		return nil, errors.New("that name is too long")
	}
	q := `release:"` + luceneQuote(album) + `"`
	if artist != "" {
		q += ` AND artist:"` + luceneQuote(artist) + `"`
	}
	u := MusicBrainz + "/release/?" + url.Values{"query": {q}, "fmt": {"json"}, "limit": {"25"}}.Encode()
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	var body []byte
	for attempt := 0; ; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", musicBrainzAgent)
		req.Header.Set("Accept", "application/json")
		resp, err := client.Do(req)
		if err != nil {
			return nil, errors.New("couldn't reach MusicBrainz: is this computer online?")
		}
		body, err = io.ReadAll(io.LimitReader(resp.Body, 4<<20))
		_ = resp.Body.Close()
		if err != nil {
			return nil, errors.New("couldn't read what MusicBrainz said")
		}
		// Busy (it allows about one question a second): once more, after a pause.
		if (resp.StatusCode == http.StatusServiceUnavailable || resp.StatusCode == http.StatusTooManyRequests) && attempt == 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(1500 * time.Millisecond):
			}
			continue
		}
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("MusicBrainz didn't answer (%d): try again in a minute", resp.StatusCode)
		}
		break
	}
	var found struct {
		Releases []struct {
			ID           string `json:"id"`
			Title        string `json:"title"`
			Date         string `json:"date"`
			Country      string `json:"country"`
			TrackCount   int    `json:"track-count"`
			ArtistCredit []struct {
				Name       string `json:"name"`
				JoinPhrase string `json:"joinphrase"`
			} `json:"artist-credit"`
			Media []struct {
				Format     string `json:"format"`
				TrackCount int    `json:"track-count"`
			} `json:"media"`
		} `json:"releases"`
	}
	if err := json.Unmarshal(body, &found); err != nil {
		return nil, errors.New("couldn't read what MusicBrainz said")
	}
	out := []Album{}
	seen := map[string]bool{}
	for _, r := range found.Releases {
		if !releaseID.MatchString(r.ID) {
			continue
		}
		a := Album{ID: r.ID, Title: r.Title, Songs: r.TrackCount, Country: r.Country}
		for _, c := range r.ArtistCredit {
			a.Artist += c.Name + c.JoinPhrase
		}
		a.Artist = strings.TrimSpace(a.Artist)
		if len(r.Date) >= 4 {
			a.Year = r.Date[:4]
		}
		var formats []string
		songs := 0
		for _, m := range r.Media {
			songs += m.TrackCount
			if m.Format != "" && (len(formats) == 0 || formats[len(formats)-1] != m.Format) {
				formats = append(formats, m.Format)
			}
		}
		if a.Songs == 0 {
			a.Songs = songs
		}
		if len(r.Media) > 1 && len(formats) == 1 {
			a.Format = fmt.Sprintf("%d×%s", len(r.Media), formats[0])
		} else {
			a.Format = strings.Join(formats, " + ")
		}
		key := strings.ToLower(strings.Join([]string{a.Title, a.Artist, a.Year, fmt.Sprint(a.Songs), a.Format}, "\x00"))
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, a)
		if len(out) == maxAlbums {
			break
		}
	}
	return out, nil
}

// releaseID is a MusicBrainz release's id, as the engine takes it.
var releaseID = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// IsReleaseID says whether s is a MusicBrainz release id (what Name these
// songs hands the engine), so nothing else can stand in its place.
func IsReleaseID(s string) bool { return releaseID.MatchString(s) }

// luceneQuote makes typed words safe inside a quoted MusicBrainz search
// term: a quote or backslash of their own can't end it early.
func luceneQuote(s string) string {
	return strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(s)
}
