import Foundation
import Testing
@testable import HomelabClient

// Transactions sorted as the computer's column headers (Transactions.tsx's
// `TxSort`), kept on this device, and drawn 200 at a time.
@Suite("Transactions, sorted by a column")
struct TransactionSortTests {
    private func ledger() throws -> [FinanceTransaction] {
        try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"""
        {"transactions":[
          {"id":"rent1","date":"2025-11-01","account":"chk","amount":-1850,"payee":"Hearth Rentals","category":"Rent"},
          {"id":"pay","date":"2026-11-14","account":"chk","amount":2410,"payee":"Paycheck","category":"Income"},
          {"id":"cafe","date":"2026-11-20","account":"card","amount":-11.4,"payee":"corner Café","category":"Eating out"},
          {"id":"rent2","date":"2026-11-01","account":"chk","amount":-1850,"payee":"Hearth Rentals","category":"Rent"},
          {"id":"move","date":"2026-11-03","account":"chk","amount":-500,"payee":"","to":"sav"},
          {"id":"split","date":"2026-11-08","account":"card","amount":-90,"payee":"Big Store","splits":[{"category":"Home","amount":-60},{"category":"Groceries","amount":-30}]},
          {"id":"none","date":"2026-11-09","account":"card","amount":-5,"payee":"apple stand"}
        ]}
        """#.utf8)).newestFirst
    }

    private let names = ["chk": "Everyday Checking", "card": "Rewards Card", "sav": "Savings"]

    private func ids(_ sort: TransactionSort, _ all: [FinanceTransaction]) -> [String] {
        sort.sorted(all, payee: { $0.payee.isEmpty ? "To \(names[$0.to ?? ""] ?? "")" : $0.payee },
                    accountName: { names[$0] ?? $0 }).map(\.id)
    }

    @Test func eachColumnSortsAsTheComputersDoes() throws {
        let all = try ledger()
        #expect(ids(.newestFirst, all) == ["cafe", "pay", "none", "split", "move", "rent2", "rent1"])
        #expect(ids(TransactionSort(by: .date, up: true), all) == ["rent1", "rent2", "move", "split", "none", "pay", "cafe"])
        // Most out first; the two Rents as they were, newest first.
        #expect(ids(TransactionSort(by: .amount, up: true), all) == ["rent2", "rent1", "move", "split", "cafe", "none", "pay"])
        #expect(ids(TransactionSort(by: .amount, up: false), all) == ["pay", "none", "cafe", "split", "move", "rent2", "rent1"])
        // Letter case and accents don't count.
        #expect(ids(TransactionSort(by: .payee, up: true), all) == ["none", "split", "cafe", "rent2", "rent1", "pay", "move"])
        #expect(ids(TransactionSort(by: .payee, up: false), all) == ["move", "pay", "rent2", "rent1", "cafe", "split", "none"])
        // A split by its parts, a transfer as Transfer, none as No category.
        #expect(ids(TransactionSort(by: .category, up: true), all) == ["cafe", "split", "pay", "none", "rent2", "rent1", "move"])
        // A transfer by both its accounts.
        #expect(ids(TransactionSort(by: .account, up: true), all) == ["pay", "rent2", "rent1", "move", "cafe", "none", "split"])
    }

    @Test func aColumnPickedStartsItsOwnWay() {
        // A date newest first, words A to Z, amounts most out first.
        #expect(TransactionSort.newestFirst.picking(.amount) == TransactionSort(by: .amount, up: true))
        #expect(TransactionSort.newestFirst.picking(.payee) == TransactionSort(by: .payee, up: true))
        #expect(TransactionSort(by: .amount, up: false).picking(.date) == .newestFirst)
        // The column already picked stays as it is.
        #expect(TransactionSort(by: .amount, up: false).picking(.amount) == TransactionSort(by: .amount, up: false))
    }

    @Test func theWordsSayWhichWay() {
        #expect(TransactionSort.Column.date.way(up: false) == "Newest First")
        #expect(TransactionSort.Column.amount.way(up: true) == "Most Out First")
        #expect(TransactionSort.Column.category.way(up: false) == "Z to A")
        #expect(TransactionSort.newestFirst.heading == "Latest Transactions")
        #expect(TransactionSort(by: .amount, up: true).heading == "By Amount")
        #expect(TransactionSort(by: .amount, up: true).moreWords(drawn: 200, of: 450) == "200 of 450 shown, most out first")
        #expect(TransactionSort(by: .payee, up: true).moreWords(drawn: 400, of: 450) == "400 of 450 shown, by payee, A to Z")
    }

    @Test func showMoreAddsUpTo200() {
        #expect(TransactionSort.nextPage(drawn: 200, of: 1284) == 200)
        #expect(TransactionSort.nextPage(drawn: 200, of: 250) == 50)
        #expect(TransactionSort.nextPage(drawn: 200, of: 150) == 0)
    }

    @Test func keptOnThisDevice() throws {
        let defaults = try #require(UserDefaults(suiteName: "TransactionSortTests.\(UUID().uuidString)"))
        #expect(TransactionSort.kept(defaults) == .newestFirst)
        TransactionSort(by: .category, up: false).keep(defaults)
        #expect(TransactionSort.kept(defaults) == TransactionSort(by: .category, up: false))
        // Something unreadable: newest first.
        defaults.set(Data("{\"by\":\"colour\",\"up\":true}".utf8), forKey: TransactionSort.key)
        #expect(TransactionSort.kept(defaults) == .newestFirst)
    }

    @Test func aRowsDayHasItsYearWhenNotThisYears() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "UTC"))
        let now = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 21, hour: 12)))
        let today = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 21, hour: 9)))
        let lastYear = try #require(calendar.date(from: DateComponents(year: 2025, month: 11, day: 1, hour: 12)))
        #expect(TransactionSort.dayWords(today, now: now, calendar: calendar) == "Today")
        #expect(TransactionSort.dayWords(lastYear, now: now, calendar: calendar).contains("2025"))
        #expect(TransactionSort.dayWords(nil, now: now, calendar: calendar) == "")
    }
}
