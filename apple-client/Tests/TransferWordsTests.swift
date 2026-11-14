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
}
