import Foundation
import Testing
@testable import HomelabClient

/// Alerts From (Settings): the ntfy app notifies, as before, until this
/// phone picks this app; then the kept alerts new since it last looked are
/// shown, never the old ones, never a flood.
@Suite("Alerts from this app")
struct AlertNotificationsTests {
    private func notes() -> AlertNotifications {
        AlertNotifications(defaults: UserDefaults(suiteName: "alerts-\(UUID().uuidString)")!)
    }

    private func kept(_ ids: [Int64]) -> [KeptAlert] {
        ids.map { KeptAlert(id: $0, at: Date(), topic: "tunnel-watchdog", title: "Alert \($0)", body: "", priority: 0, checks: [],
                            clearedAt: nil, snoozedUntil: nil, snoozedBy: "") }
    }

    @Test func theNtfyAppNotifiesUntilThisPhonePicksThisApp() {
        let n = notes()
        #expect(n.source == .ntfy)
        #expect(n.toShow(kept([1, 2])).isEmpty)
        n.source = .thisApp
        #expect(AlertNotifications(defaults: n.defaults).source == .thisApp)
    }

    @Test func theFirstLookShowsNothingOld() {
        let n = notes()
        n.source = .thisApp
        #expect(n.toShow(kept([3, 2, 1])).isEmpty)
        // Then only what's new, oldest first.
        #expect(n.toShow(kept([5, 4, 3, 2, 1])).map(\.id) == [4, 5])
        #expect(n.toShow(kept([5, 4, 3])).isEmpty)
    }

    @Test func aLongTimeAwayIsNotAFlood() {
        let n = notes()
        n.source = .thisApp
        _ = n.toShow(kept([1]))
        let shown = n.toShow(kept(Array((1...20).reversed())))
        #expect(shown.map(\.id) == [16, 17, 18, 19, 20])
    }

    @Test func aRecordBegunAgainStartsAfresh() {
        let n = notes()
        n.source = .thisApp
        _ = n.toShow(kept([40]))
        // The computer's record began again: its ids are lower than seen.
        #expect(n.toShow(kept([2, 1])).isEmpty)
        #expect(n.toShow(kept([3, 2, 1])).map(\.id) == [3])
    }

    @Test func switchingBackAndAgainDoesNotReplay() {
        let n = notes()
        n.source = .thisApp
        _ = n.toShow(kept([1]))
        n.source = .ntfy
        n.source = .thisApp
        #expect(n.toShow(kept([3, 2, 1])).isEmpty)
    }

    @Test func noneKeptYetIsNothing() {
        let n = notes()
        n.source = .thisApp
        #expect(n.toShow([]).isEmpty)
        #expect(n.toShow(kept([1])).isEmpty)
        #expect(n.toShow(kept([2, 1])).map(\.id) == [2])
    }
}
