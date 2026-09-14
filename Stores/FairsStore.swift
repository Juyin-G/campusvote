import Foundation
import Observation

@Observable
@MainActor
final class FairsStore {
    private(set) var activeFairs: [FairAssignment] = []
    private(set) var closedFairs: [FairAssignment] = []
    private(set) var isLoading = false
    var errorMessage: String?

    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    func fetchMyAssignments() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response = try await api.send(.myAssignments, as: APIResponse<[FairAssignment]>.self)
            self.activeFairs = response.data.filter { $0.fair.status.uppercased() != "CLOSED" }
            self.closedFairs = response.data.filter { $0.fair.status.uppercased() == "CLOSED" }
        } catch {
            self.errorMessage = error.localizedDescription
        }
    }
}
