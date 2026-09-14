import Foundation

/// Única capa que habla con el backend. Las vistas nunca la usan directo: pasan por un store.
///
/// Es @MainActor en lugar de actor: todo el estado de la app vive en el hilo
/// principal y así no hay que cruzar aislamientos. Las esperas de red no
/// bloquean la interfaz, porque URLSession suspende la tarea mientras llega la respuesta.
@MainActor
final class APIClient {
    static let shared = APIClient()

    private enum Key {
        static let access = "accessToken"
        static let refresh = "refreshToken"
    }

    private let session: URLSession
    private let keychain = KeychainStore()
    private let decoder = JSONCoding.makeDecoder()
    private let encoder = JSONCoding.makeEncoder()

    init(session: URLSession = .shared) {
        self.session = session
    }

    // MARK: - Tokens

    var hasSavedSession: Bool {
        keychain.read(Key.access) != nil
    }

    var savedRefreshToken: String? {
        keychain.read(Key.refresh)
    }

    func saveTokens(access: String, refresh: String?) {
        keychain.save(access, for: Key.access)
        if let refresh {
            keychain.save(refresh, for: Key.refresh)
        }
    }

    func clearTokens() {
        keychain.delete(Key.access)
        keychain.delete(Key.refresh)
    }

    // MARK: - Peticiones

    /// Envía la petición y devuelve el `data` de la respuesta ya decodificado.
    /// Si el token venció (401), lo renueva una vez y reintenta.
    func send<T: Decodable>(_ endpoint: Endpoint, as type: T.Type) async throws -> T {
        do {
            return try await perform(endpoint, as: type)
        } catch APIError.server(let status, _, _) where status == 401 && endpoint.usesStoredToken {
            try await refreshSession()
            return try await perform(endpoint, as: type)
        }
    }

    /// Para rutas cuya respuesta no interesa, como cerrar sesión.
    func send(_ endpoint: Endpoint) async throws {
        _ = try await rawData(for: endpoint)
    }

    private func perform<T: Decodable>(_ endpoint: Endpoint, as type: T.Type) async throws -> T {
        let data = try await rawData(for: endpoint)
        do {
            return try decoder.decode(Envelope<T>.self, from: data).data
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }

    private func rawData(for endpoint: Endpoint) async throws -> Data {
        var components = URLComponents(
            url: APIConfig.baseURL.appending(path: endpoint.path),
            resolvingAgainstBaseURL: false
        )
        if !endpoint.queryItems.isEmpty {
            components?.queryItems = endpoint.queryItems
        }
        guard let url = components?.url else {
            throw APIError.network
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // Render en plan gratuito puede tardar en despertar la primera vez.
        request.timeoutInterval = 60
        if let body = endpoint.body {
            request.httpBody = try encoder.encode(body)
        }

        let token = endpoint.explicitToken ?? (endpoint.usesStoredToken ? keychain.read(Key.access) : nil)
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let result: (Data, URLResponse)
        do {
            result = try await session.data(for: request)
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch {
            throw APIError.network
        }

        let (data, response) = result
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let body = try? decoder.decode(ServerErrorBody.self, from: data)
            throw APIError.server(
                status: status,
                code: body?.error.code ?? "HTTP_\(status)",
                message: body?.error.message ?? "El servidor respondió con el código \(status)."
            )
        }
        return data
    }

    /// POST /auth/refresh con el refresh token guardado.
    private func refreshSession() async throws {
        guard let refresh = keychain.read(Key.refresh) else {
            clearTokens()
            throw APIError.sessionExpired
        }
        do {
            let result = try await perform(.refresh(refreshToken: refresh), as: AuthResult.self)
            guard let token = result.token else {
                throw APIError.sessionExpired
            }
            saveTokens(access: token, refresh: result.refreshToken)
        } catch {
            clearTokens()
            throw APIError.sessionExpired
        }
    }
}

/// Toda respuesta correcta del backend: { success, message, data, meta }.
private struct Envelope<T: Decodable>: Decodable {
    let data: T
}

/// Para respuestas cuyo contenido no se usa: acepta cualquier valor.
struct IgnoredResponse: Decodable {
    init(from decoder: any Decoder) throws {}
}
