import CryptoKit
import Foundation
import Testing
@testable import HomelabClient

// Transactions in the Wallet style: what's new since this phone looked,
// the day in words, and the other times at the same payee.
@Suite("Transactions, Wallet style")
struct TransactionsWalletTests {
    private let key = SymmetricKey(size: .bits256)

    @Test func theFirstLookSeesEverything() {
        var seen = TransactionsSeen.firstLook(["a", "b"], key: key)
        #expect(!seen.isNew("a", key: key) && !seen.isNew("b", key: key))
        // One that comes in afterwards is new until it's reviewed.
        #expect(seen.isNew("c", key: key))
        seen.see(["c"], key: key)
        #expect(!seen.isNew("c", key: key))
        // Gone from the ledger: forgotten, so it never grows past it.
        seen.keep(only: ["b", "c"], key: key)
        #expect(seen.hashes.count == 2)
        #expect(seen.isNew("a", key: key))
    }

    @Test func nothingReadableIsKept() throws {
        let defaults = try #require(UserDefaults(suiteName: "TransactionsWalletTests.\(UUID().uuidString)"))
        let seen = TransactionsSeen.firstLook(["netflix-2026-11-05"], key: key)
        seen.save(to: defaults)
        let loaded = try #require(TransactionsSeen.load(defaults))
        #expect(loaded == seen)
        #expect(!loaded.hashes.contains("netflix-2026-11-05"))
        // Another device's key can't match it.
        #expect(loaded.isNew("netflix-2026-11-05", key: SymmetricKey(size: .bits256)))
        #expect(!loaded.isNew("netflix-2026-11-05", key: key))
    }

    @Test func theDayInWords() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "UTC"))
        let now = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 8, hour: 15)))
        func day(_ d: Int) -> Date? { calendar.date(from: DateComponents(year: 2026, month: 11, day: d, hour: 12)) }
        #expect(TransactionsView.dayWords(day(8), now: now, calendar: calendar) == "Today")
        #expect(TransactionsView.dayWords(day(7), now: now, calendar: calendar) == "Yesterday")
        #expect(!TransactionsView.dayWords(day(4), now: now, calendar: calendar).isEmpty)
        #expect(TransactionsView.dayWords(nil, now: now, calendar: calendar) == "")
    }

    @Test func opensOnCheckingWithoutTheThingsYouOwn() throws {
        let accounts = try JSONDecoder.homelab().decode([FinanceAccount].self, from: Data(#"""
        [{"id":"coins","name":"Coin Collection","kind":"collectible"},
         {"id":"house","name":"House","kind":"home"},
         {"id":"civic","name":"Civic","kind":"car"},
         {"id":"visa","name":"Visa","kind":"card"},
         {"id":"sav","name":"High-Yield Savings","kind":"savings"},
         {"id":"chk","name":"Everyday Checking","kind":"checking"}]
        """#.utf8))
        // It opens on checking, never on whatever comes first.
        #expect(TransactionsView.openingAccount(checking: "chk", in: accounts) == "chk")
        // No checking account (or none yet): all of them.
        #expect(TransactionsView.openingAccount(checking: "", in: accounts) == nil)
        #expect(TransactionsView.openingAccount(checking: "gone", in: accounts) == nil)
        // A home, a car and a collectible have no transactions: not in the switcher.
        #expect(TransactionsView.switcherAccounts(accounts).map(\.id) == ["chk", "sav", "visa"])
    }

    @Test func moreAtTheSamePayee() throws {
        let ledger = try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"""
        {"transactions":[
          {"id":"n1","date":"2026-11-05","account":"chk","amount":-17.99,"payee":"NETFLIX.COM","payment":"netflix"},
          {"id":"n2","date":"2026-10-05","account":"chk","amount":-17.99,"payee":"Netflix"},
          {"id":"n3","date":"2026-09-05","account":"visa","amount":-15.49,"payee":"PAYPAL *NETFLIX"},
          {"id":"t1","date":"2026-11-02","account":"chk","amount":-40,"payee":"Corner Shop"},
          {"id":"t2","date":"2026-10-02","account":"chk","amount":-30,"payee":"CORNER SHOP"},
          {"id":"x","date":"2026-11-03","account":"chk","amount":-500,"payee":"Netflix","to":"sav"},
          {"id":"o","date":"2026-11-01","account":"chk","amount":-9,"payee":"Hulu"}
        ]}
        """#.utf8))
        let all = ledger.newestFirst
        let netflix = try #require(all.first { $0.id == "n1" })
        #expect(netflix.payment == "netflix")
        // By its brand, as the bank wrote it; never a transfer, nor itself.
        #expect(TransactionDetailView_moreAt(netflix, all) == ["n2", "n3"])
        let shop = try #require(all.first { $0.id == "t1" })
        // No brand: the same name as a person writes it.
        #expect(TransactionDetailView_moreAt(shop, all) == ["t2"])
        let transfer = try #require(all.first { $0.id == "x" })
        #expect(TransactionDetailView_moreAt(transfer, all).isEmpty)
    }
}

/// The detail view is private to its file; its matching is reached through this.
private func TransactionDetailView_moreAt(_ t: FinanceTransaction, _ all: [FinanceTransaction]) -> [String] {
    TransactionMatching.moreAt(t, in: all).map(\.id)
}
