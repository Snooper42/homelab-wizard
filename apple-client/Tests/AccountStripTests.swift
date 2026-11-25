import Foundation
import Testing
@testable import HomelabClient

/// The accounts as a row of small cards under Finances' first card, as the
/// redesign's phone picture. Made-up accounts and figures.
@Suite struct AccountStripTests {
    private func view(checkingNow: String = "null") throws -> FinancesPlanView {
        try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-11-06","checking":"chk","start":{"chk":2400,"sav":6500,"visa":1250.5,"house":400000},
         "checkingNow":\#(checkingNow),
         "plan":{"people":[{"id":"alex","name":"Alex"}],
                 "accounts":[{"id":"visa","name":"Example Card","kind":"card"},
                             {"id":"sav","name":"Example Savings","kind":"savings"},
                             {"id":"house","name":"Home","kind":"home"},
                             {"id":"brokerage","name":"Example Brokerage","kind":"investment","balance":1200},
                             {"id":"chk","name":"Example Checking","kind":"checking"}],
                 "payments":[],"cushion":500},
         "periods":[],"days":[]}
        """#.utf8))
    }

    @Test func checkingFirstThenTheScreensOrderWithoutAHome() throws {
        #expect(AccountStrip.cards(try view()).map(\.id) == ["chk", "sav", "visa", "brokerage"])
    }

    @Test func checkingAtTheFirstCardsNowAndACardAsWhatItOwes() throws {
        let cards = AccountStrip.cards(try view(checkingNow: #"{"date":"2026-11-06","from":"2026-11-04","start":2400,"steps":[],"result":2512.40}"#))
        let amount = Dictionary(uniqueKeysWithValues: cards.map { ($0.id, $0.amount) })
        #expect(amount["chk"] == 2512.40)
        #expect(amount["sav"] == 6500)
        #expect(amount["visa"] == -1250.5)
        // No balance kept for the day: the one typed in.
        #expect(amount["brokerage"] == 1200)
    }

    @Test func checkingAtItsBalanceWhenNowIsntWorkedOut() throws {
        #expect(AccountStrip.cards(try view()).first?.amount == 2400)
    }

    @Test func transactionsSwitcherListsTheSameAccounts() throws {
        let accounts = try view().plan.accounts
        #expect(TransactionsView.switcherAccounts(accounts).map(\.id) == AccountStrip.listed(accounts).map(\.id))
    }
}
