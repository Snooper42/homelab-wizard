import Foundation
import Testing
@testable import HomelabClient

/// Add a Payment on the phone (Parity gap 5, apple-loop.md item 2): a new
/// payment made as the computer's own form makes one, everything else in the
/// plan kept as it came.
@Suite("Adding a payment")
struct AddPaymentTests {
    private let plan = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"r4","accounts":[
      {"id":"chk","name":"Example Checking","kind":"checking","balance":1200},
      {"id":"visa","name":"Example Visa","kind":"card","balance":300},
      {"id":"car","name":"Example Car","kind":"car","balance":9000}
    ],"payments":[
      {"id":"rent","name":"Rent","amount":1500,"kind":"home","schedule":{"every":"month","start":"2026-11-01"}}
    ],"cushion":250}
    """#.utf8))

    @Test func addsItAsTheComputersFormDoes() throws {
        let edited = try #require(FinancePlanEdit.addingPayment(
            name: "  Example Streaming ", amount: 15.494, every: "month", start: "2026-11-20",
            kind: "subscriptions", from: "visa", estimate: false, in: plan))
        guard case .array(let payments)? = edited["payments"] else { Issue.record("no payments"); return }
        #expect(payments.count == 2)
        #expect(payments[0]["id"] == .string("rent"))
        let added = payments[1]
        #expect(added["id"] == nil)   // the computer gives it its id
        #expect(added["name"] == .string("Example Streaming"))
        #expect(added["amount"] == .number(15.49))
        #expect(added["schedule"] == .object(["every": .string("month"), "start": .string("2026-11-20")]))
        #expect(added["kind"] == .string("subscriptions"))
        #expect(added["from"] == .string("visa"))
        #expect(added["estimate"] == nil)
        // The rest of the plan as it came, its rev included.
        #expect(edited["rev"] == .string("r4"))
        #expect(edited["cushion"] == .number(250))
    }

    @Test func aboutThisMuchAndTheFirstCheckingByDefault() throws {
        let edited = try #require(FinancePlanEdit.addingPayment(
            name: "Electric", amount: 90, every: "month", start: "2026-11-25",
            kind: "utilities", from: "", estimate: true, in: plan))
        guard case .array(let payments)? = edited["payments"] else { Issue.record("no payments"); return }
        #expect(payments[1]["estimate"] == .bool(true))
        #expect(payments[1]["from"] == nil)
    }

    @Test func refusesWhatTheComputerWouldNot() {
        func add(name: String = "Gym", amount: Double = 30, every: String = "month", start: String = "2026-11-20",
                 kind: String = "other", from: String = "") -> JSONValue? {
            FinancePlanEdit.addingPayment(name: name, amount: amount, every: every, start: start,
                                          kind: kind, from: from, estimate: false, in: plan)
        }
        #expect(add() != nil)
        #expect(add(name: "   ") == nil)
        #expect(add(name: String(repeating: "x", count: 81)) == nil)
        #expect(add(amount: 0) == nil)
        #expect(add(amount: 0.004) == nil)
        #expect(add(amount: -10) == nil)
        #expect(add(amount: .infinity) == nil)
        #expect(add(every: "fortnightly") == nil)
        #expect(add(every: "twice a month") == nil)   // needs a second day: the computer's for now
        #expect(add(start: "2026-13-01") == nil)
        #expect(add(kind: "groceries") == nil)
        #expect(add(from: "nope") == nil)
        #expect(add(from: "car") == nil)              // a payment doesn't come out of a car
    }

    @Test func everyChoiceIsOneTheComputerKnows() {
        // internal/finance/schedule.go's everies, less twice a month and paycheck.
        #expect(Set(FinancePlanEdit.paymentEveries.map(\.id)) == ["month", "2 weeks", "week", "3 months", "year", "once"])
        #expect(FinancePlanEdit.paymentKinds.map(\.id) == ["home", "utilities", "car", "subscriptions", "loans", "cards", "spending", "savings", "other"])
    }
}
