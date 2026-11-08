import SwiftUI

// The pieces every screen is built from, as a plain iPhone app would have
// them: white cards with a soft shadow, round logo circles, round action
// buttons, the ring, state pills, and (for later) gradient wallet cards. Colours are Theme's; the payee logos and category colours are
// PayeeLogos'. Text from the homelab is shown verbatim, never as a
// localization key or markdown.

/// The look's fixed colours, beyond Theme's.
enum Design {
    /// The shadow under cards: a deep blue-grey, never pure black, by day.
    static let shadow = Color(light: 0x101828, dark: 0x000000)
    /// The ring of running apps on the dark hero card.
    static let running = Color(light: 0x3CC79F, dark: 0x3CC79F)
    /// A red badge on an app that needs a look.
    static let badge = Color(light: 0xE5352B, dark: 0xFF453A)
    /// The dark hero card's two ends (Status's "Right now").
    static let hero = [Color(light: 0x10131A, dark: 0x1A1D25), Color(light: 0x2A3142, dark: 0x2C3344)]
    /// A logo circle with nothing of its own: a soft grey, and its icon in the quieter ink.
    static let plainCircle = Color(light: 0xEFEFF2, dark: 0x2C2C2E)

    /// Sizes of a logo circle, as the mockups use them.
    static let logoInList: CGFloat = 48
    static let logoInGrid: CGFloat = 58
    static let logoHero: CGFloat = 96

    /// A category's colours (1 to 8), light and dark, from the computer's
    /// --cat tokens; nil for 0 or one it doesn't have.
    static func category(_ hue: Int) -> CategoryTint? {
        let logos = PayeeLogos.shared
        guard hue >= 1, hue <= logos.categoryLight.count, hue <= logos.categoryDark.count else { return nil }
        let (l, d) = (logos.categoryLight[hue - 1], logos.categoryDark[hue - 1])
        func pair(_ a: String, _ b: String) -> Color {
            Color(light: PayeeLogos.rgb(a) ?? 0x8E8E93, dark: PayeeLogos.rgb(b) ?? 0x8E8E93)
        }
        return CategoryTint(base: pair(l.base, d.base), soft: pair(l.soft, d.soft), ink: pair(l.ink, d.ink))
    }

    /// A payee's own mark's colour (0 to 7); white reads on each.
    static func auto(_ n: Int) -> Color {
        let list = PayeeLogos.shared.autoColours
        guard !list.isEmpty else { return Theme.accent }
        return Color(hex: list[((n % list.count) + list.count) % list.count])
    }
}

/// A category's colour, the soft tint behind its icon, and the ink that reads on the tint.
struct CategoryTint {
    let base: Color
    let soft: Color
    let ink: Color
}

extension Color {
    /// A fixed colour from "#rrggbb", the same in light and dark (a brand's own).
    init(hex: String) {
        let rgb = PayeeLogos.rgb(hex) ?? 0x8E8E93
        self.init(light: rgb, dark: rgb)
    }
}

extension Font {
    /// The big bold number on a card ("$4,212", "21 of 22").
    static let bigNumber = Font.system(.title, design: .default, weight: .heavy)
    /// A tile's number ("All fresh", "412 GB").
    static let tileNumber = Font.system(.title2, design: .default, weight: .heavy)
}

// MARK: - Cards

/// A white card with a soft two-layer shadow and no border.
struct CardBackground: ViewModifier {
    var radius: CGFloat = Theme.cardRadius

    func body(content: Content) -> some View {
        content.background {
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(Theme.surface)
                .shadow(color: Design.shadow.opacity(0.05), radius: 1, y: 1)
                .shadow(color: Design.shadow.opacity(0.07), radius: 11, y: 8)
        }
    }
}

/// The dark card at the top of Status: a near-black gradient with a deeper shadow.
struct HeroCardBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .foregroundStyle(.white)
            .background {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(LinearGradient(colors: Design.hero, startPoint: .topLeading, endPoint: .bottomTrailing))
                    .shadow(color: Design.shadow.opacity(0.2), radius: 13, y: 10)
            }
            .environment(\.colorScheme, .dark)
    }
}

extension View {
    /// On a white card (dark grey at night) with a soft shadow.
    func card(radius: CGFloat = Theme.cardRadius) -> some View { modifier(CardBackground(radius: radius)) }

    /// On the dark hero card, in white.
    func heroCard() -> some View { modifier(HeroCardBackground()) }
}

// MARK: - Buttons

/// A button that gives way a little under a finger.
struct PressableButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.94 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

/// A round action under an app's header: Open, Restart, Stop, Logs. A white
/// circle with its symbol in its colour, its name below, and a light tap
/// you can feel.
struct RoundActionButton: View {
    let title: String
    let systemImage: String
    var tint: Color = Theme.accent
    var size: CGFloat = 56
    let action: () -> Void

    @Environment(\.isEnabled) private var isEnabled
    @State private var taps = 0

    var body: some View {
        Button {
            taps += 1
            action()
        } label: {
            VStack(spacing: 6) {
                Image(systemName: systemImage)
                    .font(.system(size: size * 0.39, weight: .semibold))
                    .foregroundStyle(tint)
                    .frame(width: size, height: size)
                    .background {
                        Circle()
                            .fill(Theme.surface)
                            .shadow(color: Design.shadow.opacity(0.05), radius: 1, y: 1)
                            .shadow(color: Design.shadow.opacity(0.07), radius: 11, y: 8)
                    }
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .opacity(isEnabled ? 1 : 0.4)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableButtonStyle())
        .sensoryFeedback(.impact(weight: .light), trigger: taps)
    }
}

// MARK: - Pills

/// A state with a dot in its colour, on a soft tint of it: "Live", "Running · up 4 days".
/// For success, warning, info and the accent, whose text reads at 4.5:1 on the tint.
struct DotPill: View {
    let text: String
    var tint: Color = Theme.success

    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(tint).frame(width: 7, height: 7)
            Text(verbatim: text).lineLimit(1)
        }
        .font(.footnote.weight(.semibold))
        .foregroundStyle(tint)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(tint.opacity(0.10), in: Capsule())
        .accessibilityElement(children: .combine)
    }
}

/// A red count or "!" on an app's icon, its corner, ringed in the canvas's colour.
struct AttentionBadge: View {
    var text = "!"

    var body: some View {
        Text(verbatim: text)
            .font(.caption.weight(.bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 5)
            .frame(minWidth: 22, minHeight: 22)
            .background(Design.badge, in: Capsule())
            .overlay(Capsule().strokeBorder(Theme.canvas, lineWidth: 2))
            .accessibilityHidden(true)
    }
}

// MARK: - The ring

/// How much of a whole: running out of total, on Status's hero card. The
/// arc grows from the top, clockwise, and moves when the value does.
struct ProgressRing<Label: View>: View {
    /// 0 to 1.
    let value: Double
    var lineWidth: CGFloat = 12
    var tint: Color = Design.running
    var track: Color = .white.opacity(0.18)
    @ViewBuilder var label: () -> Label

    private var clamped: Double { value.isFinite ? min(max(value, 0), 1) : 0 }

    var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: clamped)
                .stroke(tint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            label()
        }
        .padding(lineWidth / 2)
        .animation(.spring(response: 0.6, dampingFraction: 0.85), value: clamped)
    }
}

extension ProgressRing where Label == EmptyView {
    init(value: Double, lineWidth: CGFloat = 12, tint: Color = Design.running, track: Color = .white.opacity(0.18)) {
        self.init(value: value, lineWidth: lineWidth, tint: tint, track: track) { EmptyView() }
    }
}

// MARK: - Logo circles

/// A brand's mark (PayeeLogos.json), drawn in its 24 by 24 box, centred.
struct LogoShape: Shape {
    let segments: [LogoSegment]

    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 24
        let ox = rect.midX - 12 * s, oy = rect.midY - 12 * s
        func p(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: ox + x * s, y: oy + y * s) }
        var path = Path()
        for seg in segments {
            switch seg {
            case .move(let x, let y): path.move(to: p(x, y))
            case .line(let x, let y): path.addLine(to: p(x, y))
            case .curve(let x1, let y1, let x2, let y2, let x, let y):
                path.addCurve(to: p(x, y), control1: p(x1, y1), control2: p(x2, y2))
            case .close: path.closeSubpath()
            }
        }
        return path
    }
}

/// A round logo: a brand's mark on its colour, a payee's initials on the
/// colour its name picks, or a category's icon on its soft tint. 48 pt in
/// lists, 58 in a grid, 96 on a transaction.
struct LogoCircle: View {
    let content: LogoContent
    var size: CGFloat = Design.logoInList

    var body: some View {
        ZStack {
            Circle().fill(background)
            foreground
        }
        .frame(width: size, height: size)
        .overlay(Circle().strokeBorder(Color.black.opacity(0.06), lineWidth: 1))
        .accessibilityHidden(true)
    }

    private var background: Color {
        switch content {
        case .brand(let b): Color(hex: b.bg)
        case .initials(_, let n): Design.auto(n)
        case .icon(_, let hue), .letter(_, let hue): hue.flatMap(Design.category)?.soft ?? Design.plainCircle
        }
    }

    @ViewBuilder private var foreground: some View {
        switch content {
        case .brand(let b):
            if let mark = PayeeLogos.shared.marks[b.key] {
                LogoShape(segments: mark)
                    .fill(Color(hex: b.ink))
                    .frame(width: size * 0.52, height: size * 0.52)
            } else {
                letters(b.letters ?? String(b.name.prefix(1)), ink: Color(hex: b.ink))
            }
        case .initials(let text, _):
            letters(text, ink: .white)
        case .icon(let glyph, let hue):
            Image(systemName: PayeeLogos.symbols[glyph] ?? "circle")
                .font(.system(size: size * 0.42, weight: .semibold))
                .foregroundStyle(hue.flatMap(Design.category)?.ink ?? Theme.secondaryInk)
        case .letter(let text, let hue):
            letters(text, ink: hue.flatMap(Design.category)?.ink ?? Theme.secondaryInk)
        }
    }

    private func letters(_ text: String, ink: Color) -> some View {
        let scale: CGFloat = text.count > 2 ? 0.3 : text.count > 1 ? 0.36 : 0.44
        return Text(verbatim: text)
            .font(.system(size: size * scale, weight: .heavy))
            .tracking(-0.3)
            .foregroundStyle(ink)
            .lineLimit(1)
            .minimumScaleFactor(0.5)
            .padding(.horizontal, size * 0.08)
    }
}

extension LogoCircle {
    /// A transaction's logo: its payee's brand, a transfer's, its category's icon, or its payee's initials.
    init(transaction: FinanceTransaction, categories: [FinanceCategory], size: CGFloat = Design.logoInList) {
        self.init(content: PayeeLogos.shared.mark(for: transaction, categories: categories), size: size)
    }

    /// A payee's logo, as a bank writes it or a person does: its brand, else its initials.
    init(payee: String, institution: String? = nil, size: CGFloat = Design.logoInList) {
        let logos = PayeeLogos.shared
        let brand = logos.payeeBrand(institution: institution, payee: payee)
        self.init(content: logos.mark(brand: brand, kind: nil, name: payee, auto: institution != "none"), size: size)
    }

    /// An account's logo: its bank's (picked, or in its name), else its kind's icon.
    init(account: FinanceAccount, size: CGFloat = Design.logoInList) {
        let logos = PayeeLogos.shared
        let brand = logos.brandOf(institution: account.institution, name: account.name, kind: account.kind)
        self.init(content: logos.mark(brand: brand, kind: account.kind, name: account.name), size: size)
    }
}

// MARK: - Wallet cards

/// A wallet card's colours: the gradient from its top-left to its
/// bottom-right, and whether its text is dark. White text keeps 4.5:1 on
/// every gradient but the credit card's, which has dark text.
enum WalletStyle: Sendable, Equatable {
    /// Navy to blue.
    case checking
    /// White to silver, dark text.
    case credit
    /// Deep green.
    case savings
    /// Near-black.
    case investments
    /// Plum, for a loan.
    case loan
    /// Slate, for a home, a car, or anything else.
    case other

    /// The style of an account of a kind (FinanceAccount.kind).
    init(kind: String) {
        switch kind {
        case "checking": self = .checking
        case "card": self = .credit
        case "savings": self = .savings
        case "investment", "retirement": self = .investments
        case "loan": self = .loan
        default: self = .other
        }
    }

    var colours: [Color] {
        let pair: (UInt32, UInt32) = switch self {
        case .checking: (0x0B3B8C, 0x2464CC)
        case .credit: (0xFFFFFF, 0xE9ECF2)
        case .savings: (0x0B5A40, 0x0E7A55)
        case .investments: (0x0F1115, 0x2B2F3A)
        case .loan: (0x4A1942, 0x7A2E63)
        case .other: (0x26313F, 0x46566B)
        }
        return [Color(light: pair.0, dark: pair.0), Color(light: pair.1, dark: pair.1)]
    }

    var hasDarkText: Bool { self == .credit }
}

/// A card in the wallet: what it is at the top with its bank's mark, and
/// its amount, big, at the bottom with a line under it. 180 pt high.
struct WalletCard: View {
    static let height: CGFloat = 180

    let title: String
    let amount: String
    var detail: String?
    var style: WalletStyle
    /// The bank's or card's mark, top right.
    var mark: LogoContent?
    /// A short note top right instead, such as "▲ 2.3%".
    var note: String?

    private var ink: Color { style.hasDarkText ? Color(light: 0x1C1C1E, dark: 0x1C1C1E) : .white }
    private var quiet: Color { style.hasDarkText ? Color(light: 0x5E5E66, dark: 0x5E5E66) : .white.opacity(0.9) }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .center) {
                Text(verbatim: title)
                    .font(.subheadline.weight(.bold))
                    .lineLimit(1)
                Spacer(minLength: 8)
                if let mark {
                    LogoCircle(content: mark, size: 30)
                } else if let note {
                    Text(verbatim: note)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(quiet)
                }
            }
            Spacer(minLength: 0)
            Text(verbatim: amount)
                .font(.system(size: 30, weight: .heavy))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .contentTransition(.numericText())
            if let detail {
                Text(verbatim: detail)
                    .font(.footnote)
                    .foregroundStyle(quiet)
                    .lineLimit(1)
            }
        }
        .foregroundStyle(ink)
        .padding(.horizontal, 20)
        .padding(.vertical, 18)
        .frame(maxWidth: .infinity, minHeight: Self.height, maxHeight: Self.height, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(LinearGradient(colors: style.colours, startPoint: .topLeading, endPoint: .bottomTrailing))
                .shadow(color: Design.shadow.opacity(0.18), radius: 13, y: 10)
        }
        .environment(\.colorScheme, style.hasDarkText ? .light : .dark)
        .accessibilityElement(children: .combine)
    }
}

/// Wallet cards stacked as in Apple's Wallet: each shows its top strip
/// (`peek` points) over the one before, the last one whole, on top.
struct WalletStack<Content: View>: View {
    var peek: CGFloat = 52
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: peek - WalletCard.height) {
            content()
        }
    }
}

// MARK: - Rows with an icon tile

/// A row as Settings has them: its icon on a coloured rounded tile, its
/// name (and a line under it), and a few words on the right.
struct IconTileLabel<Trailing: View>: View {
    let title: String
    let systemImage: String
    let tint: Color
    var subtitle: String?
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(tint, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(verbatim: title)
                if let subtitle {
                    Text(verbatim: subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 8)
            trailing()
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }
}

extension IconTileLabel where Trailing == EmptyView {
    init(title: String, systemImage: String, tint: Color, subtitle: String? = nil) {
        self.init(title: title, systemImage: systemImage, tint: tint, subtitle: subtitle) { EmptyView() }
    }
}

/// The tiles' colours, as Settings' own: each a colour white reads on.
enum TileColour {
    static let green = Color(light: 0x248A3D, dark: 0x30D158)
    static let indigo = Color(light: 0x5856D6, dark: 0x5E5CE6)
    static let blue = Color(light: 0x0A6CD8, dark: 0x0A84FF)
    static let orange = Color(light: 0xC2410C, dark: 0xE8590C)
    static let red = Color(light: 0xD70015, dark: 0xFF453A)
    static let teal = Color(light: 0x0E7490, dark: 0x30B0C7)
    static let grey = Color(light: 0x6E6E73, dark: 0x8E8E93)
    static let purple = Color(light: 0x8944AB, dark: 0xBF5AF2)
}
