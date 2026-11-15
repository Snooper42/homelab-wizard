import Foundation

/// The household's Finances worked out on this phone while the Homelab
/// doesn't answer (the owner, Nov 14: "build it out", apple-loop.md section 3,
/// offline Finances 1 of 3). From the plan and ledger kept for offline
/// (`OfflineFinances`), read forward from today with the computer's own code
/// (`FinanceProjection`), as a member's private Finances are: so what's due,
/// what's left and each pay period are today's, not the day they were kept.
enum HouseholdOffline {
    /// The kept plan read forward from `today` (YYYY-MM-DD), as the computer
    /// would have answered `Finances`: the plan's `rev` kept, so a change made
    /// from it is checked against the computer's newest. Nil in a build
    /// without the computer's Finances code; it throws on a plan that isn't one.
    static func project(rawPlan: JSONValue, rawLedger: JSONValue?, today: String, readOnly: Bool) throws -> FinancesRead? {
        let encoder = JSONEncoder()
        var plan = rawPlan
        var rev: JSONValue?
        if case .object(var o) = plan {
            rev = o.removeValue(forKey: "rev")
            plan = .object(o)
        }
        var ledger = rawLedger ?? .object([:])
        if case .object(var o) = ledger {
            o.removeValue(forKey: "rev")
            ledger = .object(o)
        }
        guard let view = try FinanceProjection.project(plan: encoder.encode(plan), ledger: encoder.encode(ledger), today: today) else {
            return nil
        }
        guard case .object(var v) = try JSONDecoder().decode(JSONValue.self, from: view),
              case .object(var p)? = v["plan"]
        else { throw FinanceProjection.Failed(message: "Finances couldn’t be read forward") }
        if let rev { p["rev"] = rev }
        v["plan"] = .object(p)
        v["readOnly"] = .bool(readOnly)
        return try APIClient.financesRead(from: encoder.encode(JSONValue.object(["result": .object(v)])))
    }
}
