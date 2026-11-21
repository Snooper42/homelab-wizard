import Foundation
import Testing
@testable import HomelabClient

// Transactions' search, as the computer's `wordsOf`: by what it came to, its
// day and its accounts too, each word somewhere in the row.
@Suite("Transactions' search")
struct TransactionSearchTests {
    private let names = ["chk": "Everyday Checking", "card": "Rewards Card", "sav": "Savings"]

    private func ledger() throws -> [FinanceTransaction] {
        try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"""
        {"transactions":[
          {"id":"rent","date":"2026-11-01","account":"chk","amount":-1850,"payee":"Hearth Rentals","category":"Rent"},
          {"id":"cafe","date":"2026-10-28","account":"card","amount":-86.1,"payee":"Corner Café","category":"Eating out","note":"rainy day","tags":["work"]},
          {"id":"move","date":"2026-11-03","account":"chk","amount":-500,"payee":"","to":"sav"},
          {"id":"split","date":"2026-11-08","account":"card","amount":-1240.55,"payee":"Big Store","splits":[{"category":"Home","amount":-1000},{"category":"Groceries","amount":-240.55}]}
        ]}
        """#.utf8)).transactions
    }

    private func found(_ query: String, _ all: [FinanceTransaction]) throws -> [String] {
        let search = TransactionSearch(query, locale: Locale(identifier: "en_US"), timeZone: try #require(TimeZone(identifier: "UTC")))
        return all.filter { search.finds($0, accountName: { names[$0] }) }.map(\.id)
    }

    @Test func findsWhatTheComputersFinds() throws {
        let all = try ledger()
        // The amount as typed and as shown, without its sign.
        #expect(try found("86.10", all) == ["cafe"])
        #expect(try found("1,240.55", all) == ["split"])
        #expect(try found("1240.55", all) == ["split"])
        #expect(try found("1,850", all) == ["rent"])
        // Its day as shown.
        #expect(try found("Oct 28", all) == ["cafe"])
        // Its accounts, a transfer's both.
        #expect(try found("savings", all) == ["move"])
        #expect(try found("rewards", all) == ["cafe", "split"])
        // A split's parts, the note and a tag.
        #expect(try found("groceries", all) == ["split"])
        #expect(try found("rainy", all) == ["cafe"])
        #expect(try found("WORK", all) == ["cafe"])
        // Every word, anywhere in the row; letter case doesn't count.
        #expect(try found("corner work", all) == ["cafe"])
        #expect(try found("corner savings", all).isEmpty)
        // Nothing typed finds everything.
        #expect(try found("  ", all).count == all.count)
    }

    @Test func anAmountInWords() {
        #expect(TransactionSearch.amountWords(-86.1) == ["86.10"])
        #expect(TransactionSearch.amountWords(1850) == ["1850.00", "1,850.00"])
        #expect(TransactionSearch.amountWords(-1234567.891) == ["1234567.89", "1,234,567.89"])
    }
}
