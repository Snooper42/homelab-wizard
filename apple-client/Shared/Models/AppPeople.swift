import Foundation

/// Who uses an app (`AppPeople`, the owner's yes, Nov 20, on the canvas's
/// *Idea: Who uses it*): the household members who sign in to it, as the
/// computer's app page shows them, by name only; never an email or a sign-in.
struct AppPeople: Decodable, Sendable, Equatable {
    struct Person: Decodable, Sendable, Equatable {
        let name: String
        /// Its first letter, for the round initial ("A"); "?" for none.
        var initial: String { name.trimmingCharacters(in: .whitespaces).first.map { String($0).uppercased() } ?? "?" }
    }

    /// People sign in to it; false for a helper, the network's or the system's: no section.
    let household: Bool
    let people: [Person]

    enum CodingKeys: String, CodingKey { case household, people }

    init(household: Bool, people: [Person]) {
        self.household = household
        self.people = people
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        household = try c.decodeIfPresent(Bool.self, forKey: .household) ?? false
        people = (try c.decodeIfPresent([Person].self, forKey: .people) ?? []).filter { !$0.name.isEmpty }
    }
}
