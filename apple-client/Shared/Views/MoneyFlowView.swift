import SwiftUI

/// Money flow on Cash Flow,
/// as the computer's: where a month's money came from, all of it together,
/// then taxes, spending and saved, and on to each kind of spending and each
/// account it was saved in (`FinanceFlow`). A month the ledger has, or a
/// typical month from the plan. On an iPhone the last column is listed
/// under its box; wide, all four are drawn. Tapping a box shows what's behind
/// it under the chart, as the computer's: its transactions (each opening its
/// page), or the planned payments and pay.
struct MoneyFlowCard: View {
    @Bindable var finances: FinancesViewModel
    @State private var view: JSONValue?
    @State private var ledger: JSONValue?
    /// "" for a typical month, else "yyyy-MM".
    @State private var month: String?
    @State private var width: CGFloat = 360
    /// The box tapped, to show what's behind it.
    @State private var picked: String?

    /// The ledger's months from Track from on (`ledger` is counted from it as it's read).
    private var months: [String] { FinanceFlow.ledgerMonths(ledger) }
    private var shownMonth: String {
        if let month { return month }
        var today = ""
        if case .string(let s)? = view?["today"] { today = String(s.prefix(7)) }
        return months.contains(today) ? today : months.first ?? ""
    }
    private var flow: FinanceFlow? {
        guard let view else { return nil }
        let m = shownMonth
        return m.isEmpty ? FinanceFlow.typical(view: view) : FinanceFlow.month(view: view, ledger: ledger, month: m)
    }
    private var wide: Bool { width >= 600 }

    var body: some View {
        Group {
            if let flow, !flow.nodes.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Money Flow").font(.headline).foregroundStyle(Theme.ink)
                        Spacer(minLength: 8)
                        if !months.isEmpty {
                            Menu {
                                Picker("Month", selection: Binding(get: { shownMonth }, set: { month = $0 })) {
                                    Text("A Typical Month").tag("")
                                    ForEach(months, id: \.self) { m in Text(verbatim: Self.monthWords(m)).tag(m) }
                                }
                            } label: {
                                Label(shownMonth.isEmpty ? "A Typical Month" : Self.monthWords(shownMonth), systemImage: "chevron.up.chevron.down")
                                    .labelStyle(.titleAndIcon)
                                    .font(.subheadline)
                            }
                        }
                    }
                    SankeyDrawing(flow: flow, columns: wide ? 4 : 3, money: money, picked: picked) { id in
                        picked = picked == id ? nil : id
                    }
                    .frame(height: wide ? 380 : 340)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(Text(verbatim: said(flow)))
                    .accessibilityActions {
                        ForEach(flow.nodes) { n in
                            Button { picked = n.id } label: { Text(verbatim: "What's behind \(n.label)") }
                        }
                    }
                    if let id = picked, let node = flow.nodes.first(where: { $0.id == id }) {
                        behindSection(node, flow)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .card()
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .onChange(of: shownMonth) { _, _ in picked = nil }
        .task(id: finances.wholeVersion) {
            guard let whole = finances.wholeView() else { return }
            view = await FinancesViewModel.wholeJSON(from: whole)
            // From Track from's day, not its whole month (a mid-month day).
            ledger = FinanceFlow.counted(whole.ledger, from: finances.plan?.plan.trackFrom)
        }
    }

    private func money(_ n: Double) -> String {
        guard let view = finances.plan else { return "" }
        return amountText(n, view.plan.currency, finances, whole: true)
    }

    // MARK: What's behind a box

    /// The computer's limit on the rows shown under the chart.
    private var shownAtMost: Int { 40 }

    private var periodName: String { shownMonth.isEmpty ? "A typical month" : Self.monthWords(shownMonth) }

    private func behindSection(_ node: FinanceFlow.Node, _ flow: FinanceFlow) -> some View {
        let items = flow.behind(node.id)
        // On an iPhone the last column isn't drawn: the boxes this one leads on to, to pick.
        let next = wide ? [] : flow.next(node.id)
        return VStack(alignment: .leading, spacing: 10) {
            Divider()
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: node.label).font(.headline).foregroundStyle(Theme.ink)
                    Text(verbatim: "\(periodName) · \(money(node.value))").font(.footnote).foregroundStyle(Theme.secondaryInk)
                }
                Spacer(minLength: 8)
                Button("Close") { picked = nil }
                    .buttonStyle(.borderless)
            }
            if node.id == "kept:cash" {
                Text("What was left after taxes, spending, and what went into savings accounts: it stayed where it came in.")
                    .font(.footnote).foregroundStyle(Theme.secondaryInk)
            } else if node.id == "src:accounts" {
                Text("More went out than came in: the rest came out of what the accounts held.")
                    .font(.footnote).foregroundStyle(Theme.secondaryInk)
            } else {
                ForEach(next) { child in
                    Button { picked = child.id } label: {
                        HStack(spacing: 10) {
                            Text(verbatim: child.label).foregroundStyle(Theme.ink).lineLimit(1)
                            Spacer(minLength: 8)
                            Text(verbatim: money(child.value)).monospacedDigit().foregroundStyle(Theme.secondaryInk)
                            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(Theme.secondaryInk)
                                .accessibilityHidden(true)
                        }
                        .font(.subheadline)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                ForEach(Array(items.prefix(shownAtMost).enumerated()), id: \.offset) { _, item in
                    if let tx = item.tx, let t = finances.ledger?.transactions.first(where: { $0.id == tx }) {
                        NavigationLink {
                            FinancesView.transactionPage(t, finances: finances)
                        } label: {
                            itemRow(item, opens: true)
                        }
                        .buttonStyle(.plain)
                    } else {
                        itemRow(item, opens: false)
                    }
                }
                if items.isEmpty && next.isEmpty {
                    Text("Nothing behind it.").font(.subheadline).foregroundStyle(Theme.secondaryInk)
                }
                if items.count > shownAtMost {
                    Text(verbatim: "And \(items.count - shownAtMost) more.").font(.footnote).foregroundStyle(Theme.secondaryInk)
                }
            }
        }
    }

    /// A transaction, a planned payment or a paycheck: what it was, when and where, and how much.
    @ViewBuilder
    private func itemRow(_ item: FinanceFlow.Item, opens: Bool) -> some View {
        let day = item.date.flatMap { FinanceCalendar.shown($0) }.map { $0.formatted(.dateTime.month(.abbreviated).day()) }
        let sub = [day, item.note].compactMap { $0 }.joined(separator: " · ")
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 1) {
                Text(verbatim: item.label).font(.subheadline).foregroundStyle(Theme.ink).lineLimit(1)
                Text(verbatim: !sub.isEmpty ? sub : item.payment != nil ? "Planned, a month" : item.person != nil ? "Pay, a month" : "")
                    .font(.caption).foregroundStyle(Theme.secondaryInk).lineLimit(1)
            }
            Spacer(minLength: 8)
            if let view = finances.plan {
                Money(value: item.amount, currency: view.plan.currency, finances: finances, signed: item.amount > 0)
                    .font(.subheadline)
                    .foregroundStyle(item.amount > 0 ? Theme.success : Theme.ink)
            }
            if opens {
                Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(Theme.secondaryInk)
                    .accessibilityHidden(true)
            }
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    /// The flow in words, for VoiceOver.
    private func said(_ f: FinanceFlow) -> String {
        f.links.map { link in
            let from = f.nodes.first { $0.id == link.from }?.label ?? link.from
            let to = f.nodes.first { $0.id == link.to }?.label ?? link.to
            return "\(from) to \(to), \(money(link.value))"
        }.joined(separator: ". ")
    }

    static func monthWords(_ m: String) -> String {
        FinanceCalendar.shown(m + "-01").map { $0.formatted(.dateTime.month(.wide).year()) } ?? m
    }
}

/// A box's width and the room between boxes (file constants: a View's static is the main actor's, and `Layout` isn't).
private let sankeyBar: CGFloat = 9
private let sankeyGap: CGFloat = 10

/// The boxes and the bands between them, a column each, heights by value.
private struct SankeyDrawing: View {
    let flow: FinanceFlow
    /// 3 (an iPhone: the last column's listed under its box) or 4.
    let columns: Int
    let money: (Double) -> String
    /// The box tapped, its name in the accent.
    let picked: String?
    let pick: (String) -> Void

    var body: some View {
        GeometryReader { geo in
            let layout = Layout(flow: flow, columns: columns, size: geo.size)
            ZStack(alignment: .topLeading) {
                Canvas { context, _ in
                    for band in layout.bands {
                        var path = Path()
                        let (x0, x1) = (band.fromX + sankeyBar, band.toX)
                        let mid = (x0 + x1) / 2
                        path.move(to: CGPoint(x: x0, y: band.fromY))
                        path.addCurve(to: CGPoint(x: x1, y: band.toY), control1: CGPoint(x: mid, y: band.fromY), control2: CGPoint(x: mid, y: band.toY))
                        path.addLine(to: CGPoint(x: x1, y: band.toY + band.height))
                        path.addCurve(to: CGPoint(x: x0, y: band.fromY + band.height),
                                      control1: CGPoint(x: mid, y: band.toY + band.height), control2: CGPoint(x: mid, y: band.fromY + band.height))
                        path.closeSubpath()
                        context.fill(path, with: .color(band.tint.opacity(0.18)))
                    }
                    for box in layout.boxes {
                        context.fill(Path(roundedRect: box.rect, cornerRadius: 2), with: .color(box.tint))
                    }
                }
                ForEach(layout.boxes) { box in
                    Button { pick(box.node.id) } label: {
                        label(box, layout).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .position(x: box.labelX, y: box.rect.midY)
                }
            }
        }
    }

    @ViewBuilder
    private func label(_ box: Layout.Box, _ layout: Layout) -> some View {
        let lines = columns == 3 && box.node.col == 2 ? layout.children(of: box.node.id) : []
        VStack(alignment: box.leading ? .leading : .trailing, spacing: 1) {
            Text(verbatim: box.node.label).font(.caption2.weight(.semibold)).foregroundStyle(picked == box.node.id ? Theme.accent : Theme.ink)
            Text(verbatim: money(box.node.value)).font(.caption2).monospacedDigit().foregroundStyle(Theme.secondaryInk)
            ForEach(lines.prefix(5)) { child in
                Text(verbatim: "\(child.label) \(money(child.value))").font(.system(size: 9)).foregroundStyle(Theme.secondaryInk)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .frame(width: box.labelWidth, alignment: box.leading ? .leading : .trailing)
    }

    struct Layout {
        struct Box: Identifiable {
            let node: FinanceFlow.Node
            let rect: CGRect
            let tint: Color
            let labelX: CGFloat
            let labelWidth: CGFloat
            let leading: Bool
            var id: String { node.id }
        }

        struct Band {
            let fromX: CGFloat, fromY: CGFloat, toX: CGFloat, toY: CGFloat, height: CGFloat, tint: Color
        }

        let flow: FinanceFlow
        var boxes: [Box] = []
        var bands: [Band] = []

        init(flow: FinanceFlow, columns: Int, size: CGSize) {
            self.flow = flow
            let shown = flow.nodes.filter { $0.col < columns }
            let byCol = (0..<columns).map { c in shown.filter { $0.col == c } }
            let most = byCol.map { $0.reduce(0) { $0 + $1.value } }.max() ?? 1
            let crowded = CGFloat(max((byCol.map(\.count).max() ?? 1) - 1, 0))
            let scale = max(size.height - crowded * sankeyGap, 40) / CGFloat(max(most, 1))
            // Where each column's bar stands: labels go right of the first columns and left of the last.
            let labelRoom: CGFloat = columns == 4 ? 110 : 96
            let xs: [CGFloat] = (0..<columns).map { c in
                let usable = size.width - labelRoom - sankeyBar
                return c == columns - 1 ? usable : CGFloat(c) * usable / CGFloat(columns - 1) * (columns == 4 ? 0.9 : 0.85)
            }
            var rects: [String: CGRect] = [:]
            for (c, nodes) in byCol.enumerated() {
                var y: CGFloat = 0
                for n in nodes {
                    let h = max(CGFloat(n.value) * scale, 2)
                    let rect = CGRect(x: xs[c], y: y, width: sankeyBar, height: h)
                    rects[n.id] = rect
                    let last = c == columns - 1
                    boxes.append(Box(node: n, rect: rect, tint: Self.tint(n),
                                     labelX: last ? rect.maxX + 4 + labelRoom / 2 : rect.maxX + 4 + (labelRoom - 10) / 2,
                                     labelWidth: labelRoom - 10, leading: true))
                    y += h + sankeyGap
                }
            }
            // Each link leaves its box below the one before, and comes into its box below the one before.
            var out: [String: CGFloat] = [:], into: [String: CGFloat] = [:]
            for link in flow.links {
                guard let a = rects[link.from], let b = rects[link.to],
                      let to = shown.first(where: { $0.id == link.to }) else { continue }
                let h = max(CGFloat(link.value) * scale, 1)
                let fy = a.minY + (out[link.from] ?? 0), ty = b.minY + (into[link.to] ?? 0)
                out[link.from, default: 0] += h
                into[link.to, default: 0] += h
                bands.append(Band(fromX: a.minX, fromY: fy, toX: b.minX, toY: ty, height: h, tint: Self.tint(to)))
            }
        }

        /// The last column's boxes under one of the third's (for an iPhone's list).
        func children(of id: String) -> [FinanceFlow.Node] {
            flow.links.filter { $0.from == id }.compactMap { l in flow.nodes.first { $0.id == l.to } }
        }

        static func tint(_ n: FinanceFlow.Node) -> Color {
            switch n.role {
            case .source: Theme.accent
            case .accounts, .cash: Theme.secondaryInk
            case .total: Theme.ink
            case .taxes: Color(light: 0x7C3AED, dark: 0xA78BFA)
            case .expenses, .spending: Theme.danger
            case .saved, .savedInto: Theme.info
            }
        }
    }
}
