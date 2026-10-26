// Command homelab-run starts a scheduled homelab job on Windows without a
// console window. Task Scheduler starts it (a GUI program, built with
// -H=windowsgui, so no window opens), and it runs the job's .cmd script
// with no window either; the script appends the CLI's output to the job's
// log. Without it, each run would flash a console window.
//
//	homelab-run <job script.cmd>
package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
)

func main() { os.Exit(cli(os.Args[1:])) }

// cli takes the arguments after the program's name.
func cli(args []string) int {
	if len(args) != 1 {
		fmt.Fprintln(os.Stderr, "usage: homelab-run <job script>")
		return 2
	}
	return run(args[0])
}

// run runs the script and returns its exit code, so Task Scheduler's Last
// Result shows the job's own.
func run(script string) int {
	if _, err := os.Stat(script); err != nil {
		fmt.Fprintln(os.Stderr, "homelab-run:", err)
		return 1
	}
	err := command(script).Run()
	var exit *exec.ExitError
	switch {
	case err == nil:
		return 0
	case errors.As(err, &exit):
		return exit.ExitCode()
	}
	fmt.Fprintln(os.Stderr, "homelab-run:", err)
	return 1
}
