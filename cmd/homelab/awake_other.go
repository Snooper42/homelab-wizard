//go:build !windows

package main

import (
	"context"
	"os/exec"
	"runtime"

	"github.com/Snooper42/homelab-wizard/internal/battery"
)

func keepAwake(ctx context.Context) error {
	name, args, err := awakeCommand()
	if err != nil {
		return err
	}
	if runtime.GOOS == "darwin" {
		return exec.CommandContext(ctx, name, args...).Run() // -s: on power only
	}
	return onPower(ctx, battery.Power, func() (func(), <-chan error, error) {
		run, stop := context.WithCancel(ctx)
		c := exec.CommandContext(run, name, args...)
		if err := c.Start(); err != nil {
			stop()
			return nil, nil, err
		}
		ended := make(chan error, 1)
		go func() { ended <- c.Wait() }()
		return func() { stop(); <-ended }, ended, nil
	})
}
