import SwiftUI

/// Finances › Calendar (the owner's pick on the mocks canvas, Nov 15): the
/// money month by month, as the computer's Calendar. Each day shows its
/// paydays and payments as logos and checking at its end, outlined in
/// orange under the cushion; days before today what was recorded. Tap a day
/// for what moves on it and, where Finances may change, Add a Transaction on
/// it (today or before) or Add a Payment (after), as the computer's day card;
/// a recorded transaction opens its page, as on Transactions.
/// Wide (an iPad), the day and the month in all sit beside the month.
struct FinanceCalendarView: View {
    @Bindable var finances: FinancesViewModel
    @State private var calendar: FinanceCalendar?
    @State private var month = ""
    @State private var picked = ""
    @State private var width: CGFloat = 390
    @State private var addingOn: Date?
    @State private var recordingOn: Date?

    private var wide: Bool { width >= 720 }

    var body: some View {
        ScrollView {
            if let cal = calendar, let view = finances.plan {
                if cal.days.isEmpty {
                    Text("Nothing to show yet: add a checking account, a paycheck, and the payments that repeat.")
                        .foregroundStyle(Theme.secondaryInk)
                        .padding(18)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .card()
                        .padding(16)
                } else if wide {
                    HStack(alignment: .top, spacing: 16) {
                        monthCard(cal, view)
                        VStack(spacing: 16) {
                            dayCard(cal, view)
                            summaryCard(cal, view)
                        }
                        .frame(width: 300)
                    }
                    .padding(16)
                } else {
                    VStack(spacing: 16) {
                        monthCard(cal, view)
                        dayCard(cal, view)
                        summaryCard(cal, view)
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 28)
                }
            } else {
                ProgressView().padding(40)
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .background(Theme.canvas.ignoresSafeArea())
        .navigationTitle("Calendar")
        .refreshable {
            await finances.loadPlan()
            await finances.loadLedger()
        }
        // Worked out again, off the main thread, when the view or the ledger behind it changes.
        .task(id: finances.wholeVersion) {
            guard let whole = finances.wholeView() else { return }
            guard let cal = await FinancesViewModel.calendar(from: whole) else { return }
            calendar = cal
            if month.isEmpty || cal.days[picked] == nil {
                picked = cal.opening
                month = FinanceCalendar.month(of: cal.opening)
            }
        }
        .sheet(item: Binding(get: { addingOn.map(AddingOn.init) }, set: { addingOn = $0?.date })) { on in
            AddPaymentView(finances: finances, startOn: on.date)
        }
        .sheet(item: Binding(get: { recordingOn.map(AddingOn.init) }, set: { recordingOn = $0?.date })) { on in
            FinancesView.addTransaction(on: on.date, finances: finances)
        }
    }

    private struct AddingOn: Identifiable {
        let date: Date
        var id: Date { date }
    }

    // MARK: The month

    private func monthCard(_ cal: FinanceCalendar, _ view: FinancesPlanView) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(verbatim: monthTitle(month))
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                Spacer(minLength: 8)
                Button("Today") { go(cal.opening, cal) }
                    .disabled(picked == cal.opening)
                Button { turn(-1, cal) } label: { Label("The Month Before", systemImage: "chevron.left") }
                    .labelStyle(.iconOnly)
                    .disabled(!cal.canTurn(from: month, by: -1))
                Button { turn(1, cal) } label: { Label("The Month After", systemImage: "chevron.right") }
                    .labelStyle(.iconOnly)
                    .disabled(!cal.canTurn(from: month, by: 1))
            }
            .buttonStyle(.borderless)
            Text(verbatim: lead(cal, view))
                .font(.footnote)
                .foregroundStyle(cal.lowDays(in: month) > 0 ? Theme.warning : Theme.secondaryInk)
                .fixedSize(horizontal: false, vertical: true)
            let columns = Array(repeating: GridItem(.flexible(), spacing: 3), count: 7)
            LazyVGrid(columns: columns, spacing: 3) {
                ForEach(FinanceCalendar.weekdayLetters(mondayFirst: cal.mondayFirst), id: \.self) { name in
                    Text(verbatim: name)
                        .font(.caption2)
                        .foregroundStyle(Theme.secondaryInk)
                        .accessibilityHidden(true)
                }
                ForEach(Array(cal.weeks(of: month).joined().enumerated()), id: \.offset) { _, day in
                    if let day {
                        cell(day, cal, view)
                    } else {
                        Color.clear.frame(height: cellHeight).accessibilityHidden(true)
                    }
                }
            }
            #if os(iOS)
            .sensoryFeedback(.selection, trigger: picked)
            #endif
        }
        .padding(.top, 8)
    }

    private var cellHeight: CGFloat { wide ? 92 : 54 }

    @ViewBuilder
    private func cell(_ date: String, _ cal: FinanceCalendar, _ view: FinancesPlanView) -> some View {
        let day = cal.days[date]
        let isToday = date == cal.today
        let isPicked = date == picked
        let numberTint: Color = isToday ? .white : day == nil ? Theme.secondaryInk.opacity(0.5) : Theme.ink
        let fill: Color = day.map { $0.past ? Theme.surface.opacity(0.55) : Theme.surface } ?? .clear
        let edge: Color = isPicked ? Theme.accent : day?.low == true ? Theme.warning : .clear
        let number = String(Int(date.suffix(2)) ?? 0)
        Button {
            if day != nil { picked = date }
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: number)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, isToday ? 5 : 0)
                    .background(isToday ? Theme.accentFill : Color.clear, in: Capsule())
                    .foregroundStyle(numberTint)
                if wide, let holiday = day?.holiday {
                    Text(verbatim: holiday).font(.system(size: 9)).foregroundStyle(Theme.secondaryInk).lineLimit(1)
                }
                if let day { marks(day, view) }
                Spacer(minLength: 0)
                if let day, let figure = cellFigure(day) {
                    Text(verbatim: figure.text)
                        .font(.system(size: wide ? 11 : 9, weight: day.low ? .semibold : .regular))
                        .monospacedDigit()
                        .foregroundStyle(figure.tint)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
            }
            .padding(4)
            .frame(maxWidth: .infinity, minHeight: cellHeight, maxHeight: cellHeight, alignment: .topLeading)
            .background(fill, in: RoundedRectangle(cornerRadius: 8))
            .overlay {
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(edge, lineWidth: isPicked ? 2 : 1.5)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(day == nil)
        .accessibilityLabel(Text(verbatim: day.map { said($0, cal, view) } ?? dayWords(date)))
        .accessibilityAddTraits(isPicked ? .isSelected : [])
    }

    /// What a day's cell says at its foot: checking at its end, or before
    /// today what was recorded; nothing planned past what's read, or hidden.
    private func cellFigure(_ day: FinanceCalendar.Day) -> (text: String, tint: Color)? {
        guard finances.amountsShown, !finances.amountsHiddenByPlan else { return nil }
        if day.past {
            guard day.spent.contains(where: { $0.to == nil }) else { return nil }
            return ((day.net > 0 ? "+" : "") + compact(day.net), day.net > 0 ? Theme.success : Theme.secondaryInk)
        }
        if day.later { return nil }
        return (compact(day.balance), day.low ? Theme.warning : Theme.secondaryInk)
    }

    private func marks(_ day: FinanceCalendar.Day, _ view: FinancesPlanView) -> some View {
        let size: CGFloat = wide ? 18 : 8
        let shown = 3
        return HStack(spacing: 2) {
            if day.past {
                ForEach(day.spent.prefix(shown)) { t in
                    LogoCircle(payee: t.payee.isEmpty ? "?" : t.payee, size: size)
                }
                if day.spent.count > shown { more(day.spent.count - shown) }
            } else {
                let all = day.events.filter(\.isPayday) + day.events.filter { !$0.isPayday } + day.charges
                ForEach(Array(all.prefix(shown).enumerated()), id: \.offset) { _, e in mark(e, view, size: size) }
                if all.count > shown { more(all.count - shown) }
            }
        }
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private func mark(_ e: FinanceCalendar.Event, _ view: FinancesPlanView, size: CGFloat) -> some View {
        if !e.isPayday, let id = e.payment, let payment = view.payment(id) {
            LogoCircle(payment: payment, size: size)
        } else {
            LogoCircle(payee: e.isPayday ? view.names(e.people) : (e.payment ?? "?"), size: size)
        }
    }

    private func more(_ n: Int) -> some View {
        Text(verbatim: "+\(n)").font(.system(size: 8)).foregroundStyle(Theme.secondaryInk)
    }

    // MARK: The day picked

    @ViewBuilder
    private func dayCard(_ cal: FinanceCalendar, _ view: FinancesPlanView) -> some View {
        if let day = cal.days[picked] {
            VStack(alignment: .leading, spacing: 12) {
                Text(verbatim: dayWords(day.date) + (day.date == cal.today ? ", today" : ""))
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                if day.past {
                    figure(day.net, signed: true, tint: day.net > 0 ? Theme.success : Theme.ink, caption: "What your transactions recorded")
                } else if day.later {
                    Text("Checking is read ahead to \(shortDay(cal.read)), so its balance isn't shown.")
                        .font(.footnote).foregroundStyle(Theme.secondaryInk)
                } else {
                    figure(day.balance, signed: false, tint: day.balance < 0 ? Theme.danger : day.low ? Theme.warning : Theme.ink,
                           caption: day.low ? "In checking at the end of the day, under your \(amountText(cal.cushion, view.plan.currency, finances, whole: true)) cushion"
                                            : "In checking at the end of the day")
                }
                let notes = [day.holiday.map { "\($0): the banks \(day.past ? "were" : "are") closed." }].compactMap { $0 }
                    + day.moved.map { "\(cal.name(of: $0.person))'s payday moved from \(shortDay($0.from)): \($0.why)." }
                if !notes.isEmpty {
                    Text(verbatim: notes.joined(separator: " ")).font(.footnote).foregroundStyle(Theme.secondaryInk)
                }
                if !day.past {
                    ForEach(Array((day.events.filter(\.isPayday) + day.events.filter { !$0.isPayday }).enumerated()), id: \.offset) { _, e in
                        eventRow(e, cal, view, charge: false)
                    }
                    ForEach(Array(day.charges.enumerated()), id: \.offset) { _, e in eventRow(e, cal, view, charge: true) }
                    if day.events.isEmpty && day.charges.isEmpty {
                        Text("Nothing comes or goes.").font(.subheadline).foregroundStyle(Theme.secondaryInk)
                    }
                }
                if !day.spent.isEmpty {
                    if !day.past {
                        Text("Recorded today").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.secondaryInk)
                    }
                    ForEach(day.spent) { t in
                        if let found = finances.ledger?.transactions.first(where: { $0.id == t.id }) {
                            NavigationLink {
                                FinancesView.transactionPage(found, finances: finances)
                            } label: {
                                recordedRow(t, view, opens: true)
                            }
                            .buttonStyle(.plain)
                        } else {
                            recordedRow(t, view, opens: false)
                        }
                    }
                } else if day.past {
                    Text("Nothing was recorded.").font(.subheadline).foregroundStyle(Theme.secondaryInk)
                }
                if let date = FinanceCalendar.shown(day.date) {
                    let adding = FinanceCalendar.adding(on: day.date, today: cal.today)
                    if adding == .transaction, finances.canAddTransactions {
                        Button("Add a Transaction on This Day") {
                            finances.clearSaveError()
                            recordingOn = date
                        }
                        .buttonStyle(.borderless)
                    } else if adding == .payment, finances.canEditPlan {
                        Button("Add a Payment on This Day") { addingOn = date }
                            .buttonStyle(.borderless)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .card()
        }
    }

    /// One recorded transaction: its logo, payee and amount; a chevron when it opens.
    private func recordedRow(_ t: FinanceCalendar.Recorded, _ view: FinancesPlanView, opens: Bool) -> some View {
        HStack(spacing: 10) {
            LogoCircle(payee: t.payee.isEmpty ? "?" : t.payee, size: 28)
            Text(verbatim: t.payee.isEmpty ? "No payee" : t.payee).lineLimit(1)
            Spacer(minLength: 8)
            if t.to != nil {
                Text("Moved").font(.caption).foregroundStyle(Theme.secondaryInk)
            }
            Money(value: t.amount, currency: view.plan.currency, finances: finances, signed: true)
            if opens {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.secondaryInk)
                    .accessibilityHidden(true)
            }
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func figure(_ value: Double, signed: Bool, tint: Color, caption: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(verbatim: (signed && value > 0 ? "+" : "") + amountText(value, finances.currency, finances))
                .font(.title2.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(tint)
            Text(verbatim: caption).font(.footnote).foregroundStyle(Theme.secondaryInk)
        }
        .accessibilityElement(children: .combine)
    }

    private func eventRow(_ e: FinanceCalendar.Event, _ cal: FinanceCalendar, _ view: FinancesPlanView, charge: Bool) -> some View {
        HStack(spacing: 10) {
            mark(e, view, size: 28)
            VStack(alignment: .leading, spacing: 1) {
                Text(verbatim: cal.named(e, payments: names(view))).lineLimit(1)
                if charge {
                    let card = e.card.flatMap { id in view.plan.accounts.first { $0.id == id }?.name } ?? "a card"
                    Text(verbatim: "On \(card)" + (e.due.map { ", due \(shortDay($0))" } ?? ""))
                        .font(.caption).foregroundStyle(Theme.secondaryInk)
                }
            }
            Spacer(minLength: 8)
            Money(value: charge ? -e.amount : e.amount, currency: view.plan.currency, finances: finances, signed: !charge)
                .foregroundStyle(charge ? Theme.secondaryInk : e.amount > 0 ? Theme.success : Theme.ink)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: The month in all

    private func summaryCard(_ cal: FinanceCalendar, _ view: FinancesPlanView) -> some View {
        let s = cal.summary(of: month)
        let currency = view.plan.currency
        return VStack(alignment: .leading, spacing: 10) {
            Text(verbatim: "\(monthName(month)) in all").font(.headline).foregroundStyle(Theme.ink)
            if s.paychecks > 0 {
                summaryRow("Paychecks", "\(plural(s.paychecks, "paycheck")) · \(s.who.joined(separator: ", "))", s.paid, currency, tint: Theme.success, signed: true)
            }
            if s.comesIn > 0 {
                summaryRow("Money coming in", plural(s.comesIn, "payment"), s.came, currency, tint: Theme.success, signed: true)
            }
            if s.bills > 0 {
                summaryRow("Bills and payments", "\(plural(s.bills, "payment")) from checking", s.billed, currency, tint: Theme.ink, signed: true)
            }
            if s.charges > 0 {
                summaryRow("Charged to cards", "\(plural(s.charges, "charge")), paid with the card", s.charged, currency, tint: Theme.secondaryInk, signed: false)
            }
            if let low = s.lowest {
                summaryRow("Lowest in checking", shortDay(low.date) + (low.low ? ", under your cushion" : ""), low.balance, currency,
                           tint: low.balance < 0 ? Theme.danger : low.low ? Theme.warning : Theme.ink, signed: false)
            }
            if s.recordedIn + s.recordedOut > 0 {
                let words = [s.recordedIn > 0 ? "\(s.recordedIn) in" : nil, s.recordedOut > 0 ? "\(s.recordedOut) out" : nil].compactMap { $0 }
                summaryRow(month < FinanceCalendar.month(of: cal.today) ? "Recorded" : "Recorded so far",
                           words.joined(separator: ", ") + " · in your transactions", s.recorded, currency,
                           tint: s.recorded > 0 ? Theme.success : Theme.ink, signed: true)
            }
            if s.isEmpty {
                Text("Nothing comes or goes this month.").font(.subheadline).foregroundStyle(Theme.secondaryInk)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func summaryRow(_ title: String, _ sub: String, _ value: Double, _ currency: String, tint: Color, signed: Bool) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 1) {
                Text(verbatim: title)
                Text(verbatim: sub).font(.caption).foregroundStyle(Theme.secondaryInk)
            }
            Spacer(minLength: 8)
            Money(value: value, currency: currency, finances: finances, signed: signed)
                .foregroundStyle(tint)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Moving about

    private func go(_ date: String, _ cal: FinanceCalendar) {
        let d = date < cal.first ? cal.first : date > cal.last ? cal.last : date
        picked = d
        month = FinanceCalendar.month(of: d)
    }

    /// The month before or after, the day picked following on the same day of the month.
    private func turn(_ n: Int, _ cal: FinanceCalendar) {
        guard let m = FinanceCalendar.addMonths(month, n) else { return }
        month = m
        let want = m + picked.dropFirst(7)
        picked = want < cal.first ? cal.first : want > cal.last ? cal.last : cal.days[want] != nil ? want : (cal.inMonth(m).last?.date ?? cal.last)
    }

    // MARK: Words

    private func lead(_ cal: FinanceCalendar, _ view: FinancesPlanView) -> String {
        let low = cal.lowDays(in: month)
        let cushion = amountText(cal.cushion, view.plan.currency, finances, whole: true)
        if month < FinanceCalendar.month(of: cal.from) {
            let s = cal.summary(of: month)
            if s.recordedIn + s.recordedOut == 0 { return "Nothing was recorded this month. Days before today show what your transactions recorded." }
            let signed = (s.recorded > 0 ? "+" : "") + amountText(s.recorded, view.plan.currency, finances)
            return "What your transactions recorded: \(plural(s.recordedOut, "payment")) out, \(signed) in all."
        }
        if low > 0 { return "Checking falls under your \(cushion) cushion on \(plural(low, "day")) this month." }
        if month > FinanceCalendar.month(of: cal.read) {
            return "What's planned this month. Checking is read ahead to \(shortDay(cal.read)), so no balance shows."
        }
        if cal.last > cal.read { return "Checking each day to \(shortDay(cal.read)); after it, what's planned." }
        return "From today to \(shortDay(cal.last)), as far as Finances reads ahead."
    }

    /// A day read out: what moves and what checking holds after.
    private func said(_ day: FinanceCalendar.Day, _ cal: FinanceCalendar, _ view: FinancesPlanView) -> String {
        let currency = view.plan.currency
        var parts = [dayWords(day.date) + (day.holiday.map { ", \($0)" } ?? "")]
        if day.past {
            parts.append(day.spent.isEmpty ? "nothing recorded"
                         : day.spent.map { "\($0.payee) \(amountText($0.amount, currency, finances))" }.joined(separator: ", "))
        } else {
            let moves = day.events.map { "\(cal.named($0, payments: names(view))) \(amountText($0.amount, currency, finances))" }
                + day.charges.map { "\(cal.named($0, payments: names(view))) \(amountText(-$0.amount, currency, finances)) on a card" }
            parts.append(moves.isEmpty ? "nothing comes or goes" : moves.joined(separator: ", "))
            if day.later {
                parts.append("planned, past where checking is read ahead")
            } else {
                parts.append("checking \(amountText(day.balance, currency, finances)) after" + (day.low ? ", under your cushion" : ""))
            }
        }
        return parts.joined(separator: ". ")
    }

    private func names(_ view: FinancesPlanView) -> [String: String] {
        // The plan's payments, and each card paid off with each paycheck ("card:<id>"), named for the card.
        Dictionary(view.plan.payments.map { ($0.id, $0.name) } + view.plan.accounts.filter { $0.kind == "card" }.map { ("card:" + $0.id, $0.name) },
                   uniquingKeysWith: { a, _ in a })
    }

    private func compact(_ value: Double) -> String {
        value.formatted(.number.notation(.compactName).precision(.significantDigits(2)))
    }

    private func plural(_ n: Int, _ one: String) -> String { n == 1 ? "1 \(one)" : "\(n) \(one)s" }

    private func monthTitle(_ month: String) -> String {
        guard let d = FinanceCalendar.shown(month + "-01") else { return month }
        return d.formatted(.dateTime.month(.wide).year())
    }

    private func monthName(_ month: String) -> String {
        guard let d = FinanceCalendar.shown(month + "-01") else { return month }
        return d.formatted(.dateTime.month(.wide))
    }

    private func dayWords(_ day: String) -> String {
        guard let d = FinanceCalendar.shown(day) else { return day }
        return d.formatted(.dateTime.weekday(.wide).month(.wide).day())
    }

    private func shortDay(_ day: String) -> String {
        guard let d = FinanceCalendar.shown(day) else { return day }
        return d.formatted(.dateTime.month(.abbreviated).day())
    }
}
