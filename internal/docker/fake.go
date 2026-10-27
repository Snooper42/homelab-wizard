package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

// FakeRunner is an in-memory Runner for tests. It serves `ps`/`inspect`
// from Containers and records every streamed command.
type FakeRunner struct {
	// Images are the image IDs docker image inspect answers, by reference.
	Images     map[string]string
	Containers []FakeContainer
	InfoJSON   string
	InfoErr    error
	Streamed   [][]string
	StreamErr  error
	// Networks that exist; `network create` adds to it.
	Networks map[string]bool
	// Events are the lines `docker events` writes before it returns
	// EventsErr, as when the engine stops.
	Events    []string
	EventsErr error
	// Exec answers `docker exec` (Output and Pipe); nil returns nothing.
	Exec func(container string, args []string) (string, error)
	// Calls records every command, joined with spaces.
	Calls []string
}

// FakeContainer describes a container returned by `docker inspect`.
type FakeContainer struct {
	Name    string
	Image   string
	ImageID string
	Running bool
	Status  string // docker's status word; "" for running or exited by Running
	Health  string
	Project string
	Service string
	Ports   []PublishedPort
	// ConfigHash is the configuration hash Compose made it with.
	ConfigHash string
	Mounts     []Mount
}

// Output implements Runner.
func (f *FakeRunner) Output(_ context.Context, _ string, args ...string) ([]byte, error) {
	f.Calls = append(f.Calls, strings.Join(args, " "))
	switch {
	case len(args) > 2 && args[0] == "network" && args[1] == "inspect":
		if f.Networks[args[2]] {
			return []byte("[]"), nil
		}
		return nil, fmt.Errorf("network %s not found", args[2])
	case len(args) > 2 && args[0] == "network" && args[1] == "create":
		if f.Networks == nil {
			f.Networks = map[string]bool{}
		}
		f.Networks[args[2]] = true
		return []byte("id\n"), nil
	case len(args) > 1 && args[0] == "exec":
		if f.Exec == nil {
			return nil, nil
		}
		out, err := f.Exec(args[1], args[2:])
		return []byte(out), err
	case len(args) > 0 && args[0] == "info":
		if f.InfoErr != nil {
			return nil, f.InfoErr
		}
		if f.InfoJSON == "" {
			return []byte(`{"ServerVersion":"27.0.0","OperatingSystem":"OrbStack","Name":"orbstack","Architecture":"aarch64"}`), nil
		}
		return []byte(f.InfoJSON), nil
	case len(args) > 1 && args[0] == "compose" && args[1] == "version":
		return []byte("2.29.1\n"), nil
	case len(args) > 0 && args[0] == "ps":
		var ids []string
		for i := range f.Containers {
			ids = append(ids, fmt.Sprintf("id%d", i))
		}
		return []byte(strings.Join(ids, "\n")), nil
	case len(args) > 0 && args[0] == "inspect":
		return f.inspect()
	case len(args) > 1 && args[0] == "image" && (args[1] == "tag" || args[1] == "rm" || args[1] == "prune"):
		return nil, nil
	case len(args) > 1 && args[0] == "image" && args[1] == "inspect":
		if id, ok := f.Images[args[len(args)-1]]; ok {
			return []byte(id + "\n"), nil
		}
		return nil, fmt.Errorf("no such image: %s", args[len(args)-1])
	}
	return nil, fmt.Errorf("fake runner: unexpected command %v", args)
}

// Stream implements Runner.
func (f *FakeRunner) Stream(_ context.Context, _ string, _ string, args ...string) error {
	f.Calls = append(f.Calls, strings.Join(args, " "))
	f.Streamed = append(f.Streamed, args)
	return f.StreamErr
}

// Pipe implements Runner.
func (f *FakeRunner) Pipe(_ context.Context, w io.Writer, _ string, args ...string) error {
	f.Calls = append(f.Calls, strings.Join(args, " "))
	if len(args) > 0 && args[0] == "events" {
		for _, line := range f.Events {
			_, _ = io.WriteString(w, line+"\n")
		}
		return f.EventsErr
	}
	if len(args) > 1 && (args[0] == "exec" || args[0] == "run") && f.Exec != nil {
		out, err := f.Exec(args[1], args[2:])
		_, _ = io.WriteString(w, out)
		return err
	}
	return nil
}

func (f *FakeRunner) inspect() ([]byte, error) {
	type binding struct {
		HostIP   string `json:"HostIp"`
		HostPort string `json:"HostPort"`
	}
	var out []map[string]any
	for i, c := range f.Containers {
		labels := map[string]string{}
		if c.Project != "" {
			labels["com.docker.compose.project"] = c.Project
			labels["com.docker.compose.service"] = c.Service
		}
		if c.ConfigHash != "" {
			labels[ConfigHashLabel] = c.ConfigHash
		}
		ports := map[string][]binding{}
		for _, p := range c.Ports {
			key := fmt.Sprintf("%d/%s", p.Port, p.Protocol)
			ports[key] = append(ports[key], binding{HostIP: p.HostIP, HostPort: fmt.Sprint(p.HostPort)})
		}
		status := "exited"
		if c.Running {
			status = "running"
		}
		if c.Status != "" {
			status = c.Status
		}
		state := map[string]any{"Status": status, "Running": c.Running}
		if c.Health != "" {
			state["Health"] = map[string]any{"Status": c.Health}
		}
		mounts := []map[string]any{}
		for _, m := range c.Mounts {
			mounts = append(mounts, map[string]any{"Type": m.Type, "Name": m.Name, "Source": m.Source, "Destination": m.Target, "RW": m.Writable})
		}
		out = append(out, map[string]any{
			"Mounts":          mounts,
			"Id":              fmt.Sprintf("id%d", i),
			"Name":            "/" + c.Name,
			"Image":           c.ImageID,
			"Config":          map[string]any{"Image": c.Image, "Labels": labels},
			"State":           state,
			"NetworkSettings": map[string]any{"Ports": ports},
		})
	}
	return json.Marshal(out)
}
