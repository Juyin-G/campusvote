import Foundation

private struct RefreshPayload: Encodable {
    let refreshToken: String
}

struct Endpoint {
    let path: String
    let method: String
    var queryItems: [URLQueryItem] = []
    var body: (any Encodable)? = nil
    var usesStoredToken: Bool = true
    var explicitToken: String? = nil

    // Satisface el error de APIClient.swift (Línea 130)
    static func refresh(refreshToken: String) -> Endpoint {
        Endpoint(
            path: "/api/auth/refresh",
            method: "POST",
            body: RefreshPayload(refreshToken: refreshToken),
            usesStoredToken: false,
            explicitToken: refreshToken
        )
    }

    // Endpoint de Ferias Asignadas
    static var myAssignments: Endpoint {
        Endpoint(path: "/api/fairs/my-assignments", method: "GET")
    }
}
