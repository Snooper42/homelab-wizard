import Foundation
import Testing
@testable import HomelabClient

/// What a bank's file's rows pay and are for, as the computer's Import
/// works it out (importData.ts's `plannedFor`, guessCategory.ts's
/// `guessFor`); each expected value is what the web's own functions give
/// for the same made-up rows.
@Suite("What an imported row pays and is for")
struct BankGuessTests {
    private let logos = PayeeLogos.shared
    private let payments = [
        BankGuess.Payment(id: "p1", name: "Electric", kind: "utilities", amount: 95),
        BankGuess.Payment(id: "p2", name: "Netflix", kind: "subscriptions", amount: 15.49),
        BankGuess.Payment(id: "p3", name: "Car payment", kind: "car", amount: 320.15),
        BankGuess.Payment(id: "p4", name: "Rent", kind: "home", amount: 1500, from: "chk"),
        BankGuess.Payment(id: "p5", name: "Gym", kind: "other", amount: 30),
        BankGuess.Payment(id: "p6", name: "Gym two", kind: "other", amount: 30),
    ]
    private let dues = ["p1": ["2026-10-10", "2026-11-10"], "p2": ["2026-10-03"], "p3": ["2026-10-15"], "p4": ["2026-10-01"],
                        "p5": ["2026-10-20"], "p6": ["2026-10-20"]]
    private let accounts = [
        BankGuess.Account(id: "chk", name: "Checking", kind: "checking"),
        BankGuess.Account(id: "sav", name: "Example Savings", kind: "savings"),
        BankGuess.Account(id: "amex", name: "Gold Card", kind: "card", institution: "americanexpress"),
        BankGuess.Account(id: "c2", name: "Example Card 1234", kind: "card"),
    ]
    private let categories = ["Groceries", "Eating out", "Electric", "Streaming and music", "Shopping", "Utilities", "Food"]
        .map { BankGuess.Category(name: $0) } + [BankGuess.Category(name: "Paycheck", income: true)]

    @Test func whatEachRowPlainlyPays() {
        let paid = [BankImport.Kept(id: "y", account: "chk", date: "2026-10-04", amount: -15.49, payee: "Netflix", payment: "p2")]
        let taken = BankGuess.paidDays(paid, dues: dues)
        #expect(taken == ["p2 2026-10-03"])
        // Sunset Palms paid the rent before: it pays it again.
        let learned = BankGuess.learnedLinks([BankImport.Kept(id: "x", account: "chk", date: "2026-09-01", amount: -1500,
                                                              payee: "Sunset Palms", payment: "p4")], logos: logos)
        let same = { (payee: String, x: BankGuess.Payment) in
            BankGuess.paysBill(payee, x, logos: logos) || learned[BankGuess.payeeKey(payee, logos: logos)]?.contains(x.id) == true
        }
        let rows: [(String, Double, String)] = [
            ("2026-10-09", -88.4, "Example Electric"),  // alike its name, within two fifths: a bill that changes
            ("2026-10-03", -15.49, "Netflix"),          // its one day paid already
            ("2026-10-14", -320.15, "Mazda"),           // a car's make pays the car payment
            ("2026-10-02", -1500, "Sunset Palms"),      // learned
            ("2026-10-21", -30, "Example Gym"),         // two gyms fit as well: no plain answer
            ("2026-10-09", -88.4, "Example Bakery"),    // nothing
        ]
        let got = rows.map { BankGuess.plannedFor(date: $0.0, amount: $0.1, payee: $0.2, account: "chk", payments: payments, dues: dues,
                                                  checking: "chk", taken: taken, same: same) }
        #expect(got == [BankGuess.Planned(payment: "p1", due: "2026-10-10"), nil, BankGuess.Planned(payment: "p3", due: "2026-10-15"),
                        BankGuess.Planned(payment: "p4", due: "2026-10-01"), nil, nil])
    }

    @Test func theHouseholdsOwnAccounts() {
        #expect(BankGuess.ownAccount("Example Savings", into: "chk", accounts: accounts, raw: nil, logos: logos) == "sav")
        #expect(BankGuess.ownAccount("Payment to Example card \u{2022}\u{2022}1234", into: "chk", accounts: accounts, raw: nil, logos: logos) == "c2")
        #expect(BankGuess.ownAccount("American Express", into: "chk", accounts: accounts, raw: "AMERICAN EXPRESS ACH PMT", logos: logos) == "amex")
        #expect(BankGuess.ownAccount("Netflix", into: "chk", accounts: accounts, raw: nil, logos: logos) == nil)
    }

    @Test func whatEachRowIsFor() {
        func guess(_ payee: String, _ amount: Double, kind: String? = nil, last: String? = nil, pays: BankGuess.Payment? = nil) -> BankGuess.Guess {
            BankGuess.guessFor(payee: payee, amount: amount, raw: nil, kind: kind, into: "chk", accounts: accounts, categories: categories,
                               last: last, pays: pays, logos: logos)
        }
        #expect(guess("Costco", -80) == BankGuess.Guess(category: "Groceries"))
        #expect(guess("Example Payroll", 1400) == BankGuess.Guess(category: "Paycheck"))
        #expect(guess("Example Bakery", -12, kind: "Restaurant-Restaurant") == BankGuess.Guess(category: "Eating out"))
        #expect(guess("Example Bakery", -12, last: "Food") == BankGuess.Guess(category: "Food"))
        #expect(guess("Example Power", -90, pays: payments[0]) == BankGuess.Guess(category: "Electric"))
        #expect(guess("Example Savings", -200) == BankGuess.Guess(account: "sav"))
        #expect(guess("Netflix", -15.49) == BankGuess.Guess(category: "Streaming and music"))
    }

    @Test func aBanksOwnWords() {
        #expect(BankGuess.bankKinds("Merchandise & Supplies-Groceries") == ["groceries", "Groceries", "merchandise & supplies", "Shopping"])
        #expect(BankGuess.bankKinds("Food & Drink") == ["food & drink", "Eating out"])
        #expect(BankGuess.bankKinds("Other").isEmpty)
    }

    @Test func broughtInPayingItAndMovingMoney() throws {
        let plan: JSONValue = .object([
            "accounts": .array([.object(["id": .string("chk"), "name": .string("Checking"), "kind": .string("checking")]),
                                .object(["id": .string("sav"), "name": .string("Example Savings"), "kind": .string("savings")])]),
            "payments": .array([.object(["id": .string("p1"), "name": .string("Electric"), "kind": .string("utilities"), "amount": .number(95)])]),
        ])
        let view: JSONValue = .object(["dues": .object(["p1": .array([.string("2026-10-10")])]),
                                       "categories": .array([.object(["name": .string("Electric")])])])
        let found = [
            BankImport.Found(index: 0, date: "2026-10-09", amount: -91.2, payee: "Example Electric", raw: nil, memo: nil, bank: "E1",
                             category: nil, state: .comesIn),
            BankImport.Found(index: 1, date: "2026-10-11", amount: 200, payee: "Example Savings", raw: nil, memo: nil, bank: "S1",
                             category: nil, state: .comesIn),
        ]
        let guessed = BankImport.guessing(found, account: "chk", ledger: [], plan: plan, view: view, checking: "chk", logos: logos)
        #expect(guessed[0].link == "p1" && guessed[0].guess.category == "Electric")
        #expect(guessed[1].guess.account == "sav")
        // Taken off by hand, it pays nothing.
        #expect(BankImport.guessing(found, account: "chk", ledger: [], plan: plan, view: view, checking: "chk", picked: [0: ""],
                                    logos: logos)[0].link == nil)

        let ts = BankImport.transactions(guessed, account: "chk")
        var ledger: JSONValue = .object(["transactions": .array([])])
        for t in ts { ledger = try #require(LedgerEdit.appending(t, accounts: ["chk", "sav"], to: ledger)) }
        guard case .array(let all)? = ledger["transactions"] else { Issue.record("no transactions"); return }
        #expect(all[0]["payment"] == .string("p1") && all[0]["category"] == .string("Electric") && all[0]["bank"] == .string("E1"))
        // Money in from savings: its leaving half, out of savings into checking, the bank's ID on the arriving half.
        #expect(all[1]["account"] == .string("sav") && all[1]["to"] == .string("chk") && all[1]["amount"] == .number(-200))
        #expect(all[1]["toBank"] == .string("S1") && all[1]["bank"] == nil && all[1]["category"] == nil)
        // Read again, both are in.
        let again = BankImport.found([BankFile.Row(date: "2026-10-09", amount: -91.2, payee: "Example Electric", id: "E1"),
                                      BankFile.Row(date: "2026-10-11", amount: 200, payee: "Example Savings", id: "S1")],
                                     account: "chk", ledger: BankImport.kept(in: ledger), rules: []) { raw, _ in raw }
        #expect(again.map(\.state) == [.alreadyIn, .alreadyIn])
    }
}

/// Rows brought in before, fixed by a file read again (importData.ts's
/// `wayOnlyFixes`, `renameFixes`, and the Import form's recategorized), with
/// the web's own answers for the same made-up rows.
@Suite("Rows brought in before")
struct BankFixTests {
    private let ledger: JSONValue = .object(["transactions": .array([
        .object(["id": .string("x"), "account": .string("chk"), "date": .string("2026-09-01"), "amount": .number(-9),
                 "payee": .string("Example Bakery"), "category": .string("Food"), "institution": .string("none")]),
        .object(["id": .string("w1"), "account": .string("chk"), "date": .string("2026-10-04"), "amount": .number(-12.5),
                 "payee": .string("DEBIT")]),
        .object(["id": .string("r1"), "account": .string("chk"), "date": .string("2026-10-06"), "amount": .number(-250),
                 "payee": .string("Royal Caribbean Ad_payment Ppd Id"), "note": .string("ROYAL CARIBBEAN AD_PAYMENT PPD ID: 99")]),
        .object(["id": .string("c1"), "account": .string("chk"), "date": .string("2026-10-07"), "amount": .number(-80),
                 "payee": .string("Costco")]),
    ])])
    private let plan: JSONValue = .object(["accounts": .array([.object(["id": .string("chk"), "name": .string("Checking"), "kind": .string("checking")])])])
    private let view: JSONValue = .object(["categories": .array(["Groceries", "Travel", "Food"].map { .object(["name": .string($0)]) })])
    private let rows = [
        BankFile.Row(date: "2026-10-04", amount: -12.5, payee: "EXAMPLE BAKERY"),
        BankFile.Row(date: "2026-10-06", amount: -250, payee: "ROYAL CARIBBEAN AD_PAYMENT PPD ID: 99"),
        BankFile.Row(date: "2026-10-07", amount: -80, payee: "COSTCO"),
    ]

    @Test func eachMatchedToWhatItWas() throws {
        let logos = PayeeLogos.shared
        let kept = BankImport.kept(in: ledger)
        let found = BankImport.found(rows, account: "chk", ledger: kept, rules: []) { logos.cleanPayee(logos.withoutTown($0, town: $1)) }
        #expect(found.map(\.state) == [.fixes("w1"), .renames("r1"), .alreadyIn])
        #expect(found[1].payee == "Royal Caribbean")
        let recat = BankImport.recategorized(found, account: "chk", ledger: kept, plan: plan, view: view, logos: logos)
        #expect(recat == ["c1": "Groceries"])
        let fixes = BankImport.fixes(found, recategorized: recat, ledger: kept)
        #expect(fixes.map(\.id) == ["w1", "r1", "c1"])
        #expect(fixes[0].fix == LedgerFix(payee: "Example Bakery", category: "Food", institution: "none"))

        var fixed = ledger
        for (id, fix) in fixes { fixed = try #require(LedgerEdit.fixing(id: id, with: fix, in: fixed)) }
        guard case .array(let all)? = fixed["transactions"] else { Issue.record("no transactions"); return }
        #expect(all[1]["payee"] == .string("Example Bakery") && all[1]["category"] == .string("Food"))
        #expect(all[2]["payee"] == .string("Royal Caribbean") && all[2]["note"] == .string("ROYAL CARIBBEAN AD_PAYMENT PPD ID: 99"))
        #expect(all[3]["payee"] == .string("Costco") && all[3]["category"] == .string("Groceries"))
        // A category it has is kept.
        let kept2 = try #require(LedgerEdit.fixing(id: "x", with: LedgerFix(category: "Groceries"), in: ledger))
        guard case .array(let all2)? = kept2["transactions"] else { return }
        #expect(all2[0]["category"] == .string("Food"))
        // Read again, nothing is left to fix.
        let again = BankImport.found(rows, account: "chk", ledger: BankImport.kept(in: fixed), rules: []) {
            logos.cleanPayee(logos.withoutTown($0, town: $1))
        }
        #expect(again.map(\.state) == [.alreadyIn, .alreadyIn, .alreadyIn])
    }
}
