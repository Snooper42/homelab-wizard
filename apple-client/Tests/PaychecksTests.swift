import Foundation
import Testing
@testable import HomelabClient

/// Finances › Paychecks, as the computer's Plan › Paychecks (Lists.tsx's
/// `Pay`), on a made-up view: each person's pay and where it goes, and the
/// next paychecks month by month.
@Suite("Paychecks")
struct PaychecksTests {
    static func view(paydays: String) -> JSONValue {
        try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
        {"today":"2026-11-20","checking":"chk",
         "plan":{"accounts":[{"id":"chk","name":"Checking","kind":"checking"},{"id":"sav","name":"Savings","kind":"savings"},{"id":"ira","name":"Retirement","kind":"retirement"}],
          "people":[{"id":"alex","name":"Alex","net":2000,"gross":2600,"schedule":{"every":"2 weeks","start":"2026-11-06"},
                     "deductions":[{"name":"401(k)","amount":200,"account":"ira"},{"name":"Health","amount":100}]},
                    {"id":"sam","name":"Sam","net":1500,"account":"sav","schedule":{"every":"month","start":"2026-11-15"}}]},
         "paydays":\#(paydays)}
        """#.utf8))
    }

    @Test func eachPersonsPayAndWhereItGoes() throws {
        let p = Paychecks(view: Self.view(paydays: "[]"))
        #expect(p.people.map(\.name) == ["Alex", "Sam"])
        let alex = p.people[0]
        #expect(alex.how == "Every 2 weeks" && alex.into == "Checking")
        // About a year: take-home a paycheck, 26 paychecks.
        #expect(abs(alex.perYear - 52000) < 0.01)
        #expect(alex.gross == 2600)
        #expect(alex.deductions == [.init(name: "401(k)", amount: 200, into: "Retirement"), .init(name: "Health", amount: 100, into: nil)])
        // The bar: take-home, each deduction (saved or taken), then taxes and the rest.
        #expect(alex.parts == [.init(label: "Take-home", value: 2000, kind: .takeHome), .init(label: "401(k)", value: 200, kind: .saved),
                               .init(label: "Health", value: 100, kind: .taken), .init(label: "Taxes and the rest", value: 300, kind: .taxes)])
        // No gross typed in: no bar, a line of its own.
        let sam = p.people[1]
        #expect(sam.how == "Monthly" && sam.into == "Savings" && abs(sam.perYear - 18000) < 0.01 && sam.parts.isEmpty && sam.deductions.isEmpty)
        #expect(p.months.isEmpty)
    }

    @Test func theNextPaychecksMonthByMonth() {
        // Twelve paydays read: the first ten, and the rest of the tenth's month.
        let read = "[" + [
            #"{"date":"2026-11-20","people":["alex"],"total":2000}"#,
            #"{"date":"2026-12-04","people":["alex"],"total":2000}"#,
            #"{"date":"2026-12-15","people":["sam"],"total":1500}"#,
            #"{"date":"2026-12-18","people":["alex"],"total":2000,"moved":[{"person":"alex","from":"2026-12-19","why":"the weekend"}]}"#,
            #"{"date":"2027-01-01","people":["alex"],"total":2000}"#,
            #"{"date":"2027-01-15","people":["alex","sam"],"total":3500}"#,
            #"{"date":"2027-01-29","people":["alex"],"total":2000}"#,
            #"{"date":"2027-02-12","people":["alex"],"total":2000}"#,
            #"{"date":"2027-02-15","people":["sam"],"total":1500}"#,
            #"{"date":"2027-02-26","people":["alex"],"total":2000}"#,
            #"{"date":"2027-02-27","people":["alex"],"total":10}"#,
            #"{"date":"2027-03-12","people":["alex"],"total":2000}"#,
        ].joined(separator: ",") + "]"
        let p = Paychecks(view: Self.view(paydays: read))
        #expect(p.months.map(\.month) == ["2026-11", "2026-12", "2027-01", "2027-02"])
        // The tenth is Feb 26: the rest of February comes too, March doesn't.
        #expect(p.months[3].paydays.map(\.date) == ["2027-02-12", "2027-02-15", "2027-02-26", "2027-02-27"])
        // Each month's total, every check's take-home; whole when a payday after it was read.
        #expect(p.months[1].total == 5500 && p.months[1].whole)
        #expect(p.months[3].whole)
        // Who, with the account when it isn't checking; a check paid early says why.
        #expect(p.months[1].paydays[1].who == ["Sam (into Savings)"])
        #expect(p.months[2].paydays[1].who == ["Alex", "Sam (into Savings)"])
        #expect(p.months[1].paydays[2].moved.first?.hasPrefix("The weekend, from ") == true)
        // Read only to a month's middle: not whole.
        let short = Paychecks(view: Self.view(paydays: #"[{"date":"2026-12-04","people":["alex"],"total":2000}]"#))
        #expect(short.months.count == 1 && !short.months[0].whole)
    }
}
