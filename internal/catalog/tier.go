package catalog

// The household's core apps (the reliability reset, Nov 27, 2026): the
// photos, passwords, documents, films, music, and the requests and library
// apps around them, with the network and the backups they stand on. These
// are the apps the homelab keeps working first, their flows the ones checked
// on the owner's Mac (docs/Known Issues.md); every other app is
// Experimental: it installs and runs, with less behind it. Nothing is
// removed or hidden for it; the tier is a label.
var GoldTier = []string{
	"immich-server",      // photos
	"vaultwarden",        // passwords
	"paperless",          // documents
	"jellyfin",           // films and TV (the program on this machine)
	"jellyfin-container", // the same, in a container
	"navidrome",          // music
	"seerr",              // asking for a film or a show
	"sonarr",             // shows
	"radarr",             // films
	"prowlarr",           // where they are found
	"adguard-home",       // the home's DNS
	"tailscale",          // reaching home from away
	"duplicati",          // the backups
}

// The two tiers, as App.Tier names them.
const (
	TierGold         = "gold"
	TierExperimental = "experimental"
)

// Tier is the app's: gold for GoldTier's, experimental for every other.
func (a *App) Tier() string {
	for _, id := range GoldTier {
		if a.ID == id {
			return TierGold
		}
	}
	return TierExperimental
}
