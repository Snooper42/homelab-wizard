import Foundation

/// One card beside Status (`board.Card` in internal/board/board.go). The
/// phone can read `watchdog`, `savings`, `protection` and `alerts`. A card
/// it can't read comes back with `error` set.
struct StatusCard: Decodable, Sendable, Identifiable {
    /// The caller's request number, so a card from an older request can be dropped.
    let board: Int
    let name: String
    let data: JSONValue?
    let error: String?

    var id: String { name }
}

/// One line of the `StatusBoard` call's ndjson answer.
enum StatusBoardUpdate: Sendable {
    case status(HomelabStatus)
    case card(StatusCard)
}
