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
        .task { await computer.loadPhones() }
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
