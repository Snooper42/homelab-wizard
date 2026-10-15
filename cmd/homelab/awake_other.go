//go:build !windows

package main

import (
	"context"
	"os/exec"
)

func keepAwake(ctx context.Context) error {
	name, args, err := awakeCommand()
	if err != nil {
		return err
	}
	return exec.CommandContext(ctx, name, args...).Run()
}
