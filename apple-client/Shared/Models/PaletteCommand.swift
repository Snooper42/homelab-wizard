import Foundation

/// One thing the ⌘K palette does on the iPad (item 3; the owner approved the
/// mock with the pop-up, Nov 15), as the computer's palette has it
/// (web/src/palette/commands.ts): a screen, a page of Finances, an app's page,
/// Restart, Stop or Logs, a group's Start, Restart or Stop, and the commands
/// used now and then. Each runs what its own button runs, so a change still
/// asks for Face ID, and Stop asks for a second press first.
struct PaletteCommand: Identifiable, Sendable, Equatable {
    enum Action: Sendable, Equatable {
        case screen(DashboardViewModel.SidebarItem)
        case financePage(DeepLink.FinancePage)
        case openApp(AppStatus.ID)
        case app(AppStatus.ID, AppAction)
        case logs(AppStatus.ID)
        case group([AppStatus.ID], AppAction)
        case backUpNow
        case amounts
        case importFile
        case addTransaction
    }

    let id: String
    let label: String
    /// What it is, or its shortcut, on the right: "⌘2", "Media".
    var hint: String? = nil
    /// Other words it's found by: the app's id, its group.
    var also = ""
    /// Its heading in the list: Screens, Finances, Apps, Groups, Commands.
    let section: String
    /// Stopping: what the second press says it does ("stop Immich").
    var asks: String? = nil
    let action: Action
}

enum Palette {
    /// Words as they're matched: lower case, accents off, split on anything else.
    static func words(_ s: String) -> [String] {
        s.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US"))
            .lowercased()
            .split(whereSeparator: { !($0.isASCII && ($0.isLetter || $0.isNumber)) })
            .map(String.init)
    }

    /// The commands with every word typed, each as the start of one of theirs,
    /// best first: those whose own label has the words before those found by
    /// their other words, the label itself first, and otherwise in the list's order.
    static func match(_ list: [PaletteCommand], _ query: String) -> [PaletteCommand] {
        let want = words(query)
        guard !want.isEmpty else { return list }
        var scored: [(c: PaletteCommand, score: Int, i: Int)] = []
        for (i, c) in list.enumerated() {
            let own = words(c.label), other = own + words(c.also)
            guard want.allSatisfy({ w in other.contains { $0.hasPrefix(w) } }) else { continue }
            var score = want.filter { w in own.contains { $0.hasPrefix(w) } }.count * 2
            if own == want { score += 4 }
            scored.append((c, score, i))
        }
        return scored.sorted { $0.score != $1.score ? $0.score > $1.score : $0.i < $1.i }.map(\.c)
    }

    /// What this device may do now, read fresh as the palette opens.
    struct Can: Sendable {
        var seeFinances = false
        /// Start, Stop and Restart (a device that may change things).
        var change = false
        var backUp = false
        var importFile = false
        var addTransaction = false
        /// Amounts can be shown or hidden here (the plan doesn't hide them on every device).
        var showAmounts = false
        var amountsShown = false
    }

    /// Everything the palette offers, in its list's order: the screens, the
    /// commands, Finances' pages, each app's own, then each group's.
    static func commands(screens: [DashboardViewModel.SidebarItem], groups: [AppGroup], can: Can,
                         available: (AppStatus) -> [AppAction]) -> [PaletteCommand] {
        var out: [PaletteCommand] = []
        for screen in screens {
            out.append(PaletteCommand(id: "screen:\(screen.storageKey)", label: screen.title, hint: screen.shortcut.map { "\u{2318}\($0)" },
                                      also: screenWords(screen), section: "Screens", action: .screen(screen)))
        }
        if can.backUp {
            out.append(PaletteCommand(id: "backup", label: "Back Up Now", also: "backup", section: "Commands", action: .backUpNow))
        }
        if can.showAmounts {
            out.append(PaletteCommand(id: "amounts", label: can.amountsShown ? "Hide Amounts" : "Show Amounts", hint: "Finances",
                                      also: "money", section: "Commands", action: .amounts))
        }
        if can.importFile {
            out.append(PaletteCommand(id: "import", label: "Import a File", hint: "\u{21E7}\u{2318}I", also: "bank csv ofx",
                                      section: "Commands", action: .importFile))
        }
        if can.addTransaction {
            out.append(PaletteCommand(id: "add-transaction", label: "Add a Transaction", hint: "\u{2318}N", also: "new",
                                      section: "Commands", action: .addTransaction))
        }
        if can.seeFinances {
            for (i, page) in DeepLink.FinancePage.menuOrder.enumerated() {
                out.append(PaletteCommand(id: "finances:\(page.rawValue)", label: page.title, hint: "\u{2325}\u{2318}\(i + 1)",
                                          also: "finances money", section: "Finances", action: .financePage(page)))
            }
        }
        // Each app once, even where it's in two groups (pinned and its own).
        var seen = Set<AppStatus.ID>()
        for group in groups {
            for app in group.apps where !seen.contains(app.id) {
                seen.insert(app.id)
                let also = "\(app.id) \(group.label)"
                out.append(PaletteCommand(id: "app:\(app.id):open", label: "\(app.name): Open Its Page", hint: group.label, also: also,
                                          section: "Apps", action: .openApp(app.id)))
                let actions = can.change ? available(app) : []
                if actions.contains(.restart) {
                    out.append(PaletteCommand(id: "app:\(app.id):restart", label: "\(app.name): Restart", hint: group.label, also: also,
                                              section: "Apps", action: .app(app.id, .restart)))
                }
                if actions.contains(.start) {
                    out.append(PaletteCommand(id: "app:\(app.id):start", label: "\(app.name): Start", hint: group.label, also: also,
                                              section: "Apps", action: .app(app.id, .start)))
                }
                if actions.contains(.stop) {
                    out.append(PaletteCommand(id: "app:\(app.id):stop", label: "\(app.name): Stop\u{2026}", hint: group.label, also: also,
                                              section: "Apps", asks: "stop \(app.name)", action: .app(app.id, .stop)))
                }
                if app.hasLogs {
                    out.append(PaletteCommand(id: "app:\(app.id):logs", label: "\(app.name): Logs", hint: group.label, also: also,
                                              section: "Apps", action: .logs(app.id)))
                }
            }
        }
        if can.change {
            for group in groups where !group.pinned {
                let n = { (count: Int) in count == 1 ? "1 app" : "\(count) apps" }
                let stopped = AppAction.groupTargets(.start, in: group.apps)
                let running = AppAction.groupTargets(.restart, in: group.apps)
                if !stopped.isEmpty {
                    out.append(PaletteCommand(id: "group:\(group.label):start", label: "Start \(n(stopped.count)) Stopped", hint: group.label,
                                              also: group.label, section: "Groups", action: .group(stopped.map(\.id), .start)))
                }
                if !running.isEmpty {
                    out.append(PaletteCommand(id: "group:\(group.label):restart", label: "Restart \(n(running.count))", hint: group.label,
                                              also: group.label, section: "Groups", action: .group(running.map(\.id), .restart)))
                    out.append(PaletteCommand(id: "group:\(group.label):stop", label: "Stop \(n(running.count))\u{2026}", hint: group.label,
                                              also: group.label, section: "Groups", asks: "stop \(n(running.count)) in \(group.label)",
                                              action: .group(running.map(\.id), .stop)))
                }
            }
        }
        return out
    }

    /// Other words a screen is found by, as the computer's (commands.ts's screenList).
    private static func screenWords(_ screen: DashboardViewModel.SidebarItem) -> String {
        switch screen {
        case .status: "status apps running"
        case .backups: "backup restore"
        case .finances: "money budget bills"
        case .setup: ""
        case .settings: "preferences options"
        }
    }
}
