import Foundation
import Testing
@testable import HomelabClient

// The rest of the computer's Transactions on the phone: the Month and Tag
// filters, a filtered list's Together, and the This month card.
@Suite("Transactions, filtered as the computer's")
struct TransactionFilterTests {
    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = .current
        return c
    }

    private func day(_ y: Int, _ m: Int, _ d: Int) throws -> Date {
        try #require(calendar.date(from: DateComponents(year: y, month: m, day: d, hour: 12)))
    }

    private func ledger() throws -> [FinanceTransaction] {
        try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"""
        {"transactions":[
          {"id":"pay","date":"2026-11-14","account":"chk","amount":2400,"payee":"Paycheck","category":"Income"},
          {"id":"food","date":"2026-11-05","account":"card","amount":-100,"payee":"Green Grocer","category":"Groceries","tags":["home"]},
          {"id":"cafe","date":"2026-11-20","account":"card","amount":-15,"payee":"Corner Café","category":"Eating out","tags":["work"]},
          {"id":"save","date":"2026-11-03","account":"chk","amount":-500,"payee":"","to":"sav"},
          {"id":"payoff","date":"2026-11-10","account":"chk","amount":-300,"payee":"","to":"card"},
          {"id":"refund","date":"2026-11-12","account":"card","amount":20,"payee":"Green Grocer","category":"Groceries"},
          {"id":"oct1","date":"2026-10-04","account":"card","amount":-90,"payee":"Green Grocer","category":"Groceries","tags":["home"]},
          {"id":"oct2","date":"2026-10-25","account":"card","amount":-400,"payee":"Atlas Auto","category":"Car"},
          {"id":"octmove","date":"2026-10-08","account":"chk","amount":-50,"payee":"","to":"sav"}
        ]}
        """#.utf8)).transactions
    }

    @Test func aMonthAndATag() throws {
        let all = try ledger()
        func ids(_ f: TransactionFilter) -> [String] { all.filter { f.keeps($0, categories: [], calendar: calendar) }.map(\.id) }
        let october = try day(2026, 10, 1)
        #expect(ids(TransactionFilter(month: october)) == ["oct1", "oct2", "octmove"])
        #expect(ids(TransactionFilter(tag: "home")) == ["food", "oct1"])
        #expect(ids(TransactionFilter(month: october, tag: "home")) == ["oct1"])
        #expect(TransactionFilter(month: october).isOn && TransactionFilter(tag: "x").isOn)
        // The choices: the months newest first, the tags A to Z.
        let nov = try #require(calendar.dateInterval(of: .month, for: try day(2026, 11, 1))).start
        let oct = try #require(calendar.dateInterval(of: .month, for: october)).start
        #expect(TransactionFilter.months(in: all, calendar: calendar) == [nov, oct])
        #expect(TransactionFilter.tags(in: all) == ["home", "work"])
    }

    @Test func togetherAsTheComputersSays() throws {
        let all = try ledger()
        let november = all.filter { $0.id != "oct1" && $0.id != "oct2" && $0.id != "octmove" }
        // Every account: moves between them left out.
        #expect(TransactionFilter.together(november, account: nil) == 2400 - 100 - 15 + 20)
        // One account picked: a move out of it counts out, one into it counts in.
        let card = november.filter { $0.account == "card" || $0.to == "card" }
        #expect(TransactionFilter.together(card, account: "card") == -100 - 15 + 300 + 20)
        let checking = november.filter { $0.account == "chk" || $0.to == "chk" }
        #expect(TransactionFilter.together(checking, account: "chk") == 2400 - 500 - 300)
        #expect(TransactionFilter.count(1) == "1 transaction")
        #expect(TransactionFilter.count(6) == "6 transactions")
    }

    @Test func thisMonthAgainstLastMonthBySameDay() throws {
        let month = ThisMonth.make(try ledger(), today: try day(2026, 11, 21), calendar: calendar)
        // Moves between the household's accounts left out; a refund is money in.
        #expect(month.moneyIn == 2420)
        #expect(month.moneyOut == 115)
        #expect(month.kept == 2305)
        #expect(month.count == 4)
        // Last month by Oct 21: only the first Green Grocer (the car came on the 25th).
        #expect(month.outBefore == Double(90))
        #expect(month.outChange == Double(25))
        let lastDay = try #require(month.lastMonthDay)
        #expect(calendar.component(.day, from: lastDay) == 21 && calendar.component(.month, from: lastDay) == 10)
    }

    @Test func aShorterMonthEndsOnItsLastDay() throws {
        let month = ThisMonth.make([], today: try day(2026, 3, 31), calendar: calendar)
        let lastDay = try #require(month.lastMonthDay)
        #expect(calendar.component(.day, from: lastDay) == 28 && calendar.component(.month, from: lastDay) == 2)
        // Nothing last month: nothing to compare with.
        #expect(month.outBefore == nil && month.outChange == nil)
        #expect(month.count == 0 && month.kept == 0)
        // Nothing out is 0, never -0 (which reads "-$0").
        #expect(month.moneyOut.sign == .plus && month.kept.sign == .plus)
    }
}
