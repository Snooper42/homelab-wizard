import Foundation

/// The payments linked to a loan, as the computer's loan page has them
/// (web/src/finances/Loan.tsx): the plan's payments into it; the
/// transactions that pay one of them; the same payee's next ones, offered
/// to link; and how much one paid over its planned payment.
struct LoanLinks: Sendable, Equatable {
    /// The plan's payments that go into the loan (not a card's payoff).
    let payments: [FinancePayment]
    /// The transactions that pay one of them, newest first.
    let linked: [FinanceTransaction]
    /// Money out linked to nothing, not said to pay nothing, not a transfer,
    /// from the same payee as one linked: newest first, at most six.
    let offers: [FinanceTransaction]

    init(loan id: String, plan: FinancePlan, transactions: [FinanceTransaction]) {
        payments = plan.payments.filter { $0.to == id && $0.card == nil }
        let ids = Set(payments.map(\.id))
        let newest = transactions.sorted { ($0.date ?? .distantPast) > ($1.date ?? .distantPast) }
        linked = newest.filter { t in t.payment.map { ids.contains($0) } ?? false }
        let payees = Set(linked.map(\.payee).filter { !$0.isEmpty })
        offers = payments.isEmpty ? [] : Array(newest.filter { t in
            t.payment == nil && !t.notPlanned && t.to == nil && t.amount < 0 && payees.contains { PayeeLogos.alike($0, t.payee) }
        }.prefix(6))
    }

    /// What `t` paid over its planned payment, to the cent; 0 when it didn't.
    func over(_ t: FinanceTransaction) -> Double {
        guard let x = payments.first(where: { $0.id == t.payment }), let amount = x.amount else { return 0 }
        return max(0, ((abs(t.amount) - amount) * 100).rounded() / 100)
    }

    /// The plan's payment a link goes to: its first.
    var linkTo: String? { payments.first?.id }
}
