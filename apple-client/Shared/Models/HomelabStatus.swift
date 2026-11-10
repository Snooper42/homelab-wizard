import Foundation

/// The homelab's state (`api.Status` in internal/api/api.go).
struct HomelabStatus: Codable, Sendable, Equatable {
    var apps: [AppStatus]
    /// Baseline apps that aren't running.
    var missing: Int
    /// Running containers that aren't catalog apps.
    var unmatched: Int
    /// What the running apps replace in subscriptions per year.
    var savings: Double
    /// Apps the battery saver paused until power returns.
    var batteryPaused: [String]
    /// Some apps' pages haven't been checked yet. A refresh follows.
    var checking: Bool
    /// Apps stopped on purpose, by id. Each app also carries its own entry
    /// as `stoppedOnPurpose`.
    var stopped: [String: StopRecord]
    /// Whether nightly image updates run, and when.
    var updates: UpdatesState?
    /// The apps pinned to the top, in the order they were pinned.
    var pinned: [String]

    enum CodingKeys: String, CodingKey {
        case apps, missing, unmatched, savings, batteryPaused, checking, stopped, updates, pinned
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        apps = try c.decodeIfPresent([AppStatus].self, forKey: .apps) ?? []
        missing = try c.decodeIfPresent(Int.self, forKey: .missing) ?? 0
        unmatched = try c.decodeIfPresent(Int.self, forKey: .unmatched) ?? 0
        savings = try c.decodeIfPresent(Double.self, forKey: .savings) ?? 0
        batteryPaused = try c.decodeIfPresent([String].self, forKey: .batteryPaused) ?? []
        checking = try c.decodeIfPresent(Bool.self, forKey: .checking) ?? false
        updates = try? c.decodeIfPresent(UpdatesState.self, forKey: .updates)
        pinned = ((try? c.decodeIfPresent([String].self, forKey: .pinned)) ?? nil) ?? []
        // One entry that doesn't read shouldn't cost the whole status.
        let stopped = ((try? c.decodeIfPresent([String: StopRecord].self, forKey: .stopped)) ?? nil) ?? [:]
        self.stopped = stopped
        let paused = Set(batteryPaused)
        apps = apps.map { app in
            var app = app
            app.stoppedOnPurpose = stopped[app.id]
            app.pausedOnBattery = paused.contains(app.id)
            return app
        }
    }
}

/// One app's state (`api.AppStatus`).
struct AppStatus: Codable, Sendable, Equatable, Identifiable, Hashable {
    let id: String
    let name: String
    /// running, stopped, elsewhere, missing, or "not running".
    let state: String
    /// healthy, unhealthy, starting, restarting (a crash loop), or native.
    let health: String?
    let container: String?
    /// Its address on the computer itself. Usually localhost, so not useful here.
    let url: String?
    /// Its address on the homelab domain.
    let address: String?
    /// When it last started (RFC 3339), while running.
    let since: String?
    let restarts: Int?
    /// Why it last started, while running: you, updated, nightly, update,
    /// fix, watchdog, battery, drive, timer, or docker (internal/started).
    let startedBy: String?
    let updatedAt: String?
    let held: Bool?
    /// The days the nightly update takes it ("sun", "sat"), when not every
    /// night (main #457).
    var updateDays: [String]? = nil
    let quiet: Bool?
    /// At the top of Status (homelab pin).
    let pinned: Bool?
    /// How a public app may be reached once the domain has the Cloudflare
    /// tunnel: "away" (through the tunnel too) or "home" (home only); nil
    /// when it has no such switch (main #559).
    var reach: String? = nil
    let waitingFor: String?
    let notAnswering: String?
    let settingsChanged: Bool?
    /// When it stopped by itself (RFC 3339), and why in a few words when
    /// Docker knows ("it ran out of memory"), main #474.
    var stoppedAt: String? = nil
    var stoppedWhy: String? = nil
    /// From the status's `stopped` record, not the app's own JSON.
    var stoppedOnPurpose: StopRecord?
    /// In the status's `batteryPaused`: the battery saver paused it until
    /// the power comes back.
    var pausedOnBattery = false

    enum CodingKeys: String, CodingKey {
        case id, name, state, health, container, url, address, since, restarts, startedBy
        case updatedAt, held, updateDays, quiet, pinned, reach, waitingFor, notAnswering, settingsChanged, stoppedAt, stoppedWhy
    }

    var isRunning: Bool { state == "running" }

    /// Whether it needs a look, as the computer's Needs a look counts it
    /// (`troubled` in web/src/status/Tiles.tsx): unwell, not answering,
    /// missing, or stopped when nobody stopped it on purpose (the watchdog's
    /// stop of one that kept restarting counts too). Stopped on purpose,
    /// running elsewhere, and "not running" don't.
    var needsAttention: Bool {
        if let notAnswering, !notAnswering.isEmpty { return true }
        switch health {
        case "unhealthy", "restarting": return true
        default: break
        }
        if state == "missing" { return true }
        if state == "stopped" { return stoppedOnPurpose == nil || stoppedOnPurpose?.keptRestarting == true }
        return false
    }

    var startedAt: Date? { since.flatMap(GoTime.parse) }
}

/// A Status and when it was read (`api.Reading`). The `LastStatus` call
/// returns one so the screen can draw right away.
struct StatusReading: Codable, Sendable {
    let status: HomelabStatus
    let at: Date
}
