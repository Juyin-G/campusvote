import Foundation

/// Errores de la API, cada uno con un mensaje listo para mostrar.
enum APIError: Error, Equatable {
    /// El backend respondió con error: { success: false, error: { code, message } }.
    case server(status: Int, code: String, message: String)
    /// La sesión venció y no se pudo renovar: hay que volver a iniciar sesión.
    case sessionExpired
    /// Sin conexión, o el servidor no respondió.
    case network
    /// La respuesta no tiene el formato esperado.
    case decoding(String)

    var message: String {
        switch self {
        case .server(_, _, let message):
            // El backend ya manda el mensaje en español, listo para mostrar.
            return message
        case .sessionExpired:
            return "Tu sesión venció. Vuelve a iniciar sesión."
        case .network:
            return "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo."
        case .decoding:
            return "El servidor respondió algo inesperado. Avísale al equipo."
        }
    }

    /// Código del backend (CONFLICT, FORBIDDEN, ACCOUNT_LOCKED…), si lo hay.
    var code: String? {
        if case .server(_, let code, _) = self {
            return code
        }
        return nil
    }
}

/// Forma del cuerpo de error del backend.
struct ServerErrorBody: Decodable {
    struct Detail: Decodable {
        let code: String
        let message: String
    }

    let error: Detail
}

extension Error {
    /// Mensaje para la interfaz, o nil si la tarea solo se canceló
    /// (por ejemplo, al salir de la pantalla antes de que llegue la respuesta).
    var userMessage: String? {
        if self is CancellationError {
            return nil
        }
        if let apiError = self as? APIError {
            return apiError.message
        }
        return "Ocurrió un error inesperado."
    }
}
