import Foundation
import Testing
@testable import HomelabClient

// A loan's page in the Homelab app, as on the computer (Loan.tsx): the
// payments linked to the loan, the same payee's next one offered, one over
// the plan's payment found, and Link, Not This One and Count It as edits of
// the ledger that keep everything else.

private func decode<T: Decodable>(_ json: String) throws -> T {
    try JSONDecoder().decode(T.self, from: Data(json.utf8))
}

struct LoanLinksTests {
    private let plan = #"""
    {"people":[],"accounts":[{"id":"chk","name":"Checking","kind":"checking"},{"id":"mortgage","name":"Mortgage","kind":"loan"}],
     "payments":[{"id":"mortgagepay","name":"Mortgage","amount":1845,"to":"mortgage"},{"id":"phones","name":"Phones","amount":95}]}
    """#
    private let ledger = #"""
    {"transactions":[
      {"id":"z1","date":"2026-10-01","account":"chk","amount":-1845,"payee":"Zelle to Sam","payment":"mortgagepay"},
      {"id":"z2","date":"2026-09-01","account":"chk","amount":-1945,"payee":"Zelle to Sam","payment":"mortgagepay"},
      {"id":"z3","date":"2026-10-29","account":"chk","amount":-1845,"payee":"Zelle to Sam"},
      {"id":"z4","date":"2026-10-30","account":"chk","amount":-1845,"payee":"Zelle to Sam","notPlanned":true},
      {"id":"t1","date":"2026-10-22","account":"chk","amount":-95,"payee":"Phone Co","payment":"phones"}
    ]}
    """#

    @Test func theLinkedTheOfferedAndTheOneOver() throws {
        let p: FinancePlan = try decode(plan)
        let l: FinanceLedger = try decode(ledger)
        let links = LoanLinks(loan: "mortgage", plan: p, transactions: l.transactions)
        #expect(links.payments.map(\.id) == ["mortgagepay"])
        #expect(links.linked.map(\.id) == ["z1", "z2"])
        // Not linked, from the same payee: offered; the one said not to be isn't.
        #expect(links.offers.map(\.id) == ["z3"])
        #expect(links.over(links.linked[1]) == 100)
        #expect(links.over(links.linked[0]) == 0)
        #expect(links.linkTo == "mortgagepay")
        let none = LoanLinks(loan: "chk", plan: p, transactions: l.transactions)
        #expect(none.payments.isEmpty && none.offers.isEmpty && none.linkTo == nil)
    }

    @Test func linkNotThisOneAndCountItEditTheLedger() throws {
        let raw: JSONValue = try decode(ledger)
        let linked = try #require(LedgerEdit.settingLink(id: "z3", payment: "mortgagepay", in: raw))
        let z3 = linked["transactions"].flatMap { v -> JSONValue? in
            guard case .array(let all) = v else { return nil }
            return all.first { $0["id"] == .string("z3") }
        }
        #expect(z3?["payment"] == .string("mortgagepay") && z3?["notPlanned"] == nil && z3?["extra"] == nil && z3?["payee"] == .string("Zelle to Sam"))
        let counted = try #require(LedgerEdit.settingLink(id: "z2", payment: "mortgagepay", extra: true, in: raw))
        let z2: FinanceLedger = try JSONDecoder().decode(FinanceLedger.self, from: JSONEncoder().encode(counted))
        #expect(z2.transactions.first { $0.id == "z2" }?.extra == true)
        let off = try #require(LedgerEdit.settingLink(id: "z1", payment: nil, extra: true, in: raw))
        let z1: FinanceLedger = try JSONDecoder().decode(FinanceLedger.self, from: JSONEncoder().encode(off))
        let t = try #require(z1.transactions.first { $0.id == "z1" })
        #expect(t.payment == nil && t.notPlanned && !t.extra)
        #expect(LedgerEdit.settingLink(id: "nope", payment: nil, in: raw) == nil)
    }
}
