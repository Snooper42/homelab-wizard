import Foundation
import Testing
@testable import HomelabClient

/// A bank's file read on the phone as the computer's Import reads it
/// (importData.ts); each expected value is what the web's own functions
/// give for the same text. Every name and amount is made up.
@Suite("A bank's file")
struct BankFileTests {
    @Test func aCSVsCells() {
        #expect(BankFile.csvRows("Date;Payee;Amount\r\n2026-10-03;\"Example \"\"Big\"\" Bakery\";-12,50\r\n\r\n2026-10-04;Shop;3\n")
                == [["Date", "Payee", "Amount"], ["2026-10-03", "Example \"Big\" Bakery", "-12,50"], ["2026-10-04", "Shop", "3"]])
        #expect(BankFile.csvRows("a,b\n\"x,\ny\",2") == [["a", "b"], ["x,\ny", "2"]])
    }

    @Test func columnsGuessed() {
        // Chase: Details is only CREDIT or DEBIT, so the payee is Description.
        let chase = [["Details", "Posting Date", "Description", "Amount", "Type", "Balance", "Check or Slip #"],
                     ["DEBIT", "10/03/2026", "NETFLIX.COM", "-15.49", "ACH_DEBIT", "100.00", ""],
                     ["CREDIT", "10/05/2026", "EXAMPLE PAYROLL PPD ID: 123", "1400.00", "ACH_CREDIT", "1500.00", ""]]
        #expect(BankFile.guessColumns(chase[0], body: Array(chase.dropFirst()))
                == BankFile.Columns(date: 1, amount: 3, debit: -1, credit: -1, payee: 2, memo: -1))
        #expect(BankFile.guessColumns(["Date", "Description", "Debit", "Credit", "Memo"])
                == BankFile.Columns(date: 0, amount: -1, debit: 2, credit: 3, payee: 1, memo: 4))
    }

    @Test func daysAsBanksWriteThem() {
        #expect(["2026-10-30", "10/30/2026", "30.10.2026", "Oct 30 2026", "10/30/26", "2026/1/5", "nope"].map { BankFile.readDay($0) }
                == ["2026-10-30", "2026-10-30", "2026-10-30", "2026-10-30", "2026-10-30", "2026-01-05", ""])
        #expect(BankFile.readDay("05/10/2026", dayFirst: true) == "2026-10-05")
        #expect(BankFile.daysFirst(["30/10/2026"]) && !BankFile.daysFirst(["10/30/2026"]))
    }

    @Test func amountsWhateverTheLanguage() {
        #expect(["$1,234.56", "1.234,56", "\u{2212}12.50", "1,000", "-0.5", "abc", "12"].map(BankFile.amount)
                == [1234.56, 1234.56, -12.5, 1000, -0.5, nil, 12])
    }

    @Test func aCSVsRowsWithTwoMoneyColumns() {
        let rows = [["Date", "Description", "Debit", "Credit"], ["30/10/2026", "Example Grocer", "45.10", ""],
                    ["31/10/2026", "Refund", "", "(3.00)"], ["01/11/2026", "Nothing", "", ""]]
        #expect(BankFile.fromCSV(rows, BankFile.guessColumns(rows[0], body: Array(rows.dropFirst())))
                == [BankFile.Row(date: "2026-10-30", amount: -45.1, payee: "Example Grocer"),
                    BankFile.Row(date: "2026-10-31", amount: -3, payee: "Refund")])
    }

    @Test func anOFXStatement() {
        let ofx = "OFXHEADER:100\n<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261003120000<TRNAMT>-15.49<FITID>A1<NAME>NETFLIX.COM<MEMO>Recurring</STMTTRN><stmttrn><DTPOSTED>20261005<TRNAMT>+1400.00<FITID>A2<MEMO>EXAMPLE   PAYROLL</stmttrn><STMTTRN><DTPOSTED>bad<TRNAMT>1</STMTTRN></BANKTRANLIST></OFX>"
        #expect(BankFile.isOFX(ofx) && !BankFile.isOFX("Date,Amount"))
        #expect(BankFile.fromOFX(ofx) == [
            BankFile.Row(date: "2026-10-03", amount: -15.49, payee: "NETFLIX.COM", memo: "Recurring", id: "A1"),
            BankFile.Row(date: "2026-10-05", amount: 1400, payee: "EXAMPLE PAYROLL", id: "A2"),
        ])
    }

    @Test func payeesAlikeAndCardFiles() {
        #expect(BankFile.alike("Trader Joe's", "TRADER JOE'S STORE 552"))
        #expect(!BankFile.alike("Netflix", "Hulu"))
        #expect(BankFile.alike("Roth IRA", "TRANSFER TO ROTH"))
        let plus = [1.0, 2, -1].map { BankFile.Row(date: "", amount: $0, payee: "") }
        #expect(BankFile.chargesPlus(plus) && !BankFile.chargesPlus(Array(plus.prefix(2))))
    }

    @Test func aTownTakenOffAsTheComputerDoes() {
        let logos = PayeeLogos.shared
        #expect(logos.withoutTown("BLUE BOTTLE COFFEE  OAKLAND  CA", town: "OAKLAND CA") == "BLUE BOTTLE COFFEE")
        #expect(logos.withoutTown("EXAMPLE SHOP SAN JOSE", town: "SAN JOSE CA") == "EXAMPLE SHOP")
        #expect(logos.withoutTown("EXAMPLE SHOP", town: "OAKLAND CA") == "EXAMPLE SHOP")
    }
}

@Suite("What a bank's file brings in")
struct BankImportTests {
    private let ledger: JSONValue = .object(["transactions": .array([
        .object(["id": .string("t1"), "account": .string("chk"), "date": .string("2026-10-03"), "amount": .number(-15.49),
                 "payee": .string("Netflix"), "category": .string("Entertainment"), "bank": .string("A1")]),
        .object(["id": .string("t2"), "account": .string("chk"), "date": .string("2026-10-04"), "amount": .number(-12.5),
                 "payee": .string("DEBIT")]),
        .object(["id": .string("t3"), "account": .string("chk"), "date": .string("2026-09-20"), "amount": .number(-30),
                 "payee": .string("Example Bakery"), "category": .string("Food")]),
    ])])
    private let plan: JSONValue = .object(["rules": .array([
        .object(["match": .string("Example Payroll"), "payee": .string("Sam's pay"), "category": .string("Paycheck")]),
    ])])
    private let rows = [
        BankFile.Row(date: "2026-10-03", amount: -15.49, payee: "NETFLIX.COM", id: "A1"),
        BankFile.Row(date: "2026-10-04", amount: -12.5, payee: "EXAMPLE BAKERY"),
        BankFile.Row(date: "2026-10-06", amount: -8, payee: "EXAMPLE BAKERY"),
        BankFile.Row(date: "2026-10-05", amount: 1400, payee: "EXAMPLE PAYROLL PPD ID: 123"),
        BankFile.Row(date: "2026-10-07", amount: -5, payee: ""),
    ]

    private func found() -> [BankImport.Found] {
        let logos = PayeeLogos.shared
        return BankImport.found(rows, account: "chk", ledger: BankImport.kept(in: ledger), rules: BankImport.rules(in: plan)) {
            logos.cleanPayee(logos.withoutTown($0, town: $1))
        }
    }

    @Test func theOnesInAlreadyAreSkipped() {
        let f = found()
        // The second was brought in before as DEBIT: it gives that row its payee rather than coming in again.
        #expect(f.map(\.state) == [.alreadyIn, .fixes("t2"), .comesIn, .comesIn, .noPayee])
    }

    @Test func eachPayeeAsAPersonWritesIt() {
        let f = found()
        // The payee's last category; the same words in other capitals aren't kept.
        #expect(f[2].payee == "Example Bakery" && f[2].category == "Food" && f[2].raw == nil)
        // A rule for its name: the rule's name and category, the bank's words in the note.
        #expect(f[3].payee == "Sam's pay" && f[3].category == "Paycheck")
        #expect(f[3].note == "EXAMPLE PAYROLL PPD ID: 123")
    }

    @Test func broughtInAsTheComputerKeepsThem() throws {
        let ts = BankImport.transactions(found(), account: "chk")
        #expect(ts.map(\.payee) == ["Example Bakery", "Sam's pay"])
        #expect(ts.map(\.isMoneyIn) == [false, true])
        let withID = BankImport.transactions([BankImport.Found(index: 0, date: "2026-10-08", amount: -9.99, payee: "Example Music",
                                                               raw: nil, memo: nil, bank: "B7", category: nil, state: .comesIn)], account: "chk")
        let saved = try #require(LedgerEdit.appending(withID[0], accounts: ["chk"], to: ledger))
        guard case .array(let all)? = saved["transactions"] else { Issue.record("no transactions"); return }
        #expect(all.last?["bank"] == .string("B7"))
        #expect(all.last?["date"] == .string("2026-10-08"))
        #expect(all.last?["amount"] == .number(-9.99))
        // Read again, the same file's row is in.
        let again = BankImport.found([BankFile.Row(date: "2026-10-08", amount: -9.99, payee: "EXAMPLE MUSIC", id: "B7")], account: "chk",
                                     ledger: BankImport.kept(in: saved), rules: []) { raw, _ in raw }
        #expect(again.first?.state == .alreadyIn)
    }

    @Test func aRenamedPayeeIsRemembered() {
        // "SQ *BLUE BOTTLE 1234" came in as Blue Bottle and was renamed by hand.
        let kept = [BankImport.Kept(id: "h", account: "chk", date: "2026-09-01", amount: -4.5, payee: "Morning Coffee",
                                    note: "SQ *BLUE BOTTLE 1234")]
        let memory = BankImport.renameMemory(kept) { PayeeLogos.shared.cleanPayee($0) }
        #expect(memory["blue bottle"] == "Morning Coffee")
        #expect(BankImport.wordingOf("Coffee (SQ *BLUE BOTTLE 1234)") == "SQ *BLUE BOTTLE 1234")
    }

    @Test func rulesByNameThenTheLongestStart() {
        let rules = [BankImport.Rule(match: "Example", prefix: true, category: "A"),
                     BankImport.Rule(match: "Example Shop", prefix: true, category: "B"),
                     BankImport.Rule(match: "example shop west", category: "C")]
        #expect(BankImport.ruleFor(rules, "Example Shop West")?.category == "C")
        #expect(BankImport.ruleFor(rules, "Example Shop East")?.category == "B")
        #expect(BankImport.ruleFor(rules, "Example Cafe")?.category == "A")
        #expect(BankImport.ruleFor(rules, "Other") == nil)
    }
}
