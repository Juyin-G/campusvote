import SwiftUI

struct SplashView: View {
    var body: some View {
        ZStack {
            
            Color(.systemBackground)
                .ignoresSafeArea()

            VStack(spacing: 40) {
                Image("logo_campusvote")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 300, height: 300)
                
                
                ProgressView()
                    .controlSize(.regular)
            }
        }
    }
}

#Preview {
    SplashView()
}
