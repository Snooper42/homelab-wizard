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
        // Not stopped by you, so Start the stopped covers it; one stopped by you isn't.
        #expect(AppAction.groupTargets(.start, in: status.apps).map(\.id) == ["loop", "odd"])
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
        #expect(AppSetting.allCases.map(\.rawValue) == ["updates", "alerts", "pinned"]) // what SetAppSetting takes
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
