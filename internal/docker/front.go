package docker

// Home Assistant's half of backlog item 89 (N45). Home Assistant reads the
// proxies it trusts from its own configuration.yaml, which the household
// owns, not from the compose file: the starter one trusted every private
// range. Home Assistant is now on the front network alone, where the proxy
// and Tailscale Serve have the addresses below; it answers a forwarded
// request from a hop it doesn't trust with an error, so an existing file
// must name them before Home Assistant starts there. trustFront does that
// before every start (up, update, heal, a rollback), once: it adds the two
// front addresses to the trusted_proxies list and takes out the starter's
// three private ranges when all three are still there. Anything else the
// household wrote stays as it was.

import (
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

// HomeAssistantConfig is Home Assistant's configuration.yaml in the homelab
// folder (compose/household.yaml mounts data/appdata/home-assistant).
func HomeAssistantConfig(root string) string {
	return filepath.Join(root, "data", "appdata", "home-assistant", "configuration.yaml")
}

// starterRanges are the private ranges the starter configuration trusted.
var starterRanges = []string{"172.16.0.0/12", "192.168.0.0/16", "10.0.0.0/8"}

// starterComment is the starter's note above its http block, word for word.
const starterComment = `# Requests arrive through Nginx Proxy Manager on a Docker network, whose
# addresses depend on the runtime; Home Assistant's port only listens on
# this Mac, so trusting the private ranges is safe.
`

// FrontComment is the note the starter configuration has now.
const FrontComment = `# Requests arrive through Nginx Proxy Manager and Tailscale Serve, at their
# fixed addresses on the homelab-front network: only they may say who a
# visitor is. A device on the Wi-Fi at Home Assistant's own port is taken
# for who it is.
`

var (
	trustedKey  = regexp.MustCompile(`^(\s*)trusted_proxies:\s*(#.*)?$`)
	trustedItem = regexp.MustCompile(`^(\s*)-\s*([^\s#]+)\s*(#.*)?$`)
)

// TrustFront rewrites a Home Assistant configuration's trusted_proxies so
// the front addresses are on it, and reports whether it changed the file.
// A file with no trusted_proxies list in block form is left alone.
func TrustFront(path string) (bool, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	text := string(raw)
	out, changed := trustFrontText(text)
	if !changed {
		return false, nil
	}
	info, err := os.Stat(path)
	if err != nil {
		return false, err
	}
	tmp := path + ".homelab-tmp"
	if err := os.WriteFile(tmp, []byte(out), info.Mode().Perm()); err != nil {
		return false, err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return false, err
	}
	return true, nil
}

func trustFrontText(text string) (string, bool) {
	lines := strings.SplitAfter(text, "\n")
	key := -1
	for i, l := range lines {
		if trustedKey.MatchString(strings.TrimRight(l, "\r\n")) {
			key = i
			break
		}
	}
	if key < 0 {
		return text, false
	}
	keyIndent := len(trustedKey.FindStringSubmatch(strings.TrimRight(lines[key], "\r\n"))[1])
	end, indent := key+1, ""
	var items []string
	for ; end < len(lines); end++ {
		m := trustedItem.FindStringSubmatch(strings.TrimRight(lines[end], "\r\n"))
		if m == nil || len(m[1]) < keyIndent {
			break
		}
		if indent == "" {
			indent = m[1]
		}
		items = append(items, m[2])
	}
	if len(items) == 0 {
		return text, false
	}
	starter := true
	for _, r := range starterRanges {
		starter = starter && slices.Contains(items, r)
	}
	var keep []string
	for i := key + 1; i < end; i++ {
		item := trustedItem.FindStringSubmatch(strings.TrimRight(lines[i], "\r\n"))[2]
		if starter && slices.Contains(starterRanges, item) {
			continue
		}
		keep = append(keep, lines[i])
	}
	var add []string
	for _, a := range []string{FrontProxyAddress, FrontServeAddress} {
		if !slices.Contains(items, a) {
			add = append(add, indent+"- "+a+"\n")
		}
	}
	if len(add) == 0 && len(keep) == end-key-1 {
		return text, false
	}
	if !strings.HasSuffix(lines[key], "\n") {
		lines[key] += "\n"
	}
	// The last item may have no newline at the end of the file.
	if len(keep) > 0 && !strings.HasSuffix(keep[len(keep)-1], "\n") && end == len(lines) {
		keep[len(keep)-1] += "\n"
	}
	out := slices.Concat(lines[:key+1], add, keep, lines[end:])
	result := strings.Join(out, "")
	if starter {
		result = strings.Replace(result, starterComment, FrontComment, 1)
	}
	return result, true
}
