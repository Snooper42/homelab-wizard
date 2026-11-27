import Foundation

/// One buy or sale of a holding, as Ghostfolio keeps it (`ghostfolio.Trade`,
/// the `FinancesInvestmentTrades` call), for Change and Delete on the
/// holding's page.
struct InvestmentTrade: Codable, Sendable, Equatable, Identifiable {
    var id: String
    var account: String
    var symbol: String
    var dataSource: String
    var currency: String
    var shares: Double
    var total: Double
    var fee: Double?
    /// YYYY-MM-DD.
    var date: String
    var sold: Bool?

    var isSale: Bool { sold == true }
    var day: Date? { LocalDay.parse(date) }

    /// What's wrong with a change, as the computer would say it (`ChangeTrade`), before asking it; nil when it can be sent.
    func problem(now: Date = Date(), calendar: Calendar = .current) -> String? {
        if !(shares > 0) || !shares.isFinite { return "How many shares: more than 0." }
        if !(total >= 0) || !total.isFinite { return "What was paid: type it without a minus." }
        guard let day else { return "Pick the day it happened." }
        if calendar.startOfDay(for: day) > calendar.startOfDay(for: now) { return "The day is still to come: pick the day it happened." }
        return nil
    }

    /// The same, with what was changed: shares, what was paid, the day.
    func changed(shares: Double, total: Double, on day: Date, calendar: Calendar = .current) -> InvestmentTrade {
        var t = self
        t.shares = shares
        t.total = total
        t.date = FinancePlanEdit.todayString(day, calendar: calendar)
        return t
    }
}
