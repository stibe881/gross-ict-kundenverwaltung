import ExpoModulesCore
import UIKit
#if canImport(ProximityReader)
import ProximityReader
#endif

// Zeigt Apples eingebaute Haendler-Anleitung ("How to Tap") fuer Tap to Pay on iPhone.
// Apple-Review-Anforderung 4.1: Auf iOS 18+ muss ProximityReaderDiscovery verwendet werden.
// Rueckgabe: true = Apple-Anleitung wurde angezeigt, false = nicht verfuegbar (iOS < 18),
// der Aufrufer zeigt dann eine eigene Fallback-Anleitung.
public class TapToPayEducationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TapToPayEducation")

    AsyncFunction("show") { (promise: Promise) in
      DispatchQueue.main.async {
        if #available(iOS 18.0, *) {
          Task { @MainActor in
            do {
              let discovery = ProximityReaderDiscovery()
              let content = try await discovery.content(for: .payment(.howToTap))

              guard let root = UIApplication.shared.connectedScenes
                .compactMap({ ($0 as? UIWindowScene)?.keyWindow })
                .first?.rootViewController else {
                promise.resolve(false)
                return
              }
              var top = root
              while let presented = top.presentedViewController { top = presented }

              try await discovery.presentContent(content, from: top)
              promise.resolve(true)
            } catch {
              promise.reject("E_TTP_EDUCATION", error.localizedDescription)
            }
          }
        } else {
          promise.resolve(false)
        }
      }
    }
  }
}
