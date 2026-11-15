import SwiftUI

/// An app's log (`homelab logs <id> --tail N`), already redacted by the
/// computer. Any paired device may read it, look-only ones included.
struct LogsView: View {
    @State private var model: LogsViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var explainShown = false

    init(app: AppStatus, api: APIClient) {
        _model = State(initialValue: LogsViewModel(app: app, api: api))
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 1) {
                        ForEach(model.shownLines) { line in
                            // Verbatim: a log line is never read as Markdown or a localization key.
                            Text(verbatim: line.text.isEmpty ? " " : line.text)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(line.level == .error ? AnyShapeStyle(Theme.danger)
                                                 : line.level == .warning ? AnyShapeStyle(Theme.warning)
                                                 : AnyShapeStyle(.primary))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .id(line.id)
                        }
                    }
                    .textSelection(.enabled)
                    .privacySensitive()
                    .padding()
                }
                .onChange(of: model.lines) { _, lines in
                    // The newest lines are at the bottom, as in a terminal.
                    if let last = lines.last { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
            .overlay { emptyState }
            .searchable(text: $model.filter, prompt: "Filter")
            .refreshable { await model.load() }
            .navigationTitle("\(model.app.name) Log")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Picker("Lines", selection: Binding(get: { model.lineCount }, set: { model.setLineCount($0) })) {
                            ForEach(LogsViewModel.lineChoices, id: \.self) { count in
                                Text("Last \(count) lines").tag(count)
                            }
                        }
                        Toggle(isOn: $model.following) {
                            Label("Follow", systemImage: "dot.radiowaves.left.and.right")
                        }
                        Toggle(isOn: $model.problemsOnly) {
                            Label("Problems Only (\(model.problemCount))", systemImage: "exclamationmark.triangle")
                        }
                        Button {
                            Clipboard.copy(model.shownText, sensitive: true)
                        } label: {
                            Label(model.filter.isEmpty && !model.problemsOnly ? "Copy Log" : "Copy Shown Lines",
                                  systemImage: "doc.on.doc")
                        }
                        .keyboardShortcut("c", modifiers: [.command, .shift])
                        .disabled(model.shownLines.isEmpty)
                        Button {
                            Task { await model.load() }
                        } label: {
                            Label("Read Again", systemImage: "arrow.clockwise")
                        }
                        Divider()
                        Button {
                            explainShown = true
                            Task { await model.explain() }
                        } label: {
                            Label("Explain This Log", systemImage: "sparkles")
                        }
                        .disabled(model.lines.isEmpty || model.explaining)
                    } label: {
                        Label("Options", systemImage: "ellipsis.circle")
                    }
                }
            }
            .safeAreaInset(edge: .bottom) { footer }
            .sheet(isPresented: $explainShown, onDismiss: { model.closeExplanation() }) {
                LogExplanationView(model: model)
            }
            .task { await model.load() }
            // Follow: ends when switched off or when the sheet goes (a lock closes it).
            .task(id: model.following) {
                if model.following { await model.follow() }
            }
        }
        #if os(macOS)
        .frame(minWidth: 720, minHeight: 480)
        #endif
    }

    @ViewBuilder
    private var emptyState: some View {
        if model.lines.isEmpty {
            if model.isLoading {
                ProgressView("Reading the log…")
            } else if let error = model.error {
                ContentUnavailableView("Couldn't Read the Log", systemImage: "doc.text.magnifyingglass", description: Text(error))
            } else if model.loadedAt != nil {
                ContentUnavailableView("Nothing in the Log", systemImage: "doc.text")
            }
        } else if model.shownLines.isEmpty {
            if model.problemsOnly, model.filter.trimmingCharacters(in: .whitespaces).isEmpty {
                ContentUnavailableView("No Errors or Warnings", systemImage: "checkmark.circle",
                                       description: Text("None of these lines reads as a problem."))
            } else {
                ContentUnavailableView.search(text: model.filter)
            }
        }
    }

    @ViewBuilder
    private var footer: some View {
        if !model.lines.isEmpty {
            HStack(spacing: 6) {
                if model.isLoading {
                    ProgressView().controlSize(.mini)
                }
                if let error = model.error {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(Theme.warning)
                } else if model.following {
                    Label("Following: the newest lines every few seconds", systemImage: "dot.radiowaves.left.and.right")
                        .foregroundStyle(Theme.accent)
                    Button("Stop") { model.following = false }
                        .buttonStyle(.borderless)
                } else if let at = model.loadedAt {
                    Text("\(model.lines.count) lines · read \(at, format: .relative(presentation: .named))")
                        .foregroundStyle(.secondary)
                }
            }
            .font(.caption)
            .lineLimit(1)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(.bar)
        }
    }
}

/// Explain This Log: what the computer's own model made of the app's last
/// 200 lines (redacted there first). The words are the model's, so they're
/// shown as plain text, never Markdown or links.
struct LogExplanationView: View {
    let model: LogsViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if model.explaining {
                    ProgressView("Reading the last 200 lines…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = model.explainError {
                    ContentUnavailableView("Couldn't Explain the Log", systemImage: "sparkles",
                                           description: Text(verbatim: error))
                } else if let said = model.explanation {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            Text(verbatim: said.text)
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Label {
                                Text("From \(said.model) on the computer. The log didn't leave the homelab; check what matters before acting on it.")
                            } icon: {
                                Image(systemName: "desktopcomputer")
                            }
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        }
                        .padding()
                    }
                    .privacySensitive()
                }
            }
            .navigationTitle("\(model.app.name) Log Explained")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
                if let said = model.explanation, !model.explaining {
                    ToolbarItem(placement: .primaryAction) {
                        Button {
                            Clipboard.copy(said.text, sensitive: true)
                        } label: {
                            Label("Copy", systemImage: "doc.on.doc")
                        }
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        #if os(macOS)
        .frame(minWidth: 480, minHeight: 320)
        #endif
    }
}
