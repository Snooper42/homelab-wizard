import SwiftUI

// A household member's phone (the computer's homelab phone person): their
// own apps, their own Finances, and what the owner shares of the
// household's, to look at.

/// Settings on a member's phone: whose phone it is, the lock and the
/// widget, and this device. The homelab's own settings are the owner's.
struct MemberSettingsView: View {
    @Environment(AppCoordinator.self) private var coordinator

    var body: some View {
        Form {
            Section {
                NavigationLink {
                    ThisDevicePage()
                } label: {
                    HStack(spacing: 14) {
                        AppMark(size: 56)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Homelab Wizard")
                                .font(.headline)
                            if let name = coordinator.device?.personName {
                                Text(verbatim: "\(name)’s apps and Finances")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.accent)
                            }
                            if let server = coordinator.serverName {
                                Text(verbatim: server)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                    .padding(.vertical, 6)
                }
            }
            Section {
                LabeledContent {
                    Text("On")
                } label: {
                    IconTileLabel(title: "Face ID lock", systemImage: "faceid", tint: TileColour.indigo)
                }
            } footer: {
                Text("Your Finances are yours alone: kept apart from the household’s, and shown on no other phone. What the household shares with you, you can see but not change.")
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .navigationTitle("Settings")
    }
}

/// On a member's Finances: the household's bills, subscriptions and
/// budgets the owner shares, to look at.
struct HouseholdCard: View {
    let shared: HouseholdShared
    let finances: FinancesViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                CardHeading("Household")
                Spacer()
                Label("Shared with you", systemImage: "person.2.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.secondaryInk)
            }
            if !shared.bills.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Coming up")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.secondaryInk)
                    ForEach(shared.bills.prefix(5)) { bill in
                        row(bill, trailing: bill.date.map { $0.formatted(.dateTime.month(.abbreviated).day()) })
                    }
                }
            }
            if !shared.subscriptions.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Subscriptions")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.secondaryInk)
                    ForEach(shared.subscriptions) { sub in
                        row(sub, trailing: FinanceSchedule(every: sub.every ?? "", start: nil).words)
                    }
                }
            }
            if !shared.budgets.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Budgets this month")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.secondaryInk)
                    ForEach(shared.budgets) { budget in
                        VStack(alignment: .leading, spacing: 5) {
                            HStack {
                                Text(verbatim: budget.category)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.ink)
                                Spacer()
                                Text(verbatim: "\(amountText(max(budget.left, 0), shared.currency, finances, whole: true)) left")
                                    .font(.subheadline.weight(.semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(budget.left < 0 ? Theme.danger : Theme.ink)
                            }
                            ProgressView(value: budget.share)
                                .tint(budget.left < 0 ? Theme.danger : Theme.accent)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
        .padding(16)
        .card(radius: 24)
    }

    private func row(_ p: HouseholdShared.Payment, trailing: String?) -> some View {
        HStack(spacing: 10) {
            LogoCircle(payee: p.name, institution: p.institution, size: 32)
            VStack(alignment: .leading, spacing: 1) {
                Text(verbatim: p.name)
                    .font(.subheadline)
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                if let trailing {
                    Text(verbatim: trailing)
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryInk)
                }
            }
            Spacer(minLength: 6)
            Text(verbatim: "\(p.estimate ? "≈ " : "")\(amountText(p.amount, shared.currency, finances))")
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(Theme.ink)
        }
        .accessibilityElement(children: .combine)
    }
}

/// A plan with no accounts yet (a household member's own, at first): where
/// to start.
struct FirstAccountCard: View {
    let finances: FinancesViewModel
    @State private var adding = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: "building.columns.fill")
                .font(.title2)
                .foregroundStyle(.white)
                .frame(width: 48, height: 48)
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            Text(finances.isMember ? "Your own Finances start here" : "Finances start here")
                .font(.title3.weight(.bold))
                .foregroundStyle(Theme.ink)
            Text(finances.isMember
                 ? "Add your checking account first, then savings and cards. They’re yours alone: no one else’s phone shows them."
                 : "Add your checking account first, then savings and cards.")
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryInk)
            Button {
                adding = true
            } label: {
                Text("Add an Account")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(radius: 24)
        .sheet(isPresented: $adding) { AddAccountView(finances: finances) }
    }
}

/// A new account: its name, what kind it is, and what's in it today (for a
/// card or a loan, what's owed).
struct AddAccountView: View {
    let finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var kind = "checking"
    @State private var balance = ""
    @State private var saving = false
    @FocusState private var focused: Bool

    private var owed: Bool { kind == "card" || kind == "loan" }
    private var amount: Double? { balance.isEmpty ? 0 : FinancePlanEdit.parseAmount(balance) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name, like Chase Checking", text: $name)
                        .focused($focused)
                        #if os(iOS)
                        .textInputAutocapitalization(.words)
                        #endif
                    Picker("Kind", selection: $kind) {
                        ForEach(FinancePlanEdit.accountKinds, id: \.id) { k in
                            Text(k.title).tag(k.id)
                        }
                    }
                }
                Section {
                    TextField(owed ? "What’s owed" : "What’s in it", text: $balance)
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                        .monospacedDigit()
                } header: {
                    Text(owed ? "Owed today" : "Balance today")
                } footer: {
                    if let error = finances.saveError, !saving {
                        Text(verbatim: error).foregroundStyle(Theme.danger)
                    } else {
                        Text("You can change it any time from the account.")
                    }
                }
            }
            .navigationTitle("Add Account")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        guard let amount else { return }
                        saving = true
                        Task {
                            let ok = await finances.addAccount(name: name, kind: kind, balance: amount)
                            saving = false
                            if ok { dismiss() }
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || amount == nil || saving)
                }
            }
            .onAppear { focused = true }
        }
        .presentationDetents([.medium, .large])
    }
}
