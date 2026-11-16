import SwiftUI

/// Money flow on Cash Flow (the owner's pick on the mocks canvas, Nov 15),
/// as the computer's: where a month's money came from, all of it together,
/// then taxes, spending and saved, and on to each kind of spending and each
/// account it was saved in (`FinanceFlow`). A month the ledger has, or a
/// typical month from the plan. On an iPhone the last column is listed
/// under its box; wide, all four are drawn.
struct MoneyFlowCard: View {
    @Bindable var finances: FinancesViewModel
    @State private var view: JSONValue?
    @State private var ledger: JSONValue?
    /// "" for a typical month, else "yyyy-MM".
    @State private var month: String?
    @State private var width: CGFloat = 360

    /// The ledger's months, none before Track from's.
    private var months: [String] {
        let from = finances.plan?.plan.trackFrom.map { String($0.prefix(7)) } ?? ""
        return FinanceFlow.ledgerMonths(ledger).filter { $0 >= from }
    }
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
                        Text("Money Flow").font(.title3.weight(.bold)).foregroundStyle(Theme.ink)
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
                    Text(verbatim: lead(flow))
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryInk)
                    SankeyDrawing(flow: flow, columns: wide ? 4 : 3, money: money)
                        .frame(height: wide ? 380 : 340)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(Text(verbatim: said(flow)))
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .card(radius: 24)
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .task(id: finances.wholeVersion) {
            guard let whole = finances.wholeView() else { return }
            view = await FinancesViewModel.wholeJSON(from: whole)
            ledger = whole.ledger
        }
    }

    private func money(_ n: Double) -> String {
        guard let view = finances.plan else { return "" }
        return amountText(n, view.plan.currency, finances, whole: true)
    }

    private func lead(_ f: FinanceFlow) -> String {
        let when = shownMonth.isEmpty ? "A typical month, from the plan" : "\(Self.monthWords(shownMonth)), from your transactions"
        if f.saved < 0 { return "\(when): \(money(-f.saved)) more went out than came in." }
        return "\(when): \(money(f.income)) in, \(money(f.expenses)) spent\(f.taxes > 0.005 ? ", \(money(f.taxes)) in taxes" : ""), \(money(f.saved)) left."
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
                    label(box, layout)
                        .position(x: box.labelX, y: box.rect.midY)
                }
            }
        }
    }

    @ViewBuilder
    private func label(_ box: Layout.Box, _ layout: Layout) -> some View {
        let lines = columns == 3 && box.node.col == 2 ? layout.children(of: box.node.id) : []
        VStack(alignment: box.leading ? .leading : .trailing, spacing: 1) {
            Text(verbatim: box.node.label).font(.caption2.weight(.semibold)).foregroundStyle(Theme.ink)
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
