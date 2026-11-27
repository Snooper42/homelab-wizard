import Foundation
import Testing
@testable import HomelabClient

// The top of Status: the ring's numbers and the first app that needs a
// look, and the Backups tile's words.
@Suite("Status overview")
struct StatusOverviewTests {
    // The Apps card counts as the computer's (`Tiles` in web/src/status/Tiles.tsx).
    @Test func theAppsCardCountsAsTheComputer() throws {
        let status = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"""
        {"apps":[{"id":"a","name":"A","state":"running"},{"id":"b","name":"B","state":"stopped"},
                 {"id":"homelab-companion","name":"Phone companion","state":"not running"},
                 {"id":"c","name":"C","state":"missing"},{"id":"d","name":"D","state":"running"}],
         "stopped":{"b":{"since":"2026-11-05T14:00:00Z"}}}
        """#.utf8))
        let apps = OverviewApps(status: status, watchdog: nil)
        // The companion waiting for its scheduled jobs isn't counted.
        #expect(apps.running == 2 && apps.counted == 4)
        // B was stopped on purpose; C is missing: it's the one named.
        #expect(apps.trouble.map(\.id) == ["c"] && apps.one?.id == "c")
        #expect(apps.figure == "2" && apps.unit == "of 4 running" && apps.alert)
    }

    // Never "needs you": the card says what happened, to which app.
    @Test func theAppsCardSaysWhatHappened() throws {
        func status(_ json: String) throws -> HomelabStatus {
            try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(json.utf8))
        }
        let one = OverviewApps(status: try status(#"{"apps":[{"id":"a","name":"A","state":"running"},{"id":"m","name":"Mealie","state":"stopped"}]}"#), watchdog: nil)
        #expect(one.unit == "of 2 running")
        #expect(one.line?.hasPrefix("Mealie stopped") == true)
        #expect(one.line?.contains("need") == false)
        let two = OverviewApps(status: try status(#"{"apps":[{"id":"a","name":"A","state":"running"},{"id":"m","name":"Mealie","state":"stopped"},{"id":"v","name":"Vikunja","state":"stopped"},{"id":"i","name":"Immich","state":"running","notAnswering":"no answer for 5 minutes"}]}"#), watchdog: nil)
        #expect(two.one == nil && two.unit == "of 4 running")
        #expect(two.line == "Mealie, Vikunja stopped · Immich not answering")
        // The homelab's own apps down come first.
        let down = OverviewApps(status: try status(#"{"apps":[{"id":"a","name":"A","state":"running"}],"missing":2}"#), watchdog: nil)
        #expect(down.line == "2 of the homelab's own apps are down")
        // Four or more of a kind: two named and a count.
        #expect(OverviewApps.troubleLine(try status(#"{"apps":[{"id":"a","name":"A","state":"stopped"},{"id":"b","name":"B","state":"stopped"},{"id":"c","name":"C","state":"stopped"},{"id":"d","name":"D","state":"stopped"}]}"#).apps) == "A, B +2 stopped")
    }

    // A category's pill, as the redesign's and the computer's Status: how many run.
    @Test func aCategorySaysHowManyRun() throws {
        let s = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"{"apps":[{"id":"a","name":"A","state":"running"},{"id":"b","name":"B","state":"running"},{"id":"c","name":"C","state":"stopped"}]}"#.utf8))
        let all = AppGroup(label: "Media", apps: Array(s.apps.prefix(2)))
        #expect(all.runningPill?.words == "✓ 2 running")
        #expect(all.runningPill?.fine == true)
        let one = AppGroup(label: "Media", apps: s.apps)
        #expect(one.runningPill?.words == "2 of 3 running")
        #expect(one.runningPill?.fine == false)
        #expect(AppGroup(label: "Needs a look", apps: s.apps, alert: true).runningPill == nil)
    }

    @Test func nothingYet() {
        let apps = OverviewApps(status: nil, watchdog: nil)
        #expect(apps.running == 0 && apps.counted == 0 && apps.trouble.isEmpty)
        #expect(apps.one == nil && apps.days.isEmpty)
        #expect(apps.unit == "running" && apps.line == nil)
    }

    @Test func theBackupsCardBeforeAndWithoutCopies() throws {
        func o(_ json: String) throws -> BackupOverview { try JSONDecoder.homelab().decode(BackupOverview.self, from: Data(json.utf8)) }
        let fresh = OverviewBackups(try o(#"{"lastRun":"2026-11-05T03:12:00Z","copies":[{"id":"a","name":"A","state":"fresh"},{"id":"b","name":"B","state":"fresh"}]}"#))
        #expect(fresh.figure == "2" && fresh.unit == "of 2 copied" && fresh.skipped == nil)
        let one = OverviewBackups(try o(#"{"copies":[{"id":"a","name":"A","state":"fresh"}]}"#))
        #expect(one.figure == "1" && one.unit == "of 1 copied" && one.skipped == nil)
        let none = OverviewBackups(try o(#"{"copies":[]}"#))
        #expect(none.figure == "0" && none.unit == "of 0 copied" && none.skipped == nil)
        // Before Backups is read.
        let reading = OverviewBackups(nil)
        #expect(reading.figure == "—" && reading.unit.isEmpty && reading.skipped == nil && reading.nights.isEmpty)
    }

    // A folded group's logos: a badge only on what isn't simply running.
    @Test func onlyWhatIsNotFineWearsABadge() throws {
        func app(_ state: String, health: String? = nil, extra: String = "") throws -> AppStatus {
            var json = #"{"id":"a","name":"Audiobookshelf","state":"\#(state)""#
            if let health { json += #","health":"\#(health)""# }
            json += extra + "}"
            return try JSONDecoder.homelab().decode(AppStatus.self, from: Data(json.utf8))
        }
        #expect(try app("running", health: "healthy").isPlainlyFine)
        #expect(try app("running").isPlainlyFine)
        #expect(try !app("running", health: "starting").isPlainlyFine)
        #expect(try !app("running", health: "unhealthy").isPlainlyFine)
        #expect(try !app("running", extra: #","notAnswering":"no answer for 5 minutes""#).isPlainlyFine)
        #expect(try !app("stopped").isPlainlyFine)
        #expect(try !app("missing").isPlainlyFine)
    }

    // When all is well: all answering, and the watchdog's days as squares.
    @Test func allAnsweringAndTheDays() throws {
        func w(_ json: String) throws -> WatchdogSummary { try JSONDecoder.homelab().decode(WatchdogSummary.self, from: Data(json.utf8)) }
        let status = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"{"apps":[{"id":"a","name":"A","state":"running"},{"id":"b","name":"B","state":"running"},{"id":"homelab-companion","name":"Phone companion","state":"not running"}]}"#.utf8))
        let days = (1...14).map { #"{"date":"2026-11-\#(String(format: "%02d", $0))","failed":\#($0 == 10 ? 1 : 0),"runs":\#($0 == 4 ? 0 : 96)}"# }.joined(separator: ",")
        let two = OverviewApps(status: status, watchdog: try w(#"{"lastRun":"2026-11-14T10:00:00Z","checks":3,"failing":[],"daily":[\#(days)]}"#))
        #expect(two.figure == "2" && two.unit == "running" && !two.alert)
        #expect(two.days.count == 14)
        #expect(two.days[3].tone == .none && two.days[9].tone == .warn && two.days[13].tone == .ok)
        // All well: no line, only the squares; VoiceOver says the outages.
        #expect(two.line == nil && two.daysLabel == "The last two weeks: 1 day with an outage")
        // One still down today: its square is red.
        let down = OverviewApps(status: status, watchdog: try w(#"{"lastRun":"2026-11-14T10:00:00Z","checks":3,"failing":[{"name":"B","problem":"no answer","since":"2026-11-14T09:00:00Z"}],"daily":[{"date":"2026-11-13","failed":0,"runs":96},{"date":"2026-11-14","failed":1,"runs":40}]}"#))
        #expect(down.days.map(\.tone) == [.ok, .bad])
        // From a computer without the daily summary, the week from its outages.
        let week = OverviewApps(status: status, watchdog: try w(#"{"lastRun":"2026-11-14T10:00:00Z","checks":3,"failing":[]}"#))
        #expect(week.days.count == 7 && week.line == nil && week.daysLabel == "This week: no outage")
        // Before the watchdog has run, no squares.
        #expect(OverviewApps(status: status, watchdog: try w(#"{"checks":0,"failing":[]}"#)).days.isEmpty)
    }

    // The Backups card: how many were copied of those not waiting for a drive, and what was skipped.
    @Test func theBackupsCardSaysWhatWasCopiedAndSkipped() throws {
        func o(_ json: String) throws -> BackupOverview { try JSONDecoder.homelab().decode(BackupOverview.self, from: Data(json.utf8)) }
        let night = try o(#"{"lastRun":"2026-11-24T08:30:00Z","copies":[{"id":"a","name":"Immich","state":"fresh"},{"id":"b","name":"Mealie","state":"stale"},{"id":"c","name":"Navidrome","state":"fresh"}],"stale":1,"nights":[{"date":"2026-11-23","apps":{"immich":"copied"}},{"date":"2026-11-24","apps":{"immich":"copied","mealie":"stopped"}}]}"#)
        let words = OverviewBackups(night)
        #expect(words.figure == "2" && words.unit == "of 3 copied")
        #expect(words.skipped == "Mealie skipped")
        #expect(words.nights.map(\.tone) == [.ok, .warn])
        let waiting = OverviewBackups(try o(#"{"copies":[{"id":"a","name":"A","state":"fresh"},{"id":"k","name":"Komga","state":"paused"},{"id":"v","name":"Kavita","state":"paused"}]}"#))
        #expect(waiting.figure == "1" && waiting.unit == "of 1 copied" && waiting.skipped == nil)
    }

    @Test func theMachineCardSaysItsRoomPowerAndUpdates() {
        let facts = MachineFacts.from(.object(["free": .number(412 * 1_073_741_824), "total": .number(994 * 1_073_741_824), "low": .bool(false), "power": .string("plugged"), "keptAwake": .bool(true)]))
        #expect(facts?.powerWords == "Plugged in" && facts?.needsALook == false)
        let words = OverviewMachine(facts, updates: UpdatesState(paused: false, schedule: "daily at 04:00"))
        // In 1024s, as the computer says it (412 GB free of 994 GB).
        #expect(words.title == "This machine" && words.figure.contains("412") && words.unit == "GB free" && !words.low)
        // Fine: nothing in the title row, no line.
        #expect(words.trailing.isEmpty && words.line.isEmpty)
        #expect(words.barWords.hasSuffix(" used") && (words.bar ?? 0) > 0.5)
        #expect(OverviewMachine(facts, updates: UpdatesState(paused: true, schedule: "daily at 04:00")).trailing == "Updates paused")
        // On battery, or plugged in but free to sleep, is said in amber.
        #expect(MachineFacts.from(.object(["free": .number(1e9), "total": .number(2e9), "power": .string("battery")]))?.needsALook == true)
        #expect(OverviewMachine(MachineFacts.from(.object(["free": .number(1e9), "total": .number(2e9), "power": .string("plugged")])), updates: nil).line == "May sleep")
        #expect(OverviewMachine(MachineFacts.from(.object(["free": .number(1e9), "total": .number(2e9), "power": .string("battery")])), updates: nil).line == "On battery")
        #expect(MachineFacts.from(.object(["total": .number(0)])) == nil)
        // A computer that sends no facts: the nightly updates alone.
        let none = OverviewMachine(nil, updates: UpdatesState(paused: true, schedule: ""))
        #expect(none.title == "Updates" && none.figure == "Paused" && none.line.isEmpty && none.bar == nil)
        // How long it's been up isn't said: few words.
        let booted = OverviewMachine(MachineFacts.from(.object(["free": .number(1e9), "total": .number(2e9), "power": .string("plugged"), "keptAwake": .bool(true), "booted": .string("2027-01-01T00:00:00Z")])), updates: UpdatesState(paused: false, schedule: "daily at 04:00"))
        #expect(booted.trailing.isEmpty && booted.line.isEmpty)
    }

    // A category's row on the Overview: its apps' names under its name, a stopped one first, and what VoiceOver says.
    @Test func aCategoryRowSaysItsAppsAndHowManyRun() throws {
        let s = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"{"apps":[{"id":"a","name":"AdGuard Home","state":"running"},{"id":"b","name":"Cloudflare Tunnel","state":"running"},{"id":"c","name":"Speedtest Tracker","state":"stopped"}]}"#.utf8))
        let network = StatusCategory(id: "network", label: "Network", apps: s.apps)
        #expect(network.line == "Speedtest Tracker stopped · AdGuard Home +1")
        #expect(network.pill.words == "2 of 3 running" && !network.pill.fine)
        #expect(network.spoken == "Network, 2 of 3 running: AdGuard Home, Cloudflare Tunnel, Speedtest Tracker")
        let fine = StatusCategory(id: "network", label: "Network", apps: Array(s.apps.prefix(2)))
        #expect(fine.line == "AdGuard Home, Cloudflare Tunnel" && fine.pill.words == "2 running" && fine.pill.fine)
        #expect(fine.spoken == "Network, 2 running: AdGuard Home, Cloudflare Tunnel")
        // Media automation says what it does while none stopped.
        let automation = StatusCategory(id: StatusCategory.automation, label: "Media automation", apps: Array(s.apps.prefix(1)), summary: "Finds and downloads")
        #expect(automation.line == "Finds and downloads")
    }

    // The categories as the computer lists them: the catalog's order, Media automation last, Seerr in Media,
    // your own apps after, each with its apps whatever their state.
    @Test func theCategoriesAsTheComputerListsThem() throws {
        let catalog = try JSONDecoder.homelab().decode(AppCatalog.self, from: Data(#"""
        {"categories":[{"id":"media-automation","label":"Automation"},{"id":"media","label":"Media"},{"id":"network","label":"Network"}],
         "apps":[{"id":"jellyfin","name":"Jellyfin","category":"media","description":"","kind":"app"},
                 {"id":"seerr","name":"Seerr","category":"media-automation","description":"","kind":"app"},
                 {"id":"radarr","name":"Radarr","category":"media-automation","description":"","kind":"app"},
                 {"id":"adguard-home","name":"AdGuard Home","category":"network","description":"","kind":"app"}]}
        """#.utf8))
        let s = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"{"apps":[{"id":"radarr","name":"Radarr","state":"running"},{"id":"seerr","name":"Seerr","state":"running"},{"id":"jellyfin","name":"Jellyfin","state":"stopped"},{"id":"mine","name":"My App","state":"running"}]}"#.utf8))
        let list = StatusCategory.list(apps: s.apps, catalog: catalog)
        #expect(list.map(\.id) == ["media", "media-automation", "own"])
        #expect(list[0].apps.map(\.id) == ["jellyfin", "seerr"])
        #expect(list[1].label == "Media automation" && list[1].line == "Finds and downloads what you ask for in Seerr")
        #expect(list[2].label == "Your own apps" && list[2].apps.map(\.id) == ["mine"])
    }

    // A category's page: each tile's dot and one live line, as the computer's `tileLine`.
    @Test func aTileSaysHowLongItsBeenUpOrWhatHappened() throws {
        func app(_ json: String) throws -> AppStatus {
            try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"{"apps":[\#(json)]}"#.utf8)).apps[0]
        }
        let now = ISO8601DateFormatter().date(from: "2026-11-26T12:00:00Z")!
        let up = TileLine.of(try app(#"{"id":"a","name":"A","state":"running","health":"healthy","since":"2026-11-22T12:00:00Z"}"#), now: now)
        #expect(up.tone == .ok && up.words == "Up 4 days")
        #expect(TileLine.of(try app(#"{"id":"a","name":"A","state":"running","health":"unhealthy"}"#), now: now) == TileLine(tone: .bad, words: "Unhealthy"))
        #expect(TileLine.of(try app(#"{"id":"a","name":"A","state":"running","notAnswering":"no answer"}"#), now: now) == TileLine(tone: .bad, words: "Not answering: no answer"))
        #expect(TileLine.of(try app(#"{"id":"a","name":"A","state":"missing"}"#), now: now) == TileLine(tone: .bad, words: "Not running"))
        let stopped = TileLine.of(try app(#"{"id":"a","name":"A","state":"stopped"}"#), now: now)
        #expect(stopped.tone == .warn && stopped.words.hasPrefix("Stopped"))
        #expect(TileLine.upFor(now.addingTimeInterval(-30), now: now) == "Up a minute")
        #expect(TileLine.upFor(now.addingTimeInterval(-12 * 60), now: now) == "Up 12 min")
        #expect(TileLine.upFor(now.addingTimeInterval(-3600), now: now) == "Up 1 hour")
        #expect(TileLine.upFor(now.addingTimeInterval(-5 * 3600), now: now) == "Up 5 hours")
    }

    // What a category's page offers to add: the catalog's others, no helpers, Seerr in Media; nothing for your own apps.
    @Test func aCategoryPageShelvesWhatIsNotHereYet() throws {
        let catalog = try JSONDecoder.homelab().decode(AppCatalog.self, from: Data(#"""
        {"categories":[{"id":"media","label":"Media"},{"id":"media-automation","label":"Automation"}],
         "apps":[{"id":"jellyfin","name":"Jellyfin","category":"media","description":"Films and shows","kind":"optional"},
                 {"id":"navidrome","name":"Navidrome","category":"media","description":"Your music","kind":"optional"},
                 {"id":"helper","name":"Helper","category":"media","kind":"helper"},
                 {"id":"seerr","name":"Seerr","category":"media-automation","description":"Ask for films","kind":"optional"},
                 {"id":"radarr","name":"Radarr","category":"media-automation","kind":"optional"}]}
        """#.utf8))
        let add = StatusCategory.toAdd("media", installed: ["jellyfin"], catalog: catalog)
        #expect(add.map(\.id) == ["navidrome", "seerr"])
        #expect(StatusCategory.toAdd("media-automation", installed: [], catalog: catalog).map(\.id) == ["radarr"])
        #expect(StatusCategory.toAdd("own", installed: [], catalog: catalog).isEmpty)
        let s = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"{"apps":[{"id":"jellyfin","name":"Jellyfin","state":"running"},{"id":"x","name":"X","state":"stopped"}]}"#.utf8))
        #expect(StatusCategory.facts(apps: s.apps, toAdd: 2) == "2 on the server · 1 running · 2 to add")
        #expect(StatusCategory.facts(apps: [], toAdd: 0) == "")
        // Find an app: by name or what it does, whatever the case and accents.
        #expect(StatusCategory.matches(["Navidrome", "Your music"], "MUSIC"))
        #expect(StatusCategory.matches(["Café"], "cafe"))
        #expect(!StatusCategory.matches(["Navidrome"], "photos"))
        #expect(StatusCategory.matches(["Navidrome"], " "))
    }
}
