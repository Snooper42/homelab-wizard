package downloads

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// queueRecord is one entry of Sonarr's, Radarr's or Lidarr's queue, with
// the show, film or album it is for (includeSeries, includeEpisode,
// includeMovie, includeArtist, includeAlbum; each app's QueueController).
type queueRecord struct {
	SeriesID              int     `json:"seriesId"`
	MovieID               int     `json:"movieId"`
	Title                 string  `json:"title"` // the release's own name
	Status                string  `json:"status"`
	TrackedDownloadStatus string  `json:"trackedDownloadStatus"`
	TrackedDownloadState  string  `json:"trackedDownloadState"`
	Size                  float64 `json:"size"`
	Sizeleft              float64 `json:"sizeleft"`
	Timeleft              string  `json:"timeleft"`
	DownloadID            string  `json:"downloadId"`
	Series                *struct {
		Title string `json:"title"`
	} `json:"series"`
	Episode *struct {
		SeasonNumber  int `json:"seasonNumber"`
		EpisodeNumber int `json:"episodeNumber"`
	} `json:"episode"`
	Movie *struct {
		Title string `json:"title"`
		Year  int    `json:"year"`
	} `json:"movie"`
	Artist *struct {
		ArtistName string `json:"artistName"`
	} `json:"artist"`
	Album *struct {
		Title string `json:"title"`
	} `json:"album"`
}

// name is what the record is for, as a person says it: "Severance S2 E3",
// "Dune: Part Two (2024)", "Björk: Homogenic"; the show alone as group.
func (r queueRecord) name() (name, group string) {
	switch {
	case r.Series != nil && r.Episode != nil:
		return fmt.Sprintf("%s S%d E%d", r.Series.Title, r.Episode.SeasonNumber, r.Episode.EpisodeNumber), r.Series.Title
	case r.Series != nil:
		return r.Series.Title, r.Series.Title
	case r.Movie != nil && r.Movie.Year > 0:
		return fmt.Sprintf("%s (%d)", r.Movie.Title, r.Movie.Year), ""
	case r.Movie != nil:
		return r.Movie.Title, ""
	case r.Artist != nil && r.Album != nil:
		return r.Artist.ArtistName + ": " + r.Album.Title, ""
	}
	return r.Title, ""
}

var include = map[string]string{
	"sonarr": "&includeSeries=true&includeEpisode=true",
	"radarr": "&includeMovie=true",
	"lidarr": "&includeArtist=true&includeAlbum=true",
}

// seerrRequest is one of Seerr's requests (GET /api/v1/request): approved,
// its film or show not yet available (filter=processing; routes/request.ts).
type seerrRequest struct {
	Is4k      bool      `json:"is4k"`
	Type      string    `json:"type"` // movie, tv
	CreatedAt time.Time `json:"createdAt"`
	Media     struct {
		Status              int  `json:"status"` // MediaStatus: 4 partly available
		ExternalServiceID   *int `json:"externalServiceId"`
		ExternalServiceID4k *int `json:"externalServiceId4k"`
	} `json:"media"`
}

// partlyAvailable is Seerr's MediaStatus.PARTIALLY_AVAILABLE: a show with
// some episodes in the library, the rest perhaps not aired yet.
const partlyAvailable = 4

// Read reads what's on the way from the apps running now (wiring's view:
// a resting app isn't in it, and nothing is pending for it), and how full
// the media and downloads drives are (vols), into the card. installed: any
// media app is installed, running or resting.
func Read(ctx context.Context, apps map[string]wiring.App, env map[string]string, installed bool, vols []diskspace.Volume, now time.Time) Card {
	client := &http.Client{Timeout: 10 * time.Second}
	r := Readings{Apps: installed, Volumes: vols}
	// Which films and shows each app has in its queue, for the requests.
	queued := map[string]map[int]bool{}
	read := map[string]bool{}
	for _, q := range Queues {
		a, ok := apps[q.ID]
		if !ok {
			continue
		}
		key := Key(a.ConfigDir)
		if key == "" || a.URL == "" {
			continue // not set up yet: nothing in its queue
		}
		var page struct {
			Records []queueRecord `json:"records"`
		}
		if err := Get(ctx, client, a.URL, "/api/"+q.API+"/queue?pageSize=200"+include[q.ID], key, &page); err != nil {
			r.Unread = append(r.Unread, a.Name)
			continue
		}
		read[q.ID] = true
		queued[q.ID] = map[int]bool{}
		for _, rec := range page.Records {
			queued[q.ID][max(rec.SeriesID, rec.MovieID)] = true
			name, group := rec.name()
			r.Records = append(r.Records, Record{
				App: a.Name, Name: name, Group: group, DownloadID: rec.DownloadID,
				Status: rec.Status, TrackedState: rec.TrackedDownloadState, TrackedStatus: rec.TrackedDownloadStatus,
				Size: rec.Size, Left: rec.Sizeleft, TimeLeft: rec.Timeleft,
			})
		}
	}
	if a, ok := apps["qbittorrent"]; ok {
		// Unread (no password yet, or it didn't answer): a download stays
		// as its app says; the inbox's card says why qBittorrent can't be read.
		r.Torrents, _ = QbitList(ctx, client, QbitURL(a, env), env)
	}
	if a, ok := apps["seerr"]; ok {
		if key := SeerrKey(a.ConfigDir); key != "" && a.URL != "" {
			var page struct {
				Results []seerrRequest `json:"results"`
			}
			if err := Get(ctx, client, a.URL, "/api/v1/request?take=100&filter=processing", key, &page); err != nil {
				r.Unread = append(r.Unread, a.Name)
			} else {
				for _, req := range page.Results {
					if q, ok := request(ctx, client, apps, req, queued, read, now); ok {
						r.Requests = append(r.Requests, q)
					}
				}
			}
		}
	}
	return Build(r)
}

// request is one of Seerr's requests as the card needs it: whether its
// film or show is in its app's queue, and its name and whether it's out
// yet, from that app (Radarr's movie, Sonarr's series).
func request(ctx context.Context, client *http.Client, apps map[string]wiring.App, req seerrRequest, queued map[string]map[int]bool, read map[string]bool, now time.Time) (Request, bool) {
	id, appID, what := req.Media.ExternalServiceID, "radarr", "A film someone asked for"
	if req.Is4k {
		id = req.Media.ExternalServiceID4k
	}
	if req.Type == "tv" {
		appID, what = "sonarr", "A show someone asked for"
		if req.Media.Status == partlyAvailable {
			return Request{}, false // some of it is here; the rest may not have aired
		}
	}
	a := apps[appID]
	q := Request{App: a.Name, Name: what, Age: now.Sub(req.CreatedAt), Read: read[appID]}
	if q.App == "" {
		q.App = map[string]string{"radarr": "Radarr", "sonarr": "Sonarr"}[appID]
	}
	if id == nil || !q.Read {
		return q, true // not sent to the app yet, or the app is resting
	}
	if queued[appID][*id] {
		q.Queued = true
		return q, true
	}
	key := Key(a.ConfigDir)
	switch appID {
	case "radarr":
		var m struct {
			Title       string `json:"title"`
			Year        int    `json:"year"`
			IsAvailable bool   `json:"isAvailable"`
		}
		if Get(ctx, client, a.URL, "/api/v3/movie/"+strconv.Itoa(*id), key, &m) == nil && m.Title != "" {
			q.Name, q.NotOutYet = m.Title, !m.IsAvailable
			if m.Year > 0 {
				q.Name = fmt.Sprintf("%s (%d)", m.Title, m.Year)
			}
		}
	case "sonarr":
		var s struct {
			Title  string `json:"title"`
			Status string `json:"status"` // continuing, ended, upcoming
		}
		if Get(ctx, client, a.URL, "/api/v3/series/"+strconv.Itoa(*id), key, &s) == nil && s.Title != "" {
			q.Name, q.NotOutYet = s.Title, s.Status == "upcoming"
		}
	}
	return q, true
}
