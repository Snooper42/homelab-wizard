import Charts
import SwiftUI

// Cash Flow, Month in Review, and Recurring's calendar: worked out on the
// iPhone from the ledger and plan Finances already read (FinanceInsights).

// MARK: - Cash Flow

/// Money in against money out, month by month, and what was left.
struct FinanceCashFlowPage: View {
    @Bindable var finances: FinancesViewModel
    @State private var picked: Date?

    var body: some View {
        ScrollView {
            if let view = finances.plan, let ledger = finances.ledger {
                let thisMonth = Calendar.current.dateInterval(of: .month, for: view.today ?? Date())?.start ?? Date()
                let months = CashFlow.months(ledger.transactions, ending: thisMonth, count: 6, categories: view.categories)
                let shown = months.first { $0.month == (picked ?? thisMonth) } ?? months.last
                VStack(spacing: 18) {
                    if let shown { hero(shown, view) }
                    chart(months, picked: shown?.month, view)
                    list(months, view)
                    Text("Money in is what went to an income category; money out is what Spending counts. Money moved between your own accounts isn’t either.")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryInk)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 4)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 28)
                .animation(.smooth(duration: 0.35), value: picked)
            } else if let error = finances.ledgerError {
                ContentUnavailableView("Couldn't Read the Transactions", systemImage: "chart.bar", description: Text(verbatim: error))
                    .padding(.top, 80)
            } else {
                SkeletonCards(walletCard: false).padding(.horizontal, 16)
            }
        }
        .background(Theme.canvas.ignoresSafeArea())
        .task {
            if finances.plan == nil { await finances.loadPlan() }
            if finances.ledger == nil { await finances.loadLedger() }
        }
        .refreshable { await finances.loadLedger() }
        .navigationTitle("Cash Flow")
        .sensoryFeedback(.selection, trigger: picked)
    }

    private func hero(_ m: CashFlowMonth, _ view: FinancesPlanView) -> some View {
        let currency = view.plan.currency
        return VStack(alignment: .leading, spacing: 14) {
            Text(m.month, format: .dateTime.month(.wide).year())
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white.opacity(0.7))
            VStack(alignment: .leading, spacing: 2) {
                Text(m.net >= 0 ? "Left over" : "More out than in")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.75))
                Text(verbatim: amountText(abs(m.net), currency, finances, whole: true))
                    .font(.system(size: 38, weight: .heavy))
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            HStack(spacing: 18) {
                figure("In", m.income, Design.running, currency)
                figure("Out", m.spent, Color(light: 0xFF8FA3, dark: 0xFF8FA3), currency)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .heroCard()
        .accessibilityElement(children: .combine)
    }

    private func figure(_ title: String, _ value: Double, _ tint: Color, _ currency: String) -> some View {
        HStack(spacing: 6) {
            Circle().fill(tint).frame(width: 8, height: 8)
            Text(title).foregroundStyle(.white.opacity(0.75))
            Text(verbatim: amountText(value, currency, finances, whole: true))
                .fontWeight(.semibold)
                .monospacedDigit()
        }
        .font(.subheadline)
    }

    private func chart(_ months: [CashFlowMonth], picked: Date?, _ view: FinancesPlanView) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            CardHeading("Each Month")
            Chart {
                ForEach(months) { m in
                    BarMark(x: .value("Month", m.month, unit: .month), y: .value("Amount", m.income), width: .ratio(0.36))
                        .position(by: .value("Kind", "In"))
                        .foregroundStyle(Theme.success.opacity(m.month == picked ? 1 : 0.45))
                        .cornerRadius(4)
                    BarMark(x: .value("Month", m.month, unit: .month), y: .value("Amount", m.spent), width: .ratio(0.36))
                        .position(by: .value("Kind", "Out"))
                        .foregroundStyle(Theme.danger.opacity(m.month == picked ? 1 : 0.45))
                        .cornerRadius(4)
                }
            }
            .chartXAxis {
                AxisMarks(values: months.map(\.month)) { _ in
                    AxisValueLabel(format: .dateTime.month(.abbreviated), centered: true)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { value in
                    AxisGridLine().foregroundStyle(Theme.separator)
                    if let amount = value.as(Double.self), finances.amountsShown, !finances.amountsHiddenByPlan {
                        AxisValueLabel { Text(verbatim: amount.formatted(.number.notation(.compactName))) }
                    }
                }
            }
            .chartLegend(.hidden)
            .chartXSelection(value: Binding(get: { picked }, set: { date in
                if let date, let m = months.min(by: { abs($0.month.timeIntervalSince(date)) < abs($1.month.timeIntervalSince(date)) }) {
                    self.picked = m.month
                }
            }))
            .frame(height: 170)
            HStack(spacing: 14) {
                legend("Money in", Theme.success)
                legend("Money out", Theme.danger)
            }
            .font(.caption)
        }
        .padding(16)
        .card(radius: 24)
    }

    private func legend(_ title: String, _ tint: Color) -> some View {
        HStack(spacing: 5) {
            RoundedRectangle(cornerRadius: 2).fill(tint).frame(width: 10, height: 10)
            Text(title).foregroundStyle(Theme.secondaryInk)
        }
    }

    private func list(_ months: [CashFlowMonth], _ view: FinancesPlanView) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(months.reversed().enumerated()), id: \.element.id) { i, m in
                Button {
                    withAnimation(.snappy) { picked = m.month }
                } label: {
                    HStack {
                        Text(m.month, format: .dateTime.month(.wide))
                            .foregroundStyle(Theme.ink)
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(verbatim: "\(m.net >= 0 ? "+" : "−")\(amountText(abs(m.net), view.plan.currency, finances, whole: true))")
                                .fontWeight(.semibold)
                                .foregroundStyle(m.net >= 0 ? Theme.success : Theme.danger)
                            Text(verbatim: "\(amountText(m.income, view.plan.currency, finances, whole: true)) in · \(amountText(m.spent, view.plan.currency, finances, whole: true)) out")
                                .font(.caption)
                                .foregroundStyle(Theme.secondaryInk)
                        }
                        .monospacedDigit()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 11)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                if i < months.count - 1 { Divider().padding(.leading, 16) }
            }
        }
        .card(radius: 24)
    }
}

// MARK: - Month in Review

/// Each month told back, one page each, swiped sideways: the newest last,
/// where it opens.
struct MonthReviewPage: View {
    @Bindable var finances: FinancesViewModel
    @State private var shown: Date?

    var body: some View {
        Group {
            if let view = finances.plan, let ledger = finances.ledger {
                let latest = view.today ?? Date()
                let months = Array(MonthReview.months(in: ledger.transactions, upTo: latest).suffix(12))
                if months.isEmpty {
                    ContentUnavailableView("Nothing to Review Yet", systemImage: "calendar",
                                           description: Text("Once the computer has a month of transactions, it’s told back here."))
                } else {
                    ScrollView(.horizontal) {
                        LazyHStack(spacing: 0) {
                            ForEach(months, id: \.self) { month in
                                ScrollView {
                                    MonthReviewCards(review: MonthReview.make(ledger.transactions, month: month, categories: view.categories),
                                                     view: view, finances: finances)
                                        .padding(.horizontal, 16)
                                        .padding(.bottom, 28)
                                }
                                .containerRelativeFrame(.horizontal)
                                .id(month)
                            }
                        }
                        .scrollTargetLayout()
                    }
                    .scrollTargetBehavior(.paging)
                    .scrollIndicators(.hidden)
                    .scrollPosition(id: $shown)
                    .defaultScrollAnchor(.trailing)
                    .sensoryFeedback(.selection, trigger: shown)
                }
            } else if let error = finances.ledgerError {
                ContentUnavailableView("Couldn't Read the Transactions", systemImage: "calendar", description: Text(verbatim: error))
            } else {
                ScrollView { SkeletonCards(walletCard: false).padding(.horizontal, 16) }
            }
        }
        .background(Theme.canvas.ignoresSafeArea())
        .task {
            if finances.plan == nil { await finances.loadPlan() }
            if finances.ledger == nil { await finances.loadLedger() }
        }
        .navigationTitle("Month in Review")
    }
}

private struct MonthReviewCards: View {
    let review: MonthReview
    let view: FinancesPlanView
    let finances: FinancesViewModel

    private var currency: String { view.plan.currency }
    private var before: Date {
        Calendar.current.date(byAdding: .month, value: -1, to: review.month) ?? review.month
    }

    var body: some View {
        VStack(spacing: 18) {
            hero
            if !review.categories.isEmpty { whereItWent }
            HStack(spacing: 12) {
                tile("Came in", review.income, Theme.success)
                tile(review.saved >= 0 ? "Left over" : "Over by", abs(review.saved), review.saved >= 0 ? Theme.accent : Theme.danger)
            }
            if review.grewMost != nil || review.shrankMost != nil { changes }
            if let biggest = review.biggest {
                VStack(alignment: .leading, spacing: 10) {
                    CardHeading("Biggest Purchase")
                    WalletTransactionRow(transaction: biggest, finances: finances, isNew: false)
                }
                .padding(16)
                .card(radius: 24)
            }
            Text("Swipe for other months.")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryInk)
                .frame(maxWidth: .infinity)
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(review.month, format: .dateTime.month(.wide).year())
                .font(.title2.weight(.bold))
            VStack(alignment: .leading, spacing: 2) {
                Text("You spent")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.75))
                Text(verbatim: amountText(review.spent, currency, finances, whole: true))
                    .font(.system(size: 40, weight: .heavy))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            if let change = review.change {
                let less = change < 0
                Label {
                    Text(verbatim: "\(abs(change).formatted(.percent.precision(.fractionLength(0)))) \(less ? "less" : "more") than \(before.formatted(.dateTime.month(.wide)))")
                } icon: {
                    Image(systemName: less ? "arrow.down.right" : "arrow.up.right")
                }
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background((less ? Design.running : Color(light: 0xFF8FA3, dark: 0xFF8FA3)).opacity(0.22), in: Capsule())
            }
            Text(verbatim: "\(review.purchases) purchase\(review.purchases == 1 ? "" : "s")")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.65))
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .heroCard()
        .accessibilityElement(children: .combine)
    }

    private var whereItWent: some View {
        let high = max(review.categories.map(\.spent).max() ?? 1, 1)
        return VStack(alignment: .leading, spacing: 12) {
            CardHeading("Where It Went")
            ForEach(Array(review.categories.enumerated()), id: \.element.id) { i, c in
                VStack(alignment: .leading, spacing: 5) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(verbatim: c.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                            .lineLimit(1)
                        Spacer(minLength: 6)
                        Text(verbatim: amountText(c.spent, currency, finances, whole: true))
                            .font(.subheadline.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(Theme.ink)
                    }
                    GeometryReader { geo in
                        Capsule().fill(Theme.canvas)
                            .overlay(alignment: .leading) {
                                Capsule().fill(tint(c.name, i)).frame(width: max(6, geo.size.width * c.spent / high))
                            }
                    }
                    .frame(height: 7)
                    if c.before > 0, abs(c.change) >= 1 {
                        Text(verbatim: "\(c.change > 0 ? "+" : "−")\(amountText(abs(c.change), currency, finances, whole: true)) on \(before.formatted(.dateTime.month(.wide)))")
                            .font(.caption)
                            .foregroundStyle(c.change > 0 ? Theme.danger : Theme.success)
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
        .padding(16)
        .card(radius: 24)
    }

    private var changes: some View {
        VStack(alignment: .leading, spacing: 10) {
            CardHeading("What Changed")
            if let grew = review.grewMost {
                change(grew, symbol: "arrow.up.right.circle.fill", tint: Theme.danger, verb: "up")
            }
            if let shrank = review.shrankMost {
                change(shrank, symbol: "arrow.down.right.circle.fill", tint: Theme.success, verb: "down")
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(radius: 24)
    }

    private func change(_ c: MonthReview.Category, symbol: String, tint: Color, verb: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: symbol).font(.title3).foregroundStyle(tint)
            Text(verbatim: "\(c.name) was \(verb) \(amountText(abs(c.change), currency, finances, whole: true)) on \(before.formatted(.dateTime.month(.wide)))")
                .font(.subheadline)
                .foregroundStyle(Theme.ink)
        }
        .accessibilityElement(children: .combine)
    }

    private func tile(_ title: String, _ value: Double, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryInk)
            Text(verbatim: amountText(value, currency, finances, whole: true))
                .font(.tileNumber)
                .monospacedDigit()
                .foregroundStyle(tint)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(radius: 20)
        .accessibilityElement(children: .combine)
    }

    private func tint(_ name: String, _ index: Int) -> Color {
        if name == Spending.uncategorized { return Color(light: 0x8E8E93, dark: 0x8E8E93) }
        let hue = PayeeLogos.shared.categoryHue(name, in: view.categories)
        return Design.category(hue > 0 ? hue : index % 8 + 1)?.base ?? Theme.accent
    }
}

// MARK: - Recurring's calendar

/// This month as a calendar, a dot on each day a repeating payment lands
/// (green for money in, red for a bill, violet for a subscription); a day
/// tapped lists what comes then.
struct RecurringCalendarCard: View {
    let view: FinancesPlanView
    let finances: FinancesViewModel
    @State private var picked: Date?

    private let calendar = Calendar.current

    var body: some View {
        let today = calendar.startOfDay(for: view.today ?? Date())
        let days = view.recurringCalendar(in: today)
        let byDay = Dictionary(days.map { ($0.day, $0) }, uniquingKeysWith: { a, _ in a })
        let shown = picked ?? days.first { $0.day >= today }?.day
        VStack(alignment: .leading, spacing: 12) {
            CardHeading(LocalizedStringKey(today.formatted(.dateTime.month(.wide))))
            weekdayHeader
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 7), spacing: 6) {
                ForEach(Array(cells(for: today).enumerated()), id: \.offset) { _, day in
                    if let day {
                        dayCell(day, today: today, entry: byDay[day], selected: day == shown)
                    } else {
                        Color.clear.frame(height: 40)
                    }
                }
            }
            if let shown, let entry = byDay[shown] {
                Divider()
                Text(shown, format: .dateTime.weekday(.wide).month(.wide).day())
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.secondaryInk)
                ForEach(entry.items) { item in
                    HStack(spacing: 10) {
                        LogoCircle(payment: item.payment, size: 30)
                        Text(verbatim: item.payment.name)
                            .font(.subheadline)
                            .foregroundStyle(Theme.ink)
                            .lineLimit(1)
                        Spacer(minLength: 6)
                        Text(verbatim: "\(item.estimate ? "≈ " : "")\(amountText(item.amount, view.plan.currency, finances))")
                            .font(.subheadline.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(item.sort == .moneyIn ? Theme.success : Theme.ink)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .padding(16)
        .card(radius: 24)
        .animation(.smooth(duration: 0.25), value: picked)
        .sensoryFeedback(.selection, trigger: picked)
    }

    private var weekdayHeader: some View {
        let symbols = calendar.veryShortStandaloneWeekdaySymbols
        let first = calendar.firstWeekday - 1
        let ordered = Array(symbols[first...] + symbols[..<first])
        return HStack(spacing: 2) {
            ForEach(Array(ordered.enumerated()), id: \.offset) { _, s in
                Text(verbatim: s)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Theme.secondaryInk)
                    .frame(maxWidth: .infinity)
            }
        }
        .accessibilityHidden(true)
    }

    /// The month's days in weeks, with blanks before the first.
    private func cells(for month: Date) -> [Date?] {
        guard let range = calendar.dateInterval(of: .month, for: month),
              let count = calendar.range(of: .day, in: .month, for: month)?.count else { return [] }
        let lead = (calendar.component(.weekday, from: range.start) - calendar.firstWeekday + 7) % 7
        let days = (0..<count).compactMap { calendar.date(byAdding: .day, value: $0, to: range.start) }
        return Array(repeating: nil, count: lead) + days.map { Optional($0) }
    }

    private func dayCell(_ day: Date, today: Date, entry: RecurringDay?, selected: Bool) -> some View {
        let isToday = day == today
        return Button {
            picked = day
        } label: {
            VStack(spacing: 3) {
                Text(day, format: .dateTime.day())
                    .font(.subheadline.weight(isToday || selected ? .bold : .regular))
                    .monospacedDigit()
                    .foregroundStyle(selected ? .white : day < today ? Theme.secondaryInk : Theme.ink)
                    .frame(width: 30, height: 30)
                    .background {
                        if selected {
                            Circle().fill(Theme.accent)
                        } else if isToday {
                            Circle().strokeBorder(Theme.accent, lineWidth: 1.5)
                        }
                    }
                HStack(spacing: 2) {
                    ForEach(Array(Set((entry?.items ?? []).map(\.sort))).sorted { $0.rawValue < $1.rawValue }.prefix(3), id: \.self) { sort in
                        Circle().fill(Self.tint(sort)).frame(width: 5, height: 5)
                    }
                }
                .frame(height: 5)
            }
            .frame(maxWidth: .infinity, minHeight: 40)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(entry == nil)
        .accessibilityLabel(Text(verbatim: "\(day.formatted(.dateTime.month(.wide).day())): \(entry.map { "\($0.items.count) payment\($0.items.count == 1 ? "" : "s")" } ?? "nothing")"))
    }

    static func tint(_ sort: RecurringItem.Sort) -> Color {
        switch sort {
        case .moneyIn: Theme.success
        case .subscriptions: Color(light: 0x7C3AED, dark: 0xA78BFA)
        case .bills: Theme.danger
        case .cards: Theme.info
        case .savings: Theme.secondaryInk
        }
    }
}
