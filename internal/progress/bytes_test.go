package progress

import (
	"bytes"
	"strings"
	"testing"
	"time"
)

func TestBytes(t *testing.T) {
	var out bytes.Buffer
	var got [][2]int64
	b := &Bytes{W: &out, Total: 10, On: func(d, t int64) { got = append(got, [2]int64{d, t}) }, Every: time.Hour}
	for _, s := range []string{"abc", "def", "ghij"} {
		b.Write([]byte(s))
	}
	b.Close()
	// The first write and the end; the rest fall inside Every.
	if out.String() != "abcdefghij" || len(got) != 2 || got[0] != [2]int64{3, 10} || got[1] != [2]int64{10, 10} {
		t.Fatalf("%q %v", out.String(), got)
	}
	b = &Bytes{W: &out, Total: -1, On: func(d, t int64) { got = append(got, [2]int64{d, t}) }, Every: time.Nanosecond}
	got = nil
	b.Write([]byte(strings.Repeat("x", 5)))
	time.Sleep(time.Millisecond)
	b.Write([]byte("y"))
	if len(got) != 2 || got[1] != [2]int64{6, -1} {
		t.Fatalf("%v", got)
	}
	(&Bytes{W: &out}).Write([]byte("no one listens"))
}

func TestPercent(t *testing.T) {
	for _, c := range []struct {
		done, total int64
		want        int
	}{{0, 100, 0}, {50, 200, 25}, {200, 200, 100}, {300, 200, 100}, {5, 0, -1}, {5, -1, -1}} {
		if got := Percent(c.done, c.total); got != c.want {
			t.Errorf("Percent(%d, %d) = %d, want %d", c.done, c.total, got, c.want)
		}
	}
}
