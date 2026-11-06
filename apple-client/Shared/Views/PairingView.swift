import SwiftUI

/// Pairing with the computer: its https address and the 8-character code
/// from `homelab phone pair`. A pasted pairing link fills in both.
struct PairingView: View {
    @State private var model: PairingViewModel
    @FocusState private var focus: Field?
    @State private var scanning = false
    private let notice: String?

    private enum Field: Hashable { case server, code, name }

    init(api: APIClient, notice: String?, onPaired: @escaping @MainActor (DeviceInfo) -> Void) {
        _model = State(initialValue: PairingViewModel(api: api, onPaired: onPaired))
        self.notice = notice
    }

    var body: some View {
        NavigationStack {
            Form {
                header

                if let notice {
                    Section {
                        Label(notice, systemImage: "exclamationmark.shield")
                            .foregroundStyle(.orange)
                    }
                }

                serverSection
                codeSection
                nameSection
                submitSection
            }
            .formStyle(.grouped)
            #if os(macOS)
            .frame(maxWidth: 540)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            #endif
            .navigationTitle("Pair")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            .scrollDismissesKeyboard(.interactively)
            #endif
        }
        .sensoryFeedback(.success, trigger: model.successCount)
        .sensoryFeedback(.error, trigger: model.failureCount)
        .onAppear { focus = model.serverAddress.isEmpty ? .server : .code }
    }

    // MARK: Sections

    private var header: some View {
        Section {
            VStack(spacing: 12) {
                Image(systemName: "server.rack")
                    .accessibilityHidden(true)
                    .font(.system(size: 48))
                    .foregroundStyle(.tint)
                    .symbolRenderingMode(.hierarchical)
                Text("Pair with Your Homelab")
                    .font(.title2.bold())
                Text("On the computer, open **Settings › Phones** and choose **Pair a phone**, or run **homelab phone pair**, to make a one-time code.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
        .listRowBackground(Color.clear)
    }

    private var serverSection: some View {
        Section {
            #if os(iOS)
            if QRScannerView.isAvailable {
                Button {
                    scanning = true
                } label: {
                    Label("Scan the Computer's QR Code", systemImage: "qrcode.viewfinder")
                }
                .sheet(isPresented: $scanning) {
                    NavigationStack {
                        QRScannerView { text in
                            scanning = false
                            model.scanned(text)
                            focus = nil
                        }
                        .ignoresSafeArea()
                        .navigationTitle("Scan to Pair")
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Cancel") { scanning = false }
                            }
                        }
                    }
                }
            }
            #endif
            TextField("Address", text: serverBinding, prompt: Text(verbatim: Self.addressHint))
                #if os(iOS)
                .textContentType(.URL)
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                #endif
                .autocorrectionDisabled()
                .focused($focus, equals: .server)
                .submitLabel(.next)
                .onSubmit { focus = .code }
            #if os(macOS)
            // The companion on this Mac: loopback never leaves the computer.
            Button("The Homelab Runs on This Mac") {
                model.setServerAddress("localhost:8099")
                focus = .code
            }
            #endif
        } header: {
            Text("Computer")
        } footer: {
            #if os(macOS)
            Text("Use your homelab domain (https://homelab.your-domain.com) or the Tailscale link, or localhost:8099 when the homelab runs on this Mac. You can paste the whole pairing link. Plain http to another computer isn't accepted, because your device token would cross the network in readable form.")
            #else
            Text("Use your homelab domain (https://homelab.your-domain.com), or the Tailscale link if you use it. You can paste the whole pairing link. Plain http isn't accepted, because your device token would cross the network in readable form.")
            #endif
        }
    }

    private var codeSection: some View {
        Section {
            HStack {
                TextField("Code", text: codeBinding, prompt: Text(verbatim: "ABCD2345"))
                    .font(.system(.title2, design: .monospaced).weight(.semibold))
                    #if os(iOS)
                    .textContentType(.oneTimeCode)
                    .textInputAutocapitalization(.characters)
                    .keyboardType(.asciiCapable)
                    #endif
                    .autocorrectionDisabled()
                    .privacySensitive()
                    .focused($focus, equals: .code)
                    .submitLabel(.go)
                    .onSubmit(submit)
                    .accessibilityLabel("Pairing code")

                if model.isCodeComplete {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .transition(.scale.combined(with: .opacity))
                        .accessibilityLabel("Code complete")
                } else {
                    Text("\(model.code.count)/\(PairingCode.length)")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                        .accessibilityLabel("\(model.code.count) of \(PairingCode.length) characters")
                }
            }
            .animation(.snappy, value: model.isCodeComplete)
        } header: {
            Text("Pairing Code")
        } footer: {
            Text("8 characters. A code works once, for 10 minutes.")
        }
    }

    private var nameSection: some View {
        Section {
            TextField("Name", text: $model.deviceName)
                .focused($focus, equals: .name)
                .autocorrectionDisabled()
            Toggle("A wall screen or TV", isOn: $model.isWallScreen)
        } header: {
            Text("This Device")
        } footer: {
            Text(model.isWallScreen
                 ? "The computer lets a wall screen only look: never start or stop anything, and no Finances, whatever the code allowed. That can't be undone except by pairing again."
                 : "How the computer lists this device under Phones.")
        }
    }

    private var submitSection: some View {
        Section {
            Button(action: submit) {
                HStack(spacing: 8) {
                    if model.isPairing {
                        ProgressView().controlSize(.small)
                    }
                    Text(model.isPairing ? "Pairing…" : "Pair")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!model.canSubmit)
            .keyboardShortcut(.defaultAction)
            #if os(iOS)
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)
            #endif
        } footer: {
            if let error = model.errorMessage {
                Label(error, systemImage: "xmark.octagon.fill")
                    .foregroundStyle(.red)
                    .padding(.top, 4)
            }
        }
    }

    // MARK: Bindings & actions

    /// On the Mac, the homelab is most often on the same computer.
    private static var addressHint: String {
        #if os(macOS)
        "localhost:8099"
        #else
        "https://homelab.your-domain.com"
        #endif
    }

    private var serverBinding: Binding<String> {
        Binding(get: { model.serverAddress }, set: { model.setServerAddress($0) })
    }

    private var codeBinding: Binding<String> {
        Binding(get: { model.code }, set: { model.setCode($0) })
    }

    private func submit() {
        guard model.canSubmit else { return }
        focus = nil
        Task { await model.pair() }
    }
}
