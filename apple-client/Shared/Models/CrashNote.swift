import Foundation

/// When Homelab Wizard on the computer last stopped unexpectedly (the
/// computer's `LastCrash`: which part, and when; nothing from the log), as
/// the computer's Status says it (`web/src/status/CrashNote.tsx`). Shown at
/// the top of Status once per crash, until it's hidden on this device.
struct CrashNote: Decodable, Sendable, Equatable {
    /// "the app", "the menu bar item", "the tray icon", or "the background agent".
    let who: String
    let when: Date

    /// "Homelab Wizard stopped unexpectedly yesterday", or for one of its
    /// parts, "Homelab Wizard's background agent stopped unexpectedly on Thursday".
    func title(now: Date = Date(), calendar: Calendar = .current, locale: Locale = .current) -> String {
        let part = who.hasPrefix("the ") ? String(who.dropFirst(4)) : who
        let name = part == "app" || part.isEmpty ? "Homelab Wizard" : "Homelab Wizard's \(part)"
        return "\(name) stopped unexpectedly \(Self.day(when, now: now, calendar: calendar, locale: locale))"
    }

    /// "today", "yesterday", "on Thursday", or "on October 12": the computer's own words.
    static func day(_ when: Date, now: Date, calendar: Calendar, locale: Locale) -> String {
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: when), to: calendar.startOfDay(for: now)).day ?? 0
        if days <= 0 { return "today" }
        if days == 1 { return "yesterday" }
        if days < 7 { return "on " + when.formatted(Date.FormatStyle(locale: locale).weekday(.wide)) }
        return "on " + when.formatted(Date.FormatStyle(locale: locale).month(.wide).day())
    }

    /// What Hide remembers on this device: the crash's moment, so the next crash shows again.
    var hideKey: String { String(Int(when.timeIntervalSince1970)) }

    private static let hiddenKey = "crashNoteHidden"

    func isHidden(in defaults: UserDefaults = .standard) -> Bool {
        defaults.string(forKey: Self.hiddenKey) == hideKey
    }

    func hide(in defaults: UserDefaults = .standard) {
        defaults.set(hideKey, forKey: Self.hiddenKey)
    }
}
