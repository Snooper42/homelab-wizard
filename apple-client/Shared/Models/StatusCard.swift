import Foundation

/// One card beside Status (`board.Card` in internal/board/board.go).
///
/// The phone can read `watchdog`, `savings`, `protection` and `alerts`.
/// A card it can't read comes back with `error` set. `NotHere` means the
/// phone doesn't show it. Other errors say why it couldn't be read: for
/// example, alerts before their read token is set up.
struct StatusCard: Decodable, Sendable, Identifiable, Equatable {
    /// The cards the companion reads for a phone, in the order the screens show them.
    static let phoneCards = ["watchdog", "protection", "alerts", "savings"]
    /// `board.NotHere`.
    static let notHere = "not read here"

    /// The caller's request number, so a card from an older request can be dropped.
    let board: Int
    let name: String
    let data: CardData?
    /// Cleaned up for display.
    let error: String?

    var id: String { name }
    var isNotHere: Bool { error == Self.notHere }

    enum CodingKeys: String, CodingKey { case board, name, data, error }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let name = try c.decode(String.self, forKey: .name)
        var message = APIError.sanitize(try c.decodeIfPresent(String.self, forKey: .error))

        var data: CardData?
        if message == nil {
            // A card whose data doesn't decode becomes an error on that card only.
            do {
                data = try Self.decodeData(named: name, from: c)
            } catch {
                Log.network.error("Card \(name, privacy: .private) couldn't be decoded")
            }
            if data == nil { message = "This card couldn't be read." }
        }
        self.board = try c.decodeIfPresent(Int.self, forKey: .board) ?? 0
        self.name = name
        self.data = data
        self.error = message
    }

    init(board: Int, name: String, data: CardData?, error: String?) {
        self.board = board
        self.name = name
        self.data = data
        self.error = error
    }

    private static func decodeData(named name: String, from c: KeyedDecodingContainer<CodingKeys>) throws -> CardData? {
        switch name {
        case "watchdog":
            return try c.decodeIfPresent(WatchdogSummary.self, forKey: .data).map(CardData.watchdog)
        case "savings":
            // Go writes a nil slice as null: no history yet.
            return .savings(try c.decodeIfPresent([SavingsPoint].self, forKey: .data) ?? [])
        case "protection":
            return try c.decodeIfPresent(Protection.self, forKey: .data).map(CardData.protection)
        case "alerts":
            return .alerts(try c.decodeIfPresent([AlertEvent].self, forKey: .data) ?? [])
        default:
            return .other(try c.decodeIfPresent(JSONValue.self, forKey: .data) ?? .null)
        }
    }
}

/// One line of the `StatusBoard` call's ndjson answer.
enum StatusBoardUpdate: Sendable {
    case status(HomelabStatus)
    case card(StatusCard)
}
