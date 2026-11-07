package media

import (
	"bufio"
	"bytes"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Following is where a job that another process runs has got to (the
// agent's Collect, a terminal's run), read from its event log: its step and
// its bar, as the app's own job panel shows them.
type Following struct {
	Step     *Event `json:"step,omitempty"`
	Progress *Event `json:"progress,omitempty"`
}

// followTail is how much of the end of a job's log is read: the last step
// and bar are near its end, and a log of a long job can be large.
const followTail = 256 << 10

// Follow reads the end of a running job's event log. Only a log in Tidy
// Up's own log folder is read; a lock naming another file, or none, gives
// nothing.
func Follow(root string, l Lock) Following {
	var out Following
	if l.Log == "" {
		return out
	}
	dir, err := filepath.Abs(LogDir(root))
	if err != nil {
		return out
	}
	p, err := filepath.Abs(l.Log)
	if err != nil || filepath.Dir(p) != dir || !strings.HasSuffix(p, ".jsonl") {
		return out
	}
	f, err := os.Open(p) // #nosec G304 -- only a file in Tidy Up's log folder, checked above
	if err != nil {
		return out
	}
	defer func() { _ = f.Close() }()
	if fi, err := f.Stat(); err == nil && fi.Size() > followTail {
		if _, err := f.Seek(-followTail, io.SeekEnd); err != nil {
			return out
		}
	}
	data, err := io.ReadAll(f)
	if err != nil {
		return out
	}
	// A read from the middle starts part-way through a line: that line goes.
	if fi, err := f.Stat(); err == nil && fi.Size() > followTail {
		if i := bytes.IndexByte(data, '\n'); i >= 0 {
			data = data[i+1:]
		}
	}
	sc := bufio.NewScanner(bytes.NewReader(data))
	sc.Buffer(make([]byte, 64<<10), 8<<20)
	for sc.Scan() {
		ev, ok := ParseEvent(sc.Text())
		if !ok {
			continue
		}
		switch ev.Type {
		case "step":
			e := ev
			e.Raw = nil
			out.Step, out.Progress = &e, nil
		case "progress", "working":
			if ev.Total > 0 {
				e := ev
				e.Raw = nil
				out.Progress = &e
			}
		}
	}
	return out
}
