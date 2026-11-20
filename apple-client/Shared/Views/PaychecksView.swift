import SwiftUI

/// Finances › Paychecks (the owner's yes, Nov 19, on the canvas's *Idea:
/// Paychecks*), as the computer's Plan › Paychecks: each person's pay and
/// where it goes, then the next paychecks month by month (`Paychecks`).
struct FinancePaychecksPage: View {
    @Bindable var finances: FinancesViewModel
    @State private var paychecks: Paychecks?

    private var currency: String { finances.plan?.plan.currency ?? "USD" }
    private var thisYear: String { String((finances.plan?.todayText ?? "").prefix(4)) }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let paychecks {
                    if paychecks.people.isEmpty {
                        Text("No paychecks typed in yet. Add someone who gets paid on the computer's Plan › Paychecks.")
                            .foregroundStyle(Theme.secondaryInk)
                            .padding(18)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .card(radius: 24)
                    }
                    ForEach(paychecks.people) { person in
                        if person.parts.isEmpty && person.deductions.isEmpty {
                            simpleCard(person)
                        } else {
                            personCard(person)
                        }
                    }
                    if !paychecks.months.isEmpty {
                        nextCard(paychecks.months)
                    }
                } else {
                    ProgressView().padding(40)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 28)
        }
        .background(Theme.canvas.ignoresSafeArea())
        .navigationTitle("Paychecks")
        .refreshable { await finances.loadPlan() }
        .task(id: finances.wholeVersion) {
            guard let whole = finances.wholeView(), let view = await FinancesViewModel.wholeJSON(from: whole) else { return }
            paychecks = Paychecks(view: view)
        }
    }

    // MARK: Each person's pay

    private func header(_ p: Paychecks.Person) -> some View {
        HStack(spacing: 12) {
            LogoCircle(payee: p.name, size: 36)
            VStack(alignment: .leading, spacing: 1) {
                Text(verbatim: p.name).font(.headline).foregroundStyle(Theme.ink)
                Text(verbatim: "\(p.how) · into \(p.into)").font(.footnote).foregroundStyle(Theme.secondaryInk)
            }
            Spacer(minLength: 8)
        }
    }

    /// Someone with only a take-home typed in: one line, or the amount under
    /// the name where the line doesn't fit (it wrapped "into Chase Checking"
    /// beside the amount on the iPhone, light-paychecks, Nov 20).
    private func simpleCard(_ p: Paychecks.Person) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 12) {
                header(p).fixedSize(horizontal: true, vertical: false)
                Spacer(minLength: 8)
                takeHome(p)
            }
            VStack(alignment: .leading, spacing: 8) {
                header(p)
                takeHome(p).padding(.leading, 48)
            }
        }
        .padding(16)
        .card(radius: 24)
        .accessibilityElement(children: .combine)
    }

    private func takeHome(_ p: Paychecks.Person) -> some View {
        Money(value: p.net, currency: currency, finances: finances)
            .font(.headline)
            .monospacedDigit()
    }

    private func personCard(_ p: Paychecks.Person) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            header(p)
            VStack(alignment: .leading, spacing: 2) {
                Money(value: p.net, currency: currency, finances: finances)
                    .font(.title.weight(.bold))
                    .monospacedDigit()
                Text(verbatim: "Take-home, each paycheck · about \(amountText(p.perYear, currency, finances, whole: true)) a year")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryInk)
            }
            .accessibilityElement(children: .combine)
            if !p.parts.isEmpty, let gross = p.gross, gross > 0 {
                PayBar(parts: p.parts, gross: gross)
                    .frame(height: 10)
                    .accessibilityElement()
                    .accessibilityLabel(Text(verbatim: barWords(p, gross: gross)))
                legend(p.parts)
            }
            VStack(spacing: 0) {
                if let gross = p.gross {
                    payRow("Gross", sub: nil, value: gross)
                }
                ForEach(Array(p.deductions.enumerated()), id: \.offset) { _, d in
                    payRow(d.name, sub: d.into.map { "into \($0)" }, value: -d.amount)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(radius: 24)
    }

    /// "Alex's pay: Take-home 77%, 401(k) 8%, …", for VoiceOver.
    private func barWords(_ p: Paychecks.Person, gross: Double) -> String {
        let shares = p.parts.map { part -> String in
            let percent = Int((part.value / gross * 100).rounded())
            return "\(part.label) \(percent)%"
        }
        return "\(p.name)'s pay: " + shares.joined(separator: ", ")
    }

    private func legend(_ parts: [Paychecks.Part]) -> some View {
        // Wraps on a narrow screen or at large text.
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 12) { ForEach(Array(parts.enumerated()), id: \.offset) { _, part in key(part) } }
            VStack(alignment: .leading, spacing: 4) { ForEach(Array(parts.enumerated()), id: \.offset) { _, part in key(part) } }
        }
        .accessibilityHidden(true)
    }

    private func key(_ part: Paychecks.Part) -> some View {
        HStack(spacing: 4) {
            Circle().fill(payTint(part.kind)).frame(width: 8, height: 8)
            Text(verbatim: part.label).font(.caption).foregroundStyle(Theme.secondaryInk).lineLimit(1)
        }
    }

    private func payRow(_ title: String, sub: String?, value: Double) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(verbatim: title).foregroundStyle(Theme.ink)
            if let sub {
                Text(verbatim: sub).font(.footnote).foregroundStyle(Theme.secondaryInk)
            }
            Spacer(minLength: 8)
            Money(value: value, currency: currency, finances: finances, signed: value < 0)
                .monospacedDigit()
        }
        .font(.subheadline)
        .padding(.vertical, 7)
        .accessibilityElement(children: .combine)
    }

    // MARK: The next paychecks

    private func nextCard(_ months: [Paychecks.Month]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Next Paychecks").font(.title3.weight(.bold)).foregroundStyle(Theme.ink)
            ForEach(months) { m in
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(verbatim: monthTitle(m)).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.ink)
                        Spacer(minLength: 8)
                        Money(value: m.total, currency: currency, finances: finances, signed: true)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.success)
                            .monospacedDigit()
                    }
                    .padding(.top, 8)
                    .accessibilityElement(children: .combine)
                    ForEach(m.paydays) { day in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(verbatim: dayWords(day.date)).foregroundStyle(Theme.ink)
                                Text(verbatim: day.who.joined(separator: " and ")).font(.footnote).foregroundStyle(Theme.secondaryInk)
                                ForEach(day.moved, id: \.self) { moved in
                                    Text(verbatim: moved).font(.caption).foregroundStyle(Theme.secondaryInk)
                                }
                            }
                            Spacer(minLength: 8)
                            Money(value: day.total, currency: currency, finances: finances, signed: true)
                                .monospacedDigit()
                        }
                        .font(.subheadline)
                        .padding(.vertical, 6)
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(radius: 24)
    }

    /// "December · 3 paychecks", the year when it isn't this one, and ", to Dec 18" when the month isn't read to its end.
    private func monthTitle(_ m: Paychecks.Month) -> String {
        let date = FinanceCalendar.shown(m.month + "-01")
        let name = date.map { m.month.hasPrefix(thisYear) ? $0.formatted(.dateTime.month(.wide)) : $0.formatted(.dateTime.month(.wide).year()) } ?? m.month
        let count = m.paydays.count == 1 ? "1 paycheck" : "\(m.paydays.count) paychecks"
        let to = !m.whole ? m.paydays.last.map { ", to \(shortDay($0.date))" } ?? "" : ""
        return "\(name) · \(count)\(to)"
    }

    private func dayWords(_ day: String) -> String {
        FinanceCalendar.shown(day)?.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()) ?? day
    }

    private func shortDay(_ day: String) -> String {
        FinanceCalendar.shown(day)?.formatted(.dateTime.month(.abbreviated).day()) ?? day
    }
}

/// A part of a person's pay, as its colour in the bar and the legend.
private func payTint(_ kind: Paychecks.Part.Kind) -> Color {
    switch kind {
    case .takeHome: Theme.success
    case .saved: Theme.info
    case .taken: Theme.accent
    case .taxes: Theme.secondaryInk.opacity(0.45)
    }
}

/// A person's gross as one bar: take-home, what's taken out, taxes and the rest.
private struct PayBar: View {
    let parts: [Paychecks.Part]
    let gross: Double

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: 2) {
                ForEach(Array(parts.enumerated()), id: \.offset) { _, part in
                    Rectangle()
                        .fill(payTint(part.kind))
                        .frame(width: max(2, geo.size.width * part.value / max(gross, 1) - 2))
                }
            }
        }
        .clipShape(Capsule())
    }
}
