import Foundation

struct Category: Decodable, Hashable, Identifiable {
    let id: String
    let name: String
}

struct Stand: Decodable, Hashable, Identifiable {
    let id: String
    let code: String
}

/// GET /fairs/:id/categories → data.categories
struct CategoryList: Decodable {
    let categories: [Category]
}

/// GET /fairs/:id/stands → data.stands
struct StandList: Decodable {
    let stands: [Stand]
}

/// Tarjeta de la lista (GET /fairs/:id/projects). Solo llegan proyectos aprobados.
struct ProjectCard: Decodable, Hashable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let coverUrl: URL?
    let logoUrl: URL?
    let category: Category?
    let stand: Stand?
}

/// Detalle (GET /fairs/:id/projects/:projectId). Ojo: el id llega como project_id.
struct ProjectDetail: Decodable, Hashable {
    let projectId: String
    let name: String
    let description: String?
    let coverUrl: URL?
    let logoUrl: URL?
    let projectUrl: URL?
    let category: Category?
    let stand: Stand?
    let members: [Member]
}

/// Integrante del proyecto. El id es el de la participación, no el del usuario.
struct Member: Decodable, Hashable, Identifiable {
    let id: String
    let firstName: String?
    let lastName: String?
    /// EXPOSITOR · COLLABORATOR · ADVISOR
    let role: String

    var displayName: String {
        [firstName, lastName].compactMap { $0 }.joined(separator: " ")
    }

    var roleLabel: String {
        switch role {
        case "ADVISOR": return "Asesor"
        case "COLLABORATOR": return "Colaborador"
        default: return "Expositor"
        }
    }
}
