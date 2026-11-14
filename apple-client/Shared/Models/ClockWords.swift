import Foundation

/// The computer's clock words said as the phone says times, in its own 12-
/// or 24-hour time: quiet hours ("22-7", `internal/notify.QuietHours`) and a
/// schedule ("daily at 04:00", `internal/updates`). Anything it can't read
/// is shown as the computer sent it (its first letter capitalised).
enum ClockWords {
    /// "22-7" → "10 PM to 7 AM" (or "22:00 to 07:00"); "off" → "Off"; empty
    /// is the computer's default, 22-7.
    static func quietHours(_ value: String, locale: Locale = .current) -> String {
        let v = value.trimmingCharacters(in: .whitespaces)
        if v.lowercased() == "off" { return "Off" }
        let parts = (v.isEmpty ? "22-7" : v).split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 2,
              let from = Int(parts[0].trimmingCharacters(in: .whitespaces)),
              let to = Int(parts[1].trimmingCharacters(in: .whitespaces)),
              (0...23).contains(from), (0...23).contains(to), from != to
        else { return v }
        return "\(time(hour: from, minute: 0, locale: locale)) to \(time(hour: to, minute: 0, locale: locale))"
    }

    /// "daily at 04:00" → "Every night at 4 AM" (9 PM to 6 AM is the night),
    /// "daily at 13:30" → "Every day at 1:30 PM", "Sundays at 02:00" →
    /// "Sundays at 2 AM".
    static func schedule(_ value: String, locale: Locale = .current) -> String {
        let v = value.trimmingCharacters(in: .whitespaces)
        guard let at = v.range(of: " at ", options: .backwards) else { return capitalised(v) }
        let when = String(v[..<at.lowerBound])
        let clock = v[at.upperBound...].split(separator: ":")
        guard clock.count == 2, clock[1].count == 2,
              let hour = Int(clock[0]), let minute = Int(clock[1]),
              (0...23).contains(hour), (0...59).contains(minute)
        else { return capitalised(v) }
        let said = time(hour: hour, minute: minute, locale: locale)
        if when.lowercased() == "daily" {
            return (hour >= 21 || hour < 6 ? "Every night at " : "Every day at ") + said
        }
        return "\(capitalised(when)) at \(said)"
    }

    /// An hour and minute in the locale's own clock: "4 AM", "1:30 PM", "04:00".
    static func time(hour: Int, minute: Int, locale: Locale) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let date = calendar.date(from: DateComponents(year: 2026, month: 1, day: 1, hour: hour, minute: minute))!
        let twelve = DateFormatter.dateFormat(fromTemplate: "j", options: 0, locale: locale)?.contains("a") ?? false
        let format = DateFormatter()
        format.locale = locale
        format.calendar = calendar
        format.timeZone = calendar.timeZone
        format.setLocalizedDateFormatFromTemplate(twelve && minute == 0 ? "j" : "jmm")
        // ICU puts a narrow no-break space before AM and PM; a plain one reads the same and matches.
        return format.string(from: date).replacingOccurrences(of: "\u{202F}", with: " ")
    }

    private static func capitalised(_ s: String) -> String {
        s.prefix(1).uppercased() + s.dropFirst()
    }
}
