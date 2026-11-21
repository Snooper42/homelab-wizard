import Foundation
import Testing
@testable import HomelabClient

/// The money flow, as the computer's (flowData.ts's monthFlow and
/// typicalFlow), on a made-up view and ledger: the expected boxes and links
/// are the computer's own for them (run through esbuild).
@Suite("Money flow")
struct FinanceFlowTests {
    static let view: JSONValue = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"today":"2026-11-15","checking":"chk",
     "plan":{"currency":"USD","rates":{"EUR":1.1},
      "accounts":[{"id":"chk","name":"Checking","kind":"checking"},{"id":"sav","name":"Savings","kind":"savings"},{"id":"ira","name":"Retirement","kind":"retirement"},{"id":"visa","name":"Visa","kind":"card","paidEach":true,"spend":300},{"id":"eu","name":"Euro","kind":"checking","currency":"EUR"}],
      "people":[{"id":"alex","name":"Alex","net":2000,"gross":2600,"schedule":{"every":"2 weeks"},"deductions":[{"name":"401k","amount":200,"account":"ira"},{"name":"Health","amount":100}]},
                {"id":"sam","name":"Sam","net":1500,"schedule":{"every":"month"}}],
      "payments":[{"id":"rent","name":"Rent","kind":"home","amount":1800,"schedule":{"every":"month"}},
                  {"id":"elec","name":"Electric","kind":"utilities","amount":140,"schedule":{"every":"month"}},
                  {"id":"nf","name":"Netflix","kind":"subscriptions","amount":15,"schedule":{"every":"month"},"from":"visa"},
                  {"id":"save","name":"To savings","kind":"savings","amount":250,"to":"sav","schedule":{"every":"month"}},
                  {"id":"lodger","name":"Room","kind":"other","amount":450,"payer":"Lodger","schedule":{"every":"month"}},
                  {"id":"savout","name":"From savings","kind":"other","amount":20,"from":"sav","schedule":{"every":"month"}}]},
     "categories":[{"name":"Income","income":true},{"name":"Salary","parent":"Income"},{"name":"Food"},{"name":"Groceries","parent":"Food"},{"name":"Dining","parent":"Food"},{"name":"Home"},{"name":"Taxes"},{"name":"Fun"}]}
    """#.utf8))
    static let ledger: JSONValue = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"transactions":[
     {"id":"a","account":"chk","date":"2026-10-01","amount":2000,"payee":"Employer","category":"Salary"},
     {"id":"b","account":"chk","date":"2026-10-02","amount":300,"payee":"Friend"},
     {"id":"c","account":"chk","date":"2026-10-03","amount":-120,"payee":"Grocer","category":"Groceries"},
     {"id":"d","account":"chk","date":"2026-10-04","amount":-60,"payee":"Cafe","category":"Dining"},
     {"id":"e","account":"chk","date":"2026-10-05","amount":-1800,"payee":"Landlord","category":"Home"},
     {"id":"f","account":"chk","date":"2026-10-06","amount":-400,"payee":"IRS","category":"Taxes"},
     {"id":"g","account":"chk","date":"2026-10-07","amount":-500,"payee":"Move","to":"sav"},
     {"id":"h","account":"sav","date":"2026-10-08","amount":-100,"payee":"Back","to":"chk"},
     {"id":"i","account":"chk","date":"2026-10-09","amount":20,"payee":"Grocer","category":"Groceries"},
     {"id":"j","account":"eu","date":"2026-10-10","amount":-10,"payee":"Museum","category":"Fun"},
     {"id":"k","account":"chk","date":"2026-10-11","amount":-90,"payee":"Split","splits":[{"category":"Groceries","amount":-50},{"category":"Fun","amount":-40}]},
     {"id":"l","account":"chk","date":"2026-10-12","amount":-30,"payee":"No cat"},
     {"id":"m","account":"chk","date":"2026-11-01","amount":2000,"payee":"Employer","category":"Salary"}]}
    """#.utf8))

    struct N: Equatable, CustomStringConvertible {
        let id: String, label: String, value: Double, col: Int
        init(_ id: String, _ label: String, _ value: Double, _ col: Int) { (self.id, self.label, self.value, self.col) = (id, label, value, col) }
        var description: String { "\(id) \(label) \(value) \(col)" }
    }
    struct L: Equatable, CustomStringConvertible {
        let from: String, to: String, value: Double
        init(_ from: String, _ to: String, _ value: Double) { (self.from, self.to, self.value) = (from, to, value) }
        var description: String { "\(from)→\(to) \(value)" }
    }

    /// To the cent, as the expected answers were written.
    static func cents(_ n: Double) -> Double { (n * 100).rounded() / 100 }
    static func nodes(_ f: FinanceFlow) -> [N] { f.nodes.map { N($0.id, $0.label, cents($0.value), $0.col) } }
    static func links(_ f: FinanceFlow) -> [L] { f.links.map { L($0.from, $0.to, cents($0.value)) } }

    /// October: the paycheck and a friend's money in; taxes; spending by its group (the refund off Food,
    /// the euro museum as $11, a split in two); $500 into savings and $100 back out; more out than in.
    @Test func aRealMonthFromTheLedger() {
        let f = FinanceFlow.month(view: Self.view, ledger: Self.ledger, month: "2026-10")
        #expect(Self.nodes(f) == [
            N("src:salary", "Salary", 2000.0, 0),
            N("src:friend", "Friend", 300.0, 0),
            N("src:accounts", "From your accounts", 591.0, 0),
            N("total", "Total income", 2891.0, 1),
            N("taxes", "Taxes", 400.0, 2),
            N("expenses", "Expenses", 2091.0, 2),
            N("cat:home", "Home", 1800.0, 3),
            N("cat:food", "Food", 210.0, 3),
            N("cat:fun", "Fun", 51.0, 3),
            N("cat:no category", "No category", 30.0, 3),
            N("saved", "Savings", 400.0, 2),
            N("kept:sav", "Savings", 400.0, 3),
        ])
        #expect(Self.links(f) == [
            L("src:salary", "total", 2000.0),
            L("src:friend", "total", 300.0),
            L("src:accounts", "total", 591.0),
            L("total", "taxes", 400.0),
            L("total", "expenses", 2091.0),
            L("expenses", "cat:home", 1800.0),
            L("expenses", "cat:food", 210.0),
            L("expenses", "cat:fun", 51.0),
            L("expenses", "cat:no category", 30.0),
            L("total", "saved", 400.0),
            L("saved", "kept:sav", 400.0),
        ])
        #expect(Self.cents(f.income) == 2300.0 && Self.cents(f.taxes) == 400.0)
        #expect(Self.cents(f.expenses) == 2091.0 && Self.cents(f.saved) == -191.0)
    }

    /// The largest two of each column and the rest as one Other.
    @Test func theRestAsOther() {
        let f = FinanceFlow.month(view: Self.view, ledger: Self.ledger, month: "2026-10", top: 3)
        #expect(Self.nodes(f) == [
            N("src:salary", "Salary", 2000.0, 0),
            N("src:friend", "Friend", 300.0, 0),
            N("src:accounts", "From your accounts", 591.0, 0),
            N("total", "Total income", 2891.0, 1),
            N("taxes", "Taxes", 400.0, 2),
            N("expenses", "Expenses", 2091.0, 2),
            N("cat:home", "Home", 1800.0, 3),
            N("cat:food", "Food", 210.0, 3),
            N("cat:other", "Other (2)", 81.0, 3),
            N("saved", "Savings", 400.0, 2),
            N("kept:sav", "Savings", 400.0, 3),
        ])
        #expect(Self.links(f) == [
            L("src:salary", "total", 2000.0),
            L("src:friend", "total", 300.0),
            L("src:accounts", "total", 591.0),
            L("total", "taxes", 400.0),
            L("total", "expenses", 2091.0),
            L("expenses", "cat:home", 1800.0),
            L("expenses", "cat:food", 210.0),
            L("expenses", "cat:other", 81.0),
            L("total", "saved", 400.0),
            L("saved", "kept:sav", 400.0),
        ])
        #expect(Self.cents(f.income) == 2300.0 && Self.cents(f.taxes) == 400.0)
        #expect(Self.cents(f.expenses) == 2091.0 && Self.cents(f.saved) == -191.0)
    }

    /// The plan: Alex's pay before taxes (401k saved, health taken from pay), Sam's, the lodger's room;
    /// the card paid with each paycheck and Netflix on it; money from savings isn't checking's.
    @Test func aTypicalMonthFromThePlan() {
        let f = FinanceFlow.typical(view: Self.view)
        #expect(Self.nodes(f) == [
            N("src:alex", "Alex's pay", 5633.33, 0),
            N("src:sam", "Sam's pay", 1500.0, 0),
            N("src:pay:lodger", "Room, from Lodger", 450.0, 0),
            N("total", "Total income", 7583.33, 1),
            N("taxes", "Taxes", 650.0, 2),
            N("expenses", "Expenses", 3121.67, 2),
            N("kind:home", "Home", 1800.0, 3),
            N("kind:cards", "Cards", 950.0, 3),
            N("cat:frompay", "Taken from pay", 216.67, 3),
            N("kind:utilities", "Utilities", 140.0, 3),
            N("kind:subscriptions", "Subscriptions", 15.0, 3),
            N("saved", "Savings", 3811.67, 2),
            N("kept:ira", "Retirement", 433.33, 3),
            N("kept:sav", "Savings", 250.0, 3),
            N("kept:cash", "Kept as cash", 3128.33, 3),
        ])
        #expect(Self.links(f) == [
            L("src:alex", "total", 5633.33),
            L("src:sam", "total", 1500.0),
            L("src:pay:lodger", "total", 450.0),
            L("total", "taxes", 650.0),
            L("total", "expenses", 3121.67),
            L("expenses", "kind:home", 1800.0),
            L("expenses", "kind:cards", 950.0),
            L("expenses", "cat:frompay", 216.67),
            L("expenses", "kind:utilities", 140.0),
            L("expenses", "kind:subscriptions", 15.0),
            L("total", "saved", 3811.67),
            L("saved", "kept:ira", 433.33),
            L("saved", "kept:sav", 250.0),
            L("saved", "kept:cash", 3128.33),
        ])
        #expect(Self.cents(f.income) == 7583.33 && Self.cents(f.taxes) == 650.0)
        #expect(Self.cents(f.expenses) == 3121.67 && Self.cents(f.saved) == 3811.67)
    }

    /// Track from on a month's 15th: the flow counts that month from the
    /// 15th, not whole, and no month before it (Nov 16).
    @Test func countedFromTrackFromsDay() throws {
        let ledger: JSONValue = .object(["transactions": .array([
            .object(["id": .string("a"), "date": .string("2026-09-30"), "amount": .number(-10)]),
            .object(["id": .string("b"), "date": .string("2026-10-14"), "amount": .number(-20)]),
            .object(["id": .string("c"), "date": .string("2026-10-15"), "amount": .number(-30)]),
        ])])
        let counted = FinanceFlow.counted(ledger, from: "2026-10-15")
        #expect(FinanceFlow.ledgerMonths(counted) == ["2026-10"])
        guard case .array(let kept)? = counted?["transactions"] else { Issue.record("no transactions"); return }
        #expect(kept.map { $0["id"] } == [.string("c")])
        #expect(FinanceFlow.counted(ledger, from: nil) == ledger)
        #expect(FinanceFlow.counted(nil, from: "2026-10-15") == nil)
    }

    /// What's behind each box, as the computer lists it under the chart (flowData.ts's items, the
    /// largest first): a month's transactions with their account, a typical month's pay and payments.
    @Test func whatsBehindABox() {
        func said(_ f: FinanceFlow, _ id: String) -> [String] {
            f.behind(id).map { "\($0.label) \(Self.cents($0.amount)) \($0.tx ?? $0.payment ?? $0.person ?? "") \($0.note ?? "")" }
        }
        let october = FinanceFlow.month(view: Self.view, ledger: Self.ledger, month: "2026-10")
        #expect(said(october, "total") == ["Employer 2000.0 a Checking", "Friend 300.0 b Checking"])
        #expect(said(october, "cat:food") == ["Grocer -120.0 c Checking", "Cafe -60.0 d Checking", "Split -50.0 k Checking", "Grocer 20.0 i Checking"])
        #expect(said(october, "taxes") == ["IRS -400.0 f Checking"])
        #expect(october.behind("taxes").first?.date == "2026-10-06")
        #expect(said(october, "kept:sav") == ["Move 500.0 g Checking", "Back 100.0 h Savings"])
        #expect(said(october, "saved") == said(october, "kept:sav"))
        #expect(said(october, "cat:fun") == ["Split -40.0 k Checking", "Museum -11.0 j Euro"])
        #expect(said(october, "expenses") == ["Landlord -1800.0 e Checking", "Grocer -120.0 c Checking", "Cafe -60.0 d Checking",
                                              "Split -50.0 k Checking", "Split -40.0 k Checking", "No cat -30.0 l Checking",
                                              "Grocer 20.0 i Checking", "Museum -11.0 j Euro"])
        #expect(said(october, "kept:cash").isEmpty && said(october, "nothing").isEmpty)
        #expect(october.next("expenses").map(\.id).contains("cat:food") && october.next("total").map(\.id).contains("expenses"))
        // Top 3: Other holds what the boxes it stands for held.
        let three = FinanceFlow.month(view: Self.view, ledger: Self.ledger, month: "2026-10", top: 3)
        #expect(said(three, "cat:other") == ["Split -40.0 k Checking", "No cat -30.0 l Checking", "Museum -11.0 j Euro"])

        let typical = FinanceFlow.typical(view: Self.view)
        #expect(said(typical, "total") == ["Alex's pay, before taxes 5633.33 alex ", "Sam's pay 1500.0 sam ", "Room, from Lodger 450.0 lodger "])
        #expect(said(typical, "taxes") == ["Alex's taxes -650.0 alex "])
        #expect(said(typical, "kept:ira") == ["401k, from Alex's pay 433.33 alex "])
        #expect(said(typical, "cat:frompay") == ["Health, from Alex's pay -216.67 alex "])
        #expect(said(typical, "kind:home") == ["Rent -1800.0 rent "])
        #expect(said(typical, "saved") == ["401k, from Alex's pay 433.33 alex ", "To savings 250.0 save "])
        #expect(said(typical, "kind:cards") == ["Visa -950.0 card:visa "])
    }

    /// A card paid off with each paycheck and nothing typed in goes on it what the computer read from
    /// its transactions (View.CardSpend), as money.ts's allPayments; one typed in wins.
    @Test func aCardsSpendingFromTheComputer() throws {
        func cards(_ visa: String) throws -> Double? {
            let view = try JSONDecoder().decode(JSONValue.self, from: Data("""
            {"today":"2026-11-15","checking":"chk","cardSpend":{"visa":300},
             "plan":{"currency":"USD","accounts":[{"id":"chk","name":"Checking","kind":"checking"},\(visa)],
              "people":[{"id":"alex","name":"Alex","net":2000,"schedule":{"every":"2 weeks"}}],"payments":[]}}
            """.utf8))
            return Self.nodes(FinanceFlow.typical(view: view)).first { $0.id == "kind:cards" }?.value
        }
        // 300 each of 26 paychecks a year: 650 a month.
        #expect(try cards(#"{"id":"visa","name":"Visa","kind":"card","paidEach":true}"#) == Double(650))
        #expect(try cards(#"{"id":"visa","name":"Visa","kind":"card","paidEach":true,"spend":120}"#) == Double(260))
    }

    @Test func theMonthsTheLedgerHas() {
        #expect(FinanceFlow.ledgerMonths(Self.ledger) == ["2026-11", "2026-10"])
        #expect(FinanceFlow.taxing("Federal taxes") && FinanceFlow.taxing("Tax") && !FinanceFlow.taxing("Taxi"))
    }
}
