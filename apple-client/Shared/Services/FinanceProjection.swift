#if canImport(HomelabFinance)
import HomelabFinance
#endif
import Foundation

/// Finances read forward on this phone with the computer's own code
/// (mobile/finance, built with gomobile as HomelabFinance.xcframework), for
/// the Finances only this phone can open: a household member's private ones
/// (private-finances.md 3.2), and the owner's kept for offline (2F). Never a
/// second copy of the model: what the computer would have shown, from the
/// plan's and the ledger's JSON and today's date on this phone.
enum FinanceProjection {
    /// Whether this build has the computer's Finances code in it
    /// (`make phone-finance-framework` before building).
    #if canImport(HomelabFinance)
    static let available = true
    #else
    static let available = false
    #endif

    struct Failed: Error, LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    /// The finance.View's JSON for the plan and ledger read forward from
    /// today (YYYY-MM-DD, as this phone reads the day), or nil in a build
    /// without the framework.
    static func project(plan: Data, ledger: Data, today: String) throws -> Data? {
        #if canImport(HomelabFinance)
        var error: NSError?
        let out = FinanceProject(plan, ledger, today, &error)
        if let error { throw Failed(message: error.localizedDescription) }
        guard let out else { throw Failed(message: "Finances couldn’t be read forward") }
        return out
        #else
        return nil
        #endif
    }

    /// One of Finances' reminders, as the computer's nightly job sends them (finance.Reminder).
    struct Reminder: Decodable, Equatable, Sendable {
        let kind: String
        let title: String
        let body: String
    }

    /// What Finances would tell her on day (YYYY-MM-DD): the computer's own
    /// reminders (mobile/finance.Reminders), or nil in a build without the framework.
    static func reminders(plan: Data, ledger: Data, day: String) throws -> [Reminder]? {
        #if canImport(HomelabFinance)
        var error: NSError?
        let out = FinanceReminders(plan, ledger, day, &error)
        if let error { throw Failed(message: error.localizedDescription) }
        guard let out else { throw Failed(message: "Finances’ reminders couldn’t be read") }
        return try JSONDecoder().decode([Reminder].self, from: out)
        #else
        return nil
        #endif
    }
}
