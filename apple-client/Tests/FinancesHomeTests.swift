import Foundation
import Testing
@testable import HomelabClient

// Finances' home: net worth's line and this month's change from the
// accounts' kept balances, and the next bill in words.
@Suite("Finances home")
struct FinancesHomeTests {
    private let json = #"""
    {"today":"2026-11-20","checking":"chk","start":{"chk":2400,"sav":10000},
     "plan":{"people":[],
             "accounts":[{"id":"chk","name":"Everyday","kind":"checking","balance":2400,
                          "history":[{"date":"2026-08-01","amount":1000},{"date":"2026-10-01","amount":2000},{"date":"2026-11-01","amount":2200}]},
                         {"id":"sav","name":"Rainy day","kind":"savings","balance":10000,"history":[{"date":"2026-11-01","amount":9000}]}],
             "payments":[{"id":"rent","name":"Rent","amount":1200,"schedule":{}},{"id":"move","name":"To savings","amount":100,"schedule":{}},
                         {"id":"gift","name":"Gift","amount":50,"schedule":{},"payer":"Grandma"}],
             "cushion":0},
     "periods":[{"now":true,"start":"2026-11-20","last":"2026-11-30","carried":2400,"in":0,"out":1200,"saved":0,"left":1200,
                 "rows":[{"date":"2026-11-21","payment":"move","amount":100,"outside":true},
                         {"date":"2026-11-22","payment":"gift","amount":50,"into":true},
                         {"date":"2026-11-24","payment":"rent","amount":1200}]}]}
    """#

    @Test func netWorthsLine() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(json.utf8))
        let series = view.netWorthSeries(days: 92)
        // Aug 1 is more than 92 days back; Oct 1 and Nov 1 from the kept balances
        // (savings had none on Oct 1, so its first), then today from the start of today.
        #expect(series.map(\.value) == [11000, 11200, 12400])
        #expect(series.last?.date == view.today)
        #expect(view.netWorthThisMonth == 1200)
    }

    @Test func noKeptBalancesNoChange() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-11-20","start":{"a":5},"plan":{"people":[],"accounts":[{"id":"a","name":"A","kind":"checking","balance":5}],"payments":[],"cushion":0},"periods":[]}
        """#.utf8))
        #expect(view.netWorthThisMonth == nil)
        #expect(view.netWorthSeries(days: 92).count == 1)
    }

    @Test func theNextBill() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(json.utf8))
        // Not money between the household's own accounts, nor money coming in.
        let words = try #require(FinancesView.nextBill(view))
        #expect(words.hasPrefix("Rent on "))
        let none = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-11-20","plan":{"people":[],"accounts":[],"payments":[],"cushion":0},"periods":[]}
        """#.utf8))
        #expect(FinancesView.nextBill(none) == nil)
    }
}
