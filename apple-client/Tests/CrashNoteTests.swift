import Foundation
import Testing
@testable import HomelabClient

/// Status's crash note (the owner's pick, Nov 16): the computer's words for
/// which part of Homelab Wizard stopped and when, read from `LastCrash`
/// (who and when only), and Hide kept on this device for that crash alone.
@Suite struct CrashNoteTests {
    let us = Locale(identifier: "en_US")
    let calendar = Calendar(identifier: .gregorian)

    private func note(_ json: String) throws -> CrashNote {
        try JSONDecoder.homelab().decode(CrashNote.self, from: Data(json.utf8))
    }

    @Test func saysWhichPartAndWhen() throws {
        let now = try #require(ISO8601DateFormatter().date(from: "2026-11-16T15:00:00Z"))
        let app = try note(#"{"who":"the app","when":"2026-11-15T09:30:00Z"}"#)
        #expect(app.title(now: now, calendar: calendar, locale: us) == "Homelab Wizard stopped unexpectedly yesterday")
        let agent = try note(#"{"who":"the background agent","when":"2026-11-12T09:30:00Z"}"#)
        #expect(agent.title(now: now, calendar: calendar, locale: us) == "Homelab Wizard's background agent stopped unexpectedly on Thursday")
        let today = try note(#"{"who":"the menu bar item","when":"2026-11-16T08:00:00Z"}"#)
        #expect(today.title(now: now, calendar: calendar, locale: us) == "Homelab Wizard's menu bar item stopped unexpectedly today")
        let old = try note(#"{"who":"the app","when":"2026-11-02T08:00:00Z"}"#)
        #expect(old.title(now: now, calendar: calendar, locale: us) == "Homelab Wizard stopped unexpectedly on November 2")
    }

    @Test func hideIsForThatCrashOnly() throws {
        let defaults = try #require(UserDefaults(suiteName: "CrashNoteTests"))
        defaults.removePersistentDomain(forName: "CrashNoteTests")
        let first = try note(#"{"who":"the app","when":"2026-11-15T09:30:00Z"}"#)
        #expect(!first.isHidden(in: defaults))
        first.hide(in: defaults)
        #expect(first.isHidden(in: defaults))
        let next = try note(#"{"who":"the app","when":"2026-11-16T10:00:00Z"}"#)
        #expect(!next.isHidden(in: defaults))
    }
}
