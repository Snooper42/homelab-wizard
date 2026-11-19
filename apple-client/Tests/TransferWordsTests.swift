import Testing
@testable import HomelabClient

/// A transfer's line in Transactions names the end the payee doesn't.
@Suite struct TransferWordsTests {
    @Test func thePayeeNamesWhereItWentSoTheLineSaysWhereFrom() {
        #expect(TransferWords.line(payee: "Roth IRA", from: "Main Checking", to: "Roth IRA") == "From Main Checking")
        #expect(TransferWords.line(payee: "roth ira ", from: "Main Checking", to: "Roth IRA") == "From Main Checking")
    }

    @Test func thePayeeNamesWhereItCameFromSoTheLineSaysWhereTo() {
        #expect(TransferWords.line(payee: "Main Checking", from: "Main Checking", to: "Savings") == "To Savings")
    }

    @Test func aPayeeThatIsNeitherKeepsBothEnds() {
        #expect(TransferWords.line(payee: "Move to savings", from: "Main Checking", to: "Savings") == "Main Checking → Savings")
    }

    /// The dot stays with what's before it: "From Chase Checking" over "· Oct 27" (light-inbox, Nov 19).
    @Test func aRowsLineNeverStartsWithItsDot() {
        #expect(RowWords.line(["From Chase Checking", "Oct 27"]) == "From Chase Checking\u{00A0}· Oct 27")
        #expect(RowWords.line(["Groceries", nil, " ", "Oct 30"]) == "Groceries\u{00A0}· Oct 30")
        #expect(RowWords.line([nil, "Oct 30"]) == "Oct 30")
        #expect(RowWords.line([]) == "")
    }
}
