import Foundation
import Testing
@testable import HomelabClient

/// A loan read from its papers, as the computer's Loans (web/src/finances/
/// widgets/Loans.tsx's Papers) works it out, on a made-up loan.
@Suite("Loan papers")
struct LoanPapersTests {
    static let view: JSONValue = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"today":"2026-12-15","checking":"chk",
     "plan":{"accounts":[{"id":"chk","name":"Checking","kind":"checking"},{"id":"car","name":"Example Car Loan","kind":"loan"}],
             "people":[{"id":"alex","name":"Alex","schedule":{"every":"2 weeks"}}],
             "payments":[{"id":"p1","name":"Car share","amount":55,"to":"car","schedule":{"every":"month"}},
                         {"id":"p2","name":"Car extra","amount":10,"to":"car","schedule":{"every":"paycheck","person":"alex"}},
                         {"id":"p3","name":"Rent","amount":900,"schedule":{"every":"month"}}]},
     "loans":[{"account":"car","balance":198,"rate":6,"monthly":110,"months":2,"date":"2027-01","interest":8,
               "made":2,"rows":[
                 {"date":"2026-10-01","payment":110,"principal":100,"interest":10,"after":300},
                 {"date":"2026-11-01","payment":110,"principal":102,"interest":8,"after":198},
                 {"date":"2026-12-01","payment":110,"principal":104,"interest":6,"after":94},
                 {"date":"2027-01-01","payment":96,"principal":94,"interest":2,"after":0}]},
              {"account":"none","balance":50,"monthly":10,"months":5}]}
    """#.utf8))

    @Test func whatThePapersSay() throws {
        let p = try #require(LoanPapers(view: Self.view, account: "car"))
        #expect(p.made == 2 && p.rows.count == 4)
        #expect(p.original == 400 && p.down == 202)
        #expect(abs(p.share - 0.505) < 0.0001)
        #expect(p.next?.date == "2026-12-01" && p.next?.principal == 104 && p.next?.interest == 6)
        // Half paid off by the second payment, already made.
        #expect(p.half?.date == "2026-11-01" && p.halfMade)
        #expect(p.last?.date == "2027-01-01" && p.left == 2)
        #expect(p.paidIn == 18 && p.interest == 8)
        // Who pays it each month: the share, the extra each of Alex's paychecks (26 a year), and the rest another way.
        #expect(p.into.map(\.name) == ["Car share", "Car extra"])
        #expect(abs(p.into[1].amount - 10 * 26 / 12) < 0.0001)
        #expect(abs(p.rest - (110 - 55 - 10 * 26 / 12)) < 0.0001)
    }

    @Test func noPapersNoPage() {
        // A loan with no rows typed in, or no loan at all.
        #expect(LoanPapers(view: Self.view, account: "none") == nil)
        #expect(LoanPapers(view: Self.view, account: "chk") == nil)
    }

    @Test func eachMonthAsTheComputerCountsIt() {
        let people: [JSONValue] = [
            .object(["id": .string("a"), "schedule": .object(["every": .string("week")])]),
            .object(["id": .string("b"), "account": .string("other"), "schedule": .object(["every": .string("month")])]),
        ]
        func every(_ s: String, person: String? = nil) -> JSONValue {
            var o: [String: JSONValue] = ["every": .string(s)]
            if let person { o["person"] = .string(person) }
            return .object(o)
        }
        #expect(LoanPapers.perMonth(every("year"), people: [], checking: "") == 1.0 / 12)
        #expect(LoanPapers.perMonth(every("twice a month"), people: [], checking: "") == 2)
        #expect(LoanPapers.perMonth(every("once"), people: [], checking: "") == 0)
        // With each paycheck, whoever is paid into checking: only a's.
        #expect(LoanPapers.perMonth(every("paycheck"), people: people, checking: "chk") == 52.0 / 12)
        #expect(LoanPapers.perMonth(every("paycheck", person: "b"), people: people, checking: "chk") == 1)
    }

    /// Read as they're typed in, the computer's account form's reading (payoffPlan.ts's `papers`):
    /// the expected rows are the computer's own for the same papers (run through esbuild).
    @Test func readFromItsPapersAsTyped() throws {
        typealias R = LoanPapers.Row
        // A car loan with its finance charge: the first payment carries the days before it (7.94).
        #expect(LoanPapers.oddDays(first: "2025-02-15", original: 12000, rate: 6.5, monthly: 367.79, charge: 1250) == 7.94)
        let car = try #require(LoanPapers.reading(original: 12000, rate: 6.5, firstDue: "2025-02-15", term: 36, charge: 1250, monthly: 367.79, today: "2026-11-19"))
        #expect(car.rows.count == 37 && car.made == 22 && car.owed == 4954.61)
        #expect(car.rows[0] == R(date: "2025-02-15", payment: 367.79, principal: 294.85, interest: 72.94, after: 11705.15))
        #expect(car.rows[2] == R(date: "2025-04-15", payment: 367.79, principal: 306.04, interest: 61.75, after: 11094.72))
        #expect(car.rows.last == R(date: "2028-02-15", payment: 9.56, principal: 9.51, interest: 0.05, after: 0))
        // Without the charge, no odd days.
        let plain = try #require(LoanPapers.reading(original: 12000, rate: 6.5, firstDue: "2025-02-15", term: 0, charge: 0, monthly: 367.79, today: "2026-11-19"))
        #expect(plain.rows.count == 36 && plain.made == 22 && plain.owed == 4945.71)
        #expect(plain.rows[0] == R(date: "2025-02-15", payment: 367.79, principal: 302.79, interest: 65, after: 11697.21))
        #expect(plain.rows.last == R(date: "2028-01-15", payment: 367.71, principal: 365.73, interest: 1.98, after: 0))
        // No interest, due on the 31st: each month's last day where it has no 31st.
        let zero = try #require(LoanPapers.reading(original: 1200, rate: 0, firstDue: "2026-01-31", term: 0, charge: 0, monthly: 100, today: "2026-11-19"))
        #expect(zero.rows.count == 12 && zero.made == 10 && zero.owed == 200)
        #expect(zero.rows[2] == R(date: "2026-03-31", payment: 100, principal: 100, interest: 0, after: 900))
        #expect(LoanPapers.dueOn("2026-01-31", 1) == "2026-02-28" && LoanPapers.dueOn("2026-01-31", 13) == "2027-02-28" && LoanPapers.dueOn("2025-12-15", 2) == "2026-02-15")
        // Not started yet: it owes what was borrowed.
        let later = try #require(LoanPapers.reading(original: 5000, rate: 4, firstDue: "2027-01-10", term: 0, charge: 0, monthly: 500, today: "2026-11-19"))
        #expect(later.rows.count == 11 && later.made == 0 && later.owed == 5000)
        #expect(later.rows.last == R(date: "2027-11-10", payment: 93.85, principal: 93.54, interest: 0.31, after: 0))
        // A payment that never pays it off, or papers not typed in yet: no reading.
        #expect(LoanPapers.reading(original: 10000, rate: 12, firstDue: "2026-01-01", term: 0, charge: 0, monthly: 90, today: "2026-11-19") == nil)
        #expect(LoanPapers.reading(original: 10000, rate: 5, firstDue: "", term: 0, charge: 0, monthly: 300, today: "2026-11-19") == nil)
    }
}
