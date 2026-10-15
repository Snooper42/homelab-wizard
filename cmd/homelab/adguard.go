package main

import (
	"cmp"
	"context"
	"fmt"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/tailnet"
)

// adguardCmd sets up ad blocking: AdGuard Home's first-run wizard with a
// generated login, and, with the tailnet-dns app, what to put in the
// tailnet's DNS settings so every Tailscale device uses it.
func (h *homelab) adguardCmd(ctx context.Context, args []string) error {
	if len(args) == 0 || args[0] != "setup" {
		return fmt.Errorf("usage: homelab adguard setup")
	}
	fs := newFlags("adguard setup")
	auto := fs.Bool("auto", false, "")
	if _, err := parseFlags(fs, args[1:]); err != nil {
		return err
	}
	return h.adguardSetup(ctx, *auto)
}

// adguardSetup answers AdGuard's wizard when it is waiting and checks the
// login otherwise. With auto (after an install) it says nothing when
// AdGuard is not running.
func (h *homelab) adguardSetup(ctx context.Context, auto bool) error {
	u := h.ui
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	report := detect.Analyze(h.catalog, containers)
	if _, ok := runningContainer(report, adguardID); !ok {
		if auto {
			return nil
		}
		return fmt.Errorf("AdGuard Home is not running: homelab install @adblock")
	}

	env := h.envMap()
	ag := domain.NewAdGuard("http://127.0.0.1:"+cmp.Or(env["ADGUARD_PORT"], "3003"), cmp.Or(env["ADGUARD_USER"], "admin"), env["ADGUARD_PASSWORD"])
	setupURL := "http://127.0.0.1:" + cmp.Or(env["ADGUARD_SETUP_PORT"], "3002")
	switch {
	case ag.FirstRun(ctx, setupURL):
		if ag.Password == "" {
			if ag.Password, err = envfile.NewSecret("ADGUARD_PASSWORD"); err != nil {
				return err
			}
		}
		if err := ag.Install(ctx, setupURL); err != nil {
			return err
		}
		f, err := envfile.Load(h.envFile)
		if err != nil {
			return err
		}
		f.Set("ADGUARD_USER", ag.User)
		f.Set("ADGUARD_PASSWORD", ag.Password)
		if err := f.Save(); err != nil {
			return err
		}
		// AdGuard moves its admin pages to port 80 and starts DNS.
		var checkErr error
		for i := 0; i < 15; i++ {
			if checkErr = ag.Check(ctx); checkErr == nil {
				break
			}
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(2 * time.Second):
			}
		}
		if checkErr != nil {
			return fmt.Errorf("AdGuard Home took the setup but does not answer yet: %w (run homelab adguard setup again in a minute)", checkErr)
		}
		u.OK("AdGuard Home is set up; its login is in Settings › ADGUARD_USER and ADGUARD_PASSWORD")
	case ag.Password == "":
		return fmt.Errorf("AdGuard Home was set up in its wizard: put the login you made there in Settings › ADGUARD_USER and ADGUARD_PASSWORD")
	default:
		if err := ag.Check(ctx); err != nil {
			return err
		}
		if !auto {
			u.OK("AdGuard Home accepts the login in Settings")
		}
	}

	ts, tsOK := runningContainer(report, tailnet.App)
	if _, ok := runningContainer(report, tailnet.DNSApp); !ok || !tsOK {
		if !auto && env["HOMELAB_DOMAIN"] == "" {
			u.Info("for ad blocking on every Tailscale device, at home and away: homelab install @adblock")
		}
		return nil
	}
	out, err := client.Exec(ctx, ts.Name, "tailscale", "status", "--json")
	if err != nil {
		return fmt.Errorf("reading Tailscale's status: %w", err)
	}
	self, err := tailnet.ParseStatus(out)
	if err != nil {
		return err
	}
	if self.IP == "" {
		return fmt.Errorf("Tailscale is %s, without a tailnet address yet: homelab tailnet setup says why", self.State)
	}
	u.Title("Ad blocking on every Tailscale device")
	u.Printf("  In the Tailscale admin console (%s):\n", u.Cyan(tailnet.DNSAdmin))
	u.Printf("  1. Nameservers › Add nameserver › Custom: %s, then Save.\n", u.Cyan(self.IP))
	u.Printf("  2. Turn on Override DNS servers.\n")
	u.Printf("\n  %s\n", u.Dim("While this machine is off, devices with Tailscale on cannot look up names: turn Tailscale off on them until it is back."))
	return nil
}
