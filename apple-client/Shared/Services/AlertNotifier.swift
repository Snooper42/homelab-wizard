import Foundation
import UserNotifications

/// Who notifies this phone of the homelab's alerts (Settings › Alerts From):
/// the ntfy app, as before, or this app. Kept on this device only, so a
/// partner's phone keeps its own choice.
enum AlertSource: String, CaseIterable, Identifiable, Sendable {
    case ntfy
    case thisApp

    var id: String { rawValue }

    var label: String {
        switch self {
        case .ntfy: "The ntfy App"
        case .thisApp: "This App"
        }
    }
}

/// What this phone has shown of the computer's kept alerts (AlertLog), and
/// who notifies it.
struct AlertNotifications {
    static let sourceKey = "alertSource"
    static let seenKey = "alertsSeenThrough"
    /// The most shown at once, the newest: a long time away isn't a flood.
    static let most = 5

    let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var source: AlertSource {
        get { AlertSource(rawValue: defaults.string(forKey: Self.sourceKey) ?? "") ?? .ntfy }
        nonmutating set {
            defaults.set(newValue.rawValue, forKey: Self.sourceKey)
            // Starting afresh: what's already kept isn't shown again.
            defaults.removeObject(forKey: Self.seenKey)
        }
    }

    /// The alerts to show now, oldest first, and remembers how far it has
    /// seen. None while the ntfy app notifies; none on the first look (it
    /// only notes where the list is); none when the computer's record began
    /// again (its ids lower than seen), which starts afresh.
    func toShow(_ alerts: [KeptAlert]) -> [KeptAlert] {
        guard source == .thisApp, let newest = alerts.map(\.id).max() else { return [] }
        let seen = (defaults.object(forKey: Self.seenKey) as? NSNumber)?.int64Value
        defaults.set(NSNumber(value: newest), forKey: Self.seenKey)
        guard let seen, newest >= seen else { return [] }
        return Array(alerts.filter { $0.id > seen }.sorted { $0.id < $1.id }.suffix(Self.most))
    }
}

/// The kept alerts as this device's own notifications.
enum LocalAlerts {
    /// Asks once to show notifications; false when the person said no.
    static func ask() async -> Bool {
        (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])) ?? false
    }

    static func show(_ alert: KeptAlert) async {
        let content = UNMutableNotificationContent()
        content.title = alert.title
        content.body = alert.body
        content.threadIdentifier = alert.topic
        content.sound = .default
        try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "alert-\(alert.id)", content: content, trigger: nil))
    }

    /// While this app notifies: reads the computer's kept alerts each minute
    /// while the app runs, and shows the ones new since. It reads nothing
    /// while the ntfy app notifies, or where the computer doesn't keep them.
    @MainActor
    static func watch(read: () async throws -> [KeptAlert], computerKeeps: () -> Bool) async {
        UNUserNotificationCenter.current().delegate = AlertPresenter.shared
        while !Task.isCancelled {
            let notes = AlertNotifications()
            if notes.source == .thisApp, computerKeeps(), let alerts = try? await read() {
                for alert in notes.toShow(alerts) {
                    await show(alert)
                }
            }
            try? await Task.sleep(for: .seconds(60))
        }
    }
}

/// Lets this app's own alerts show as banners while it's open.
final class AlertPresenter: NSObject, UNUserNotificationCenterDelegate, @unchecked Sendable {
    static let shared = AlertPresenter()

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }
}
