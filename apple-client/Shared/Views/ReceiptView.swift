import PDFKit
import SwiftUI

/// A receipt kept with a transaction: a picture or a PDF. It's read when
/// opened and kept only while shown.
struct ReceiptView: View {
    let name: String
    let title: String
    let finances: FinancesViewModel
    @State private var content: ReceiptCodec.Content?
    @State private var failed = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                switch content {
                case .image(let icon)?:
                    ScrollView([.horizontal, .vertical]) {
                        Image(decorative: icon.image, scale: 1)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxWidth: 900)
                            .padding()
                    }
                case .pdf(let data)?:
                    PDFDocumentView(data: data)
                case nil:
                    if failed {
                        ContentUnavailableView("Couldn't Open the Receipt", systemImage: "doc.questionmark",
                                               description: Text(finances.saveError ?? "It isn't a picture or PDF this device can show."))
                    } else {
                        ProgressView("Reading the receipt…")
                    }
                }
            }
            .privacySensitive()
            .navigationTitle(title)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 520, minHeight: 600)
        #endif
        .task {
            content = await finances.openReceipt(name)
            failed = content == nil
        }
    }
}

/// PDFKit's view, read-only, on both platforms.
#if os(iOS)
private struct PDFDocumentView: UIViewRepresentable {
    let data: Data

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.document = PDFDocument(data: data)
        return view
    }

    func updateUIView(_ view: PDFView, context: Context) {}
}
#else
private struct PDFDocumentView: NSViewRepresentable {
    let data: Data

    func makeNSView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.document = PDFDocument(data: data)
        return view
    }

    func updateNSView(_ view: PDFView, context: Context) {}
}
#endif
