import CoreGraphics
import Foundation
import ImageIO
import SwiftUI
import Testing
@testable import HomelabClient

@Suite("AppAction")
struct AppActionTests {
    private func app(state: String, health: String? = nil, id: String = "jellyfin") throws -> AppStatus {
        var json = #"{"id":"\#(id)","name":"Jellyfin","state":"\#(state)""#
        if let health { json += #","health":"\#(health)""# }
        json += "}"
        return try JSONDecoder.homelab().decode(AppStatus.self, from: Data(json.utf8))
    }

    @Test func followsTheComputersRowMenu() throws {
        #expect(AppAction.available(for: try app(state: "stopped")) == [.start])
        #expect(AppAction.available(for: try app(state: "running", health: "healthy")) == [.restart, .stop])
        #expect(AppAction.available(for: try app(state: "running", health: "native")).isEmpty)
        #expect(AppAction.available(for: try app(state: "missing")).isEmpty)
        #expect(AppAction.available(for: try app(state: "elsewhere")).isEmpty)
    }

    @Test func stopAndRollBackAreConfirmed() {
        #expect(AppAction.allCases.filter(\.needsConfirmation) == [.stop, .rollback])
        #expect(!AppAction.rollback.isEveryday)
    }

    @Test func rollBackWhileTheOldVersionIsKept() throws {
        let json = #"{"id":"immich","name":"Immich","state":"running","updatedAt":"2026-11-04T03:00:00Z"}"#
        let updated = try JSONDecoder.homelab().decode(AppStatus.self, from: Data(json.utf8))
        #expect(AppAction.available(for: updated) == [.restart, .stop, .rollback])
        #expect(AppAction.rollback.confirmationMessage(for: updated).contains("homelab updates release immich"))
    }

    @Test func appIDsAreCatalogShaped() {
        #expect(AppStatus.isValidID("nginx-proxy-manager"))
        #expect(AppStatus.isValidID("firefly-iii"))
        #expect(!AppStatus.isValidID(""))
        #expect(!AppStatus.isValidID("../etc"))
        #expect(!AppStatus.isValidID("a b"))
        #expect(!AppStatus.isValidID("app;rm -rf"))
        #expect(!AppStatus.isValidID(String(repeating: "a", count: 65)))
    }

    @Test func commandOutputIsCleanedAndCapped() {
        let lines = APIError.sanitizeLog(["\u{1B}[1mbold\u{7}", "tab\there"] + Array(repeating: "x", count: 500))
        #expect(lines.count == 400)
        let short = APIError.sanitizeLog(["\u{1B}[1mbold\u{7}", "tab\there", String(repeating: "y", count: 2000)])
        #expect(short[0] == "[1mbold")
        #expect(short[1] == "tab\there")
        #expect(short[2].count == 1000)
        #expect(APIError.sanitizeLog(nil).isEmpty)
    }

    @Test func failedActionsLogNoOutput() {
        #expect(APIError.actionFailed(message: "no such container jellyfin", log: ["secret"]).logName == "actionFailed")
    }
}

@Suite("Stop for a while")
struct StopChoiceTests {
    private var utc: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }

    private func at(_ text: String) -> Date { GoTime.parse(text)! }

    @Test func afternoonOffersAnHourTonightAndTomorrowMorning() {
        let choices = StopChoice.choices(now: at("2026-11-05T14:30:42Z"), calendar: utc)
        #expect(choices.map(\.until) == [at("2026-11-05T15:30:00Z"), at("2026-11-05T21:00:00Z"), at("2026-11-06T08:00:00Z")])
        #expect(choices[2].label.hasSuffix("tomorrow"))
    }

    @Test func lateEveningSkipsTonight() {
        let choices = StopChoice.choices(now: at("2026-11-05T20:30:00Z"), calendar: utc)
        #expect(choices.map(\.until) == [at("2026-11-05T21:30:00Z"), at("2026-11-06T08:00:00Z")])
    }

    @Test func earlyMorningOffersThisMorning() {
        let choices = StopChoice.choices(now: at("2026-11-05T03:00:00Z"), calendar: utc)
        #expect(choices.last?.until == at("2026-11-05T08:00:00Z"))
        #expect(choices.last?.label.hasSuffix("tomorrow") == false)
    }

    @Test func untilIsWhatTheCLITakes() {
        #expect(StopChoice(label: "x", until: at("2026-11-05T21:00:00Z")).untilArgument == "2026-11-05T21:00:00Z")
    }

    @Test func statusCarriesTheStopToItsApp() throws {
        let status = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"""
        {"apps":[{"id":"immich","name":"Immich","state":"stopped"},{"id":"plex","name":"Plex","state":"stopped"}],
         "stopped":{"immich":{"since":"2026-11-05T14:00:00Z","until":"2026-11-05T21:00:00Z"},"plex":{"since":"2026-11-05T14:00:00Z"}}}
        """#.utf8))
        #expect(status.apps[0].stoppedOnPurpose?.until == at("2026-11-05T21:00:00Z"))
        #expect(status.apps[1].stoppedOnPurpose?.words() == "Stopped by you")
    }

    @Test func anAppTheWatchdogStoppedNeedsALook() throws {
        let status = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"""
        {"apps":[{"id":"loop","name":"Loop","state":"stopped"},{"id":"plex","name":"Plex","state":"stopped"},
                 {"id":"odd","name":"Odd","state":"stopped"}],
         "stopped":{"loop":{"since":"2026-11-05T14:00:00Z","why":"restarting","restarts":5},
                    "plex":{"since":"2026-11-05T14:00:00Z"},
                    "odd":{"since":"2026-11-05T14:00:00Z","why":"restarting"}}}
        """#.utf8))
        let loop = status.apps[0], plex = status.apps[1], odd = status.apps[2]
        #expect(loop.stoppedOnPurpose?.keptRestarting == true)
        #expect(loop.detailLine == "Stopped: it restarted 5 times in an hour")
        #expect(odd.detailLine == "Stopped: it restarted many times in an hour")
        #expect(loop.needsAttention && !plex.needsAttention)
        // Like one stopped by you, it's started from its own row, not by Start the stopped.
        #expect(AppAction.groupTargets(.start, in: status.apps).isEmpty)
    }

    @Test func needsALookAsTheComputerCountsIt() throws {
        let apps = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"""
        {"apps":[{"id":"a","name":"A","state":"stopped"},
                 {"id":"b","name":"B","state":"stopped"},
                 {"id":"homelab-companion","name":"Phone companion","state":"not running"},
                 {"id":"c","name":"C","state":"missing"},
                 {"id":"d","name":"D","state":"elsewhere"},
                 {"id":"e","name":"E","state":"running","health":"restarting"},
                 {"id":"f","name":"F","state":"running","health":"native"}],
         "stopped":{"b":{"since":"2026-11-05T14:00:00Z"}}}
        """#.utf8)).apps
        #expect(apps.map(\.needsAttention) == [true, false, false, true, false, true, false])
        #expect(apps[2].detailLine == "Starts with the scheduled jobs (Setup)")
        #expect(apps[3].detailLine == "Not running" && apps[4].detailLine == "Runs elsewhere")
        #expect(apps[5].detailLine == "Restarting" && apps[6].detailLine == "Running (native app)")
    }

    @Test func theSummaryReadsLikeTheComputersTiles() throws {
        let status = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"""
        {"apps":[{"id":"a","name":"A","state":"running"},{"id":"b","name":"B","state":"stopped"},
                 {"id":"homelab-companion","name":"Phone companion","state":"not running"}],
         "missing":1,"batteryPaused":["b"],"checking":true}
        """#.utf8))
        #expect(DashboardViewModel.summary(of: status) == "1 of 2 running · 1 needs attention · 1 baseline app is down · 1 paused on battery · checking…")
        let empty = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"{"apps":[]}"#.utf8))
        #expect(DashboardViewModel.summary(of: empty) == "No apps yet")
    }

    @Test func batteryAndDriveWaitsAreNotStartedInBulk() throws {
        let status = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"""
        {"apps":[{"id":"plain","name":"Plain","state":"stopped"},
                 {"id":"immich","name":"Immich","state":"stopped"},
                 {"id":"jellyfin","name":"Jellyfin","state":"stopped","waitingFor":"/Volumes/Media"},
                 {"id":"running","name":"Running","state":"running"}],
         "batteryPaused":["immich","running"]}
        """#.utf8))
        let apps = status.apps
        #expect(AppAction.groupTargets(.start, in: apps).map(\.id) == ["plain"])
        #expect(apps[1].pausedOnBattery && apps[1].detailLine == "Paused on battery" && apps[1].isWaiting)
        #expect(apps[2].detailLine == "Waiting for the Media drive" && apps[2].isWaiting)
        // Running again: the battery list doesn't change how it reads.
        #expect(apps[3].detailLine == "Running" && !apps[3].isWaiting)
        // Stopped, and not on purpose: the computer's Needs a look counts them.
        #expect(apps[1].needsAttention && apps[2].needsAttention && apps[0].needsAttention)
    }

    @Test func aBadStoppedRecordDoesNotCostTheStatus() throws {
        let status = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"""
        {"apps":[{"id":"a","name":"A","state":"stopped"}],"stopped":{"a":{"since":"yesterday"}}}
        """#.utf8))
        #expect(status.apps.count == 1)
        #expect(status.stopped.isEmpty)
    }
}

@Suite("App settings")
struct AppSettingTests {
    private func app(_ json: String) throws -> AppStatus {
        try JSONDecoder.homelab().decode(AppStatus.self, from: Data(json.utf8))
    }

    @Test func valuesFromStatus() throws {
        let held = try app(#"{"id":"immich","name":"Immich","state":"running","held":true,"quiet":true}"#)
        #expect(!AppSetting.updates.isOn(for: held))
        #expect(!AppSetting.alerts.isOn(for: held))
        let plain = try app(#"{"id":"immich","name":"Immich","state":"running"}"#)
        #expect(AppSetting.updates.isOn(for: plain) && AppSetting.alerts.isOn(for: plain))
    }

    @Test func nativeAppsHaveOnlyAlerts() throws {
        let native = try app(#"{"id":"jellyfin","name":"Jellyfin","state":"running","health":"native"}"#)
        #expect(AppSetting.available(for: native) == [.alerts, .pinned])
        #expect(AppSetting.allCases.map(\.rawValue) == ["updates", "sundays", "alerts", "pinned"]) // what SetAppSetting takes
    }

    // main #457: an update window per app.
    @Test func updateDays() throws {
        let plain = try app(#"{"id":"immich","name":"Immich","state":"running"}"#)
        #expect(AppSetting.available(for: plain) == [.updates, .sundays, .alerts, .pinned])
        #expect(!AppSetting.sundays.isOn(for: plain))
        #expect(AppSetting.sundays.title(for: plain) == "Only on Sundays")
        #expect(AppSetting.updates.detail(on: true, app: plain) == "Every night, with a backup of its data first.")

        let sundays = try app(#"{"id":"immich","name":"Immich","state":"running","updateDays":["sun"]}"#)
        #expect(AppSetting.sundays.isOn(for: sundays))
        #expect(AppSetting.updates.detail(on: true, app: sundays) == "On Sundays only, with a backup of its data first.")

        let weekend = try app(#"{"id":"immich","name":"Immich","state":"running","updateDays":["sat","sun"]}"#)
        #expect(AppSetting.sundays.title(for: weekend) == "Only on Saturdays and Sundays")
        #expect(AppStatus.weekdaysText(["mon", "wed", "fri"]) == "Mondays, Wednesdays and Fridays")

        // Held: the nightly update leaves it out, so no days to choose.
        let held = try app(#"{"id":"immich","name":"Immich","state":"running","held":true}"#)
        #expect(!AppSetting.available(for: held).contains(.sundays))
    }
}

@Suite("Group actions")
struct GroupActionTests {
    @Test func targetsAsTheComputerPicksThem() throws {
        let status = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"""
        {"apps":[{"id":"a","name":"A","state":"running"},{"id":"b","name":"B","state":"stopped"},
                 {"id":"c","name":"C","state":"stopped"},{"id":"n","name":"N","state":"running","health":"native"},
                 {"id":"m","name":"M","state":"missing"}],
         "stopped":{"c":{"since":"2026-11-05T10:00:00Z"}}}
        """#.utf8))
        #expect(AppAction.groupTargets(.start, in: status.apps).map(\.id) == ["b"])     // c was stopped on purpose
        #expect(AppAction.groupTargets(.restart, in: status.apps).map(\.id) == ["a"])   // n is native
        #expect(AppAction.groupTargets(.stop, in: status.apps).map(\.id) == ["a"])
        #expect(AppAction.groupTargets(.rollback, in: status.apps).isEmpty)
    }

    @Test func progressLabel() {
        let p = AppActionsViewModel.GroupProgress(action: .restart, at: 1, of: 5)
        #expect(p.label == "Restarting 2 of 5…")
    }
}

@Suite("Pinned apps and why they started")
struct PinnedTests {
    @Test func decodesPinnedAndStartedBy() throws {
        let status = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"""
        {"apps":[{"id":"a","name":"A","state":"running","startedBy":"watchdog","pinned":true},
                 {"id":"b","name":"B","state":"running","pinned":true},{"id":"c","name":"C","state":"running"}],
         "pinned":["b","a"]}
        """#.utf8))
        #expect(status.pinned == ["b", "a"])
        #expect(status.apps[0].pinned == true && AppSetting.pinned.isOn(for: status.apps[0]))
        #expect(status.apps[0].startedWords?.hasPrefix("The watchdog") == true)
        #expect(status.apps[2].startedWords == nil)
    }

    @Test @MainActor func pinnedComeFirstInTheirOrder() async throws {
        let live = LiveEventManager(api: APIClient(keychain: FakeCredentialStore(), protocolClasses: [StubProtocol.self]))
        let model = DashboardViewModel(api: APIClient(keychain: FakeCredentialStore()), liveEvents: live)
        // No status yet: nothing pinned, nothing listed.
        #expect(model.pinnedApps.isEmpty)
        #expect(model.apps(for: .all).isEmpty)
    }
}

@Suite("The sidebar's place")
struct SidebarPlaceTests {
    @Test func roundTrips() {
        let all: [DashboardViewModel.SidebarItem] = [.overview, .backups, .finances, .computer] + DashboardViewModel.Filter.allCases.map { .apps($0) }
        for item in all {
            #expect(DashboardViewModel.SidebarItem(storageKey: item.storageKey) == item)
        }
        #expect(DashboardViewModel.SidebarItem(storageKey: "apps:nope") == nil)
        #expect(DashboardViewModel.SidebarItem(storageKey: "") == nil)
    }
}

@Suite("Searching the app list")
struct AppSearchTests {
    private let apps = try! JSONDecoder.homelab().decode([AppStatus].self, from: Data(#"""
    [{"id":"jellyfin","name":"Jellyfin","state":"running"},{"id":"immich","name":"Immich Photos","state":"running"},
     {"id":"pihole","name":"Pi-hole Café","state":"stopped"}]
    """#.utf8))

    @Test func matchesNameOrIDRegardlessOfCaseAndAccents() {
        #expect(apps.filter { DashboardViewModel.matches($0, "JELLY") }.map(\.id) == ["jellyfin"])
        #expect(apps.filter { DashboardViewModel.matches($0, "photos") }.map(\.id) == ["immich"])
        #expect(apps.filter { DashboardViewModel.matches($0, "cafe") }.map(\.id) == ["pihole"])
        #expect(apps.filter { DashboardViewModel.matches($0, "pihole") }.map(\.id) == ["pihole"])
        #expect(apps.filter { DashboardViewModel.matches($0, "  ") }.count == 3)
        #expect(apps.filter { DashboardViewModel.matches($0, "plex") }.isEmpty)
    }
}

@Suite("The app page")
@MainActor
struct AppPageTests {
    @Test func saysWhereItCanBeReached() {
        #expect(AppDetailView.reach(isPublic: true, hasAddress: true).contains("Cloudflare Tunnel"))
        #expect(AppDetailView.reach(isPublic: false, hasAddress: true) == "At home and on your tailnet, not on the internet.")
        #expect(AppDetailView.reach(isPublic: false, hasAddress: false) == "On this machine only.")
    }

    @Test func settingsSayWhatOnAndOffMean() {
        #expect(AppSetting.updates.title == "Nightly updates")
        #expect(AppSetting.updates.detail(on: false) == "Held: the nightly update leaves it out.")
        #expect(AppSetting.alerts.detail(on: true).contains("ntfy"))
        #expect(AppSetting.allCases.allSatisfy { $0.detail(on: true) != $0.detail(on: false) })
    }

    @Test func onlyHTTPSAddressesOpen() {
        #expect(AppDetailView.httpsURL("photos.example.com")?.absoluteString == "https://photos.example.com")
        #expect(AppDetailView.httpsURL("http://photos.example.com") == nil)
        #expect(AppDetailView.httpsURL("ftp://photos.example.com") == nil)
    }
}

#if os(macOS)
@Suite("The Dock badge")
struct DockBadgeTests {
    @Test func aCountOnlyAndNothingAtZero() {
        #expect(DockBadge.label(for: 0) == nil)
        #expect(DockBadge.label(for: 3) == "3")
        #expect(DockBadge.label(for: 250) == "99+")
    }
}
#endif

// main #449: a state reads by its shape as well as its colour.
@Suite("State shapes")
struct StateShapeTests {
    private func app(_ json: String) throws -> AppStatus {
        try JSONDecoder.homelab().decode(AppStatus.self, from: Data(json.utf8))
    }

    @Test func circleTriangleCross() throws {
        let up = try app(#"{"id":"a","name":"A","state":"running"}"#)
        #expect(up.symbolName == "checkmark.circle.fill")
        // Stopped, and nobody stopped it on purpose: to look at.
        let stopped = try app(#"{"id":"a","name":"A","state":"stopped"}"#)
        #expect(stopped.needsAttention && !stopped.isDown)
        #expect(stopped.symbolName == "exclamationmark.triangle.fill")
        // Down: a cross.
        for json in [#"{"id":"a","name":"A","state":"running","health":"unhealthy"}"#,
                     #"{"id":"a","name":"A","state":"missing"}"#,
                     #"{"id":"a","name":"A","state":"running","notAnswering":"HTTP 502"}"#] {
            let down = try app(json)
            #expect(down.isDown)
            #expect(down.symbolName == "xmark.circle.fill")
        }
    }
}

// main #451: what VoiceOver hears when Status changes.
@Suite("Status read aloud")
struct StatusAloudTests {
    private func apps(_ json: String) throws -> [AppStatus] {
        try JSONDecoder.homelab().decode([AppStatus].self, from: Data(json.utf8))
    }

    @Test func saysWhatChangedInTheRowsWords() throws {
        let before = try apps(#"[{"id":"v","name":"Vikunja","state":"running"},{"id":"i","name":"Immich","state":"running"},{"id":"p","name":"Plex","state":"running"}]"#)
        let was = Dictionary(uniqueKeysWithValues: before.map { ($0.id, $0.detailLine) })
        let after = try apps(#"[{"id":"v","name":"Vikunja","state":"running","health":"restarting"},{"id":"i","name":"Immich","state":"running","health":"restarting"},{"id":"p","name":"Plex","state":"running"}]"#)
        #expect(DashboardViewModel.changes(from: was, to: after) == "Vikunja and Immich: Restarting")
        #expect(DashboardViewModel.changes(from: was, to: before) == nil)
        // A new app isn't a change to say.
        let added = try before + apps(#"[{"id":"n","name":"New","state":"running"}]"#)
        #expect(DashboardViewModel.changes(from: was, to: added) == nil)
    }

    @Test func listsNamesAsTheComputerDoes() {
        #expect(DashboardViewModel.listed(["A"]) == "A")
        #expect(DashboardViewModel.listed(["A", "B", "C"]) == "A, B and C")
        #expect(DashboardViewModel.listed(["A", "B", "C", "D", "E", "F", "G"]) == "A, B, C, D and 3 more")
    }
}

#if os(macOS)
// The theme's colours stay readable as text on a card, in light and dark
// (WCAG AA for small text: 4.5:1). Theme.swift promises it; this keeps it.
@Suite("Theme colours")
struct ThemeContrastTests {
    /// Relative luminance from a resolved colour, whose components are linear sRGB.
    private func luminance(_ c: Color.Resolved) -> Double {
        0.2126 * Double(c.linearRed) + 0.7152 * Double(c.linearGreen) + 0.0722 * Double(c.linearBlue)
    }

    private func contrast(_ a: Color.Resolved, _ b: Color.Resolved) -> Double {
        let (x, y) = (luminance(a), luminance(b))
        return (max(x, y) + 0.05) / (min(x, y) + 0.05)
    }

    @Test @MainActor func textColoursReadOnTheirCards() throws {
        var light = EnvironmentValues(), dark = EnvironmentValues()
        light.colorScheme = .light
        dark.colorScheme = .dark
        // The dark values must really be the dark ones, or the check means nothing.
        #expect(Theme.surface.resolve(in: light) != Theme.surface.resolve(in: dark))

        let colours: [(String, Color)] = [("accent", Theme.accent), ("success", Theme.success), ("warning", Theme.warning),
                                          ("caution", Theme.caution), ("danger", Theme.danger), ("info", Theme.info)]
        for (scheme, env) in [("light", light), ("dark", dark)] {
            let card = Theme.surface.resolve(in: env)
            for (name, colour) in colours {
                let ratio = contrast(colour.resolve(in: env), card)
                #expect(ratio >= 4.5, "\(name) in \(scheme): \(ratio)")
            }
        }
    }
}
#endif

// main #470: health in one line, as the computer says it.
@Suite("Health in one line")
struct HealthLineTests {
    @Test func theOneThingThatNeedsYou() {
        #expect(DashboardViewModel.healthWords(apps: [], checks: []) == nil)
        #expect(DashboardViewModel.healthWords(apps: [("Immich", "Unhealthy")], checks: ["tunnel"]) == "Immich: Unhealthy")
        #expect(DashboardViewModel.healthWords(apps: [("Immich", "Unhealthy"), ("Plex", "Stopped")], checks: []) == "2 apps need a look: Immich and Plex")
        #expect(DashboardViewModel.healthWords(apps: [], checks: ["tunnel"]) == "The watchdog's check of tunnel is failing")
        #expect(DashboardViewModel.healthWords(apps: [], checks: ["a", "b"]) == "2 of the watchdog's checks are failing: a and b")
        #expect(DashboardViewModel.shortList(["A", "B", "C"]) == "A, B and C")
        #expect(DashboardViewModel.shortList(["A", "B", "C", "D", "E"]) == "A, B and 3 more")
    }
}
