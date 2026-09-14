import Foundation

/// Decodificador y codificador que entienden el formato del backend.
enum JSONCoding {
    /// Respuestas: claves snake_case (cover_url → coverUrl) y fechas ISO 8601 con milisegundos.
    /// convertFromSnakeCase solo transforma las claves que tienen guion bajo, así que
    /// las que ya vienen en camelCase (requiresTotp, refreshToken) llegan intactas.
    static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        // El .iso8601 de JSONDecoder no acepta milisegundos ("2026-09-14T12:04:02.978Z").
        // El código va dentro del cierre para que funcione con cualquier aislamiento de Xcode.
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let text = try container.decode(String.self)

            let withMillis = ISO8601DateFormatter()
            withMillis.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = withMillis.date(from: text) {
                return date
            }

            let plain = ISO8601DateFormatter()
            plain.formatOptions = [.withInternetDateTime]
            if let date = plain.date(from: text) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Fecha inválida: \(text)"
            )
        }
        return decoder
    }

    /// Cuerpos de las peticiones: sin estrategia de claves. Cada cuerpo declara sus
    /// CodingKeys, porque el backend mezcla estilos (project_id, pero refreshToken).
    static func makeEncoder() -> JSONEncoder {
        JSONEncoder()
    }
}
