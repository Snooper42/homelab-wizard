import CoreGraphics
import Foundation
import ImageIO
import SwiftUI
import Testing
@testable import HomelabClient

@Suite("Finances")
struct FinancesTests {
    @Test func levels() {
        #expect(FinancesLevel(nil) == .none)
        #expect(FinancesLevel("") == .none)
        #expect(FinancesLevel("card") >= .card)
        #expect(FinancesLevel("VIEW") == .view)
        #expect(FinancesLevel("edit") > .view)
        #expect(FinancesLevel("admin") == .none) // unknown: nothing
    }

    @Test func moneyCard() throws {
        let card = try JSONDecoder.homelab().decode(MoneyCard.self, from: Data(#"""
        {"payday":"2026-11-13","who":["Sam",""],"left":412.5,"bills":[{"name":"Rent","date":"2026-11-15","amount":1200}],"currency":"eur"}
        """#.utf8))
        #expect(card.payday != nil)
        #expect(card.who == ["Sam"])
        #expect(card.bills.first?.amount == 1200)
        #expect(card.currency == "EUR")
        #expect(!card.hidden)
    }

    @Test func hiddenAndNoPayday() throws {
        let card = try JSONDecoder.homelab().decode(MoneyCard.self, from: Data(#"{"left":0,"bills":[],"hidden":true,"currency":"€"}"#.utf8))
        #expect(card.payday == nil && card.hidden)
        #expect(card.currency == "USD")
    }

    @Test func localDays() {
        #expect(LocalDay.parse("2026-11-05") != nil)
        #expect(LocalDay.parse("2026-13-01") == nil)
        #expect(LocalDay.parse("soon") == nil)
        #expect(LocalDay.parse(nil) == nil)
    }
}

@Suite("Finances plan")
struct FinancesPlanTests {
    private let json = #"""
    {"today":"2026-11-05","checking":"chk","typed":"2026-11-01",
     "start":{"chk":2400,"sav":10000,"visa":350,"car":8000},
     "since":[],"paydays":[],"days":[],"worth":[],"next":{},"categories":[],
     "plan":{"people":[{"id":"p1","name":"Sam","schedule":{},"net":3000}],
             "accounts":[{"id":"chk","name":"Everyday","kind":"checking","balance":2400},
                         {"id":"sav","name":"Rainy day","kind":"savings","balance":10000},
                         {"id":"visa","name":"Visa","kind":"card","balance":350},
                         {"id":"car","name":"Car loan","kind":"loan","balance":8000}],
             "payments":[{"id":"rent","name":"Rent","amount":1200,"schedule":{}}],
             "cushion":500,"currency":"usd","hideAmounts":true,"logos":{"x":"data:image/png;base64,AAAA"}},
     "periods":[{"now":true,"start":"2026-11-05","last":"2026-11-12","carried":2400,"in":0,"out":1200,"saved":0,"left":400,
                 "rows":[{"date":"2026-11-10","payment":"rent","amount":1200,"after":1200,"estimate":true}],"accounts":{}},
                {"now":false,"start":"2026-11-13","last":"2026-11-26","pay":{"date":"2026-11-13","people":["p1"],"amount":3000},
                 "carried":400,"in":3000,"out":0,"saved":0,"left":3400,"rows":[],"accounts":{}}],
     "readOnly":true}
    """#

    @Test func decodesTheViewTheComputerSends() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(json.utf8))
        #expect(view.readOnly)
        #expect(view.plan.hideAmounts)
        #expect(view.plan.currency == "USD")
        #expect(view.periods.count == 2)
        #expect(view.periods[0].now && view.periods[0].left == 400)
        #expect(view.periods[0].rows.first?.estimate == true)
        #expect(view.periods[1].moneyIn == 3000)
        #expect(view.person("p1") == "Sam")
        #expect(view.payment("rent")?.name == "Rent")
    }

    @Test func netWorthSubtractsWhatIsOwed() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(json.utf8))
        // 2400 + 10000 − 350 (card) − 8000 (loan)
        #expect(view.netWorth == 4050)
    }
}

@Suite("Ledger")
struct LedgerTests {
    private let json = #"""
    {"transactions":[
      {"id":"a","date":"2026-10-30","account":"chk","amount":-12.99,"payee":"Netflix","category":"Streaming","tags":["tv"]},
      {"id":"c","date":"2026-11-02","account":"chk","amount":3000,"payee":"Sam's paycheck","category":"Paycheck"},
      {"id":"b","date":"2026-11-02","account":"chk","amount":-500,"to":"sav","payee":"","note":"rainy day","receipt":"r1.jpg"}
    ],"rev":"x"}
    """#

    @Test func newestFirstStable() throws {
        let ledger = try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(json.utf8))
        #expect(ledger.newestFirst.map(\.id) == ["c", "b", "a"])
        #expect(ledger.transactions.first { $0.id == "b" }?.hasReceipt == true)
        #expect(ledger.transactions.first { $0.id == "b" }?.to == "sav")
    }

    @Test func search() throws {
        let ledger = try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(json.utf8))
        #expect(ledger.transactions.filter { $0.matches("TV") }.map(\.id) == ["a"])
        #expect(ledger.transactions.filter { $0.matches("rainy") }.map(\.id) == ["b"])
        #expect(ledger.transactions.filter { $0.matches(" ") }.count == 3)
    }

    @Test func nullTransactions() throws {
        let ledger = try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"{"transactions":null}"#.utf8))
        #expect(ledger.transactions.isEmpty)
    }
}

@Suite("Budgets, goals, loans")
struct FinanceExtrasTests {
    @Test func decodeExtras() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-11-05","plan":{"people":[],"accounts":[],"payments":[],"cushion":0},"periods":[],
         "budgets":[{"category":"Groceries","per":"month","start":"2026-11-01","last":"2026-11-30","amount":600,"spent":250,"left":350,"pace":100}],
         "goals":[{"id":"g","name":"Holiday","target":2000,"date":"2027-06-01","saved":500,"left":1500,"needsMonth":214.29,"reaches":"2027-04"}],
         "loans":[{"account":"car","balance":8000,"rate":4.9,"monthly":250,"months":36,"date":"2029-11","interest":600,"path":[1,2]}]}
        """#.utf8))
        #expect(view.budgets.first?.isAhead == true)
        #expect(view.budgets.first?.share == 250.0 / 600.0)
        #expect(view.goals.first?.reaches != nil && view.goals.first?.isReached == false)
        #expect(view.loans.first?.paidOff != nil && view.loans.first?.never == false)
    }

    @Test func aBadExtraCostsOnlyItself() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"plan":{"people":[],"accounts":[],"payments":[],"cushion":0},"periods":[],"goals":[{"name":"no id"}]}
        """#.utf8))
        #expect(view.goals.isEmpty)
    }

    @Test func months() {
        #expect(LocalDay.parseMonth("2027-04") != nil)
        #expect(LocalDay.parseMonth("2027") == nil)
        #expect(LocalDay.parseMonth(nil) == nil)
    }
}

@Suite("Editing the Finances plan")
struct FinancePlanEditTests {
    private let plan = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"abc123","updated":"2026-10-01","cushion":500,"logos":{"chase":"data:image/png;base64,AAAA"},
     "accounts":[{"id":"chk","name":"Everyday","kind":"checking","balance":2400,"updated":"2026-10-01","history":[{"date":"2026-10-01","annual":2400}]},
                 {"id":"visa","name":"Visa","kind":"card","balance":350,"pending":20,"paidEach":true}],
     "payments":[{"id":"rent","name":"Rent","amount":1200,"schedule":{"every":"month","day":1}}]}
    """#.utf8))

    @Test func setsOnlyTheBalanceAndTheDays() throws {
        let edited = try #require(FinancePlanEdit.settingBalance(of: "visa", to: 412.346, today: "2026-11-05", in: plan))
        guard case .array(let accounts)? = edited["accounts"] else { Issue.record("no accounts"); return }
        #expect(accounts[1]["balance"] == .number(412.35))
        #expect(accounts[1]["updated"] == .string("2026-11-05"))
        #expect(accounts[1]["pending"] == .number(20))      // untouched
        #expect(accounts[1]["paidEach"] == .bool(true))     // untouched
        #expect(accounts[0] == plan["accounts"].flatMap { if case .array(let a) = $0 { return a[0] } else { return nil } })
        #expect(edited["updated"] == .string("2026-11-05"))
        // Everything the phone doesn't show goes back as it came, the rev included.
        #expect(edited["rev"] == .string("abc123"))
        #expect(edited["logos"] == plan["logos"])
        #expect(edited["payments"] == plan["payments"])
        #expect(edited["cushion"] == plan["cushion"])
    }

    @Test func refusesWhatItCannotSave() {
        #expect(FinancePlanEdit.settingBalance(of: "nope", to: 1, today: "2026-11-05", in: plan) == nil)
        #expect(FinancePlanEdit.settingBalance(of: "chk", to: .infinity, today: "2026-11-05", in: plan) == nil)
        #expect(FinancePlanEdit.settingBalance(of: "chk", to: .nan, today: "2026-11-05", in: plan) == nil)
        #expect(FinancePlanEdit.settingBalance(of: "chk", to: 2e12, today: "2026-11-05", in: plan) == nil)
        #expect(FinancePlanEdit.settingBalance(of: "chk", to: 1, today: "today", in: plan) == nil)
        #expect(FinancePlanEdit.settingBalance(of: "chk", to: 1, today: "2026-11-05", in: .array([])) == nil)
    }

    @Test func parsesAmountsAsTyped() {
        let us = Locale(identifier: "en_US")
        #expect(FinancePlanEdit.parseAmount("1,234.56", locale: us) == 1234.56)
        #expect(FinancePlanEdit.parseAmount("$1,200", locale: us) == 1200)
        #expect(FinancePlanEdit.parseAmount("-35.10", locale: us) == -35.1)
        #expect(FinancePlanEdit.parseAmount("abc", locale: us) == nil)
        #expect(FinancePlanEdit.parseAmount("", locale: us) == nil)
        #expect(FinancePlanEdit.parseAmount("1.234,56", locale: Locale(identifier: "de_DE")) == 1234.56)
    }

    @Test func today() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        #expect(FinancePlanEdit.todayString(GoTime.parse("2026-11-05T23:30:00Z")!, calendar: calendar) == "2026-11-05")
    }

    @Test func rawPlanRoundTripsThroughJSON() throws {
        let encoded = try JSONEncoder().encode(plan)
        let back = try JSONDecoder().decode(JSONValue.self, from: encoded)
        #expect(back == plan)
    }
}

@Suite("Adding a transaction")
struct LedgerEditTests {
    private let ledger = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"r9","transactions":[{"id":"t1","date":"2026-11-01","account":"chk","amount":-5,"payee":"Café","bank":"FITID1","splits":[{"category":"Food","amount":-5}]}]}
    """#.utf8))
    private var utc: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func draft(_ amount: Double, moneyIn: Bool = false, payee: String = " Grocer ", account: String = "chk") -> NewTransaction {
        NewTransaction(date: GoTime.parse("2026-11-05T12:00:00Z")!, account: account, isMoneyIn: moneyIn, amount: amount, payee: payee, category: " Groceries ", note: "")
    }

    @Test func appendsSignedAndTrimmed() throws {
        let edited = try #require(LedgerEdit.appending(draft(42.199), accounts: ["chk"], calendar: utc, to: ledger))
        guard case .array(let all)? = edited["transactions"] else { Issue.record("no transactions"); return }
        #expect(all.count == 2)
        #expect(all[0] == (ledger["transactions"].flatMap { if case .array(let a) = $0 { return a[0] } else { return nil } })) // untouched
        let added = all[1]
        #expect(added["amount"] == .number(-42.2))
        #expect(added["date"] == .string("2026-11-05"))
        #expect(added["payee"] == .string("Grocer"))
        #expect(added["category"] == .string("Groceries"))
        #expect(added["note"] == nil)
        #expect(added["id"] == nil) // the computer gives it one
        #expect(edited["rev"] == .string("r9"))
    }

    @Test func moneyInIsPositive() throws {
        let edited = try #require(LedgerEdit.appending(draft(10, moneyIn: true), accounts: ["chk"], calendar: utc, to: ledger))
        guard case .array(let all)? = edited["transactions"] else { return }
        #expect(all.last?["amount"] == .number(10))
    }

    @Test func refusesWhatTheComputerWould() {
        #expect(LedgerEdit.problem(with: draft(0), accounts: ["chk"]) != nil)
        #expect(LedgerEdit.problem(with: draft(0.004), accounts: ["chk"]) != nil) // rounds to nothing
        #expect(LedgerEdit.problem(with: draft(5, account: "gone"), accounts: ["chk"]) != nil)
        #expect(LedgerEdit.problem(with: draft(5, payee: "  "), accounts: ["chk"]) != nil)
        #expect(LedgerEdit.problem(with: draft(.nan), accounts: ["chk"]) != nil)
        #expect(LedgerEdit.problem(with: draft(5), accounts: ["chk"]) == nil)
    }

    @Test func emptyLedgersTakeOne() throws {
        let fromNull = try #require(LedgerEdit.appending(draft(5), accounts: ["chk"], calendar: utc, to: .null))
        guard case .array(let all)? = fromNull["transactions"] else { Issue.record("no transactions"); return }
        #expect(all.count == 1)
        let fromNullList = try #require(LedgerEdit.appending(draft(5), accounts: ["chk"], calendar: utc, to: .object(["transactions": .null])))
        #expect(fromNullList["transactions"] != nil)
    }
}

@Suite("Receipts")
struct ReceiptTests {
    private let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    @Test func names() {
        #expect(ReceiptCodec.isValidName("0123456789abcdef0123456789abcdef.jpg"))
        #expect(ReceiptCodec.isValidName("0123456789abcdef0123456789abcdef.pdf"))
        #expect(!ReceiptCodec.isValidName("0123456789ABCDEF0123456789ABCDEF.jpg"))
        #expect(!ReceiptCodec.isValidName("../etc/passwd"))
        #expect(!ReceiptCodec.isValidName("0123456789abcdef0123456789abcdef.svg"))
        #expect(!ReceiptCodec.isValidName("short.jpg"))
    }

    @Test func showsImagesAndPDFs() {
        if case .image? = ReceiptCodec.content(fromDataURL: "data:image/png;base64,\(png)") {} else { Issue.record("png not shown") }
        let pdf = Data("%PDF-1.4\n%%EOF".utf8).base64EncodedString()
        if case .pdf? = ReceiptCodec.content(fromDataURL: "data:application/pdf;base64,\(pdf)") {} else { Issue.record("pdf not shown") }
        // The declared type must match the bytes.
        #expect(ReceiptCodec.content(fromDataURL: "data:application/pdf;base64,\(png)") == nil)
        #expect(ReceiptCodec.content(fromDataURL: "data:text/html;base64,\(Data("<b>".utf8).base64EncodedString())") == nil)
    }

    @Test func photosAreReencodedWithoutMetadata() throws {
        let url = try #require(ReceiptCodec.preparePhoto(Data(base64Encoded: png)!))
        #expect(url.hasPrefix("data:image/jpeg;base64,"))
        let jpeg = try #require(Data(base64Encoded: String(url.dropFirst("data:image/jpeg;base64,".count))))
        let source = try #require(CGImageSourceCreateWithData(jpeg as CFData, nil))
        let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] ?? [:]
        #expect(props[kCGImagePropertyGPSDictionary] == nil)
        #expect(props[kCGImagePropertyExifDictionary] == nil || (props[kCGImagePropertyExifDictionary] as? [CFString: Any])?[kCGImagePropertyExifDateTimeOriginal] == nil)
    }

    @Test func transactionsCarryAValidReceiptOnly() throws {
        let good = NewTransaction(date: Date(), account: "chk", isMoneyIn: false, amount: 5, payee: "Shop", category: "", note: "", receipt: "0123456789abcdef0123456789abcdef.jpg")
        #expect(LedgerEdit.appending(good, accounts: ["chk"], to: .null) != nil)
        var bad = good
        bad.receipt = "../../.env"
        #expect(LedgerEdit.appending(bad, accounts: ["chk"], to: .null) == nil)
    }
}

@Suite("Changing a transaction")
struct LedgerChangeTests {
    private let ledger = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"r1","transactions":[
      {"id":"a","date":"2026-11-01","account":"chk","amount":-5,"payee":"Café","bank":"FITID1","tags":["coffee"],"receipt":"0123456789abcdef0123456789abcdef.jpg","category":"Food"},
      {"id":"b","date":"2026-11-02","account":"chk","amount":-500,"to":"sav","payee":"Savings"},
      {"id":"c","date":"2026-11-03","account":"chk","amount":-60,"payee":"Shop","splits":[{"category":"Food","amount":-40},{"category":"Home","amount":-20}]}
    ]}
    """#.utf8))

    private func draft() -> NewTransaction {
        NewTransaction(date: GoTime.parse("2026-11-04T12:00:00Z")!, account: "chk", isMoneyIn: false, amount: 6.5, payee: "Café Bleu", category: "", note: "oat milk")
    }

    @Test func updatesAndKeepsTheRest() throws {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let edited = try #require(LedgerEdit.updating(id: "a", with: draft(), accounts: ["chk"], calendar: utc, in: ledger))
        guard case .array(let all)? = edited["transactions"] else { Issue.record("no transactions"); return }
        let a = all[0]
        #expect(a["amount"] == .number(-6.5))
        #expect(a["payee"] == .string("Café Bleu"))
        #expect(a["date"] == .string("2026-11-04"))
        #expect(a["category"] == nil)                       // cleared
        #expect(a["note"] == .string("oat milk"))
        #expect(a["bank"] == .string("FITID1"))              // kept
        #expect(a["tags"] == .array([.string("coffee")]))    // kept
        #expect(a["receipt"] == .string("0123456789abcdef0123456789abcdef.jpg")) // kept
        #expect(a["id"] == .string("a"))
        #expect(edited["rev"] == .string("r1"))
    }

    @Test func transfersAndSplitsStayOnTheComputer() {
        #expect(LedgerEdit.updating(id: "b", with: draft(), accounts: ["chk"], in: ledger) == nil)
        #expect(LedgerEdit.updating(id: "c", with: draft(), accounts: ["chk"], in: ledger) == nil)
        #expect(LedgerEdit.updating(id: "zzz", with: draft(), accounts: ["chk"], in: ledger) == nil)
    }

    @Test func removesExactlyOne() throws {
        let edited = try #require(LedgerEdit.removing(id: "b", from: ledger))
        guard case .array(let all)? = edited["transactions"] else { Issue.record("no transactions"); return }
        #expect(all.map { $0["id"] } == [.string("a"), .string("c")])
        #expect(LedgerEdit.removing(id: "nope", from: ledger) == nil)
        #expect(LedgerEdit.removing(id: "", from: ledger) == nil)
    }
}

@Suite("Changing a budget")
struct BudgetEditTests {
    private let plan = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"r2","budgets":[{"category":"Groceries","amount":600,"rollover":true},{"category":"Fun","amount":100,"per":"paycheck"}],"accounts":[]}
    """#.utf8))

    @Test func setsOnlyTheAmount() throws {
        let edited = try #require(FinancePlanEdit.settingBudget(category: "groceries", to: 650.004, in: plan))
        guard case .array(let budgets)? = edited["budgets"] else { Issue.record("no budgets"); return }
        #expect(budgets[0]["amount"] == .number(650))
        #expect(budgets[0]["rollover"] == .bool(true))   // kept
        #expect(budgets[0]["category"] == .string("Groceries"))
        #expect(budgets[1] == (plan["budgets"].flatMap { if case .array(let a) = $0 { return a[1] } else { return nil } }))
        #expect(edited["rev"] == .string("r2"))
    }

    @Test func refusesNothingAndUnknown() {
        #expect(FinancePlanEdit.settingBudget(category: "Groceries", to: 0, in: plan) == nil)
        #expect(FinancePlanEdit.settingBudget(category: "Groceries", to: -5, in: plan) == nil)
        #expect(FinancePlanEdit.settingBudget(category: "Rent", to: 5, in: plan) == nil)
        #expect(FinancePlanEdit.settingBudget(category: "Groceries", to: .infinity, in: plan) == nil)
    }
}

@Suite("Taken as done")
struct WaitingTests {
    private let plan = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"r3","waiting":["pay:p1:2026-11-01"],"notYet":"2026-10-15","accounts":[]}
    """#.utf8))

    @Test func marksAndUnmarksAsTheComputerDoes() throws {
        let marked = try #require(FinancePlanEdit.settingWaiting("payment:rent:2026-11-01", waiting: true, current: ["pay:p1:2026-11-01"], in: plan))
        #expect(marked["waiting"] == .array([.string("pay:p1:2026-11-01"), .string("payment:rent:2026-11-01")]))
        #expect(marked["notYet"] == nil)          // folded into waiting, as on the computer
        #expect(marked["rev"] == .string("r3"))

        let unmarked = try #require(FinancePlanEdit.settingWaiting("pay:p1:2026-11-01", waiting: false, current: ["pay:p1:2026-11-01"], in: plan))
        #expect(unmarked["waiting"] == nil)       // none left: omitted
    }

    @Test func keysMustHaveTheComputersShape() {
        #expect(FinancePast.isValidKey("pay:p1:2026-11-01"))
        #expect(FinancePast.isValidKey("payment:rent:2026-11-01"))
        #expect(!FinancePast.isValidKey("pay::2026-11-01"))
        #expect(!FinancePast.isValidKey("evil:x:2026-11-01"))
        #expect(!FinancePast.isValidKey("pay:p1:yesterday"))
        #expect(FinancePlanEdit.settingWaiting("nope", waiting: true, current: [], in: plan) == nil)
    }

    @Test func decodesSince() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"plan":{"people":[],"accounts":[],"payments":[],"cushion":0},"periods":[],
         "since":[{"key":"pay:p1:2026-11-01","date":"2026-11-01","person":"p1","amount":3000,"in":true,"typed":true},
                  {"key":"payment:rent:2026-11-01","date":"2026-11-01","payment":"rent","amount":1200,"waiting":true}]}
        """#.utf8))
        #expect(view.since.count == 2)
        #expect(view.since[0].moneyIn && view.since[0].typed)
        #expect(view.waitingKeys == ["payment:rent:2026-11-01"])
    }
}

@Suite("Changing a goal")
struct GoalEditTests {
    private let plan = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"r4","goals":[{"id":"g1","name":"Holiday","target":2000,"date":"2027-06-01","shares":[{"account":"sav","percent":50}]}],"accounts":[]}
    """#.utf8))

    @Test func setsOnlyTheTarget() throws {
        let edited = try #require(FinancePlanEdit.settingGoal(id: "g1", target: 2500.499, in: plan))
        guard case .array(let goals)? = edited["goals"] else { Issue.record("no goals"); return }
        #expect(goals[0]["target"] == .number(2500.5))
        #expect(goals[0]["date"] == .string("2027-06-01"))
        #expect(goals[0]["shares"] == .array([.object(["account": .string("sav"), "percent": .number(50)])]))
        #expect(edited["rev"] == .string("r4"))
    }

    @Test func refusesNothingAndUnknown() {
        #expect(FinancePlanEdit.settingGoal(id: "g1", target: 0, in: plan) == nil)
        #expect(FinancePlanEdit.settingGoal(id: "nope", target: 10, in: plan) == nil)
        #expect(FinancePlanEdit.settingGoal(id: "", target: 10, in: plan) == nil)
        #expect(FinancePlanEdit.settingGoal(id: "g1", target: .nan, in: plan) == nil)
    }
}
