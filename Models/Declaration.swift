import Foundation

/// Declaración de imparcialidad firmada por el jurado (una por feria).
struct Declaration: Decodable, Hashable {
    let id: String
    let statement: String
    let signedAt: Date
}

/// GET /fairs/:id/jury/declaration
struct DeclarationStatus: Decodable {
    let signed: Bool
    let declaration: Declaration?
}
