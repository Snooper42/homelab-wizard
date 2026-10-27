## Summary

The 0.11 item "The same run in Home mode, with Tailscale replaced by a fake tailnet, so Setup's checklist is walked from top to bottom by the CLI". **Done when:** "every step of `homelab setup` the CLI can do ends done in the nightly run, and the ones left name the person's step".

- **`TestHomeModeSetupWalked`** (test/realdocker/home_test.go), run with `REALDOCKER_HOME=1`:
  - the fake tailnet: a Headscale 0.29.6 server on the homelab's network (alias `headscale`), names under `fake-tailnet.test`, and a pre-auth key from it
  - a new household's folder: `HOMELAB_BASELINE=small` (as the desktop app makes it), a media folder, `TAILSCALE_AUTHKEY` (in place of the browser sign-in) and `TAILSCALE_EXTRA_ARGS=--login-server=http://headscale:8080`
  - Setup walked as the Setup screen's **Do the steps I can** walks it: each step to do with commands, one at a time, re-read after each (the homelab started, Tailscale installed and signed in, the addresses set up, the alert token, the scheduled jobs as systemd user units, keeping awake allowed); Vaultwarden added as a household's pick brings its own steps
  - every step the CLI ran must end done, and each left must name the person's part (a box to tick, a setting, a choice, or a page)
  - then the person's part (the boxes ticked, a backup folder chosen with `duplicati destination`, the outside check's address) and the walk again: every step ends done
- **`TAILSCALE_EXTRA_ARGS`** (compose/network.yaml's `TS_EXTRA_ARGS`, .env.example, docs/Environment.md, the Tailscale page): flags for `tailscale up`, as `--login-server=` for your own Headscale.
- **Fixes the walk found:**
  - Setup's **Addresses on your tailnet** runs `install tailscale` then `tailnet setup` at once; with an auth key Tailscale still showed "needs login" with no link for a moment, and the step failed. `tailnet setup` and `tailnet login` now wait up to a minute for the link or for the key's sign-in.
  - `signups open` in Home mode said "create the accounts at https://passwords." (no domain). It now names Vaultwarden's tailnet address (`householdAddress`, shared with the phone's ntfy address).
- **`.github/workflows/nightly.yml`**: a `home` job (lingering on, for systemd's user manager), each night and by hand. Not on pull requests.
- **Docs:** Roadmap item ticked with a Done line; Testing; CHANGELOG.

## Safety impact

- [x] Does not expose an app to the internet by default: the tailnet is the run's own, under `.test`
- [x] Does not write secrets anywhere but `.env` (mode 0600), nor print them
- [x] Does not delete data without a backup and a confirmation first: it uninstalls only its own homelab, and removes the jobs and the awake permission it added
- [x] Does not claim it works on a machine unless it was actually tried there

## Validation

- [x] `make check`, `make coverage`, gosec (with `-tags realdocker ./test/...`) clean
- [x] Unit tests: `TestTailnetSetupWaitsForTheAuthKeysSignIn` (fails without the fix), `TestTailnetLoginGivesUpWithoutALink`, `TestHouseholdAddress`
- [x] In the sandbox: the fake tailnet signs the homelab's Tailscale in (`homelab.fake-tailnet.test`) and the walk goes through the tailnet step after the fix; it stops at the scheduled jobs there (no systemd user manager in the sandbox).
- [x] Nightly dispatched on the branch at c80f27a, before the sign-up address fix ([run 40494114422](https://github.com/Snooper42/homelab-wizard/actions/runs/40494114422)): the `home` job `--- PASS: TestHomeModeSetupWalked (688.69s)`: "after Do the steps I can: runtime done, started done, tailnet done, vaultwarden todo, twofactor waiting, backups todo, duplicati waiting, alerts todo, jobs done, heartbeat todo, devices todo", then "after the person's part:" every step done.
- [x] Again on f74afad, with the sign-up fix ([run 40506439258](https://github.com/Snooper42/homelab-wizard/actions/runs/40506439258), the rest of the run cancelled once `home` was done): `--- PASS: TestHomeModeSetupWalked (700.44s)`, and `signups open` said "create the accounts at https://homelab.fake-tailnet.test:8087".
- [ ] CI on this head (the life run's real-docker)

## Notes

Handoff: merge once CI is green. About ten minutes of the job are `signups open` counting down its ten minutes, as the Setup screen's button does.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01RK6Vw4qnad3nDZKbqeBwqp
