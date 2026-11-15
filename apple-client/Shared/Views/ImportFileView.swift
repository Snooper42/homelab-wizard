import SwiftUI
import UniformTypeIdentifiers

/// Import a File (Transactions › ⋯), the sheet the owner approved, Nov 15:
/// a bank's CSV or OFX/QFX picked on this device and read here (never sent
/// anywhere), into an account. A CSV's columns are guessed from its header
/// and can be picked; then how many come in, what goes out and in, and each
/// row as it would come in, the ones already in greyed. Bring In saves them
/// together (away, they wait as other changes do). Import 1 of 3: links to
/// planned payments and fixing rows brought in before are the computer's for now.
struct ImportFileView: View {
    let finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var picking = false
    @State private var fileName = ""
    @State private var text = ""
    @State private var account = ""
    @State private var columns: BankFile.Columns?
    /// A card's file with its charges as plus amounts (American Express): read the other way round. Nil: as guessed.
    @State private var flip: Bool?
    @State private var found: [BankImport.Found] = []
    @State private var readError: String?
    /// The CSV's rows, read once as the file opens; the OFX's rows, there being no columns to pick.
    @State private var rows: [[String]] = []
    @State private var ofxRows: [BankFile.Row] = []
    @State private var isOFX = false
    /// Counts files opened, so what comes in is worked out again for a new one.
    @State private var opened = 0
    @State private var saving = false

    private var accounts: [FinanceAccount] {
        (finances.plan?.plan.accounts ?? []).filter { BankImport.intoKinds($0.kind) }
    }
    private var here: FinanceAccount? { accounts.first { $0.id == account } }
    private var header: [String] { rows.first ?? [] }
    private var asRead: [BankFile.Row] {
        if text.isEmpty { return [] }
        if isOFX { return ofxRows }
        guard let columns, columns.readable else { return [] }
        return BankFile.fromCSV(rows, columns)
    }
    private var signed: Bool { !isOFX && (columns?.amount ?? -1) >= 0 }
    private var isCard: Bool { here?.kind == "card" }
    private var guessFlip: Bool { signed && isCard && BankFile.chargesPlus(asRead) }
    private var flipped: Bool { signed && (flip ?? guessFlip) }
    private var read: [BankFile.Row] {
        flipped ? asRead.map { var t = $0; t.amount = -t.amount; return t } : asRead
    }
    /// What changes what comes in.
    private struct Key: Hashable { let opened: Int; let columns: BankFile.Columns?; let account: String; let flipped: Bool }
    private var key: Key { Key(opened: opened, columns: columns, account: account, flipped: flipped) }

    private var coming: [BankImport.Found] { found.filter { $0.state == .comesIn } }
    private var currency: String { finances.currency }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if fileName.isEmpty {
                        Button("Pick a File") { picking = true }
                    } else {
                        LabeledContent {
                            Button("Pick Another") { picking = true }
                        } label: {
                            Text(verbatim: fileName).lineLimit(1).truncationMode(.middle)
                        }
                    }
                    if !accounts.isEmpty {
                        Picker("Into", selection: $account) {
                            ForEach(accounts) { a in Text(verbatim: a.name).tag(a.id) }
                        }
                    }
                } header: {
                    Text("File")
                } footer: {
                    if let readError {
                        Text(verbatim: readError).foregroundStyle(Theme.danger)
                    } else if text.isEmpty {
                        Text("A CSV or an OFX/QFX file from your bank's website. It's read on this device and kept only in your ledger.")
                    }
                }
                if columns != nil {
                    columnsSection
                }
                if !text.isEmpty {
                    rowsSection
                }
            }
            .navigationTitle("Import a File")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(coming.isEmpty ? "Bring In" : "Bring In \(coming.count)") {
                        saving = true
                        Task {
                            let n = await finances.bringIn(found, into: account)
                            saving = false
                            if n != nil { dismiss() }
                        }
                    }
                    .disabled(coming.isEmpty || saving)
                }
            }
            .fileImporter(isPresented: $picking, allowedContentTypes: BankImport.fileTypes.compactMap { UTType(filenameExtension: $0) }) { result in
                if case .success(let url) = result { open(url) }
            }
            .task(id: key) { found = finances.importing(read, into: account) }
            .onChange(of: account) { flip = nil }
            .onAppear {
                finances.clearSaveError()
                if account.isEmpty {
                    let checking = finances.plan?.checking ?? ""
                    account = accounts.contains { $0.id == checking } ? checking : accounts.first?.id ?? ""
                }
            }
        }
        .presentationDetents([.large])
    }

    private func open(_ url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else {
            readError = "This device couldn't read that file."
            return
        }
        guard data.count <= BankImport.largestFile else {
            readError = "That file is too large for a bank's statement."
            return
        }
        // Most banks write UTF-8; some still write Latin-1.
        let t = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) ?? ""
        readError = t.isEmpty ? "Nothing in that file reads as text." : nil
        fileName = url.lastPathComponent
        text = t
        flip = nil
        isOFX = BankFile.isOFX(t)
        if isOFX {
            rows = []
            ofxRows = BankFile.fromOFX(t)
            columns = nil
        } else {
            rows = BankFile.csvRows(t)
            ofxRows = []
            columns = BankFile.guessColumns(rows.first ?? [], body: Array(rows.dropFirst()))
        }
        opened += 1
    }

    // MARK: Columns

    private var columnsSection: some View {
        Section {
            columnPicker("Day", \.date)
            columnPicker("Amount", \.amount)
            if (columns?.amount ?? -1) < 0 {
                columnPicker("Money Out", \.debit)
                columnPicker("Money In", \.credit)
            }
            columnPicker("Payee", \.payee)
            if signed && isCard {
                Toggle("Charges are plus amounts", isOn: Binding(get: { flipped }, set: { flip = $0 }))
            }
        } header: {
            Text("Columns")
        } footer: {
            if signed && isCard {
                Text(flip == nil && guessFlip
                     ? "Most rows in this card's file are plus amounts, so they're read as charges, and its minus amounts as payments to it."
                     : "American Express writes a card's charges as plus amounts.")
            } else {
                Text("Guessed from the file's first row.")
            }
        }
    }

    private func columnPicker(_ title: LocalizedStringKey, _ path: WritableKeyPath<BankFile.Columns, Int>) -> some View {
        Picker(title, selection: Binding(get: { columns?[keyPath: path] ?? -1 }, set: { columns?[keyPath: path] = $0 })) {
            Text("None").tag(-1)
            ForEach(Array(header.enumerated()), id: \.offset) { i, h in
                Text(verbatim: h.isEmpty ? "Column \(i + 1)" : h).tag(i)
            }
        }
    }

    // MARK: What comes in

    private var headline: String {
        guard !found.isEmpty else { return "Nothing found yet" }
        let already = found.filter { $0.state == .alreadyIn }.count
        let none = found.filter { $0.state == .noPayee }.count
        return (["\(coming.count) to bring in"]
                + (already > 0 ? ["\(already) already in, skipped"] : [])
                + (none > 0 ? ["\(none) with no payee, left out"] : [])).joined(separator: " · ")
    }

    private var rowsSection: some View {
        Section {
            if !coming.isEmpty {
                let out = coming.filter { $0.amount < 0 }, inn = coming.filter { $0.amount > 0 }
                let sum = { (l: [BankImport.Found]) in amountText(BankFile.cents(l.reduce(0) { $0 + abs($1.amount) }), currency, finances) }
                Text(verbatim: "\(out.count) out, \(sum(out)) · \(inn.count) in, \(sum(inn))")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
                    .monospacedDigit()
            }
            ForEach(found.prefix(BankImport.shownRows)) { f in
                ImportRow(found: f, finances: finances)
            }
            if found.count > BankImport.shownRows {
                Text(verbatim: "And \(found.count - BankImport.shownRows) more.")
                    .foregroundStyle(Theme.secondaryInk)
            }
        } header: {
            Text(verbatim: headline)
        } footer: {
            if let warning {
                Text(verbatim: warning).foregroundStyle(Theme.danger)
            } else if let error = finances.saveError, !saving {
                Text(verbatim: error).foregroundStyle(Theme.danger)
            } else if !found.isEmpty {
                Text("The bank's own words go in the note, and each payee takes its last category or its rule's.")
            }
        }
    }

    /// Said before anything comes in: a payee column with no names, or a card's file read as money in.
    private var warning: String? {
        if !isOFX, asRead.count > 1, asRead.allSatisfy({ $0.payee.isEmpty || BankFile.wayOnly($0.payee) }) {
            let first = asRead.first { !$0.payee.isEmpty }?.payee
            return "No payee here is a name, only \(first.map { "“\($0)”" } ?? "empty"): pick the column with the names under Payee."
        }
        if signed, !flipped, BankFile.chargesPlus(asRead) {
            return isCard
                ? "Most of these rows are read as money coming in, which on \(here?.name ?? "this card") lowers what it owes. Turn on Charges are plus amounts."
                : "Most of these rows are money coming in, which is how a card's file writes its charges (American Express does). If it's a card's file, pick the card under Into."
        }
        return nil
    }
}

/// A row as it would come in: its logo, payee, the bank's words and day, its category, and the amount.
private struct ImportRow: View {
    let found: BankImport.Found
    let finances: FinancesViewModel

    private var detail: String {
        let day = LocalDay.parse(found.date).map { TransactionsView.dayWords($0) } ?? found.date
        var parts = [found.raw, day].compactMap { $0 }
        switch found.state {
        case .alreadyIn: parts.append("already in")
        case .noPayee: parts.append("no payee")
        case .comesIn: if let c = found.category { parts.append(c) }
        }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        HStack(spacing: 12) {
            LogoCircle(payee: found.payee.isEmpty ? "?" : found.payee, size: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(verbatim: found.payee.isEmpty ? "No payee" : found.payee)
                    .lineLimit(1)
                Text(verbatim: detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            Spacer(minLength: 8)
            Money(value: found.amount, currency: finances.currency, finances: finances)
                .foregroundStyle(found.amount > 0 ? Theme.success : .primary)
        }
        .opacity(found.state == .comesIn ? 1 : 0.5)
        .accessibilityElement(children: .combine)
    }
}
