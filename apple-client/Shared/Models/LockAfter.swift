import Foundation

/// How long the iPhone or iPad app may be away (another app in front, the
/// Home Screen) before it locks and asks for Face ID again: Settings › This
/// iPhone › Lock After. The owner, Nov 14: "I don't want to keep having to use
/// my Face ID every single second." Within it, coming back shows the app as it
/// was left, amounts shown or hidden included. A change still asks for Face ID
/// after leaving, locking the screen locks the app (while it's still running
/// in the background), and a member's private Finances still lock on leaving.
enum LockAfter: Int, CaseIterable, Identifiable, Sendable {
    case rightAway = 0
    case oneMinute = 60
    case fiveMinutes = 300
    case fifteenMinutes = 900

    /// The owner's pick for the iPhone and iPad, Nov 14. The Mac keeps
    /// locking as it leaves the screen (it has no Lock After).
    #if os(macOS)
    static let standard: LockAfter = .rightAway
    #else
    static let standard: LockAfter = .fiveMinutes
    #endif
    static let defaultsKey = "lockAfter.v1"

    var id: Int { rawValue }
    var duration: Duration { .seconds(rawValue) }

    var label: String {
        switch self {
        case .rightAway: "Right Away"
        case .oneMinute: "After 1 Minute"
        case .fiveMinutes: "After 5 Minutes"
        case .fifteenMinutes: "After 15 Minutes"
        }
    }

    /// The setting's footnote.
    var words: String {
        switch self {
        case .rightAway: "The app locks as soon as it leaves the screen."
        default: "Back within \(label.dropFirst("After ".count).lowercased()), the app opens as you left it, without Face ID. Locking the screen locks it, and a change still asks for Face ID first."
        }
    }

    /// What's kept, or the standard one.
    static func read(_ defaults: UserDefaults) -> LockAfter {
        guard defaults.object(forKey: defaultsKey) != nil else { return standard }
        return LockAfter(rawValue: defaults.integer(forKey: defaultsKey)) ?? standard
    }
}
