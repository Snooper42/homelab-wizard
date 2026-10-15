// Package notify publishes alerts to the self-hosted ntfy server.
package notify

import (
	"bufio"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

// The topics homelab services publish to. ntfy runs with deny-all, so
// ./homelab notify setup grants the publisher user write access and the
// reader user (for the app's alert list) read access to each.
var Topics = []string{"watchtower", "duplicati-alerts", "uptime-kuma", "tunnel-watchdog", "reminders"}

// Message is one notification.
type Message struct {
	Title    string
	Body     string
	Priority int // 1 (min) to 5 (max); 0 leaves ntfy's default
	Tags     []string
}

// Client publishes to one ntfy server.
type Client struct {
	BaseURL string
	Token   string // an access token (tk_...) with write access to the topics
	HTTP    *http.Client
}

// AuthParam is a token as ntfy's ?auth= query parameter, for publishers that
// can only be given a URL (Watchtower, Duplicati).
func AuthParam(token string) string {
	return base64.RawURLEncoding.EncodeToString([]byte("Bearer " + token))
}

// New returns a client for an ntfy base URL such as http://127.0.0.1:9293.
func New(baseURL string) *Client {
	return &Client{BaseURL: strings.TrimRight(baseURL, "/"), HTTP: &http.Client{Timeout: 15 * time.Second}}
}

// Publish sends m to topic.
func (c *Client) Publish(ctx context.Context, topic string, m Message) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/"+topic, strings.NewReader(m.Body))
	if err != nil {
		return err
	}
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
	if m.Title != "" {
		req.Header.Set("Title", m.Title)
	}
	if m.Priority > 0 {
		req.Header.Set("Priority", strconv.Itoa(m.Priority))
	}
	if len(m.Tags) > 0 {
		req.Header.Set("Tags", strings.Join(m.Tags, ","))
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("ntfy is not reachable at %s: %w", c.BaseURL, err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
	switch {
	case resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized:
		return fmt.Errorf("ntfy refused to publish to %q (no write grant); run ./homelab notify setup", topic)
	case resp.StatusCode >= 300:
		return fmt.Errorf("ntfy %s: %d %s", topic, resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

// Event is a message ntfy has kept, as Recent returns it.
type Event struct {
	ID       string    `json:"id"`
	Time     time.Time `json:"time"`
	Topic    string    `json:"topic"`
	Title    string    `json:"title,omitempty"`
	Message  string    `json:"message"`
	Priority int       `json:"priority,omitempty"`
	Tags     []string  `json:"tags,omitempty"`
}

// Recent reads the messages ntfy kept on topics over the last since (it
// keeps 12 hours by default), newest first. The client's token needs read
// access to the topics (NTFY_READ_TOKEN, made by ./homelab notify setup).
func (c *Client) Recent(ctx context.Context, topics []string, since time.Duration) ([]Event, error) {
	u := fmt.Sprintf("%s/%s/json?poll=1&since=%ds", c.BaseURL, strings.Join(topics, ","), int(since.Seconds()))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ntfy is not reachable at %s: %w", c.BaseURL, err)
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized:
		return nil, fmt.Errorf("ntfy refused to show the alerts (no read access); run ./homelab notify setup")
	case resp.StatusCode >= 300:
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("ntfy: %d %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var events []Event
	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 64*1024), 1024*1024)
	for sc.Scan() {
		var raw struct {
			ID       string   `json:"id"`
			Time     int64    `json:"time"` // Unix seconds
			Event    string   `json:"event"`
			Topic    string   `json:"topic"`
			Title    string   `json:"title"`
			Message  string   `json:"message"`
			Priority int      `json:"priority"`
			Tags     []string `json:"tags"`
		}
		if json.Unmarshal(sc.Bytes(), &raw) != nil || raw.Event != "message" {
			continue
		}
		events = append(events, Event{ID: raw.ID, Time: time.Unix(raw.Time, 0), Topic: raw.Topic, Title: raw.Title, Message: raw.Message, Priority: raw.Priority, Tags: raw.Tags})
	}
	sort.SliceStable(events, func(i, j int) bool { return events[i].Time.After(events[j].Time) })
	return events, sc.Err()
}

// Account signs in with authorization (an "Authorization" header value:
// "Bearer tk_…" or "Basic …") and returns the account's user name, to
// check a token or password.
func (c *Client) Account(ctx context.Context, authorization string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/v1/account", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", authorization)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return "", fmt.Errorf("ntfy is not reachable at %s: %w", c.BaseURL, err)
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return "", fmt.Errorf("ntfy refused it")
	case resp.StatusCode >= 300:
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", fmt.Errorf("ntfy: %d %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var acct struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&acct); err != nil {
		return "", err
	}
	return acct.Username, nil
}
