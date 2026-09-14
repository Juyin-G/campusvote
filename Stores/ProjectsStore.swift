import Foundation
import Observation

/// Proyectos aprobados de la feria abierta, con búsqueda y filtros.
@Observable
@MainActor
final class ProjectsStore {
    private(set) var projects: [ProjectCard] = []
    private(set) var categories: [Category] = []
    private(set) var stands: [Stand] = []
    private(set) var isLoading = false
    var errorMessage: String?

    // Filtros de la lista. Las vistas los enlazan con @Bindable.
    var search = ""
    var categoryId: String?
    var standId: String?

    private var currentFairId: String?
    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    /// Cambia cuando cambia algún filtro; la lista lo usa para recargar.
    var filterKey: String {
        "\(search)|\(categoryId ?? "")|\(standId ?? "")"
    }

    /// Al entrar a otra feria se limpian los filtros y se cargan sus categorías y stands.
    func open(fairId: String) async {
        guard fairId != currentFairId else { return }
        currentFairId = fairId
        projects = []
        search = ""
        categoryId = nil
        standId = nil
        do {
            categories = try await api.send(.categories(fairId: fairId), as: CategoryList.self).categories
            stands = try await api.send(.stands(fairId: fairId), as: StandList.self).stands
        } catch {
            errorMessage = error.userMessage
        }
    }

    func load(fairId: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        let text = search.trimmingCharacters(in: .whitespaces)
        do {
            projects = try await api.send(
                .projects(
                    fairId: fairId,
                    search: text.isEmpty ? nil : text,
                    categoryId: categoryId,
                    standId: standId
                ),
                as: [ProjectCard].self
            )
        } catch {
            errorMessage = error.userMessage
        }
    }

    func detail(fairId: String, projectId: String) async -> ProjectDetail? {
        do {
            return try await api.send(.projectDetail(fairId: fairId, projectId: projectId), as: ProjectDetail.self)
        } catch {
            errorMessage = error.userMessage
            return nil
        }
    }
}
