import Foundation
import Testing
@testable import HomelabClient

/// Accounts' top card and rows, as the owner's reference pictures.
@Suite struct AccountsLookTests {
    private func day(_ s: String) throws -> Date { try #require(LocalDay.parse(s)) }

    @Test func howTheLineMovedWithItsShare() throws {
        let up = try #require(AccountsLook.change([NetWorthPoint(date: try day("2026-08-24"), value: 178_162.65),
                                                   NetWorthPoint(date: try day("2026-11-24"), value: 198_051.55)]))
        #expect(abs(up.amount - 19_888.90) < 0.001)
        #expect(up.share.map { abs($0 - 0.111631) < 0.0001 } == true)
        // Owed, as less than nothing: a card paid down is a rise.
        let card = try #require(AccountsLook.change([NetWorthPoint(date: try day("2026-10-24"), value: -1_500),
                                                     NetWorthPoint(date: try day("2026-11-24"), value: -1_200)]))
        #expect(card.amount == 300 && card.share == 0.2)
        #expect(AccountsLook.change([NetWorthPoint(date: try day("2026-11-24"), value: 1)]) == nil)
        #expect(AccountsLook.change([NetWorthPoint(date: try day("2026-11-23"), value: 0),
                                     NetWorthPoint(date: try day("2026-11-24"), value: 50)])?.share == nil)
    }

    @Test func howLongAgoItsBalanceWasTypedIn() throws {
        let today = try day("2026-11-24")
        #expect(AccountsLook.updated(try day("2026-11-24"), today: today) == "Today")
        #expect(AccountsLook.updated(try day("2026-11-23"), today: today) == "Yesterday")
        #expect(AccountsLook.updated(try day("2026-11-21"), today: today) == "3 days ago")
        #expect(AccountsLook.updated(nil, today: today) == nil)
        #expect(AccountsLook.updated(try day("2026-11-01"), today: today) != nil)
    }
}
