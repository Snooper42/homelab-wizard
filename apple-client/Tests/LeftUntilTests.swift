import Foundation
import Testing
@testable import HomelabClient

/// Finances' first card: what's left until the paycheck after next, after
/// the bills, in words (apple-loop.md item 1: the home led with checking now
/// and checking before the paycheck's bills, what's left below the fold).
@Suite struct LeftUntilTests {
    let us = Locale(identifier: "en_US")

    private func view(_ periods: String, cushion: Double = 500) throws -> FinancesPlanView {
        try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-10-30","checking":"chk","start":{"chk":2512.40},
         "plan":{"people":[{"id":"alex","name":"Alex"}],"accounts":[{"id":"chk","name":"Example Checking","kind":"checking"}],
                 "payments":[],"cushion":\#(cushion)},
         "periods":\#(periods)}
        """#.utf8))
    }

    private let now = #"{"now":true,"start":"2026-10-30","last":"2026-11-05","carried":2512.40,"in":0,"out":2104.49,"saved":0,"left":407.91,"rows":[]}"#
    private let next = #"{"start":"2026-11-06","last":"2026-11-19","pay":{"date":"2026-11-06","people":["alex"],"amount":2150},"carried":407.91,"in":2150,"out":1818.14,"saved":0,"left":739.77,"rows":[]}"#
    private let after = #"{"start":"2026-11-20","last":"2026-12-03","pay":{"date":"2026-11-20","people":["alex"],"amount":2150},"carried":739.77,"in":2150,"out":1819.65,"saved":0,"left":1070.12,"rows":[]}"#

    @Test func whatsLeftIsTheNextPaychecksPeriodAfterItsBills() throws {
        let plan = try view("[\(now),\(next),\(after)]")
        let left = try #require(LeftUntil(plan))
        #expect(left.amount == 739.77)
        #expect(left.title(locale: us) == "Left until Nov 19, after the bills")
        #expect(left.detail(plan, locale: us) == "After Alex's paycheck on Nov 6")
    }

    @Test func underTheCushionBeforeItIsSaidOnTheCard() throws {
        let left = try #require(LeftUntil(view("[\(now),\(next)]")))
        #expect(left.low == LeftUntil.Low(day: LocalDay.parse("2026-11-05"), amount: 407.91))
        #expect(left.warning(cushion: "$500", short: "", locale: us) == "Under your $500 cushion on Thu, Nov 5")
        // No cushion set: nothing to warn of while checking stays above nothing.
        let none = try #require(LeftUntil(view("[\(now),\(next)]", cushion: 0)))
        #expect(none.low == nil && none.warning(cushion: "$0", short: "", locale: us) == nil)
    }

    @Test func shortSaysByHowMuch() throws {
        let short = now.replacingOccurrences(of: "\"left\":407.91", with: "\"left\":-120")
        let left = try #require(LeftUntil(view("[\(short),\(next)]")))
        #expect(left.low?.short == true)
        #expect(left.warning(cushion: "$500", short: "$120", locale: us) == "Short $120 on Thu, Nov 5")
    }

    @Test func noPaycheckAheadIsNowsPeriod() throws {
        let only = try view("[\(now)]")
        let left = try #require(LeftUntil(only))
        #expect(left.amount == 407.91)
        #expect(left.title(locale: us) == "Left until Nov 5, after the bills")
        #expect(left.detail(only, locale: us) == nil)
        let empty = try view("[]")
        #expect(LeftUntil(empty) == nil)
    }

    /// The money widget's words: on
    /// track until the day, or under the cushion or short on a weekday, and
    /// the next bill's day, never an amount. Made-up figures.
    @Test func theMoneyWidgetSaysItInWordsOnly() throws {
        let calendar = Calendar(identifier: .gregorian)
        let today = try #require(LocalDay.parse("2026-10-30"))
        let tomorrow = try #require(LocalDay.parse("2026-10-31"))
        // No cushion to dip under: on track until the paycheck's period ends.
        let fine = MoneyLine.words(LeftUntil(try view("[\(now),\(next)]", cushion: 0)), nextBill: tomorrow, today: today, calendar: calendar, locale: us)
        #expect(fine?.title == "On track until Nov 19" && fine?.warns == false && fine?.next == "Next bill tomorrow")
        // Under the $500 cushion on Thu, Nov 5.
        let low = MoneyLine.words(LeftUntil(try view("[\(now),\(next)]")), nextBill: today, today: today, calendar: calendar, locale: us)
        #expect(low?.title == "Under your cushion Thu" && low?.warns == true && low?.next == "Next bill today")
        // Short: says so, and when.
        let short = now.replacingOccurrences(of: "\"left\":407.91", with: "\"left\":-120")
        let shortLine = MoneyLine.words(LeftUntil(try view("[\(short),\(next)]")), nextBill: LocalDay.parse("2026-11-03"), today: today, calendar: calendar, locale: us)
        #expect(shortLine?.title == "Short on Thu" && shortLine?.next == "Next bill Tue")
        // Far off: the date; none ahead: no line about it; no periods: no words at all.
        let far = MoneyLine.words(LeftUntil(try view("[\(now),\(next)]", cushion: 0)), nextBill: LocalDay.parse("2026-11-20"), today: today, calendar: calendar, locale: us)
        #expect(far?.next == "Next bill Nov 20")
        #expect(MoneyLine.words(LeftUntil(try view("[\(now),\(next)]", cushion: 0)), nextBill: nil, today: today, calendar: calendar, locale: us)?.next == nil)
        #expect(MoneyLine.words(LeftUntil(try view("[]")), nextBill: tomorrow, today: today) == nil)
        // Never a figure in it.
        for line in [fine, low, shortLine, far].compactMap({ $0 }) {
            #expect(!(line.title + (line.next ?? "")).contains("$"))
        }
    }
}
