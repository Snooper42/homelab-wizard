import Foundation
import Testing
@testable import HomelabClient

/// Finances › Calendar, as the computer's (web/src/finances/Calendar.tsx's
/// `daysOf` and its month in all), on a made-up view. The expected days are
/// the computer's own answers for the same view (run through esbuild).
@Suite("Finance calendar")
struct FinanceCalendarTests {
    static let view: JSONValue = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"today":"2026-12-15",
     "plan":{"cushion":500,"rates":{"EUR":1.1},"accounts":[{"id":"chk","name":"Checking","kind":"checking"},{"id":"eu","name":"Euro","kind":"checking","currency":"eur"},{"id":"sav","name":"Savings","kind":"savings"}],
             "people":[{"id":"alex","name":"Alex"},{"id":"sam","name":"Sam"}]},
     "days":[
      {"date":"2026-12-15","balance":2900,"events":[{"people":["alex"],"amount":2400},{"payment":"loan","amount":-300}]},
      {"date":"2026-12-16","balance":2900,"events":[]},
      {"date":"2026-12-17","balance":480,"events":[{"payment":"car","amount":-2420}],"charges":[{"payment":"netflix","amount":-15.49,"card":"visa","due":"2027-01-02"}]},
      {"date":"2026-12-18","balance":3100,"events":[{"people":["alex","sam"],"amount":2620}]}],
     "later":[{"date":"2026-12-25","events":[{"payment":"gifts","amount":-200}]},{"date":"2027-01-05","events":[{"payment":"rent-in","amount":450}],"charges":[]}],
     "holidays":{"2026-12-25":"Christmas Day","2026-11-26":"Thanksgiving"},
     "paydays":[{"date":"2026-12-18","moved":[{"person":"sam","from":"2026-12-19","why":"the weekend"}]},{"date":"2026-12-15"}]}
    """#.utf8))
    static let ledger: JSONValue = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"transactions":[
      {"id":"t1","account":"chk","date":"2026-11-20","amount":-42.1,"payee":"Grocer"},
      {"id":"t2","account":"eu","date":"2026-11-26","amount":-10,"payee":"Cafe"},
      {"id":"t3","account":"chk","date":"2026-11-26","amount":-500,"payee":"Move","to":"sav"},
      {"id":"t4","account":"chk","date":"2026-12-01","amount":2400,"payee":"Paycheck"},
      {"id":"t5","account":"chk","date":"2026-12-15","amount":-8.25,"payee":"Coffee"},
      {"id":"t6","account":"chk","date":"2025-06-01","amount":-1,"payee":"Long ago"}]}
    """#.utf8))

    @Test func theDaysAreTheComputers() throws {
        let cal = FinanceCalendar(view: Self.view, ledger: Self.ledger)
        // A year back from the 1st of today's month (what was recorded), to a year ahead.
        #expect(cal.days.count == 744)
        #expect(cal.first == "2025-12-01" && cal.last == "2027-12-14")
        #expect(cal.from == "2026-12-15" && cal.read == "2026-12-18")

        let longAgo = try #require(cal.days["2025-12-01"])
        #expect(longAgo.past && longAgo.spent.isEmpty && longAgo.net == 0)
        let thanksgiving = try #require(cal.days["2026-11-26"])
        // The euro café in dollars (−10 × 1.1); the move to savings neither in nor out.
        #expect(thanksgiving.past && thanksgiving.holiday == "Thanksgiving")
        #expect(thanksgiving.spent.map(\.id) == ["t2", "t3"])
        #expect(abs(thanksgiving.net - -11) < 0.001)
        #expect(cal.days["2026-12-01"]?.net == 2400)
        #expect(cal.days["2026-12-14"]?.past == true)

        let today = try #require(cal.days["2026-12-15"])
        #expect(!today.past && !today.later && today.balance == 2900 && today.events.count == 2)
        #expect(today.spent.map(\.id) == ["t5"] && today.net == -8.25)
        let low = try #require(cal.days["2026-12-17"])
        #expect(low.low && low.balance == 480 && low.events.count == 1 && low.charges.count == 1)
        #expect(low.charges.first?.card == "visa" && low.charges.first?.due == "2027-01-02")
        let moved = try #require(cal.days["2026-12-18"])
        #expect(!moved.low && moved.moved.count == 1 && moved.moved.first?.from == "2026-12-19" && moved.spent.isEmpty)

        let planned = try #require(cal.days["2026-12-19"])
        #expect(planned.later && planned.events.isEmpty)
        let christmas = try #require(cal.days["2026-12-25"])
        #expect(christmas.later && christmas.holiday == "Christmas Day" && christmas.events.first?.amount == -200)
        #expect(cal.days["2027-01-05"]?.events.first?.amount == 450)
        #expect(cal.days["2027-12-14"]?.later == true)
    }

    @Test func theMonthInAll() {
        let cal = FinanceCalendar(view: Self.view, ledger: Self.ledger)
        let december = cal.summary(of: "2026-12")
        // Paychecks: Alex's and the one for both, who in order.
        #expect(december.paychecks == 2 && december.paid == 5020 && december.who == ["Alex", "Sam"])
        #expect(december.bills == 3 && december.billed == -2920)
        #expect(december.charges == 1 && abs(december.charged - 15.49) < 0.001)
        #expect(december.comesIn == 0)
        // The lowest day read, from today on.
        #expect(december.lowest?.date == "2026-12-17")
        // Recorded so far: the paycheck on the 1st, today's coffee.
        #expect(december.recordedIn == 1 && december.recordedOut == 1 && december.recorded == 2391.75)
        #expect(cal.lowDays(in: "2026-12") == 1)

        let january = cal.summary(of: "2027-01")
        #expect(january.comesIn == 1 && january.came == 450 && january.lowest == nil && january.recordedIn + january.recordedOut == 0)
        let november = cal.summary(of: "2026-11")
        // The move to savings isn't counted: neither in nor out.
        #expect(november.recordedOut == 2 && abs(november.recorded - -53.1) < 0.001)
    }

    @Test func weeksStartOnSundayOrMondayForUKHolidays() {
        let cal = FinanceCalendar(view: Self.view, ledger: Self.ledger)
        // December 2026 starts on a Tuesday.
        let weeks = cal.weeks(of: "2026-12")
        #expect(weeks.count == 5 && weeks[0].prefix(3) == [nil, nil, "2026-12-01"])
        #expect(weeks.allSatisfy { $0.count == 7 } && weeks.last?.compactMap { $0 }.last == "2026-12-31")
        #expect(FinanceCalendar.weekdayLetters(mondayFirst: false).first == "Sun")

        var uk = Self.view
        if case .object(var v) = uk, case .object(var plan)? = v["plan"] {
            plan["holidays"] = .string("uk"); v["plan"] = .object(plan); uk = .object(v)
        }
        let ukCal = FinanceCalendar(view: uk, ledger: Self.ledger)
        #expect(ukCal.mondayFirst && ukCal.weeks(of: "2026-12")[0].prefix(2) == [nil, "2026-12-01"])
        #expect(FinanceCalendar.weekdayLetters(mondayFirst: true).first == "Mon")
    }

    @Test func monthsTurnWithinTheDaysItHas() {
        let cal = FinanceCalendar(view: Self.view, ledger: Self.ledger)
        #expect(FinanceCalendar.month(of: "2026-12-15") == "2026-12")
        #expect(FinanceCalendar.addMonths("2026-12", 1) == "2027-01")
        #expect(FinanceCalendar.addMonths("2026-01", -1) == "2025-12")
        #expect(cal.canTurn(from: "2025-12", by: -1) == false && cal.canTurn(from: "2027-12", by: 1) == false)
        #expect(cal.canTurn(from: "2026-12", by: 1) && cal.canTurn(from: "2026-12", by: -1))
        // Today opens it, or the first day read when today has none.
        #expect(cal.opening == "2026-12-15")
    }

    /// Today and the days before it add a transaction, as the computer's day card; later days a payment.
    @Test func aDayAddsWhatTheComputersDoes() {
        #expect(FinanceCalendar.adding(on: "2025-12-01", today: "2026-12-15") == .transaction)
        #expect(FinanceCalendar.adding(on: "2026-12-14", today: "2026-12-15") == .transaction)
        #expect(FinanceCalendar.adding(on: "2026-12-15", today: "2026-12-15") == .transaction)
        #expect(FinanceCalendar.adding(on: "2026-12-16", today: "2026-12-15") == .payment)
        #expect(FinanceCalendar.adding(on: "2027-01-05", today: "2026-12-15") == .payment)
    }

    @Test func nothingYet() {
        let empty = FinanceCalendar(view: .object(["today": .string("2026-12-15"), "plan": .object([:])]), ledger: nil)
        #expect(empty.days.isEmpty && empty.opening == "2026-12-15")
    }
}
