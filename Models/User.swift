import Foundation

/// Usuario de la sesión (respuesta de /auth/login y /auth/me).
struct User: Decodable, Hashable {
    let id: String
    let email: String
    let firstName: String
    let lastName: String
    let role: String
    let organizationId: String?

    var fullName: String {
        "\(firstName) \(lastName)"
    }

    var isJury: Bool {
        role == "JURY"
    }
}

/// Respuesta del login, del segundo paso del 2FA y de la renovación de sesión.
struct AuthResult: Decodable {
    let requiresTotp: Bool?
    let token: String?
    let refreshToken: String?
    /// Solo llega si requiresTotp es true: se usa para enviar el código.
    let tempToken: String?
    let user: User?
}
