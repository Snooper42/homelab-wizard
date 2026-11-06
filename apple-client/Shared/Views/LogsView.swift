import SwiftUI

/// An app's log (`homelab logs <id> --tail N`), already redacted by the
/// computer. Any paired device may read it, look-only ones included.
struct LogsView: View {
    @State private var model: LogsViewModel
    @Environment(\.dismiss) private var dismiss

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
                    } label: {
                        Label("Options", systemImage: "ellipsis.circle")
                    }
                }
            }
            .safeAreaInset(edge: .bottom) { footer }
            .task { await model.load() }
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
