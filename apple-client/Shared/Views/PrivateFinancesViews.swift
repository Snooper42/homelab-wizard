import SwiftUI

/// A household member's private Finances, locked (private-finances.md 3.4):
/// Face ID opens them once she opened them on this device, else her
/// passphrase or the 16 words of her recovery code. Nothing of them is on
/// this device until then; what the household shares with her shows below
/// either way.
struct PrivateLockedView: View {
    @Bindable var finances: FinancesViewModel
    @State private var passphrase = ""
    @State private var words = ""
    @State private var usingCode = false
    @State private var keepForFaceID = true
    @FocusState private var focused: Field?

    private enum Field { case passphrase, code }

    private var byCode: Bool { usingCode || !finances.opensByPassphrase }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Image(systemName: "lock.fill")
                .font(.title2)
                .foregroundStyle(.white)
                .frame(width: 48, height: 48)
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .accessibilityHidden(true)
            Text("Your Finances are private")
                .font(.title3.weight(.bold))
                .foregroundStyle(Theme.ink)
            Text("Only you can open them, here on your own phone. The Homelab keeps them locked and can’t open them, whoever runs it.")
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryInk)
                .fixedSize(horizontal: false, vertical: true)

            if finances.faceIDOpens {
                Button {
                    Task { _ = await finances.unlockPrivateWithFaceID() }
                } label: {
                    Label("Open with Face ID", systemImage: "faceid")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .disabled(finances.isUnlocking)
            }

            if byCode {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Your recovery code")
                        .font(.subheadline.weight(.semibold))
                    TextField("The 16 words you wrote down", text: $words, axis: .vertical)
                        .lineLimit(3...6)
                        .autocorrectionDisabled()
                        #if os(iOS)
                        .textInputAutocapitalization(.never)
                        #endif
                        .focused($focused, equals: .code)
                        .padding(10)
                        .background(Theme.canvas, in: RoundedRectangle(cornerRadius: Theme.radius, style: .continuous))
                }
                Button {
                    Task {
                        if await finances.unlockPrivate(words: words, keepForFaceID: keepForFaceID) { words = "" }
                    }
                } label: {
                    Text("Open with the Code")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(.capsule)
                .disabled(words.split(whereSeparator: \.isWhitespace).count < 16 || finances.isUnlocking)
                if finances.opensByPassphrase {
                    Button("Use My Passphrase Instead") { usingCode = false }
                        .font(.subheadline)
                }
            } else {
                SecureField("Your passphrase", text: $passphrase)
                    #if os(iOS)
                    .textContentType(.password)
                    #endif
                    .focused($focused, equals: .passphrase)
                    .submitLabel(.go)
                    .onSubmit(openWithPassphrase)
                    .padding(10)
                    .background(Theme.canvas, in: RoundedRectangle(cornerRadius: Theme.radius, style: .continuous))
                Button(action: openWithPassphrase) {
                    Text("Open")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(.capsule)
                .disabled(passphrase.count < PrivateSeal.minPassphrase || finances.isUnlocking)
                Button("Use My Recovery Code") { usingCode = true }
                    .font(.subheadline)
            }

            if !finances.faceIDOpens {
                Toggle("Open with Face ID next time, on this device", isOn: $keepForFaceID)
                    .font(.subheadline)
                    .tint(Theme.accent)
            }
            if finances.isUnlocking {
                ProgressView("Opening…")
                    .font(.footnote)
            }
            if let error = finances.privateError {
                Text(verbatim: error)
                    .font(.footnote)
                    .foregroundStyle(Theme.danger)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(radius: 24)
    }

    private func openWithPassphrase() {
        guard passphrase.count >= PrivateSeal.minPassphrase else { return }
        Task {
            if await finances.unlockPrivate(passphrase: passphrase, keepForFaceID: keepForFaceID) { passphrase = "" }
        }
    }
}

/// Above her private Finances while they're open: they're hers alone, and Lock.
struct PrivateOpenBanner: View {
    let finances: FinancesViewModel

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: "lock.open.fill")
                .foregroundStyle(Theme.accent)
                .accessibilityHidden(true)
            Text("Private: only you can open these. They lock when you leave Finances, or after 5 minutes.")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryInk)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Button("Lock") { finances.lockPrivate() }
                .font(.subheadline.weight(.semibold))
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
    }
}

/// On a member's own phone, under her plain Finances: they can be made private.
struct PrivateOfferCard: View {
    let finances: FinancesViewModel
    @State private var making = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Keep them private", systemImage: "lock.shield")
                .font(.headline)
                .foregroundStyle(Theme.ink)
            Text("Only you could open them, here with Face ID, your passphrase or a recovery code. The Homelab would keep them locked, and whoever runs it couldn’t open them.")
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryInk)
                .fixedSize(horizontal: false, vertical: true)
            Button("Make Them Private…") { making = true }
                .fontWeight(.semibold)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(radius: 24)
        .sheet(isPresented: $making) { MakePrivateSheet(finances: finances) }
    }
}

/// Make Them Private… (private-finances.md 3.3 and 3.4): what it means and
/// what losing the code means, her 16-word recovery code shown once, two of
/// its words typed back, then a passphrase of 12 characters or more (the
/// app's second way in; Face ID opens them on this device after).
struct MakePrivateSheet: View {
    let finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var step = Step.why
    @State private var code = PrivateSeal.newCode()
    @State private var asked: [Int] = Array((0..<16).shuffled().prefix(2)).sorted()
    @State private var typed = ["", ""]
    @State private var passphrase = ""
    @State private var again = ""
    @State private var keepForFaceID = true
    @State private var working = false

    private enum Step { case why, code, check, passphrase }

    private var words: [String] { PrivateSeal.codeWords(code) }
    private var checked: Bool {
        asked.indices.allSatisfy { typed[$0].trimmingCharacters(in: .whitespaces).lowercased() == words[asked[$0]] }
    }
    private var passphraseProblem: String? {
        if passphrase.count < PrivateSeal.minPassphrase { return "\(PrivateSeal.minPassphrase) characters or more." }
        if passphrase != again { return "The two don’t match yet." }
        return nil
    }

    var body: some View {
        NavigationStack {
            Form {
                switch step {
                case .why:
                    Section {
                        Text("Once they’re private, your Finances open only on your own phone. The Homelab keeps them locked and can’t open them, whoever runs it.")
                        Text("You’ll get a recovery code: 16 words to write down. With it, or your passphrase, they open on a new phone too.")
                        Text("If you lose both the code and your passphrase, no one can open them, ever.")
                            .fontWeight(.semibold)
                        Text("What the household shares with you still shows, as now. The Homelab stops its reminders and its calendar for your Finances; this phone can’t remind you yet.")
                            .foregroundStyle(Theme.secondaryInk)
                    }
                case .code:
                    Section {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 8) {
                            ForEach(Array(words.enumerated()), id: \.offset) { i, word in
                                HStack(spacing: 6) {
                                    Text(verbatim: "\(i + 1).")
                                        .monospacedDigit()
                                        .foregroundStyle(Theme.secondaryInk)
                                    Text(verbatim: word)
                                        .font(.body.monospaced().weight(.semibold))
                                }
                            }
                        }
                        .padding(.vertical, 4)
                        .accessibilityElement(children: .combine)
                    } header: {
                        Text("Your recovery code")
                    } footer: {
                        Text("Write these 16 words down, in order, and keep them somewhere safe. They’re shown only now.")
                    }
                case .check:
                    Section {
                        ForEach(asked.indices, id: \.self) { i in
                            TextField("Word \(asked[i] + 1)", text: $typed[i])
                                .autocorrectionDisabled()
                                #if os(iOS)
                                .textInputAutocapitalization(.never)
                                #endif
                        }
                    } footer: {
                        Text("From what you wrote down, so you know you have it.")
                    }
                case .passphrase:
                    Section {
                        SecureField("Passphrase", text: $passphrase)
                        SecureField("The same again", text: $again)
                    } footer: {
                        Text(passphraseProblem ?? "It opens them where Face ID can’t, on the phone’s page too.")
                    }
                    Section {
                        Toggle("Open with Face ID on this device", isOn: $keepForFaceID)
                    }
                    if let error = finances.privateError {
                        Section { Text(verbatim: error).foregroundStyle(Theme.danger) }
                    }
                }
            }
            .navigationTitle("Make Them Private")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(working)
                }
                ToolbarItem(placement: .confirmationAction) { next }
            }
            .interactiveDismissDisabled(working)
        }
    }

    @ViewBuilder private var next: some View {
        switch step {
        case .why: Button("Continue") { step = .code }
        case .code: Button("I Wrote Them Down") { step = .check }
        case .check:
            Button("Continue") { step = .passphrase }
                .disabled(!checked)
        case .passphrase:
            if working {
                ProgressView()
            } else {
                Button("Make Them Private") {
                    working = true
                    Task {
                        let done = await finances.makePrivate(code: code, passphrase: passphrase, keepForFaceID: keepForFaceID)
                        working = false
                        if done { dismiss() }
                    }
                }
                .disabled(passphraseProblem != nil)
            }
        }
    }
}

/// Turn Privacy Off…, under her open private Finances, once she confirms.
struct PrivateOffButton: View {
    let finances: FinancesViewModel
    @State private var asking = false

    var body: some View {
        Button("Turn Privacy Off…", role: .destructive) { asking = true }
            .font(.subheadline)
            .disabled(finances.isSaving)
            .confirmationDialog("Turn privacy off?", isPresented: $asking, titleVisibility: .visible) {
                Button("Turn Privacy Off", role: .destructive) {
                    Task { _ = await finances.turnPrivacyOff() }
                }
            } message: {
                Text("Your Finances will be kept on the Homelab as before, where whoever runs it can read them. Your recovery code and passphrase stop opening them.")
            }
    }
}
