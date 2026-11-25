import Foundation
import Testing
@testable import HomelabClient

/// The last fourteen nights as squares under Last night, and each app's last
/// seven as dots, as the computer's Backups (R7). Made-up apps and nights.
@Suite struct BackupNightsTests {
    private func overview(_ nights: String) throws -> BackupOverview {
        try JSONDecoder.homelab().decode(BackupOverview.self, from: Data(#"""
        {"copies":[{"id":"mealie","name":"Mealie","app":"mealie","state":"stale"},
                   {"id":"immich-db","name":"Immich database","app":"immich","state":"fresh"},
                   {"id":"env","name":"Settings file","state":"fresh"}],
         "nights":[\#(nights)]}
        """#.utf8))
    }

    @Test func eachNightsToneAsTheComputers() {
        #expect(BackupNight(date: "2026-11-24", apps: ["a": "copied", "b": "copied"]).tone == .ok)
        #expect(BackupNight(date: "2026-11-24", apps: ["a": "copied", "b": "stopped"]).tone == .warn)
        #expect(BackupNight(date: "2026-11-24", apps: ["a": "stopped", "b": "failed"]).tone == .bad)
        #expect(BackupNight(date: "2026-11-24", apps: ["a": "none", "b": "outside"]).tone == .none)
        #expect(BackupNight.tone("copied") == .ok && BackupNight.tone(nil) == .none)
    }

    @Test func theLastFourteenOldestFirstWithTheirWeekdays() throws {
        let rows = (1...16).map { #"{"date":"2026-11-\#(String(format: "%02d", $0))","apps":{"mealie":"copied"}}"# }
        let o = try overview(rows.joined(separator: ","))
        let shown = o.lastNights()
        #expect(shown.count == 14 && shown.first?.date == "2026-11-03" && shown.last?.date == "2026-11-16")
        // Nov 16, 2026 is a Monday, Nov 15 a Sunday.
        #expect(shown.last?.weekday() == "M" && shown[12].weekday() == "Su")
    }

    @Test func aNightInWords() throws {
        let o = try overview(#"{"date":"2026-11-24","apps":{"mealie":"stopped","immich":"copied","env":"copied","pihole":"outside"}}"#)
        let words = o.nights[0].words(name: o.nightName, locale: Locale(identifier: "en_US"))
        #expect(words.hasSuffix(": 2 of 3 copied · Mealie stopped"))
        #expect(words.hasPrefix("Tue"))
        #expect(BackupNight(date: "2026-11-24", apps: [:]).words(name: { $0 }).hasSuffix(": nothing to copy"))
    }

    @Test func eachCopysLastSevenByItsAppOrItsOwnID() throws {
        let rows = (10...20).map { d in #"{"date":"2026-11-\#(d)","apps":{"mealie":"\#(d >= 19 ? "stopped" : "copied")","env":"copied"}}"# }
        let o = try overview(rows.joined(separator: ","))
        let mealie = o.nights(of: o.copies[0])
        #expect(mealie.count == 7 && mealie.first?.date == "2026-11-14")
        #expect(Array(mealie.map { $0.result }.suffix(2)) == ["stopped", "stopped"])
        // No app: its own id. Not in any night: nil each night.
        #expect(o.nights(of: o.copies[2]).allSatisfy { $0.result == "copied" })
        #expect(o.nights(of: o.copies[1]).allSatisfy { $0.result == nil })
    }

    @Test func noNightsKeptYet() throws {
        let o = try JSONDecoder.homelab().decode(BackupOverview.self, from: Data(#"{"copies":[]}"#.utf8))
        #expect(o.nights.isEmpty && o.lastNights().isEmpty)
    }
}
