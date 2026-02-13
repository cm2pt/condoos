import AppKit
import Foundation
import WebKit

let arguments = CommandLine.arguments

func usage() {
  fputs("Usage: swift capture_screenshot.swift <url> <output_png_path> [width] [height] [wait_ms]\n", stderr)
}

guard arguments.count >= 3 else {
  usage()
  exit(1)
}

guard let targetURL = URL(string: arguments[1]) else {
  fputs("Invalid URL: \(arguments[1])\n", stderr)
  exit(1)
}

let outputPath = arguments[2]
let width = arguments.count > 3 ? Int(arguments[3]) ?? 1512 : 1512
let height = arguments.count > 4 ? Int(arguments[4]) ?? 1200 : 1200
let waitMs = arguments.count > 5 ? Int(arguments[5]) ?? 2100 : 2100

final class SnapshotController: NSObject, WKNavigationDelegate {
  private let webView: WKWebView
  private let outputPath: String
  private let waitMs: Int

  init(frame: CGRect, outputPath: String, waitMs: Int) {
    let config = WKWebViewConfiguration()
    config.preferences.javaScriptCanOpenWindowsAutomatically = true
    config.websiteDataStore = .nonPersistent()

    self.webView = WKWebView(frame: frame, configuration: config)
    self.outputPath = outputPath
    self.waitMs = waitMs
    super.init()

    self.webView.navigationDelegate = self
    self.webView.setValue(false, forKey: "drawsBackground")
  }

  func start(url: URL) {
    let request = URLRequest(url: url)
    webView.load(request)
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    let js = "document.readyState"
    webView.evaluateJavaScript(js) { [self] _, _ in
      DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(self.waitMs)) {
        self.capture(webView: webView)
      }
    }
  }

  private func capture(webView: WKWebView) {
    let js = "Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight, document.documentElement.clientHeight)"

    webView.evaluateJavaScript(js) { [self] result, _ in
      let contentHeight = (result as? Double) ?? Double(webView.frame.height)
      let finalHeight = max(CGFloat(contentHeight), webView.frame.height)

      let config = WKSnapshotConfiguration()
      config.rect = CGRect(x: 0, y: 0, width: webView.frame.width, height: finalHeight)
      config.afterScreenUpdates = true

      webView.takeSnapshot(with: config) { [self] image, error in
        if let error {
          fputs("Snapshot failed: \(error.localizedDescription)\n", stderr)
          exit(2)
        }

        guard let image,
              let tiffData = image.tiffRepresentation,
              let imageRep = NSBitmapImageRep(data: tiffData),
              let pngData = imageRep.representation(using: .png, properties: [:]) else {
          fputs("Could not encode PNG data\n", stderr)
          exit(3)
        }

        do {
          let url = URL(fileURLWithPath: self.outputPath)
          try pngData.write(to: url)
          print("Screenshot saved to: \(self.outputPath)")
          exit(0)
        } catch {
          fputs("Failed writing image: \(error.localizedDescription)\n", stderr)
          exit(4)
        }
      }
    }
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    fputs("Navigation failed: \(error.localizedDescription)\n", stderr)
    exit(5)
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    fputs("Navigation failed (provisional): \(error.localizedDescription)\n", stderr)
    exit(6)
  }
}

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
let frame = CGRect(x: 0, y: 0, width: width, height: height)
let snapshotController = SnapshotController(frame: frame, outputPath: outputPath, waitMs: waitMs)
snapshotController.start(url: targetURL)
RunLoop.main.run()
