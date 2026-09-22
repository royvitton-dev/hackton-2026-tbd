import AppKit
import ApplicationServices

// Warp receives normal paste/Return events in its currently focused tab or pane.
// Never activate Warp here: an unfocused app is not an eligible destination.
final class WarpInput {
    private struct Focus {
        let pid: pid_t
        let window: AXUIElement
        let title: String
        let element: AXUIElement?
    }
    private var generation = 0
    private var restoreClipboard: (() -> Void)?
    private var inputMonitor: Any?

    static func isWarp(_ bundle: String?) -> Bool {
        ["dev.warp.Warp-Stable", "dev.warp.Warp-Preview"].contains(bundle ?? "")
    }

    static func requestPermission() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        if !AXIsProcessTrustedWithOptions(options) {
            emit(["type": "warning", "message": "Warp 입력을 위해 시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용에서 TBD Speech를 허용하세요. 마이크 대기는 계속됩니다."])
        }
    }

    static func snapshot() -> [String: Any] {
        let app = NSWorkspace.shared.frontmostApplication
        return ["type": "warp-status", "accessibility": AXIsProcessTrusted(),
                "frontmostBundle": app?.bundleIdentifier ?? "", "warpFocused": isWarp(app?.bundleIdentifier)]
    }

    private func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
        return value
    }

    private func element(_ app: AXUIElement, _ name: String) -> AXUIElement? {
        guard let value = attribute(app, name), CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
        return (value as! AXUIElement)
    }

    private func focus() -> Focus? {
        guard let app = NSWorkspace.shared.frontmostApplication, Self.isWarp(app.bundleIdentifier) else { return nil }
        let ax = AXUIElementCreateApplication(app.processIdentifier)
        AXUIElementSetMessagingTimeout(ax, 0.5)
        guard let window = element(ax, kAXFocusedWindowAttribute) else { return nil }
        return Focus(pid: app.processIdentifier, window: window,
                     title: attribute(window, kAXTitleAttribute) as? String ?? "",
                     element: element(ax, kAXFocusedUIElementAttribute))
    }

    private func unchanged(_ original: Focus) -> Bool {
        guard let current = focus(), current.pid == original.pid,
              CFEqual(current.window, original.window), current.title == original.title else { return false }
        if let before = original.element {
            guard let after = current.element, CFEqual(before, after) else { return false }
        }
        return true
    }

    private func keys(_ key: CGKeyCode, flags: CGEventFlags = [], pid: pid_t) -> Bool {
        guard let source = CGEventSource(stateID: .privateState),
              let down = CGEvent(keyboardEventSource: source, virtualKey: key, keyDown: true),
              let up = CGEvent(keyboardEventSource: source, virtualKey: key, keyDown: false) else { return false }
        for event in [down, up] {
            event.flags = flags
            event.setIntegerValueField(.eventSourceUserData, value: Int64(getpid()))
            event.postToPid(pid)
        }
        return true
    }

    func cancel() {
        generation += 1
        if let monitor = inputMonitor { NSEvent.removeMonitor(monitor); inputMonitor = nil }
        restoreClipboard?()
        restoreClipboard = nil
    }

    func submit(_ text: String, completion: @escaping (Bool, String) -> Void) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, text.count <= 32_000,
              !text.unicodeScalars.contains(where: { ($0.value < 32 && $0.value != 10 && $0.value != 9) || $0.value == 127 }) else {
            completion(false, "전달할 명령이 비어 있거나 올바르지 않습니다."); return
        }
        guard AXIsProcessTrusted() else {
            completion(false, "손쉬운 사용에서 TBD Speech를 허용한 뒤 다시 말해주세요."); return
        }
        guard let target = focus() else {
            completion(false, "Warp의 CLI 입력줄을 클릭한 뒤 다시 말해주세요."); return
        }
        cancel()
        let token = generation
        let board = NSPasteboard.general
        let saved = (board.pasteboardItems ?? []).map { item -> NSPasteboardItem in
            let copy = NSPasteboardItem()
            for type in item.types { if let data = item.data(forType: type) { copy.setData(data, forType: type) } }
            return copy
        }
        board.clearContents()
        guard board.setString(text, forType: .string) else {
            board.writeObjects(saved)
            completion(false, "Warp에 붙여넣을 내용을 준비하지 못했습니다."); return
        }
        let written = board.changeCount
        restoreClipboard = {
            // Preserve a newer copy made by the user or another application.
            guard board.changeCount == written else { return }
            board.clearContents()
            if !saved.isEmpty { board.writeObjects(saved) }
        }
        var interrupted = false
        inputMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.keyDown, .leftMouseDown, .rightMouseDown]) { event in
            if event.cgEvent?.getIntegerValueField(.eventSourceUserData) != Int64(getpid()) { interrupted = true }
        }
        guard unchanged(target), keys(9, flags: .maskCommand, pid: target.pid) else {
            cancel(); completion(false, "입력 포커스가 바뀌어 전달하지 않았습니다."); return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            guard let self, self.generation == token else { return }
            guard !interrupted, self.unchanged(target), AXIsProcessTrusted(), board.changeCount == written else {
                self.cancel()
                completion(false, "포커스나 입력이 바뀌어 Enter를 보내지 않았습니다. Warp 입력줄을 확인하세요.")
                return
            }
            let sent = self.keys(36, pid: target.pid)
            self.cancel()
            completion(sent, sent ? "포커스된 Warp CLI에 입력과 Enter를 전달했습니다." : "Enter를 보내지 못했습니다. Warp 입력줄을 확인하세요.")
        }
    }
}
