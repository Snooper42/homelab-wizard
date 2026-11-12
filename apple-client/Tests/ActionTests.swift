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
        #expect(DashboardViewModel.summary(of: status) == "1 of 2 running · 1 needs a look · 1 of the homelab's own apps is down · 1 paused on battery · checking…")
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
        #expect(AppSetting.allCases.map(\.rawValue) == ["updates", "sundays", "alerts", "pinned", "away"]) // what SetAppSetting takes
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

    // Home only (main #559): Status's reach says a public app has the switch,
    // once the domain has the tunnel; on is "away", off "home".
    @Test func reachItAwayFromHome() throws {
        let away = try app(#"{"id":"immich-server","name":"Immich","state":"running","reach":"away"}"#)
        #expect(away.reach == "away" && AppSetting.available(for: away).last == .away)
        #expect(AppSetting.away.isOn(for: away))
        #expect(AppSetting.away.title == "Reach it away from home")
        #expect(AppSetting.away.detail(on: true).contains("Cloudflare can see what passes"))
        let home = try app(#"{"id":"paperless","name":"Paperless-ngx","state":"running","reach":"home"}"#)
        #expect(!AppSetting.away.isOn(for: home))
        #expect(AppSetting.away.detail(on: false) == "Home only: it opens on your home Wi-Fi, and nobody outside can reach it.")
        #expect(AppSetting.away.reason(on: false, app: home) == "Keep Paperless-ngx home only.")
        // No reach: it can't be published, or the domain has no tunnel yet.
        let plain = try app(#"{"id":"vikunja","name":"Vikunja","state":"running"}"#)
        #expect(!AppSetting.available(for: plain).contains(.away))
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
    /// Every Alert beside the list on the Mac and iPad (#596's gap 4): it
    /// takes the app's place, and picking an app or another screen closes it.
    @Test @MainActor func everyAlertTakesTheAppsPlaceUntilAnotherIsPicked() {
        let live = LiveEventManager(api: APIClient(keychain: FakeCredentialStore(), protocolClasses: [StubProtocol.self]))
        let model = DashboardViewModel(api: APIClient(keychain: FakeCredentialStore()), liveEvents: live)
        model.selectedAppID = "radarr"
        #expect(!model.showsAlertLog)

        model.openAlertLog()
        #expect(model.showsAlertLog && model.selectedAppID == nil)
        // An app picked in the list: its page again.
        model.selectedAppID = "immich"
        #expect(!model.showsAlertLog)

        model.openAlertLog()
        // Another Status filter, or another screen: closed.
        model.sidebar = .status(.attention)
        #expect(!model.showsAlertLog)
        model.openAlertLog()
        model.sidebar = .status(.attention)
        // The same row picked again leaves it open.
        #expect(model.showsAlertLog)
        model.sidebar = .finances
        #expect(!model.showsAlertLog)
    }

    @Test func roundTrips() {
        let all: [DashboardViewModel.SidebarItem] = [.backups, .finances, .setup, .settings] + DashboardViewModel.Filter.allCases.map { .status($0) }
        for item in all {
            #expect(DashboardViewModel.SidebarItem(storageKey: item.storageKey) == item)
        }
        #expect(DashboardViewModel.SidebarItem(storageKey: "apps:nope") == nil)
        #expect(DashboardViewModel.SidebarItem(storageKey: "") == nil)
    }

    @Test func aPlaceKeptBeforeTheScreensMatchedTheComputersStillOpens() {
        // The cards moved to Status; Computer became Setup and Settings.
        #expect(DashboardViewModel.SidebarItem(storageKey: "overview") == .status(.all))
        #expect(DashboardViewModel.SidebarItem(storageKey: "computer") == .settings)
    }

    @Test func theComputersOrderNamesAndShortcuts() {
        let screens: [DashboardViewModel.SidebarItem] = [.status(.all), .backups, .finances, .setup, .settings]
        #expect(screens.map(\.title) == ["Status", "Backups", "Finances", "Setup", "Settings"])
        // As on the computer: ⌘2 Status, ⌘3 Backups, ⌘4 Setup, ⌘5 Settings, ⌘6 Finances.
        #expect(screens.map(\.shortcut) == ["2", "3", "6", "4", "5"])
        // Every Status filter highlights the one Status row.
        #expect(DashboardViewModel.SidebarItem.status(.attention).row == .status(.all))
        #expect(DashboardViewModel.SidebarItem.backups.row == .backups)
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
        #expect(AppDetailView.reach(isPublic: true, hasAddress: true, homeOnly: true) == "At home only: kept off the internet.")
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
                                          ("caution", Theme.caution), ("danger", Theme.danger), ("info", Theme.info),
                                          ("ink", Theme.ink), ("secondaryInk", Theme.secondaryInk)]
        for (scheme, env) in [("light", light), ("dark", dark)] {
            // On a card, and on the canvas behind it (a section's caption).
            for (ground, colour) in [("card", Theme.surface), ("canvas", Theme.canvas)] {
                let back = colour.resolve(in: env)
                for (name, colour) in colours {
                    let ratio = contrast(colour.resolve(in: env), back)
                    #expect(ratio >= 4.5, "\(name) on the \(ground) in \(scheme): \(ratio)")
                }
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

// main #474: a stopped app says when it stopped, and why when Docker knows.
@Suite("Stopped by itself")
struct StoppedByItselfTests {
    private func app(_ json: String) throws -> AppStatus {
        try JSONDecoder.homelab().decode(AppStatus.self, from: Data(json.utf8))
    }

    @Test func whenAndWhy() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let now = Date()
        let today = AppStatus.stoppedByItself(at: calendar.startOfDay(for: now).addingTimeInterval(3600), why: "it ran out of memory", now: now, calendar: calendar)
        #expect(today.hasPrefix("Stopped at ") && today.hasSuffix(": it ran out of memory"))
        let yesterday = try #require(calendar.date(byAdding: .day, value: -1, to: now))
        #expect(AppStatus.stoppedByItself(at: yesterday, why: nil, now: now, calendar: calendar).hasPrefix("Stopped yesterday, "))
        #expect(AppStatus.stoppedByItself(at: nil, why: nil, now: now) == "Stopped")
        #expect(AppStatus.stoppedByItself(at: nil, why: "Docker couldn't start it", now: now) == "Stopped: Docker couldn't start it")
    }

    @Test func aCrashIsDownACleanStopIsToLookAt() throws {
        let crashed = try app(#"{"id":"a","name":"A","state":"stopped","stoppedAt":"2026-11-06T03:12:00Z","stoppedWhy":"it quit with an error"}"#)
        #expect(crashed.isDown && crashed.symbolName == "xmark.circle.fill")
        #expect(crashed.detailLine.hasSuffix(": it quit with an error"))
        let clean = try app(#"{"id":"a","name":"A","state":"stopped","stoppedAt":"2026-11-06T03:12:00Z"}"#)
        #expect(!clean.isDown && clean.symbolName == "exclamationmark.triangle.fill")
        #expect(clean.detailLine.hasPrefix("Stopped"))
    }
}

// Status by category, as the computer's Status groups it.
@Suite("Status groups")
struct StatusGroupTests {
    private func status(_ json: String) throws -> HomelabStatus {
        try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(json.utf8))
    }

    private let catalog: AppCatalog = {
        // swiftlint:disable:next force_try
        try! JSONDecoder.homelab().decode(AppCatalog.self, from: Data(#"""
        {"categories":[{"id":"media","label":"Media"},{"id":"photos","label":"Photos"}],
         "apps":[{"id":"plex","name":"Plex","category":"media"},{"id":"sonarr","name":"Sonarr","category":"media"},
                 {"id":"immich","name":"Immich","category":"photos"},{"id":"vault","name":"Vault","category":"security"}]}
        """#.utf8))
    }()

    @Test func needsALookThenPinnedThenEachCategoryThenOther() throws {
        let st = try status(#"""
        {"apps":[{"id":"plex","name":"Plex","state":"running"},
                 {"id":"sonarr","name":"Sonarr","state":"running","health":"unhealthy"},
                 {"id":"immich","name":"Immich","state":"running","pinned":true},
                 {"id":"vault","name":"Vault","state":"stopped"},
                 {"id":"x","name":"X","state":"missing"}],
         "pinned":["immich"]}
        """#)
        let pinned = st.apps.filter { st.pinned.contains($0.id) }
        let groups = DashboardViewModel.groups(apps: st.apps, pinned: pinned, catalog: catalog)
        #expect(groups.map(\.label) == ["Needs a look", "Pinned", "Media", "Other"])
        #expect(groups[0].apps.map(\.id) == ["sonarr", "x"] && groups[0].alert)
        #expect(groups[1].apps.map(\.id) == ["immich"] && groups[1].pinned)
        #expect(groups[2].apps.map(\.id) == ["plex"])          // Photos is empty, so it goes
        #expect(groups[3].apps.map(\.id) == ["vault"])         // a category the catalog doesn't list
    }

    @Test func foldedWhenAllIsFineUntilChosen() throws {
        let st = try status(#"{"apps":[{"id":"plex","name":"Plex","state":"running"},{"id":"vault","name":"Vault","state":"stopped"}]}"#)
        let groups = DashboardViewModel.groups(apps: st.apps, pinned: [], catalog: catalog)
        let media = try #require(groups.first { $0.label == "Media" })
        let other = try #require(groups.first { $0.label == "Other" })
        #expect(media.isFine && !StatusFolds.isOpen(media, in: ""))
        #expect(!other.isFine && StatusFolds.isOpen(other, in: ""))   // a stop nobody chose
        let opened = StatusFolds.setting(media, open: true, in: "")
        #expect(StatusFolds.isOpen(media, in: opened))
        #expect(!StatusFolds.isOpen(other, in: StatusFolds.setting(other, open: false, in: opened)))
        #expect(StatusFolds.isOpen(other, in: "not json"))             // a bad record is no choice
    }

    // The folds are the computer's, the same on every device (the owner, Nov 10): its answer becomes this device's
    // folds; a change is saved for every device only when the person made it (not the computer's answer coming
    // back, in whatever order), on a device allowed changes, with a computer that keeps them.
    @Test func foldsAreTheComputers() throws {
        let theirs = StatusFolds.fromComputer(["Media": true, "Photos": false])
        #expect(StatusFolds.choices(theirs) == ["Media": true, "Photos": false])
        #expect(StatusFolds.choices(StatusFolds.fromComputer([:])).isEmpty)
        let st = try status(#"{"apps":[{"id":"plex","name":"Plex","state":"running"}]}"#)
        let media = try #require(DashboardViewModel.groups(apps: st.apps, pinned: [], catalog: catalog).first { $0.label == "Media" })
        #expect(StatusFolds.isOpen(media, in: theirs))
        let mine = StatusFolds.setting(media, open: false, in: theirs)
        #expect(!StatusFolds.shouldSave(theirs, computers: theirs, canChange: true, keeps: true))
        #expect(!StatusFolds.shouldSave(#"{"Photos":false,"Media":true}"#, computers: theirs, canChange: true, keeps: true))
        #expect(StatusFolds.shouldSave(mine, computers: theirs, canChange: true, keeps: true))
        #expect(StatusFolds.shouldSave(mine, computers: nil, canChange: true, keeps: true))
        #expect(!StatusFolds.shouldSave(mine, computers: theirs, canChange: false, keeps: true))   // looks only: its own
        #expect(!StatusFolds.shouldSave(mine, computers: theirs, canChange: true, keeps: false))   // an older computer
    }
}

// The widget's one line: a count, never names; and nothing kept without a widget.
@Suite("Widget")
struct WidgetSummaryTests {
    @Test func aCountNeverNames() {
        #expect(WidgetSummary(needALook: 0, at: Date()).words == "All well")
        #expect(WidgetSummary(needALook: 1, at: Date()).words == "1 needs a look")
        #expect(WidgetSummary(needALook: 3, at: Date()).words == "3 need a look")
    }

    @Test func aBuildWithoutTheWidgetKeepsNothing() {
        // The test bundle names no App Group, as the default app doesn't.
        #expect(!WidgetSummaryStore.isAvailable)
        #expect(!WidgetSummaryStore.save(WidgetSummary(needALook: 2, at: Date())))
        #expect(WidgetSummaryStore.load() == nil)
    }
}

// An app's page says why it isn't running, and what helps, as the computer does.
@Suite("Why it's stopped")
struct StoppedNextTests {
    private func app(_ json: String) throws -> AppStatus {
        try JSONDecoder.homelab().decode(AppStatus.self, from: Data(json.utf8))
    }

    @Test func eachReasonInTheComputersWords() throws {
        #expect(try app(#"{"id":"a","name":"A","state":"running"}"#).stoppedNext() == nil)
        let memory = try #require(try app(#"{"id":"a","name":"A","state":"stopped","stoppedWhy":"it ran out of memory"}"#).stoppedNext())
        #expect(memory.why.contains("give Docker more memory") && memory.todo == "Start tries again.")
        let port = try #require(try app(#"{"id":"a","name":"A","state":"stopped","stoppedWhy":"another program is using its port 8080"}"#).stoppedNext())
        #expect(port.why == "Another program has port 8080." && port.todo == "Quit it, then Start.")
        let drive = try #require(try app(#"{"id":"a","name":"A","state":"stopped","waitingFor":"/Volumes/Media"}"#).stoppedNext())
        #expect(drive.why.contains("the Media drive") && drive.todo.isEmpty)
        let outside = try #require(try app(#"{"id":"a","name":"A","state":"stopped"}"#).stoppedNext())
        #expect(outside.why.hasPrefix("It was stopped outside the homelab"))
    }
}

// Snooze… on a failing check, from the phone, as the computer offers it.
@Suite("Snooze from the phone")
struct SnoozeTests {
    @Test func theComputersChoices() {
        #expect(WatchdogSummary.snoozeChoices(snoozed: false).map { $0.hours } == [1, 24])
        #expect(WatchdogSummary.snoozeChoices(snoozed: true).map { $0.label } == ["For an hour", "For a day", "Alert again now"])
        #expect(WatchdogSummary.snoozeReason("disk /", hours: 1) == "No alerts about disk / for an hour.")
        #expect(WatchdogSummary.snoozeReason("disk /", hours: 24) == "No alerts about disk / for a day.")
        #expect(WatchdogSummary.snoozeReason("disk /", hours: 0) == "Alert about disk / again now.")
    }
}
