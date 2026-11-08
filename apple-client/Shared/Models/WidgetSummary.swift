import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

/// The one line the Home Screen or desktop widget shows: "All well" or
/// "2 need a look", and when it was read. Nothing else: no app names, no
/// addresses, nothing from the computer's words.
///
/// The widget runs without Face ID or Touch ID, so this is the one reading
/// kept past a lock, and only on a device where the person turned it on
/// (Settings › This Device). It's written by the unlocked app on each Status
/// read, into the App Group the app and widget share, and deleted when the
/// widget is turned off and when the device is unpaired. The widget has no
/// token and reads nothing from the network.
struct WidgetSummary: Codable, Sendable, Equatable {
    /// How many apps need a look; 0 is all well.
    let needALook: Int
    /// When the app read it.
    let at: Date

    /// "All well", "1 needs a look", "3 need a look".
    var words: String {
        switch needALook {
        case 0: "All well"
        case 1: "1 needs a look"
        default: "\(needALook) need a look"
        }
    }
}

/// Where the widget's line is kept: the App Group named in the app's and
/// widget's Info.plist (`HomelabAppGroup`, set by make-xcode-project.sh when
/// the widget is built). Without one, it keeps nothing, so a build without
/// the widget (and the test package) writes nothing anywhere.
enum WidgetSummaryStore {
    /// Whether the person turned the widget on, on this device.
    static let enabledKey = "widgetEnabled"
    private static let summaryKey = "widgetSummary"

    /// The App Group, when the build has a widget: "group.<prefix>.HomelabClient"
    /// on iPhone and iPad, "<team>.<prefix>.HomelabClient" on the Mac.
    static var appGroup: String? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "HomelabAppGroup") as? String,
              group.contains("HomelabClient"), !group.hasPrefix("."), !group.contains("$")
        else { return nil }
        return group
    }

    private static var shared: UserDefaults? { appGroup.flatMap(UserDefaults.init(suiteName:)) }

    /// Whether this build can show a widget at all.
    static var isAvailable: Bool { shared != nil }

    static var isEnabled: Bool {
        get { shared?.bool(forKey: enabledKey) ?? false }
        set {
            shared?.set(newValue, forKey: enabledKey)
            if !newValue { clear() }
        }
    }

    /// Saves the line, if the widget is on. Returns whether it changed, so
    /// the widget is asked to redraw only then.
    @discardableResult
    static func save(_ summary: WidgetSummary) -> Bool {
        guard let shared, isEnabled else { return false }
        let old = load()
        // The time alone changing isn't worth a redraw more than once a few minutes.
        if let old, old.needALook == summary.needALook, summary.at.timeIntervalSince(old.at) < 300 { return false }
        guard let data = try? JSONEncoder().encode(summary) else { return false }
        shared.set(data, forKey: summaryKey)
        return true
    }

    static func load() -> WidgetSummary? {
        guard let data = shared?.data(forKey: summaryKey) else { return nil }
        return try? JSONDecoder().decode(WidgetSummary.self, from: data)
    }

    static func clear() {
        shared?.removeObject(forKey: summaryKey)
    }

    /// Asks the widget to draw the line again.
    static func reloadWidget() {
        #if canImport(WidgetKit)
        if isAvailable { WidgetCenter.shared.reloadAllTimelines() }
        #endif
    }
}
