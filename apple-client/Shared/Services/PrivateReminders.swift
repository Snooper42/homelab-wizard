import Foundation
import UserNotifications

/// A household member's Finances reminders, from her own private Finances
/// on her phone (private-finances.md 3.3: the computer can't read them to
/// send its nightly ones). Whenever she opens them, the next two weeks'
/// are worked out with the computer's own code (`PrivateFinances.reminders`)
/// and planned as this device's own notifications: today's at once (once a
/// day), each later day's at 9 AM. Each opening plans them afresh; turning
/// privacy off, or unpairing, takes them all away. Amounts are hidden in
/// them while Hide amounts is on, as the computer's are.
enum PrivateReminders {
    static let prefix = "private-finances-"
    static let days = 14
    static let hour = 9
    /// The day today's were last shown, so a second opening doesn't show them again.
    static let shownKey = "privateRemindersShownDay"

    /// One notification to plan: at nil is now.
    struct Planned: Equatable, Sendable {
        let id: String
        let title: String
        let body: String
        let at: DateComponents?
    }

    /// The notifications for days (from `PrivateFinances.reminders`), with
    /// today (YYYY-MM-DD) and the day today's were last shown.
    static func planned(_ days: [PrivateFinances.DayReminders], today: String, shownDay: String?) -> [Planned] {
        var out: [Planned] = []
        for d in days where d.day >= today {
            if d.day == today, shownDay == today { continue }
            var at: DateComponents?
            if d.day != today {
                let parts = d.day.split(separator: "-").compactMap { Int($0) }
                guard parts.count == 3 else { continue }
                at = DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: hour)
            }
            for (i, r) in d.reminders.enumerated() {
                out.append(Planned(id: "\(prefix)\(d.day)-\(i)", title: r.title, body: r.body, at: at))
            }
        }
        return out
    }

    /// Plans them, in place of any planned before.
    static func schedule(_ planned: [Planned]) async {
        await cancel()
        let center = UNUserNotificationCenter.current()
        for p in planned {
            let content = UNMutableNotificationContent()
            content.title = p.title
            content.body = p.body
            content.threadIdentifier = "private-finances"
            content.sound = .default
            let trigger = p.at.map { UNCalendarNotificationTrigger(dateMatching: $0, repeats: false) }
            try? await center.add(UNNotificationRequest(identifier: p.id, content: content, trigger: trigger))
        }
    }

    /// Takes every planned one away (privacy off, unpaired).
    static func cancel() async {
        let center = UNUserNotificationCenter.current()
        let ids = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(prefix) }
        center.removePendingNotificationRequests(withIdentifiers: ids)
    }
}
