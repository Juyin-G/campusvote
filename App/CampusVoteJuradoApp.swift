import SwiftUI

@main
struct CampusVoteJuradoApp: App {
    @State private var fairsStore: FairsStore
    @State private var isShowingSplash = true

    init() {
        let apiClient = APIClient()
        _fairsStore = State(initialValue: FairsStore(api: apiClient))
    }

    var body: some Scene {
        WindowGroup {
            ZStack {
                if isShowingSplash {
                    SplashView()
                } else {
                    FairListView()
                        .environment(fairsStore)
                }
            }
            .task {
                
                try? await Task.sleep(nanoseconds: 2_500_000_000)
                withAnimation {
                    isShowingSplash = false
                }
            }
        }
    }
}
