import SwiftUI

/// Settings › Phones (the owner's yes, Nov 19, from the mocks canvas): this
/// device, then every other paired phone and iPad, whose it is, what it may
/// do and when it was last seen. From here a phone is only given less;
/// pairing one, or giving one more, stays on the computer.
struct PhonesPage: View {
    let computer: ComputerViewModel

    var body: some View {
        Form {
            if let phones = computer.phones {
                let others = phones.filter { !$0.isThis }
                if let mine = phones.first(where: \.isThis) {
                    Section("This Device") {
                        NavigationLink {
                            ThisDevicePage()
                        } label: {
                            PhoneRow(phone: mine)
                        }
                    }
                }
                Section {
                    if others.isEmpty {
                        Text("No other phone or iPad is paired.")
                            .foregroundStyle(Theme.secondaryInk)
                    }
                    ForEach(others) { phone in
                        NavigationLink {
                            PairedPhonePage(computer: computer, phoneID: phone.id)
                        } label: {
                            PhoneRow(phone: phone)
                        }
                    }
                } header: {
                    Text("Other Phones and iPads")
                } footer: {
                    Text("Here a phone can only be given less: looks only, less of Finances, or removed, each after Face ID. Pairing a phone, or giving one more, is on the computer's Settings › Phones.")
                }
            } else if let error = computer.phonesError {
                Text(verbatim: error).foregroundStyle(Theme.secondaryInk)
            } else {
                ProgressView()
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .navigationTitle("Phones")
        // Again once this device's own answer is in: opened before it (as the pictures
        // do, light-phones read forever), the list was never asked for.
        .task(id: computer.canListPhones) { await computer.loadPhones() }
        .refreshable { await computer.loadPhones() }
    }
}

/// A phone's row: its name, what it may do, and when it was last seen.
private struct PhoneRow: View {
    let phone: PairedPhone

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: phone.kiosk ? "ipad.landscape" : "iphone")
                .foregroundStyle(Theme.accent)
                .frame(width: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: phone.name)
                Group {
                    if let seen = phone.lastSeen, !phone.isThis {
                        Text(verbatim: phone.summary + " · seen ") + Text(seen, format: .relative(presentation: .named))
                    } else {
                        Text(verbatim: phone.summary)
                    }
                }
                .font(.footnote)
                .foregroundStyle(Theme.secondaryInk)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// One other phone's page: whose it is, what it may do, and only less from
/// here, each asked first and then after Face ID.
struct PairedPhonePage: View {
    let computer: ComputerViewModel
    let phoneID: String
    @Environment(\.dismiss) private var dismiss
    @State private var asking: PhoneLowering?

    private var phone: PairedPhone? { computer.phones?.first { $0.id == phoneID } }

    var body: some View {
        Form {
            if let phone {
                Section {
                    LabeledContent("Whose", value: phone.whose)
                    if let paired = phone.paired {
                        LabeledContent("Paired") { Text(paired, format: .dateTime.month().day().year()) }
                    }
                    LabeledContent("Last seen") {
                        if let seen = phone.lastSeen {
                            Text(seen, format: .relative(presentation: .named))
                        } else {
                            Text("Not yet")
                        }
                    }
                }
                let offered = PhoneLowering.offered(for: phone)
                Section {
                    LabeledContent("Changes") {
                        if phone.canChange, let until = phone.until {
                            Text("Until ") + Text(until, format: .dateTime.weekday(.abbreviated).hour().minute())
                        } else {
                            Text(phone.canChange ? "Yes" : "Looks only")
                        }
                    }
                    LabeledContent("Finances", value: PhoneLowering.financesWords(phone.finances))
                    ForEach(offered.filter { $0 != .remove }) { what in
                        Button(what.title) { asking = what }
                            .disabled(computer.isChangingPhone)
                    }
                } header: {
                    Text("What It May Do")
                } footer: {
                    Text("To give it changes or Finances again, use the computer's Settings › Phones.")
                }
                if offered.contains(.remove) {
                    Section {
                        Button(PhoneLowering.remove.title, role: .destructive) { asking = .remove }
                            .disabled(computer.isChangingPhone)
                    } footer: {
                        if let error = computer.phonesError {
                            Text(verbatim: error).foregroundStyle(Theme.danger)
                        } else {
                            Text("Its pairing stops working at once; it would need a new code from the computer to come back.")
                        }
                    }
                }
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .navigationTitle(phone?.name ?? "Phone")
        .confirmationDialog(asking.map { "\($0.title)?" } ?? "", isPresented: Binding(
            get: { asking != nil },
            set: { if !$0 { asking = nil } }
        ), titleVisibility: .visible, presenting: asking) { what in
            Button(what.title, role: what == .remove ? .destructive : nil) {
                guard let phone else { return }
                Task {
                    let done = await computer.lower(phone, what)
                    if done, what == .remove { dismiss() }
                }
            }
        } message: { what in
            Text(what == .remove
                 ? "\(phone?.name ?? "It") stops reaching the homelab at once. This asks for Face ID."
                 : "\(phone?.name ?? "It") keeps looking. This asks for Face ID.")
        }
        // Gone (removed here or on the computer): back to the list.
        .onChange(of: phone == nil) { _, gone in if gone, computer.phones != nil { dismiss() } }
    }
}

/// Setup's checklist on the owner's phone (the owner's yes, Nov 19, from the
/// mocks canvas): how far along it is, Do the N I Can Do for You for the
/// steps the homelab does by itself, then what's left and what can wait,
/// each with its why. Anything else says it's the computer's.
struct SetupChecklistSections: View {
    let computer: ComputerViewModel

    var body: some View {
        Group {
            if let steps = computer.setupSteps, !steps.isEmpty {
                let progress = SetupChecklist.progress(steps)
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(verbatim: SetupChecklist.title(steps)).font(.headline)
                        if !progress.allDone {
                            Text(verbatim: SetupChecklist.count(steps))
                                .font(.subheadline)
                                .foregroundStyle(Theme.secondaryInk)
                            ProgressView(value: Double(progress.done), total: Double(max(progress.total, 1)))
                                .tint(Theme.accent)
                                .accessibilityHidden(true)
                        }
                    }
                    .padding(.vertical, 4)
                    .accessibilityElement(children: .combine)
                    if computer.canDoSetup, let title = SetupChecklist.buttonTitle(steps) {
                        Button {
                            Task { await computer.doSetupForYou() }
                        } label: {
                            if let doing = computer.doingSetupStep {
                                HStack(spacing: 8) {
                                    ProgressView()
                                    Text(verbatim: doing + "…")
                                }
                            } else {
                                Text(verbatim: title).fontWeight(.semibold)
                            }
                        }
                        .disabled(computer.doingSetupStep != nil)
                    }
                } footer: {
                    if let error = computer.setupError {
                        Text(verbatim: error).foregroundStyle(Theme.danger)
                    } else if computer.canDoSetup, SetupChecklist.buttonTitle(steps) != nil {
                        Text("Asks Face ID first. Only steps the homelab does by itself; anything that needs typing, a sign-in, a drive or a password is the computer's.")
                    }
                }
                let left = steps.filter { !$0.isDone && !$0.waits }
                if !left.isEmpty {
                    Section("Left to Do") {
                        ForEach(left) { SetupStepRow(step: $0) }
                    }
                }
                let wait = steps.filter(\.waits)
                if !wait.isEmpty {
                    Section("Can Wait") {
                        ForEach(wait) { SetupStepRow(step: $0) }
                    }
                }
            } else if let error = computer.setupError {
                Section { Text(verbatim: error).foregroundStyle(Theme.secondaryInk) }
            } else if computer.setupSteps == nil {
                // Something for the task below to run on: with nothing drawn yet, a group's
                // .task never ran, so the checklist showed only after a pull to refresh (light-setup, Nov 20).
                Section {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text("Reading the checklist…").foregroundStyle(Theme.secondaryInk)
                    }
                }
            }
        }
        .task(id: computer.canSeeSetup) { await computer.loadSetup() }
    }
}

/// A step's row: its title and why, and whether the phone can do it.
private struct SetupStepRow: View {
    let step: SetupStepInfo

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: step.title)
                Text(verbatim: step.why)
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryInk)
                    .lineLimit(3)
            }
            Spacer(minLength: 8)
            Text(step.forYou ? "I can do it" : "On the computer")
                .font(.caption.weight(.semibold))
                .foregroundStyle(step.forYou ? Theme.accent : Theme.secondaryInk)
                .multilineTextAlignment(.trailing)
        }
        .accessibilityElement(children: .combine)
    }
}
