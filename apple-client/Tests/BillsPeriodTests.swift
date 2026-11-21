import Foundation
import Testing
@testable import HomelabClient

// A pay period on Bills as the computer's (Paycheck.tsx; the owner's yes,
// Nov 21, on the canvas's *Idea: Bills*): its paycheck, checking on payday,
// how each bill is paid, and the accounts after it.
@Suite("Bills, a pay period as the computer's")
struct BillsPeriodTests {
    private func view() throws -> FinancesPlanView {
        try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-11-21","checking":"chk",
         "start":{"chk":442,"sav":6500,"visa":120,"ira":24215},
         "plan":{"people":[{"id":"alex","name":"Alex"},{"id":"sam","name":"Sam"}],"cushion":0,
           "accounts":[{"id":"chk","name":"Everyday Checking","kind":"checking","balance":442},
                       {"id":"sav","name":"Savings","kind":"savings","balance":6500},
                       {"id":"visa","name":"Rewards Card","kind":"card","balance":120},
                       {"id":"ira","name":"Roth IRA","kind":"retirement","balance":24215},
                       {"id":"house","name":"Home","kind":"home","balance":300000}],
           "payments":[{"id":"power","name":"City Power","kind":"utilities","amount":95},
                       {"id":"tv","name":"Streamly","kind":"subscriptions","amount":15.99,"from":"visa"},
                       {"id":"move","name":"From savings","kind":"savings","amount":100,"from":"sav"},
                       {"id":"room","name":"Room","kind":"other","amount":450,"payer":"Jordan"}]},
         "periods":[
           {"now":true,"start":"2026-11-21","last":"2026-12-03","in":0,"out":0,"left":442,
            "accounts":{"chk":442,"sav":6500,"visa":168,"ira":24215},"rows":[]},
           {"now":false,"start":"2026-12-04","last":"2026-12-17","pay":{"date":"2026-12-04","people":["alex","sam"],"amount":2150},
            "in":2600,"out":915,"left":2127,
            "accounts":{"chk":2127,"sav":6900,"visa":96,"ira":24310},
            "rows":[{"date":"2026-12-08","payment":"power","amount":95,"estimate":true},
                    {"date":"2026-12-12","payment":"tv","amount":15.99,"outside":true},
                    {"date":"2026-12-13","payment":"move","amount":100,"into":true},
                    {"date":"2026-12-15","payment":"room","amount":450,"into":true}]}],
         "days":[{"date":"2026-12-03","balance":442},{"date":"2026-12-04","balance":1772}]}
        """#.utf8))
    }

    @Test func itsPaycheckAndPayday() throws {
        let v = try view()
        let pay = try #require(v.periods[1].pay)
        #expect(BillsPeriod.payWords(pay, people: v.plan.people) == "Alex and Sam's paycheck")
        // Checking at the end of payday, once its own payments are out.
        #expect(BillsPeriod.onPayday(v.periods[1], in: v) == Double(1772))
        // Now has no payday of its own.
        #expect(BillsPeriod.onPayday(v.periods[0], in: v) == nil)
    }

    @Test func howEachBillIsPaid() throws {
        let v = try view()
        let rows = v.periods[1].rows
        #expect(BillsPeriod.via(rows[0], in: v) == "Utilities")
        #expect(BillsPeriod.via(rows[1], in: v) == "on Rewards Card")
        #expect(BillsPeriod.via(rows[2], in: v) == "from Savings")
        #expect(BillsPeriod.via(rows[3], in: v) == "from Jordan")
    }

    @Test func theAccountsAfterIt() throws {
        let v = try view()
        let tiles = BillsPeriod.tiles(1, in: v)
        // Checking, savings and retirement on their own, the card as itself (one card); not the home.
        #expect(tiles.map(\.id) == ["chk", "sav", "ira", "cards"])
        #expect(tiles.map(\.after) == [2127, 6900, 24310, 96])
        // Against the period before it.
        #expect(tiles.map(\.change) == [1685, 400, 95, -72])
        #expect(tiles[3].owes && tiles[3].name == "Rewards Card")
        // The first period's is against today.
        #expect(BillsPeriod.tiles(0, in: v).first { $0.id == "cards" }?.change == Double(48))
        #expect(BillsPeriod.tiles(5, in: v).isEmpty)
    }
}
