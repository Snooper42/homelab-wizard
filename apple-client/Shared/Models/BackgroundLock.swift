import Foundation

/// How long the Mac app may sit behind other apps, unlocked, before it
/// locks: a choice in Settings, kept in UserDefaults (a number of minutes,
/// nothing else). Only these choices are honoured; anything else, or none,
/// is the default. "Never" isn't one of them.
enum BackgroundLock {
    static let key = "macBackgroundLockMinutes"
    static let choices = [1, 5, 15]
    static let defaultMinutes = 5

    static func minutes(in defaults: UserDefaults) -> Int {
        let stored = defaults.integer(forKey: key)
        return choices.contains(stored) ? stored : defaultMinutes
    }

    static func duration(in defaults: UserDefaults) -> Duration {
        .seconds(minutes(in: defaults) * 60)
    }
}
