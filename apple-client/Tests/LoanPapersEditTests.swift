import Foundation
import Testing
@testable import HomelabClient

/// A loan's papers typed in on the phone (the owner's yes, Nov 19), saved as
/// the computer's account form saves them: the papers on the account, and
/// what it owes today from them as its balance (`FinancePlanEdit.settingPapers`).
/// Made-up loans; what it owes is the computer's own reading
/// (`readFromItsPapersAsTyped` checks that against payoffPlan.ts).
@Suite("Loan papers typed in")
struct LoanPapersEditTests {
    static let plan: JSONValue = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"accounts":[{"id":"chk","name":"Checking","kind":"checking","balance":2000},
                 {"id":"car","name":"Car Loan","kind":"loan","balance":5200,"updated":"2026-10-01","term":48,"charge":900}],
     "people":[{"id":"alex","name":"Alex","net":2000,"schedule":{"every":"month"}}],
     "payments":[{"id":"carpay","name":"Car payment","amount":367.79,"to":"car","schedule":{"every":"month"}},
                 {"id":"rent","name":"Rent","amount":1800,"schedule":{"every":"month"}}]}
    """#.utf8))
    static let today = "2026-11-19"
    static let papers = LoanPapersTyped(original: 12000, rate: 6.5, firstDue: "2025-02-15", payment: 367.79, term: 36, charge: nil)

    static func account(_ plan: JSONValue, _ id: String) -> JSONValue? {
        guard case .array(let accounts)? = plan["accounts"] else { return nil }
        return accounts.first { $0["id"] == .string(id) }
    }

    @Test func savedAsTheComputersFormSavesThem() throws {
        let saved = try #require(FinancePlanEdit.settingPapers(of: "car", Self.papers, planMonthly: 0, today: Self.today, in: Self.plan))
        let car = try #require(Self.account(saved, "car"))
        #expect(car["original"] == .number(12000) && car["rate"] == .number(6.5) && car["firstDue"] == .string("2025-02-15"))
        #expect(car["payment"] == .number(367.79) && car["term"] == .number(36))
        // No charge typed: the one there before goes, as the computer's form leaves it out.
        #expect(car["charge"] == nil)
        // What it owes today is read from the papers: after 22 of 36 payments.
        #expect(car["balance"] == .number(4945.71) && car["updated"] == .string(Self.today))
        #expect(saved["updated"] == .string(Self.today))
        // Read back as typed.
        #expect(LoanPapersTyped.of(account: "car", in: saved) == Self.papers)
        #expect(LoanPapersTyped.of(account: "car", in: Self.plan) == nil)
        // Nothing else moves.
        #expect(Self.account(saved, "chk") == Self.account(Self.plan, "chk"))
    }

    @Test func eachPaymentFromThePlanWhenNoneIsTyped() throws {
        #expect(LoanPapers.planMonthly(into: "car", plan: Self.plan, checking: "chk") == 367.79)
        #expect(LoanPapers.planMonthly(into: "chk", plan: Self.plan, checking: "chk") == 0)
        var p = Self.papers
        p.payment = nil
        #expect(p.problem(planMonthly: 0, today: Self.today) == "Type each payment.")
        let saved = try #require(FinancePlanEdit.settingPapers(of: "car", p, planMonthly: 367.79, today: Self.today, in: Self.plan))
        let car = try #require(Self.account(saved, "car"))
        #expect(car["payment"] == nil && car["balance"] == .number(4945.71))
    }

    @Test func whatItRefusesInTheComputersWords() {
        func problem(_ change: (inout LoanPapersTyped) -> Void) -> String? {
            var p = Self.papers
            change(&p)
            return p.problem(planMonthly: 0, today: Self.today)
        }
        #expect(problem { _ in } == nil)
        #expect(problem { $0.original = 0 } == "Type what was borrowed.")
        #expect(problem { $0.firstDue = "" } == "Pick the day its first payment was due.")
        #expect(problem { $0.charge = -5 } == "Type the payment and the charge without a minus.")
        #expect(problem { $0.rate = 150 } == "Type the interest as a percent a year, as 6.5.")
        #expect(problem { $0.term = -1 } == "The number of payments is a whole number, as 36.")
        #expect(problem { $0.payment = 50 } == "At that payment it is never paid off: check the payment and the rate.")
        // Not a loan, or not in the plan: nothing saved.
        #expect(FinancePlanEdit.settingPapers(of: "chk", Self.papers, planMonthly: 0, today: Self.today, in: Self.plan) == nil)
        #expect(FinancePlanEdit.settingPapers(of: "gone", Self.papers, planMonthly: 0, today: Self.today, in: Self.plan) == nil)
    }

    /// Away from home it waits as other changes do, and a second change to the same loan's papers is one.
    @Test func keptAwayAndReplayed() throws {
        let change = FinanceChange.loanPapers(account: "car", papers: Self.papers, planMonthly: 0, today: Self.today)
        #expect(change.target == "papers:car" && change.setting == nil)
        #expect(change.apply(to: Self.plan) == FinancePlanEdit.settingPapers(of: "car", Self.papers, planMonthly: 0, today: Self.today, in: Self.plan))
        var later = Self.papers
        later.payment = 400
        let both = FinanceChange.adding(.loanPapers(account: "car", papers: later, planMonthly: 0, today: Self.today), to: [change])
        #expect(both.count == 1)
        let data = try JSONEncoder().encode([change])
        #expect(try JSONDecoder().decode([FinanceChange].self, from: data) == [change])
    }
}
