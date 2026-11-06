#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// Whether the person is using VoiceOver or Switch Control, for what has to
/// wait longer for them: reaching a button by swiping or scanning takes
/// longer than a glance and a tap.
enum AssistiveTech {
    @MainActor static var isRunning: Bool {
        #if canImport(UIKit)
        UIAccessibility.isVoiceOverRunning || UIAccessibility.isSwitchControlRunning
        #elseif canImport(AppKit)
        NSWorkspace.shared.isVoiceOverEnabled || NSWorkspace.shared.isSwitchControlEnabled
        #else
        false
        #endif
    }
}
