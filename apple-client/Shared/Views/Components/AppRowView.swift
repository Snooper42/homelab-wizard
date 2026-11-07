import SwiftUI

struct AppRowView: View {
    @Environment(AppActionsViewModel.self) private var actions
    @Environment(DashboardViewModel.self) private var dashboard
    @Environment(\.dynamicTypeSize) private var typeSize
    /// Follows the person's text size, up to a point: at the largest sizes
    /// the words need the room more than the icon does.
    @ScaledMetric(relativeTo: .body) private var iconSize: CGFloat = 32
    let app: AppStatus

    /// At the accessibility text sizes the badges go under the name, and the
    /// detail line may wrap, so nothing is cut off.
    private var large: Bool { typeSize.isAccessibilitySize }

    var body: some View {
        HStack(spacing: 12) {
            AppIconView(app: app, size: min(iconSize, 56))
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(app.name)
                        .fontWeight(.medium)
                    if let note = dashboard.changeNote(for: app) {
                        Circle()
                            .fill(.tint)
                            .frame(width: 7, height: 7)
                            .accessibilityLabel(note)
                            .help(note)
                    }
                }
                if let pending = actions.pending[app.id] {
                    PendingActionLine(app: app, pending: pending)
                        .font(.caption)
                } else {
                    Text(app.detailLine)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(large ? 4 : 1)
                }
                if large {
                    HStack(spacing: 6) { badges }
                }
            }
            Spacer(minLength: 0)
            if !large { badges }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var badges: some View {
        if let uptime = dashboard.cards.watchdog?.uptimeLabel(for: app.id) {
            Text(uptime.replacingOccurrences(of: " this week", with: ""))
                .pill(Theme.warning)
                .accessibilityLabel(uptime)
        }
        if let restarts = app.restarts, restarts > 0 {
            Label("\(restarts)", systemImage: "arrow.counterclockwise")
                .labelStyle(.titleAndIcon)
                .pill(.secondary)
                .accessibilityLabel("\(restarts) restarts")
        }
    }
}

/// The app's own icon with its state as a badge, or the state symbol
/// alone while there's no icon.
struct AppIconView: View {
    @Environment(IconStore.self) private var icons
    let app: AppStatus
    let size: CGFloat

    var body: some View {
        // The app's logo from the set the app ships (AppLogos), else the one
        // the computer kept from the app itself, else its state on a tile.
        if let logo = BundledLogo.image(for: app.id) {
            framed(logo)
        } else if let icon = icons.icon(for: app) {
            framed(Image(decorative: icon.image, scale: 1))
        } else {
            // No icon yet: the state on a soft tile of its own colour, the
            // same shape as an icon, so the rows line up.
            AppStateIcon(app: app)
                .font(.system(size: size * 0.5, weight: .semibold))
                .frame(width: size, height: size)
                .background(app.tint.opacity(0.13), in: RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
        }
    }
}

extension AppIconView {
    /// A logo at the icon's size, rounded, with the state as a badge.
    private func framed(_ image: Image) -> some View {
        image
            .resizable()
            .interpolation(.high)
            .aspectRatio(contentMode: .fit)
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
            // A hairline, so a white tile keeps its edge on a light background.
            .overlay {
                RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                    .strokeBorder(.primary.opacity(0.08), lineWidth: 0.5)
            }
            .overlay(alignment: .bottomTrailing) {
                AppStateIcon(app: app)
                    .font(.system(size: size * 0.42))
                    .background(Circle().fill(.background).padding(1))
                    .offset(x: size * 0.12, y: size * 0.12)
            }
            .accessibilityHidden(true)
    }
}

/// Just an app's logo, small, beside its name where there's no row of its
/// own (the memory list): the bundled logo, or a plain tile the same size
/// so the names line up.
struct AppLogo: View {
    let id: String?
    let size: CGFloat

    var body: some View {
        Group {
            if let id, let logo = BundledLogo.image(for: id) {
                logo
                    .resizable()
                    .interpolation(.high)
                    .aspectRatio(contentMode: .fit)
            } else {
                Image(systemName: "shippingbox")
                    .font(.system(size: size * 0.5))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.secondary.opacity(0.12))
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
        .accessibilityHidden(true)
    }
}

/// The logos the app ships for the homelab's catalog apps
/// (Shared/Assets.xcassets/AppLogos, from homarr-labs/dashboard-icons,
/// Apache 2.0; scripts/fetch-app-logos.py). Looked up by app id, once each.
@MainActor
enum BundledLogo {
    private static var known: [String: Bool] = [:]

    static func image(for id: String) -> Image? {
        guard AppStatus.isValidID(id) else { return nil }
        let name = "AppLogos/\(id)"
        if let has = known[id] { return has ? Image(name) : nil }
        #if canImport(UIKit)
        let has = UIImage(named: name) != nil
        #elseif canImport(AppKit)
        let has = NSImage(named: name) != nil
        #else
        let has = false
        #endif
        known[id] = has
        return has ? Image(name) : nil
    }

    #if os(macOS)
    /// The logo at a menu item's size, for the menu bar's Needs a look list
    /// (a menu shows an image at its own size, not a frame's).
    static func menuIcon(for id: String) -> NSImage? {
        guard image(for: id) != nil,
              let logo = NSImage(named: "AppLogos/\(id)")?.copy() as? NSImage
        else { return nil }
        logo.size = NSSize(width: 16, height: 16)
        return logo
    }
    #endif
}

struct AppStateIcon: View {
    let app: AppStatus

    var body: some View {
        Image(systemName: app.symbolName)
            .symbolRenderingMode(.hierarchical)
            .foregroundStyle(app.tint)
            .accessibilityHidden(true)
    }
}

struct ConnectionBadge: View {
    let state: LiveEventManager.ConnectionState

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 7, height: 7)
            Text(state.label)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(color.opacity(0.12), in: Capsule())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Connection: \(state.label)")
    }

    private var color: Color {
        switch state {
        case .live: Theme.success
        case .connecting, .reconnecting: Theme.caution
        case .idle: .gray
        case .stopped: Theme.danger
        }
    }
}

// MARK: - Presentation

extension AppStatus {
    /// Why it last started, in the computer's words (web/src/status/AppList.tsx).
    var startedWords: String? {
        switch startedBy {
        case "you": "You started it"
        case "updated": "You updated it, so it started on its new version"
        case "nightly": "The nightly update moved it to its new version"
        case "update": "It was updated, and started on its new version"
        case "fix": "Fix it restarted it"
        case "watchdog": "The watchdog restarted it: it was unwell on two checks in a row"
        case "battery": "It started again when the power came back (the battery saver had paused it)"
        case "drive": "It started once its drive was plugged in again"
        case "timer": "It started again at the time you set when you stopped it"
        case "docker": "Docker started it again after it stopped on its own; its log says why"
        default: nil
        }
    }

    /// In the computer's words (`stateOf` in web/src/status/AppList.tsx).
    var stateLabel: String {
        switch state {
        case "running": health == "native" ? "Running (native app)" : "Running"
        case "stopped": "Stopped"
        case "elsewhere": "Runs elsewhere"
        case "missing", "not running": "Not running"
        default: state.capitalized
        }
    }

    /// The phone companion is `homelab serve`, which the scheduled jobs
    /// run: not running before they're set up is expected, not a problem.
    var awaitingJobs: Bool { id == "homelab-companion" && state == "not running" }

    /// One line explaining the state, the most urgent part first.
    var detailLine: String {
        if let problem = notAnswering, !problem.isEmpty { return "Not answering: \(problem)" }
        if state == "stopped", let stop = stoppedOnPurpose { return stop.words() }
        if state != "running", pausedOnBattery { return "Paused on battery" }
        if let drive = waitingFor, !drive.isEmpty { return "Waiting for the \(Self.driveName(drive)) drive" }
        if awaitingJobs { return "Starts with the scheduled jobs (Setup)" }
        // Stopped by itself, not from here: when, and why when Docker knows (main #474).
        if state == "stopped" { return Self.stoppedByItself(at: stoppedAt.flatMap(GoTime.parse), why: stoppedWhy) }
        switch health {
        case "restarting": return "Restarting"
        case "unhealthy": return "Unhealthy"
        case "starting": return "Starting"
        default: return stateLabel
        }
    }

    /// "Stopped at 3:12 AM: it ran out of memory", "Stopped yesterday,
    /// 9:40 PM", "Stopped Tue, 9:40 PM", "Stopped Oct 28", or just "Stopped"
    /// when Docker didn't say when (`stoppedByItself` in web/src/status/stopFor.ts).
    static func stoppedByItself(at: Date?, why: String?, now: Date = Date(), calendar: Calendar = .current) -> String {
        var words = "Stopped"
        if let at {
            let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: at), to: calendar.startOfDay(for: now)).day ?? 0
            let time = at.formatted(date: .omitted, time: .shortened)
            if days <= 0 {
                words += " at \(time)"
            } else if days == 1 {
                words += " yesterday, \(time)"
            } else if days < 7 {
                words += " \(at.formatted(.dateTime.weekday(.abbreviated))), \(time)"
            } else {
                words += " \(at.formatted(.dateTime.month(.abbreviated).day()))"
            }
        }
        if let why, !why.isEmpty { words += ": \(why)" }
        return words
    }

    /// Why it isn't running, and what helps, for its page, in the computer's
    /// words (`stoppedNext` in web/src/status/stopFor.ts). Nil while it runs.
    /// `todo` is empty when nothing needs doing (it starts by itself).
    func stoppedNext(now: Date = Date()) -> (why: String, todo: String)? {
        guard state == "stopped" else { return nil }
        if let held = stoppedOnPurpose {
            if held.keptRestarting {
                return ("The watchdog stopped it after Docker restarted it again and again; its log says why.", "Once that is put right, Start tries again.")
            }
            if held.until != nil {
                let when = held.words(now: now).replacingOccurrences(of: "Stopped until ", with: "")
                return ("You stopped it until \(when): it starts again by itself then.", "Or Start it now.")
            }
            return ("You stopped it, so nothing starts it by itself.", "Start starts it again.")
        }
        if pausedOnBattery {
            return ("Paused while this computer is on battery: it starts again by itself once it is plugged in.", "")
        }
        if let drive = waitingFor, !drive.isEmpty {
            return ("Its folders are on the \(Self.driveName(drive)) drive: plug it in and it starts by itself.", "")
        }
        let why = stoppedWhy ?? ""
        if let range = why.range(of: #"port (\d+)$"#, options: .regularExpression) {
            return ("Another program has port \(why[range].dropFirst("port ".count)).", "Quit it, then Start.")
        }
        switch why {
        case "it ran out of memory":
            return ("If it runs out again, stop an app you aren't using, or give Docker more memory.", "Start tries again.")
        case "Docker couldn't start it":
            return ("Its log may say why.", "Start tries again.")
        case "it quit with an error":
            return ("If it stops again, its log says why.", "Start tries again.")
        default:
            return ("It was stopped outside the homelab (by Docker, or a shutdown).", "Start starts it again.")
        }
    }

    /// A drive as the computer names it: "/Volumes/Media" is "Media".
    static func driveName(_ path: String) -> String {
        path.hasPrefix("/Volumes/") ? String(path.dropFirst("/Volumes/".count)) : path
    }

    /// Not running for a reason that passes by itself: the power or a drive
    /// comes back. The web's "warn" dot; the computer still counts a
    /// stopped one in Needs a look.
    var isWaiting: Bool {
        state != "running" && (pausedOnBattery || !(waitingFor ?? "").isEmpty)
    }

    /// Stopped by a person on purpose: no trouble, a plain dot.
    private var heldByYou: Bool {
        state == "stopped" && stoppedOnPurpose != nil && stoppedOnPurpose?.keptRestarting != true
    }

    /// The computer's "bad" dot: unwell, crash-looping, missing, not
    /// answering, or stopped for restarting too often. A plain stop that
    /// needs a look is its "warn".
    var isDown: Bool {
        health == "restarting" || health == "unhealthy" || state == "missing"
            || !(notAnswering ?? "").isEmpty || stoppedOnPurpose?.keptRestarting == true
            // A crash: it stopped by itself and Docker says why (main #474).
            || (state == "stopped" && stoppedOnPurpose == nil && !(stoppedWhy ?? "").isEmpty)
    }

    var symbolName: String {
        if heldByYou { return "stop.circle.fill" }
        if isWaiting { return pausedOnBattery ? "bolt.slash.circle.fill" : "externaldrive.fill.badge.exclamationmark" }
        // As the computer's dots (main #449): a triangle to look at, a cross
        // when down, so a state reads without telling orange from red.
        if needsAttention { return isDown ? "xmark.circle.fill" : "exclamationmark.triangle.fill" }
        if health == "starting" { return "hourglass.circle.fill" }
        switch state {
        case "running": return "checkmark.circle.fill"
        case "elsewhere": return "arrow.up.forward.circle.fill"
        default: return "stop.circle.fill"
        }
    }

    var tint: Color {
        if heldByYou || awaitingJobs { return .secondary }
        if isWaiting { return Theme.warning }
        if needsAttention { return isDown ? Theme.danger : Theme.warning }
        if health == "starting" { return Theme.caution }
        switch state {
        case "running": return Theme.success
        case "elsewhere": return Theme.info
        default: return .secondary
        }
    }
}
