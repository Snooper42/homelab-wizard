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
}
