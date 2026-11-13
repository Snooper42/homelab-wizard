import PhotosUI
import SwiftUI

/// The Collection (the owner's mockup, Nov 13): what the cards are worth
/// now and the gain on what was paid, then each card with its picture,
/// what it's worth and its gain; a card opens its own page, large. Update
/// Prices (a phone allowed to change Finances) has the computer read
/// TCGplayer's prices from TCGdex, after Face ID.
struct FinanceCollectionPage: View {
    @Bindable var finances: FinancesViewModel
    @State private var adding = false

    var body: some View {
        Form {
            if let view = finances.plan {
                let cards = view.plan.collection
                let worth = cards.reduce(0) { $0 + $1.worth }
                let paid = cards.reduce(0) { $0 + $1.paidTotal }
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(cards.count == 1 ? "1 Card" : "\(cards.count) Cards")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Money(value: worth, currency: view.plan.currency, finances: finances)
                            .font(.largeTitle.bold())
                        if let gain = FinanceCollected.gain(worth: cards.filter { $0.paid > 0 }.reduce(0) { $0 + $1.worth }, paid: paid) {
                            HStack(spacing: 4) {
                                Text(gain, format: .percent.precision(.fractionLength(0)).sign(strategy: .always()))
                                    .foregroundStyle(gain < 0 ? Theme.danger : Theme.success)
                                    .fontWeight(.semibold)
                                Text("on the")
                                Money(value: paid, currency: view.plan.currency, finances: finances)
                                Text("you paid")
                            }
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        }
                        Text("Counted in your net worth.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                    .accessibilityElement(children: .combine)
                }
                if cards.isEmpty {
                    Section {
                        ContentUnavailableView {
                            Label("No Cards Yet", systemImage: "rectangle.stack")
                        } description: {
                            Text(finances.canEdit ? "Add one with what it says on it, what you paid and what it's worth now. Your cards are kept in their own account, so they count in your net worth." : "Cards are added on the computer.")
                        } actions: {
                            if finances.canEdit {
                                Button("Add a Card") { adding = true }
                                    .buttonStyle(.borderedProminent)
                            }
                        }
                    }
                }
                Section {
                    ForEach(cards) { card in
                        NavigationLink {
                            FinanceCardPage(finances: finances, cardID: card.id)
                        } label: {
                            CardRow(card: card, currency: view.plan.currency, finances: finances)
                        }
                    }
                } footer: {
                    if let said = finances.pricesSaid {
                        Text(verbatim: said)
                    } else if finances.canEdit {
                        Text("Update Prices reads TCGplayer's prices from TCGdex, sending only each card's name: never what you paid or how many.")
                    }
                }
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .refreshable { await finances.loadPlan() }
        .navigationTitle("Collection")
        .toolbar {
            if finances.canEdit {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        adding = true
                    } label: {
                        Label("Add a Card", systemImage: "plus")
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        Task { await finances.updatePrices() }
                    } label: {
                        if finances.isUpdatingPrices { ProgressView() } else { Text("Update Prices") }
                    }
                    .disabled(finances.isUpdatingPrices || finances.plan?.plan.collection.isEmpty != false)
                }
            }
        }
        .sheet(isPresented: $adding) {
            CardEditor(finances: finances, editing: nil)
        }
    }
}

/// One card's row: its picture, its name and printing, what it's worth and its gain.
private struct CardRow: View {
    let card: FinanceCollected
    let currency: String
    let finances: FinancesViewModel

    var body: some View {
        HStack(spacing: 12) {
            CardPicture(card: card, finances: finances, width: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: card.name)
                    .font(.body.weight(.medium))
                Text(verbatim: card.line)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Money(value: card.worth, currency: currency, finances: finances)
                    .fontWeight(.semibold)
                if let gain = FinanceCollected.gain(worth: card.worth, paid: card.paidTotal) {
                    Text(gain, format: .percent.precision(.fractionLength(0)).sign(strategy: .always()))
                        .font(.caption)
                        .foregroundStyle(gain < 0 ? Theme.danger : Theme.success)
                }
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

/// A card's picture, read from the computer (never fetched from anywhere
/// else), or a plain placeholder until it has one.
struct CardPicture: View {
    let card: FinanceCollected
    let finances: FinancesViewModel
    let width: CGFloat
    @State private var image: CGImage?

    var body: some View {
        Group {
            if let image {
                Image(decorative: image, scale: 1)
                    .resizable()
                    .scaledToFill()
            } else {
                Image(systemName: "rectangle.portrait")
                    .font(.system(size: width * 0.4))
                    .foregroundStyle(Theme.secondaryInk)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.canvas)
            }
        }
        .frame(width: width, height: width * 88 / 63)
        .clipShape(RoundedRectangle(cornerRadius: width > 100 ? 14 : 4))
        .overlay(RoundedRectangle(cornerRadius: width > 100 ? 14 : 4).strokeBorder(Theme.separator))
        .accessibilityLabel(image == nil ? "\(card.name): no picture yet" : card.name)
        .task(id: card.picture) {
            image = nil
            guard let name = card.picture, let data = await finances.cardPicture(name) else { return }
            image = LogoCircle.cgImage(data)
        }
    }
}

/// A card opened large: its picture, what it's worth with its gain and its
/// price over time, then how many, what was paid and where it's counted.
struct FinanceCardPage: View {
    @Bindable var finances: FinancesViewModel
    let cardID: String
    @State private var points: [FinancePoint] = []
    @State private var picked: Date?
    @State private var editing: FinanceCollected?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            if let view = finances.plan, let card = view.plan.collection.first(where: { $0.id == cardID }) {
                Section {
                    VStack(spacing: 12) {
                        CardPicture(card: card, finances: finances, width: 220)
                        Text(verbatim: card.name)
                            .font(.title2.bold())
                        Text(verbatim: card.line)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                }
                Section("Worth Now") {
                    HStack(alignment: .firstTextBaseline) {
                        Money(value: card.worth, currency: view.plan.currency, finances: finances)
                            .font(.title.bold())
                        Spacer()
                        if let gain = FinanceCollected.gain(worth: card.worth, paid: card.paidTotal) {
                            Text(gain, format: .percent.precision(.fractionLength(0)).sign(strategy: .always()))
                                .foregroundStyle(gain < 0 ? Theme.danger : Theme.success)
                                .fontWeight(.semibold)
                        }
                    }
                    let series = points.compactMap { p in p.date.map { NetWorthPoint(date: $0, value: p.amount) } }
                    if series.count > 1, finances.amountsShown, !finances.amountsHiddenByPlan {
                        TrendChart(series: series, picked: $picked)
                            .frame(height: 140)
                            .accessibilityLabel("\(card.name)'s price on each day it was read")
                    }
                }
                Section("About It") {
                    LabeledContent("How Many", value: "\(card.count)")
                    LabeledContent("Paid") {
                        if card.paid > 0 { Money(value: card.paid, currency: view.plan.currency, finances: finances) } else { Text("Not typed in") }
                    }
                    LabeledContent("Its Price", value: card.typed ? "Your own: never looked up" : card.ref == nil ? "Typed in" : "TCGplayer's, from TCGdex")
                    LabeledContent("Counted In", value: finances.accountName(card.account) ?? "Net worth")
                }
            } else {
                ContentUnavailableView("Card Not Found", systemImage: "rectangle.portrait", description: Text("It's no longer in the Collection."))
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .navigationTitle("Card")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            if finances.canEdit, let card = finances.plan?.plan.collection.first(where: { $0.id == cardID }) {
                ToolbarItem(placement: .primaryAction) {
                    Button("Edit") { editing = card }
                }
            }
        }
        .sheet(item: $editing, onDismiss: {
            // Removed: back to the Collection.
            if finances.plan?.plan.collection.contains(where: { $0.id == cardID }) == false { dismiss() }
        }) { card in
            CardEditor(finances: finances, editing: card)
        }
        .task(id: finances.plan?.plan.collection.first(where: { $0.id == cardID })?.priceOnText) {
            points = await finances.cardPrices()[cardID] ?? []
        }
    }
}

/// Add a Card, or change one (the owner, Nov 13: cards added from the
/// iPhone, with a photo of their own from the camera): what it says on it,
/// its condition, how many, what one cost and when, what one is worth now
/// and whether to keep that price, and a photo. Saved after Face ID, as
/// the computer's form saves it (FinancePlanEdit.settingCard).
struct CardEditor: View {
    let finances: FinancesViewModel
    /// The card being changed, or nil for a new one.
    let editing: FinanceCollected?
    @Environment(\.dismiss) private var dismiss
    @State private var draft = CardDraft()
    @State private var paidText = ""
    @State private var priceText = ""
    @State private var hasPaidOn = true
    @State private var paidOn = Date()
    /// Amounts weren't filled in (they're hidden here): a field left empty keeps what it was.
    @State private var amountsKept = false
    @State private var photo: PhotosPickerItem?
    @State private var taking = false
    @State private var attaching = false
    @State private var shown: CGImage?
    @State private var confirmingRemove = false
    @State private var loaded = false

    /// The draft as it would be saved: the amounts and the day read from their fields.
    private var toSave: CardDraft {
        var d = draft
        d.paid = amount(paidText, was: editing?.paid ?? 0)
        d.price = amount(priceText, was: editing?.price ?? 0)
        d.paidOn = hasPaidOn ? FinancePlanEdit.todayString(paidOn) : nil
        return d
    }

    private func amount(_ text: String, was: Double) -> Double {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return amountsKept ? was : 0 }
        return FinancePlanEdit.parseAmount(trimmed) ?? .nan
    }

    private var holdsCards: Bool {
        guard let plan = finances.plan?.plan else { return false }
        return plan.accounts.contains { a in a.kind == "collectible" && plan.collection.contains { $0.account == a.id } }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name, as it says on the card", text: $draft.name)
                        .autocorrectionDisabled()
                    TextField("Set (optional)", text: $draft.set)
                        .autocorrectionDisabled()
                    TextField("Number (optional), as 4/102", text: $draft.number)
                        .autocorrectionDisabled()
                        #if os(iOS)
                        .keyboardType(.numbersAndPunctuation)
                        #endif
                    TextField("Condition or grade (optional)", text: $draft.grade)
                    Stepper(value: $draft.count, in: 1...FinancePlanEdit.maxCardCount) {
                        LabeledContent("How Many", value: "\(draft.count)")
                    }
                } footer: {
                    Text("Update Prices finds it by its name, then its number and set.")
                }
                Section {
                    TextField(amountsKept ? "Paid, each: hidden, type to change" : "Paid, each (optional)", text: $paidText)
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                        .privacySensitive()
                    Toggle("I Know When", isOn: $hasPaidOn)
                    if hasPaidOn {
                        DatePicker("Paid On", selection: $paidOn, in: ...Date(), displayedComponents: .date)
                    }
                } header: {
                    Text("What You Paid")
                }
                Section {
                    TextField(amountsKept ? "Worth now, each: hidden, type to change" : "Worth now, each", text: $priceText)
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                        .privacySensitive()
                    Toggle("Keep This Price", isOn: $draft.typed)
                } header: {
                    Text("Worth Now")
                } footer: {
                    Text(draft.typed ? "Never looked up: for a graded card the price service doesn't list." : "Update Prices can change it to TCGplayer's price.")
                }
                photoSection
                if let editing {
                    Section {
                        Button(role: .destructive) {
                            confirmingRemove = true
                        } label: {
                            Label("Remove Card", systemImage: "trash")
                        }
                        .disabled(finances.isSaving)
                        .confirmationDialog("Remove \(editing.name)?", isPresented: $confirmingRemove, titleVisibility: .visible) {
                            Button("Remove", role: .destructive) {
                                Task { if await finances.removeCard(editing) { dismiss() } }
                            }
                        } message: {
                            Text("It's taken out of the Collection on the computer too, and out of your net worth.")
                        }
                    }
                }
                if let error = finances.saveError {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(Theme.danger)
                    }
                } else if editing == nil, !holdsCards {
                    Section {
                        Text("Your cards are kept in a new account, Pokémon cards, worth what they are: it counts in your net worth.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .formStyle(.grouped)
            .themedCanvas()
            .navigationTitle(editing == nil ? "Add a Card" : "Change Card")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if finances.isSaving {
                        ProgressView()
                    } else {
                        Button("Save") {
                            Task { if await finances.saveCard(id: editing?.id, toSave) { dismiss() } }
                        }
                        .disabled(FinancePlanEdit.cardProblem(toSave) != nil || attaching)
                    }
                }
            }
            .onChange(of: photo) { _, item in
                guard let item else { return }
                Task {
                    guard let data = try? await item.loadTransferable(type: Data.self) else { return }
                    await keep(data)
                }
            }
            #if os(iOS)
            .fullScreenCover(isPresented: $taking) {
                CameraPicker { data in
                    taking = false
                    if let data { Task { await keep(data) } }
                }
                .ignoresSafeArea()
            }
            #endif
            .task(id: draft.picture) {
                shown = nil
                guard let name = draft.picture, let data = await finances.cardPicture(name) else { return }
                shown = LogoCircle.cgImage(data)
            }
        }
        #if os(macOS)
        .frame(minWidth: 420, minHeight: 520)
        #endif
        .onAppear(perform: load)
    }

    /// The photo: the one kept, with Take a Photo (the camera) and Choose a Photo.
    private var photoSection: some View {
        Section {
            HStack(spacing: 14) {
                Group {
                    if let shown {
                        Image(decorative: shown, scale: 1).resizable().scaledToFill()
                    } else {
                        Image(systemName: "rectangle.portrait")
                            .font(.title2)
                            .foregroundStyle(Theme.secondaryInk)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(Theme.canvas)
                    }
                }
                .frame(width: 63, height: 88)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Theme.separator))
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 10) {
                    #if os(iOS)
                    if CameraPicker.isAvailable {
                        Button {
                            taking = true
                        } label: {
                            Label("Take a Photo", systemImage: "camera")
                        }
                        .buttonStyle(.borderless)
                    }
                    #endif
                    // Read here, on the main actor: PhotosPicker's label isn't.
                    let label = draft.picture == nil ? "Choose a Photo" : "Another Photo"
                    PhotosPicker(selection: $photo, matching: .images) {
                        Label(label, systemImage: "photo.on.rectangle")
                    }
                    .buttonStyle(.borderless)
                    if draft.picture != nil {
                        Button("No Photo", role: .destructive) {
                            draft.picture = nil
                            photo = nil
                        }
                        .buttonStyle(.borderless)
                    }
                }
                .disabled(attaching || finances.isSaving)
                if attaching {
                    Spacer()
                    ProgressView().controlSize(.small)
                }
            }
        } header: {
            Text("Your Own Photo")
        } footer: {
            Text("Shrunk and sent to the computer without its location or any other details the camera kept. A card with no photo gets TCGdex's picture from Update Prices.")
        }
    }

    /// Keeps a photo on the computer (after Face ID), for the card to save with.
    private func keep(_ data: Data) async {
        attaching = true
        defer { attaching = false }
        if let name = await finances.attachCardPhoto(data) { draft.picture = name }
    }

    /// Fills the form from the card being changed, once.
    private func load() {
        guard !loaded else { return }
        loaded = true
        guard let editing else { return }
        draft = CardDraft(editing)
        if let day = editing.paidOnText.flatMap(LocalDay.parse) {
            paidOn = day
        } else {
            hasPaidOn = false
        }
        // The amounts are filled in only when amounts are showing here;
        // otherwise a field left empty keeps what it was.
        if finances.amountsShown, !finances.amountsHiddenByPlan {
            let text = { (n: Double) in n > 0 ? n.formatted(.number.precision(.fractionLength(0...2)).grouping(.never)) : "" }
            paidText = text(editing.paid)
            priceText = text(editing.price)
        } else {
            amountsKept = true
        }
    }
}
