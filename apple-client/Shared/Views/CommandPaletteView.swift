import SwiftUI

/// ⌘K on the iPad,
/// as the computer's palette: type, ↑↓ pick, Return runs, Escape closes. The
/// matches are under what they are (Screens, Commands, Finances, Apps,
/// Groups), each with its shortcut or group on the right. Stop asks for a
/// second press ("Press Return again to stop Immich"), then Face ID as its button does.
struct CommandPaletteView: View {
    let commands: [PaletteCommand]
    let run: @MainActor (PaletteCommand) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var at = 0
    /// A stop waiting for its second press, by id.
    @State private var sure: String?
    @FocusState private var typing: Bool

    private var found: [PaletteCommand] { Palette.match(commands, query) }
    private var picked: PaletteCommand? { found.isEmpty ? nil : found[min(at, found.count - 1)] }

    /// The matches under their headings, in the order the headings first come.
    private var sections: [(title: String, commands: [PaletteCommand])] {
        var out: [(title: String, commands: [PaletteCommand])] = []
        for c in found {
            if let i = out.firstIndex(where: { $0.title == c.section }) { out[i].commands.append(c) } else { out.append((c.section, [c])) }
        }
        return out
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary).accessibilityHidden(true)
                TextField("Type a command or an app", text: $query)
                    .textFieldStyle(.plain)
                    .font(.title3)
                    .autocorrectionDisabled()
                    #if os(iOS)
                    .textInputAutocapitalization(.never)
                    #endif
                    .focused($typing)
                    .onSubmit { press(picked) }
                    .onKeyPress(.upArrow) { move(-1); return .handled }
                    .onKeyPress(.downArrow) { move(1); return .handled }
                    .onKeyPress(.escape) { dismiss(); return .handled }
            }
            .padding(16)
            Divider()
            ScrollViewReader { proxy in
                List {
                    ForEach(sections, id: \.title) { section in
                        Section(section.title) {
                            ForEach(section.commands) { c in
                                row(c)
                                    .id(c.id)
                                    .contentShape(Rectangle())
                                    .onTapGesture { press(c) }
                                    // VoiceOver: one button a row, its name and where it's from, run with a double tap.
                                    .accessibilityElement(children: .combine)
                                    .accessibilityAddTraits(.isButton)
                                    .accessibilityAddTraits(c.id == picked?.id ? .isSelected : [])
                                    .accessibilityAction { press(c) }
                                    .listRowBackground(c.id == picked?.id ? Theme.accent.opacity(0.18) : Color.clear)
                            }
                        }
                    }
                    if found.isEmpty {
                        Text("Nothing matches \u{201C}\(query)\u{201D}.").foregroundStyle(.secondary)
                    }
                }
                .listStyle(.plain)
                .onChange(of: at) { if let id = picked?.id { proxy.scrollTo(id) } }
            }
            Divider()
            Text("\u{2191}\u{2193} to pick \u{00B7} Return to run \u{00B7} Esc closes")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(10)
        }
        .onChange(of: query) { at = 0; sure = nil }
        .onAppear { typing = true }
        .presentationDetents([.large])
    }

    private func row(_ c: PaletteCommand) -> some View {
        HStack {
            Text(verbatim: sure == c.id ? "Press Return again to \(c.asks ?? "do it")" : c.label)
                .foregroundStyle(sure == c.id ? Theme.danger : Theme.ink)
                .lineLimit(1)
            Spacer(minLength: 12)
            if let hint = c.hint {
                Text(verbatim: hint)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
    }

    private func move(_ by: Int) {
        guard !found.isEmpty else { return }
        at = (min(at, found.count - 1) + by + found.count) % found.count
        sure = nil
    }

    private func press(_ c: PaletteCommand?) {
        guard let c else { return }
        if c.asks != nil, sure != c.id {
            sure = c.id
            if let i = found.firstIndex(of: c) { at = i }
            return
        }
        dismiss()
        run(c)
    }
}
