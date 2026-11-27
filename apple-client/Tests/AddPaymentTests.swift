import Foundation
import Testing
@testable import HomelabClient

/// Add a Payment on the phone: a new
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
        #expect(add(every: "twice a month") == nil)   // needs its second day
        #expect(add(start: "2026-13-01") == nil)
        #expect(add(kind: "groceries") == nil)
        #expect(add(from: "nope") == nil)
        #expect(add(from: "car") == nil)              // a payment doesn't come out of a car
    }

    @Test func everyChoiceIsOneTheComputerKnows() {
        // internal/finance/schedule.go's everies; paycheck is offered by person.
        #expect(Set(FinancePlanEdit.paymentEveries.map(\.id)) == ["month", "2 weeks", "week", "twice a month", "3 months", "year", "once"])
        #expect(FinancePlanEdit.paymentKinds.map(\.id) == ["home", "utilities", "car", "subscriptions", "loans", "cards", "spending", "savings", "other"])
    }

    private let household = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"accounts":[
      {"id":"chk","name":"Example Checking","kind":"checking","balance":1200},
      {"id":"sav","name":"Example Savings","kind":"savings","balance":5000},
      {"id":"visa","name":"Example Visa","kind":"card","balance":300}
    ],"people":[{"id":"alex","name":"Alex"}],"payments":[]}
    """#.utf8))

    private func added(_ p: NewPayment) -> JSONValue? {
        guard let edited = FinancePlanEdit.addingPayment(p, in: household), case .array(let all)? = edited["payments"] else { return nil }
        return all.last
    }

    @Test func moneyInFromSomeoneOutsideTheHousehold() throws {
        let p = NewPayment(name: "Rent from the lodger", amount: 450, every: "month", start: "2026-12-01", payer: " Example Lodger ", to: "sav")
        let x = try #require(added(p))
        #expect(x["payer"] == .string("Example Lodger"))
        #expect(x["to"] == .string("sav"))
        #expect(x["from"] == nil && x["estimate"] == nil)
        // Into checking: no `to`, as the computer reads none.
        let toChecking = try #require(added(NewPayment(name: "Share of the mortgage", amount: 600, every: "month", start: "2026-12-01", payer: "Jamie")))
        #expect(toChecking["to"] == nil)
        // From someone, so out of none of the household's accounts; into a card, never.
        #expect(added(NewPayment(name: "X", amount: 1, every: "month", start: "2026-12-01", from: "chk", payer: "Jamie")) == nil)
        #expect(added(NewPayment(name: "X", amount: 1, every: "month", start: "2026-12-01", payer: "Jamie", to: "visa")) == nil)
    }

    @Test func twiceAMonthOnTwoDays() throws {
        let x = try #require(added(NewPayment(name: "Example Daycare", amount: 300, every: "twice a month", start: "2026-12-01", day2: 15)))
        #expect(x["schedule"] == .object(["every": .string("twice a month"), "start": .string("2026-12-01"), "day2": .number(15)]))
        // The second day is a day of the month, and not the first one.
        #expect(added(NewPayment(name: "X", amount: 1, every: "twice a month", start: "2026-12-01", day2: 1)) == nil)
        #expect(added(NewPayment(name: "X", amount: 1, every: "twice a month", start: "2026-12-01", day2: 32)) == nil)
    }

    /// One that ends (a lease to Jan 2027), as the computer's Schedule.Until:
    /// a day, not before it starts; once has none.
    @Test func aPaymentThatEnds() throws {
        let lease = try #require(added(NewPayment(name: "Example Car Lease", amount: 389, every: "month", start: "2024-01-15", until: "2027-01-15")))
        #expect(lease["schedule"]?["until"] == .string("2027-01-15"))
        #expect(added(NewPayment(name: "X", amount: 1, every: "month", start: "2026-12-01", until: "2026-11-01")) == nil)
        #expect(added(NewPayment(name: "X", amount: 1, every: "month", start: "2026-12-01", until: "soon")) == nil)
        let once = try #require(added(NewPayment(name: "X", amount: 1, every: "once", start: "2026-12-01", until: "2027-01-01")))
        #expect(once["schedule"]?["until"] == nil)
    }

    @Test func withEachPaycheck() throws {
        let anyone = try #require(added(NewPayment(name: "To savings", amount: 100, every: "paycheck", start: "2026-11-15", person: "", from: "chk")))
        #expect(anyone["schedule"] == .object(["every": .string("paycheck"), "start": .string("2026-11-15")]))
        let alex = try #require(added(NewPayment(name: "Alex's allowance", amount: 50, every: "paycheck", start: "2026-11-15", person: "alex")))
        #expect(alex["schedule"]?["person"] == .string("alex"))
        // Someone the plan doesn't have.
        #expect(added(NewPayment(name: "X", amount: 1, every: "paycheck", start: "2026-11-15", person: "sam")) == nil)
    }

    @Test func keptAwayAndReplayed() throws {
        // Made away from home, it waits as one change and is made the same way once home.
        let p = NewPayment(name: "Rent from the lodger", amount: 450, every: "month", start: "2026-12-01", payer: "Example Lodger")
        let change = FinanceChange.addNewPayment(p)
        let data = try JSONEncoder().encode([change])
        #expect(try JSONDecoder().decode([FinanceChange].self, from: data) == [change])
        let made = try #require(change.apply(to: household))
        #expect(made == FinancePlanEdit.addingPayment(p, in: household))
    }
}
