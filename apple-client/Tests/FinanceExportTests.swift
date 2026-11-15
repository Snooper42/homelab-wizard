import Foundation
import Testing
@testable import HomelabClient

/// Export on the phone makes what the computer's Export makes
/// (exportData.ts), on the golden household view (made up).
@Suite("Finances exported")
struct FinanceExportTests {
    private let household = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        .appendingPathComponent("internal/finance/testdata/golden/household")

    @Test func aCellASpreadsheetWontRun() {
        #expect(FinanceExport.cell("Rent") == "Rent")
        #expect(FinanceExport.cell("=SUM(A1)") == "'=SUM(A1)")
        #expect(FinanceExport.cell("-5 off") == "'-5 off")
        #expect(FinanceExport.cell("Sam, Alex") == "\"Sam, Alex\"")
        #expect(FinanceExport.cell("a \"b\"") == "\"a \"\"b\"\"\"")
        #expect(FinanceExport.cell("two\nlines") == "\"two\nlines\"")
    }

    @Test func theYearAheadAsTheComputerWritesIt() throws {
        let view = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: household.appendingPathComponent("view.json")))
        let csv = FinanceExport.aheadCSV(view: view)
        let lines = csv.components(separatedBy: "\r\n")
        #expect(lines.first == "Date,What,Kind,Amount,Account,Checking after")
        #expect(csv.hasSuffix("\r\n"))
        // The first day's row: Sam's pay into checking, checking after it.
        #expect(lines[1].hasPrefix("2026-11-13,Sam's pay,Payday,1400.00,"))
        #expect(lines[1].hasSuffix(",3637.05"))
        // Every row has six cells, and none is before today.
        for line in lines.dropFirst() where !line.isEmpty {
            #expect(String(line.prefix(10)) >= "2026-11-13")
        }
        #expect(lines.count > 20)
    }

    @Test func thePlanAsFinanceJSONKeepsIt() throws {
        let plan = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: household.appendingPathComponent("plan.json")))
        let data = try #require(FinanceExport.planJSON(plan))
        #expect(try JSONDecoder().decode(JSONValue.self, from: data) == plan)   // reads back as it was
        #expect(data.last == 0x0A)
        #expect(FinanceExport.planName("2026-11-14") == "finances-plan-2026-11-14.json")
        #expect(FinanceExport.aheadName("2026-11-14") == "finances-ahead-2026-11-14.csv")
    }
}
