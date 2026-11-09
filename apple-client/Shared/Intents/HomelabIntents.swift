import AppIntents
import Foundation
import Observation

// Siri, Shortcuts, Spotlight and the Action button.
//
// - "Is everything running?" answers from the line the widget shows
//   (WidgetSummaryStore): a count and when it was read, never an app's
//   name, and nothing at all while the iPhone is locked.
// - Opening an app's page, or starting, stopping or restarting it, opens
//   Homelab. It unlocks with Face ID as always, shows the app's page, and
//   asks as the button would (Face ID for the change, and Stop asks
//   first). Nothing changes from Siri without that, and a look-only
//   device changes nothing at all.

/// What Siri or a shortcut asked Homelab to do, kept until the unlocked
/// app does it. Only the request is kept: the app's name as said, and
/// the action.
@MainActor
@Observable
final class IntentInbox {
    static let shared = IntentInbox()

    struct Request: Equatable, Sendable {
        /// The app's name as said or typed ("jellyfin", "Immich").
        let app: String
        let action: AppAction?
        /// From a link (`homelab://`), which anyone can send: the action
        /// waits for one confirming tap on the app's page.
        var fromLink = false
        /// From a link: its logs, once the page is open.
        var logs = false
    }

    var pending: Request?
    /// A screen a link asked for (`homelab://backups`), until the dashboard shows it.
    var screen: DashboardViewModel.SidebarItem?
    /// A page of Finances a link asked for (`homelab://finances/budgets`).
    var financePage: DeepLink.FinancePage?

    func post(_ request: Request) { pending = request }

    /// Takes a link into the app (DeepLink). Nothing changes by itself: an
    /// action waits for a tap on the app's page, after the app is unlocked.
    func open(_ link: DeepLink) {
        switch link {
        case .app(let id, let then):
            post(Request(app: id, action: then?.change, fromLink: true, logs: then == .logs))
        case .status, .tidyInbox:
            screen = .status(.all)
        case .backups:
            screen = .backups
        case .finances(let page):
            screen = .finances
            financePage = page
        }
    }

    /// The app a request names, among those Status lists: its id or name,
    /// any case, then the only one whose name starts with it.
    nonisolated static func match(_ said: String, in apps: [AppStatus]) -> AppStatus? {
        let key = said.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !key.isEmpty else { return nil }
        if let exact = apps.first(where: { $0.id.lowercased() == key || $0.name.lowercased() == key }) {
            return exact
        }
        let starts = apps.filter { $0.name.lowercased().hasPrefix(key) || $0.id.lowercased().hasPrefix(key) }
        return starts.count == 1 ? starts[0] : nil
    }
}

/// Start, Stop or Restart, as Siri and Shortcuts offer them.
enum IntentAppAction: String, AppEnum, CaseIterable {
    case restart, start, stop

    static var typeDisplayRepresentation: TypeDisplayRepresentation { "Action" }
    static var caseDisplayRepresentations: [IntentAppAction: DisplayRepresentation] {
        [.restart: "Restart", .start: "Start", .stop: "Stop"]
    }

    var action: AppAction {
        switch self {
        case .restart: .restart
        case .start: .start
        case .stop: .stop
        }
    }
}

struct CheckHomelabIntent: AppIntent {
    static var title: LocalizedStringResource { "Is Everything Running?" }
    static var description: IntentDescription {
        IntentDescription("Says whether all your apps are well, or how many need a look, as Homelab last read it.")
    }
    static var authenticationPolicy: IntentAuthenticationPolicy { .requiresAuthentication }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let answer = Self.answer(WidgetSummaryStore.load(),
                                 enabled: WidgetSummaryStore.isEnabled,
                                 available: WidgetSummaryStore.isAvailable)
        return .result(dialog: "\(answer)")
    }

    /// The words Siri says. Without the widget's line (a build without the
    /// widget, or it turned off) there's nothing to say but where to look.
    static func answer(_ summary: WidgetSummary?, enabled: Bool, available: Bool) -> String {
        guard available else { return "Open Homelab to read your apps." }
        guard enabled, let summary else {
            return "Open Homelab to read your apps. To have me answer this without opening it, turn on the widget in Homelab's Settings, under This Device."
        }
        let ago = summary.at.formatted(.relative(presentation: .named, unitsStyle: .wide))
        switch summary.needALook {
        case 0: return "All your apps are well, as of \(ago)."
        case 1: return "One app needs a look, as of \(ago). Open Homelab to see which."
        default: return "\(summary.needALook) apps need a look, as of \(ago). Open Homelab to see which."
        }
    }
}

struct OpenAppPageIntent: AppIntent {
    static var title: LocalizedStringResource { "Open an App's Page" }
    static var description: IntentDescription {
        IntentDescription("Opens Homelab at one app's page, after Face ID.")
    }
    static var openAppWhenRun: Bool { true }
    static var authenticationPolicy: IntentAuthenticationPolicy { .requiresAuthentication }

    @Parameter(title: "App", requestValueDialog: "Which app?")
    var app: String

    @MainActor
    func perform() async throws -> some IntentResult {
        IntentInbox.shared.post(.init(app: app, action: nil))
        return .result()
    }
}

struct AppActionIntent: AppIntent {
    static var title: LocalizedStringResource { "Start, Stop or Restart an App" }
    static var description: IntentDescription {
        IntentDescription("Opens Homelab at the app's page and asks to do it there: Face ID first, and Stop asks before it stops.")
    }
    static var openAppWhenRun: Bool { true }
    static var authenticationPolicy: IntentAuthenticationPolicy { .requiresAuthentication }

    @Parameter(title: "Action", default: .restart)
    var action: IntentAppAction

    @Parameter(title: "App", requestValueDialog: "Which app?")
    var app: String

    static var parameterSummary: some ParameterSummary {
        Summary("\(\.$action) \(\.$app)")
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        IntentInbox.shared.post(.init(app: app, action: action.action))
        return .result()
    }
}

struct HomelabShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CheckHomelabIntent(),
            phrases: [
                "Is everything running in \(.applicationName)?",
                "Check \(.applicationName)",
            ],
            shortTitle: "Is Everything Running?",
            systemImageName: "checkmark.circle"
        )
        AppShortcut(
            intent: AppActionIntent(),
            phrases: [
                "\(\.$action) an app in \(.applicationName)",
                "Restart an app in \(.applicationName)",
            ],
            shortTitle: "Start, Stop or Restart",
            systemImageName: "arrow.clockwise"
        )
        AppShortcut(
            intent: OpenAppPageIntent(),
            phrases: ["Open an app in \(.applicationName)"],
            shortTitle: "Open an App",
            systemImageName: "server.rack"
        )
    }
}
