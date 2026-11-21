import Foundation
import Testing
@testable import HomelabClient

// Edit a Payment on the phone (the owner's yes, Nov 21, on the canvas's
// *Idea: Bills*): all of it, as the computer's form changes one; what the
// sheet doesn't show kept as it was; Delete; home or away.
@Suite("Editing a whole payment")
struct EditPaymentTests {
    private let plan = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"r5",
     "people":[{"id":"alex","name":"Alex"}],
     "accounts":[{"id":"chk","name":"Checking","kind":"checking"},
                 {"id":"sav","name":"Savings","kind":"savings"},
                 {"id":"visa","name":"Rewards Card","kind":"card"},
                 {"id":"ira","name":"Roth IRA","kind":"retirement"}],
     "payments":[
       {"id":"power","name":"City Power","kind":"utilities","amount":95,"estimate":true,"institution":"citypower","schedule":{"every":"month","start":"2026-01-08"}},
       {"id":"roth","name":"Roth IRA","kind":"savings","amount":250,"to":"ira","schedule":{"every":"month","start":"2026-01-16"}},
       {"id":"room","name":"Room","kind":"other","amount":450,"payer":"Jordan","schedule":{"every":"month","start":"2026-01-15"}},
       {"id":"visapay","name":"Rewards Card","kind":"cards","amount":0,"card":"visa","schedule":{"every":"month","start":"2026-01-21"}}]}
    """#.utf8))

    private func payment(_ edited: JSONValue?, _ id: String) -> JSONValue? {
        guard case .array(let list)? = edited?["payments"] else { return nil }
        return list.first { $0["id"] == .string(id) }
    }

    @Test func changesAllOfItAndKeepsTheRest() throws {
        var p = NewPayment(name: " Bright Electric ", amount: 110.004, every: "twice a month", start: "2026-12-01", kind: "utilities")
        p.day2 = 15
        p.until = "2027-06-30"
        p.from = "visa"
        p.estimate = false
        let edited = try #require(FinancePlanEdit.updatingPayment(id: "power", with: p, in: plan))
        let power = try #require(payment(edited, "power"))
        #expect(power["name"] == .string("Bright Electric"))
        #expect(power["amount"] == .number(110))
        #expect(power["schedule"] == .object(["every": .string("twice a month"), "start": .string("2026-12-01"), "day2": .number(15), "until": .string("2027-06-30")]))
        #expect(power["from"] == .string("visa"))
        #expect(power["estimate"] == nil)
        // What the sheet doesn't show stays: its id and its logo.
        #expect(power["id"] == .string("power") && power["institution"] == .string("citypower"))
        #expect(edited["rev"] == .string("r5"))
    }

    @Test func keepsWhereItGoesAndWhoSendsIt() throws {
        // A transfer into the Roth keeps where it goes.
        let roth = try #require(payment(FinancePlanEdit.updatingPayment(
            id: "roth", with: NewPayment(name: "Roth IRA", amount: 300, every: "month", start: "2026-01-16", kind: "savings"), in: plan), "roth"))
        #expect(roth["to"] == .string("ira") && roth["amount"] == .number(300) && roth["from"] == nil)
        // Money from someone keeps who sends it, and comes out of none of the household's accounts.
        var p = NewPayment(name: "Room", amount: 475, every: "month", start: "2026-01-15", kind: "other")
        p.from = "sav"
        let room = try #require(payment(FinancePlanEdit.updatingPayment(id: "room", with: p, in: plan), "room"))
        #expect(room["payer"] == .string("Jordan") && room["from"] == nil && room["amount"] == .number(475))
        // A card's payoff keeps its card, and may cost nothing else.
        let card = try #require(payment(FinancePlanEdit.updatingPayment(
            id: "visapay", with: NewPayment(name: "Rewards Card", amount: 0, every: "month", start: "2026-01-21", kind: "cards"), in: plan), "visapay"))
        #expect(card["card"] == .string("visa"))
    }

    @Test func refusesWhatTheComputerWould() {
        let ok = NewPayment(name: "City Power", amount: 95, every: "month", start: "2026-01-08", kind: "utilities")
        #expect(FinancePlanEdit.updatingPayment(id: "gone", with: ok, in: plan) == nil)
        var noName = ok; noName.name = "  "
        #expect(FinancePlanEdit.updatingPayment(id: "power", with: noName, in: plan) == nil)
        var nothing = ok; nothing.amount = 0
        #expect(FinancePlanEdit.updatingPayment(id: "power", with: nothing, in: plan) == nil)
        var endsFirst = ok; endsFirst.until = "2025-12-31"
        #expect(FinancePlanEdit.updatingPayment(id: "power", with: endsFirst, in: plan) == nil)
        var sameDay = ok; sameDay.every = "twice a month"; sameDay.day2 = 8
        #expect(FinancePlanEdit.updatingPayment(id: "power", with: sameDay, in: plan) == nil)
        // A card can't pay itself off, nor come out of an account it can't (retirement).
        var itself = NewPayment(name: "Rewards Card", amount: 0, every: "month", start: "2026-01-21", kind: "cards"); itself.from = "visa"
        #expect(FinancePlanEdit.updatingPayment(id: "visapay", with: itself, in: plan) == nil)
        var fromRoth = ok; fromRoth.from = "ira"
        #expect(FinancePlanEdit.updatingPayment(id: "power", with: fromRoth, in: plan) == nil)
    }

    @Test func deletesIt() throws {
        let edited = try #require(FinancePlanEdit.removingPayment(id: "power", in: plan))
        #expect(payment(edited, "power") == nil && payment(edited, "roth") != nil)
        #expect(FinancePlanEdit.removingPayment(id: "gone", in: plan) == nil)
    }

    @Test func awayItWaitsAsOneChange() throws {
        let p = NewPayment(name: "City Power", amount: 120, every: "month", start: "2026-01-08", kind: "utilities")
        // A change to its amount, then an edit of all of it: one change, the edit.
        let changes = FinanceChange.adding(.editPayment(id: "power", p), to: [.paymentAmount(id: "power", to: 100, was: 95)])
        #expect(changes == [.editPayment(id: "power", p)])
        // Then deleted: one change, the delete.
        #expect(FinanceChange.adding(.removePayment(id: "power"), to: changes) == [.removePayment(id: "power")])
        // Deleted on another device meanwhile: the edit can't be made, and is left out.
        let gone = try #require(FinancePlanEdit.removingPayment(id: "power", in: plan))
        #expect(FinanceReplay.replay(changes, on: gone).dropped == [0])
        // Kept as written.
        #expect(try JSONDecoder().decode([FinanceChange].self, from: JSONEncoder().encode(changes)) == changes)
    }

    @Test func itsScheduleReadsBackForTheSheet() throws {
        let s = try JSONDecoder().decode(FinanceSchedule.self, from: Data(#"{"every":"twice a month","start":"2026-01-01","day2":15}"#.utf8))
        #expect(s.day2 == 15 && s.person == nil)
        let paid = try JSONDecoder().decode(FinanceSchedule.self, from: Data(#"{"every":"paycheck","person":"alex"}"#.utf8))
        #expect(paid.person == "alex" && paid.start == nil)
    }
}
