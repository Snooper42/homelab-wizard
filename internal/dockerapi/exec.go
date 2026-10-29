package dockerapi

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// ErrNotStarted wraps an Exec error from before the command started (the
// engine could not be reached, or answered in a way that is not the
// engine's), so the caller may run it another way without running it
// twice. An error the engine gave (no such container, not running) is an
// *Error instead, and the answer.
var ErrNotStarted = errors.New("the command did not start")

// Exec runs cmd in the running container (its name or id), with env
// ("NAME=value") added to the container's own, as docker exec does:
// without a terminal or input, its output written to stdout and stderr as
// it comes. It returns the command's exit code; an error is the engine's
// or the connection's, not the command's.
func (c *Client) Exec(ctx context.Context, container string, cmd, env []string, stdout, stderr io.Writer) (int, error) {
	var made struct{ ID string }
	err := c.post(ctx, "/containers/"+url.PathEscape(container)+"/exec", map[string]any{
		"AttachStdout": true, "AttachStderr": true, "Cmd": cmd, "Env": env,
	}, &made)
	if err != nil {
		var e *Error
		if errors.As(err, &e) && e.Status < 500 {
			return -1, err
		}
		return -1, fmt.Errorf("%w: %w", ErrNotStarted, err)
	}
	if made.ID == "" {
		return -1, fmt.Errorf("%w: the engine gave the exec no id", ErrNotStarted)
	}
	resp, err := c.send(ctx, http.MethodPost, "/exec/"+made.ID+"/start", map[string]any{"Detach": false, "Tty": false})
	if err != nil {
		return -1, fmt.Errorf("%w: %w", ErrNotStarted, err)
	}
	err = demux(resp.Body, stdout, stderr)
	resp.Body.Close()
	if err != nil {
		return -1, fmt.Errorf("engine API exec: %w", err)
	}
	var ended struct {
		ExitCode int
		Running  bool
	}
	data, err := c.get(ctx, "/exec/"+made.ID+"/json", nil)
	if err == nil {
		err = json.Unmarshal(data, &ended)
	}
	if err != nil {
		return -1, fmt.Errorf("engine API exec: how it ended: %w", err)
	}
	if ended.Running {
		return -1, errors.New("engine API exec: its output ended while it still runs")
	}
	return ended.ExitCode, nil
}

// demux copies the engine's stream of a command without a terminal: frames
// of 8 bytes (which stream, then the length) and that many bytes, until the
// command ends.
func demux(r io.Reader, stdout, stderr io.Writer) error {
	var head [8]byte
	for {
		if _, err := io.ReadFull(r, head[:]); err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		var w io.Writer
		switch head[0] {
		case 1:
			w = stdout
		case 2:
			w = stderr
		default:
			return fmt.Errorf("a frame for stream %d", head[0])
		}
		if w == nil {
			w = io.Discard
		}
		if _, err := io.CopyN(w, r, int64(binary.BigEndian.Uint32(head[4:]))); err != nil {
			return err
		}
	}
}

// post sends body as JSON to path and decodes the answer into out.
func (c *Client) post(ctx context.Context, path string, body, out any) error {
	resp, err := c.send(ctx, http.MethodPost, path, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return json.NewDecoder(resp.Body).Decode(out)
}

// send is do for a request with a JSON body.
func (c *Client) send(ctx context.Context, method, path string, body any) (*http.Response, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, method, "http://engine"+path, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return c.answer(req)
}
