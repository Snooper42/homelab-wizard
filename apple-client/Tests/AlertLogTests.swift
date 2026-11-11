import Foundation
import Testing
@testable import HomelabClient

/// Every Alert: what became of each alert the computer kept, in the words
/// the computer's own Every alert… uses.
@Suite("Every Alert")
struct AlertLogTests {
    private let now = Date(timeIntervalSince1970: 1_794_405_600) // 2026-11-11 14:00 UTC

    private func alert(cleared: Date? = nil, until: Date? = nil, by: String = "", checks: [String] = ["vikunja"]) -> KeptAlert {
        KeptAlert(id: 1, at: now.addingTimeInterval(-3600), topic: "tunnel-watchdog", title: "Homelab: something is down",
                  body: "vikunja: not answering", priority: 4, checks: checks, clearedAt: cleared, snoozedUntil: until, snoozedBy: by)
    }

    @Test func clearedSaysWhen() {
        let at = now.addingTimeInterval(-600)
        #expect(alert(cleared: at).fate(now: now) == "Cleared at \(WatchdogSummary.wakeText(at, now: now))")
    }

    @Test func snoozedSaysByWhomUntilWhen() {
        let until = now.addingTimeInterval(3600)
        #expect(alert(until: until, by: "Sam's iPhone").fate(now: now) == "Snoozed by Sam's iPhone until \(WatchdogSummary.wakeText(until, now: now))")
        // A wall screen isn't told by whom.
        #expect(alert(until: until).fate(now: now) == "Snoozed until \(WatchdogSummary.wakeText(until, now: now))")
        // A snooze that ended says nothing of it.
        #expect(alert(until: now.addingTimeInterval(-60), by: "Sam's iPhone").fate(now: now) == "Not cleared yet")
    }

    @Test func openOrAboutNoCheck() {
        #expect(alert().fate(now: now) == "Not cleared yet")
        #expect(alert(checks: []).fate(now: now) == nil)
    }

    @Test func topicsByTheirNames() {
        #expect(alert().topicName == "Watchdog")
        #expect(KeptAlert(id: 2, at: now, topic: "duplicati-alerts", title: "x", body: "", priority: 0, checks: [], clearedAt: nil, snoozedUntil: nil, snoozedBy: "").topicName == "Backups")
        #expect(KeptAlert(id: 3, at: now, topic: "somewhere-new", title: "x", body: "", priority: 0, checks: [], clearedAt: nil, snoozedUntil: nil, snoozedBy: "").topicName == "somewhere-new")
    }
}
