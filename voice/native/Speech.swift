import AppKit
import AVFoundation
import Speech
import Darwin
import ApplicationServices

// A private Unix socket carries the same newline-delimited protocol as stdio,
// while allowing LaunchServices to own the app's microphone/Speech permissions.
if let index = CommandLine.arguments.firstIndex(of: "--socket"), index + 1 < CommandLine.arguments.count {
    let path = CommandLine.arguments[index + 1]
    let bytes = Array(path.utf8CString)
    var address = sockaddr_un()
    guard bytes.count <= MemoryLayout.size(ofValue: address.sun_path) else { exit(2) }
    address.sun_family = sa_family_t(AF_UNIX)
    address.sun_len = UInt8(MemoryLayout<sockaddr_un>.size)
    withUnsafeMutablePointer(to: &address.sun_path) { pointer in
        pointer.withMemoryRebound(to: CChar.self, capacity: bytes.count) { target in
            for (offset, value) in bytes.enumerated() { target[offset] = value }
        }
    }
    let descriptor = socket(AF_UNIX, SOCK_STREAM, 0)
    guard descriptor >= 0 else { exit(2) }
    let connected = withUnsafePointer(to: &address) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            connect(descriptor, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
        }
    }
    guard connected == 0 else { exit(2) }
    guard dup2(descriptor, STDIN_FILENO) >= 0, dup2(descriptor, STDOUT_FILENO) >= 0 else { exit(2) }
    close(descriptor)
}

func emit(_ event: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: event, options: [.sortedKeys]) else { return }
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([10]))
}

final class RecognitionFeedback {
    private var panel: NSPanel?
    private var dismissal: Timer?
    private var sound: NSSound?

    func show(_ kind: String, detailOverride: String? = nil) {
        let title: String, message: String, symbol: String, soundName: String
        let tint: NSColor
        switch kind {
        case "wake":
            title = "TBD · 듣고 있어요"
            message = "호출어 인식 완료. 작업 내용을 말해주세요."
            symbol = "mic.fill"; soundName = "Tink"; tint = .systemBlue
        case "start":
            title = CommandLine.arguments.contains("--warp-focus") ? "TBD · Warp 전송 준비"
                : CommandLine.arguments.contains("--target-session") ? "TBD · CLI에 전달합니다" : "TBD · 명령을 실행합니다"
            message = CommandLine.arguments.contains("--warp-focus") ? "실행어 인식 완료. 포커스된 Warp 입력줄을 확인합니다." : "실행어 인식 완료. Codex에 전달합니다."
            symbol = "play.fill"; soundName = "Glass"; tint = .systemGreen
        case "empty":
            title = "TBD · 작업 내용이 필요해요"
            message = "시작어를 인식했어요. 작업 내용을 먼저 말해주세요."
            symbol = "exclamationmark.bubble.fill"; soundName = "Pop"; tint = .systemOrange
        case "warp-sent":
            title = "TBD · Warp로 전달했어요"
            message = "포커스된 CLI에서 입력과 실행 결과를 확인하세요."
            symbol = "checkmark.circle.fill"; soundName = "Glass"; tint = .systemGreen
        case "warp-blocked":
            title = "TBD · Warp 전달 확인 필요"
            message = "Warp의 CLI 입력줄을 선택하고 다시 말해주세요."
            symbol = "exclamationmark.bubble.fill"; soundName = "Pop"; tint = .systemOrange
        default: return
        }
        dismissal?.invalidate()
        panel?.orderOut(nil)
        let frame = NSRect(x: 0, y: 0, width: 400, height: 98)
        let window = NSPanel(contentRect: frame, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        window.isFloatingPanel = true
        window.hidesOnDeactivate = false
        window.level = .statusBar
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = true
        window.ignoresMouseEvents = true
        window.isReleasedWhenClosed = false
        let background = NSVisualEffectView(frame: frame)
        background.material = .hudWindow
        background.blendingMode = .behindWindow
        background.state = .active
        background.wantsLayer = true
        background.layer?.cornerRadius = 18
        background.layer?.masksToBounds = true
        let icon = NSImageView(frame: NSRect(x: 22, y: 32, width: 32, height: 32))
        icon.image = NSImage(systemSymbolName: symbol, accessibilityDescription: title)
        icon.contentTintColor = tint
        background.addSubview(icon)
        let heading = NSTextField(labelWithString: title)
        heading.font = .systemFont(ofSize: 17, weight: .semibold)
        heading.frame = NSRect(x: 70, y: 51, width: 310, height: 24)
        background.addSubview(heading)
        let detail = CommandLine.arguments.contains("--dry-run") && kind == "start"
            ? "시작어 인식 완료. 연습 모드: 실제 실행하지 않습니다." : detailOverride ?? message
        let body = NSTextField(wrappingLabelWithString: detail)
        body.font = .systemFont(ofSize: 12)
        body.textColor = .secondaryLabelColor
        body.frame = NSRect(x: 70, y: 15, width: 310, height: 32)
        background.addSubview(body)
        window.contentView = background
        let screen = NSScreen.screens.first(where: { NSMouseInRect(NSEvent.mouseLocation, $0.frame, false) }) ?? NSScreen.main
        if let visible = screen?.visibleFrame {
            window.setFrameOrigin(NSPoint(x: visible.maxX - frame.width - 20, y: visible.maxY - frame.height - 20))
        }
        panel = window
        window.orderFrontRegardless()
        sound?.stop()
        sound = NSSound(named: NSSound.Name(soundName))
        let played = !CommandLine.arguments.contains("--no-sound") && (sound?.play() ?? false)
        emit(["type": "feedback-shown", "kind": kind, "title": title, "message": detail,
              "visible": window.isVisible, "sound": soundName, "soundAvailable": sound != nil, "soundPlayed": played,
              "takesFocus": window.isKeyWindow, "blocksClicks": !window.ignoresMouseEvents])
        dismissal = Timer.scheduledTimer(withTimeInterval: 3, repeats: false) { [weak self] _ in
            self?.panel?.orderOut(nil)
            emit(["type": "feedback-hidden", "kind": kind])
        }
    }
}

enum CaptureState: String {
    case preparing, active, finalizing, reconnecting, paused, preview, stopped
}

final class VoiceMenuBar: NSObject, NSMenuDelegate {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private let summary = NSMenuItem(title: "", action: nil, keyEquivalent: "")
    private let microphone = NSMenuItem(title: "", action: nil, keyEquivalent: "")
    private let level = NSMenuItem(title: "입력 음량: 입력 대기", action: nil, keyEquivalent: "")
    private let transcript = NSMenuItem(title: "최근 인식: 아직 없음", action: nil, keyEquivalent: "")
    private let warpPermission = NSMenuItem(title: "", action: nil, keyEquivalent: "")
    private(set) var capture: CaptureState = .preparing
    private(set) var phase = "idle"
    var onQuit: (() -> Void)?

    override init() {
        super.init()
        let menu = NSMenu()
        menu.autoenablesItems = false
        menu.delegate = self
        for entry in [summary, microphone, level, transcript] { entry.isEnabled = false; menu.addItem(entry) }
        let mode = CommandLine.arguments.contains("--feedback-only") ? "알림 시연 · 마이크 사용 안 함"
            : CommandLine.arguments.contains("--dry-run") ? "연습 · Codex 실행 안 함"
            : CommandLine.arguments.contains("--warp-focus") ? "포커스된 Warp CLI에 입력"
            : CommandLine.arguments.contains("--target-session") ? "기존 Codex CLI 연결" : "새 Codex 작업 실행"
        let modeItem = NSMenuItem(title: "모드: \(mode)", action: nil, keyEquivalent: "")
        modeItem.isEnabled = false
        menu.addItem(modeItem)
        if CommandLine.arguments.contains("--warp-focus") {
            let target = NSMenuItem(title: "연결 대상: 시작어를 말할 때 포커스된 Warp 탭", action: nil, keyEquivalent: "")
            target.isEnabled = false
            warpPermission.isEnabled = false
            menu.addItem(target)
            menu.addItem(warpPermission)
            menuWillOpen(menu)
        }
        if let index = CommandLine.arguments.firstIndex(of: "--target-session"), index + 1 < CommandLine.arguments.count {
            let target = NSMenuItem(title: "연결 대상: \(CommandLine.arguments[index + 1])", action: nil, keyEquivalent: "")
            target.isEnabled = false
            menu.addItem(target)
        }
        menu.addItem(.separator())
        let hint = NSMenuItem(title: "헤이 티비디야 → 작업 내용 → 티비디야 시작해줘", action: nil, keyEquivalent: "")
        hint.isEnabled = false
        menu.addItem(hint)
        menu.addItem(.separator())
        let quitTitle = CommandLine.arguments.contains("--target-session") || CommandLine.arguments.contains("--warp-focus") ? "TBD 종료 (음성 입력 종료)" : "TBD 종료 (진행 중인 작업도 중단)"
        let quit = NSMenuItem(title: quitTitle, action: #selector(quitRequested), keyEquivalent: "")
        quit.target = self
        menu.addItem(quit)
        item.menu = menu
        refresh()
    }

    static func label(capture: CaptureState, phase: String) -> String {
        switch capture {
        case .preparing: return "TBD · 준비 중"
        case .preview: return "TBD · 시연"
        case .reconnecting: return "TBD · 재연결"
        case .finalizing: return "TBD · 인식 확인"
        case .stopped: return "TBD · 꺼짐"
        case .paused:
            if phase != "running" { return "TBD · 일시정지" }
            return CommandLine.arguments.contains("--target-session") || CommandLine.arguments.contains("--warp-focus") ? "TBD · 전달 중" : "TBD · 실행 중"
        case .active: return phase == "listening" ? "TBD · 명령 수집" : "TBD · 호출 대기"
        }
    }

    func setCapture(_ state: CaptureState) {
        guard capture != state else { return }
        capture = state
        refresh()
    }

    func menuWillOpen(_ menu: NSMenu) {
        warpPermission.title = AXIsProcessTrusted() ? "Warp 입력 권한: 허용됨" : "Warp 입력 권한: 손쉬운 사용 허용 필요"
    }

    func setPhase(_ state: String) {
        guard ["idle", "listening", "running"].contains(state), phase != state else { return }
        phase = state
        refresh()
    }

    func snapshot() -> [String: Any] {
        ["type": "status-changed", "title": Self.label(capture: capture, phase: phase),
         "capture": capture.rawValue, "phase": phase, "microphoneActive": capture == .active,
         "visible": item.isVisible, "microphoneText": microphone.title,
         "hasQuitAction": item.menu?.items.last?.action == #selector(quitRequested),
         "warpFocus": CommandLine.arguments.contains("--warp-focus"), "accessibility": AXIsProcessTrusted()]
    }

    func updateLevel(_ decibels: Double) {
        let bars = Int(max(0, min(10, (decibels + 60) / 6)))
        level.title = "입력 음량: \(String(repeating: "▮", count: bars))\(String(repeating: "▯", count: 10 - bars)) \(Int(decibels)) dB"
    }

    func updateTranscript(_ text: String) {
        transcript.title = "최근 인식: \(text.prefix(60))"
    }

    private func refresh() {
        let title = Self.label(capture: capture, phase: phase)
        summary.title = title
        microphone.title = capture == .active ? "마이크: 켜짐 · 음성 인식 중" : "마이크: 꺼짐"
        if capture != .active { level.title = "입력 음량: 입력 대기" }
        item.button?.title = " \(title)"
        let image = NSImage(systemSymbolName: capture == .active ? "mic.fill" : "mic.slash", accessibilityDescription: title)
        image?.isTemplate = true
        item.button?.image = image
        item.button?.imagePosition = .imageLeading
        item.button?.toolTip = "\(title)\n\(microphone.title)"
        item.button?.setAccessibilityLabel("\(title), \(microphone.title)")
        emit(snapshot())
    }

    @objc private func quitRequested() { onQuit?() }
}

final class SpeechInput {
    private let status = VoiceMenuBar()
    private let feedback = RecognitionFeedback()
    private let warp = WarpInput()
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ko-KR"))
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var silence: Timer?
    private var lifetime: Timer?
    private var finalTimeout: Timer?
    private var tapInstalled = false
    private var paused = false
    private var generation = 0
    private var finishing = false
    private var failures = 0
    private var latest = ""
    private let onDevice: Bool

    init(onDevice: Bool) {
        self.onDevice = onDevice
        status.onQuit = { [weak self] in self?.control("quit") }
        if CommandLine.arguments.contains("--feedback-only") { status.setCapture(.preview) }
    }

    func authorize() {
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                guard status == .authorized else {
                    self.fail("음성 인식 권한이 없습니다. 시스템 설정 → 개인정보 보호 및 보안 → 음성 인식에서 TBD Speech 또는 실행한 터미널을 허용하세요.")
                    return
                }
                if let index = CommandLine.arguments.firstIndex(of: "--recognize-file"), index + 1 < CommandLine.arguments.count {
                    self.recognizeFile(CommandLine.arguments[index + 1])
                    return
                }
                AVCaptureDevice.requestAccess(for: .audio) { allowed in
                    DispatchQueue.main.async {
                        guard allowed else {
                            self.fail("마이크 권한이 없습니다. 시스템 설정 → 개인정보 보호 및 보안 → 마이크에서 TBD Speech 또는 실행한 터미널을 허용하세요.")
                            return
                        }
                        self.start()
                    }
                }
            }
        }
    }

    private func recognizeFile(_ path: String) {
        guard let recognizer, recognizer.isAvailable else { fail("한국어 인식 서비스를 사용할 수 없습니다."); return }
        status.setCapture(.preview)
        let request = SFSpeechURLRecognitionRequest(url: URL(fileURLWithPath: path))
        request.shouldReportPartialResults = true
        request.contextualStrings = ["헤이 티비디야", "티비디야 시작해줘"]
        emit(["type": "probe-ready"])
        task = recognizer.recognitionTask(with: request) { result, error in
            DispatchQueue.main.async {
                if let result {
                    let text = result.bestTranscription.formattedString
                    self.status.updateTranscript(text)
                    emit(["type": result.isFinal ? "final" : "partial", "id": 1, "text": text])
                    if result.isFinal { self.finalTimeout?.invalidate(); return }
                }
                if let error { self.fail("파일 음성 인식 실패: \(error.localizedDescription)") }
            }
        }
        finalTimeout = Timer.scheduledTimer(withTimeInterval: 25, repeats: false) { _ in
            self.fail("파일 음성 인식이 25초 안에 완료되지 않았습니다.")
        }
    }

    private func fail(_ message: String) {
        emit(["type": "error", "message": message])
        stopSession()
        exit(1)
    }

    private func stopAudio() {
        engine.stop()
        if tapInstalled {
            engine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        if status.capture == .active { status.setCapture(.finalizing) }
    }

    private func stopSession() {
        generation += 1 // Ignore callbacks from a cancelled or superseded recognition task.
        silence?.invalidate()
        lifetime?.invalidate()
        finalTimeout?.invalidate()
        stopAudio()
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        finishing = false
        latest = ""
    }

    func control(_ line: String) {
        if line.hasPrefix("warp-submit:") {
            guard let data = String(line.dropFirst("warp-submit:".count)).data(using: .utf8),
                  let request = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let id = request["id"] as? Int, let text = request["text"] as? String else { return }
            guard CommandLine.arguments.contains("--warp-focus"), !CommandLine.arguments.contains("--dry-run") else {
                emit(["type": "warp-delivery", "id": id, "ok": false, "message": "Warp 입력 모드가 활성화되지 않았습니다."])
                return
            }
            warp.submit(text) { ok, message in
                self.feedback.show(ok ? "warp-sent" : "warp-blocked", detailOverride: message)
                emit(["type": "warp-delivery", "id": id, "ok": ok, "message": message, "target": "focused-warp"])
            }
            return
        }
        if line.hasPrefix("warp-cancel:") { warp.cancel(); return }
        if line.hasPrefix("state:") {
            status.setPhase(String(line.dropFirst("state:".count)))
            return
        }
        if line.hasPrefix("feedback:") {
            feedback.show(String(line.dropFirst("feedback:".count)))
            return
        }
        switch line {
        case "warp-status": emit(WarpInput.snapshot())
        case "pause": paused = true; stopSession(); status.setCapture(.paused)
        case "resume":
            guard paused else { return }
            paused = false
            if CommandLine.arguments.contains("--feedback-only") { status.setCapture(.preview) }
            else { start() }
        case "status": emit(status.snapshot())
        case "quit":
            warp.cancel()
            paused = true
            stopSession()
            status.setCapture(.stopped)
            emit(["type": "quit-requested"])
        case "stop": warp.cancel(); stopSession(); status.setCapture(.stopped); exit(0)
        default: break
        }
    }

    private func restart() {
        stopSession()
        let token = generation
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            if token == self.generation && !self.paused { self.start() }
        }
    }

    private func retry(_ error: Error) {
        failures += 1
        if failures >= 3 {
            fail("음성 인식 오류가 3회 반복되어 중단했습니다: \(error.localizedDescription). 마이크 연결·네트워크·음성 인식 권한을 확인하세요.")
            return
        }
        emit(["type": "warning", "message": "음성 인식 재연결 \(failures)/3: \(error.localizedDescription)"])
        restart()
        status.setCapture(.reconnecting)
    }

    private func finishAudio(token: Int) {
        guard token == generation && !paused && !finishing else { return }
        finishing = true
        silence?.invalidate()
        lifetime?.invalidate()
        stopAudio()
        request?.endAudio()
        // A partial hypothesis must never submit a command. Await Apple's final result.
        finalTimeout = Timer.scheduledTimer(withTimeInterval: 5, repeats: false) { _ in
            guard token == self.generation else { return }
            if self.latest.isEmpty { self.restart() }
            else {
                self.retry(NSError(domain: "TBD", code: 1, userInfo: [NSLocalizedDescriptionKey: "인식 확정 시간이 초과되었습니다. 마지막 문장을 다시 말하세요."]))
            }
        }
    }

    private func start() {
        guard !paused else { return }
        guard let recognizer, recognizer.isAvailable else {
            retry(NSError(domain: "TBD", code: 2, userInfo: [NSLocalizedDescriptionKey: "한국어 음성 인식을 사용할 수 없습니다."]))
            return
        }
        if onDevice && !recognizer.supportsOnDeviceRecognition {
            fail("이 Mac에서 한국어 기기 내 음성 인식을 사용할 수 없습니다. --on-device를 해제하거나 한국어 음성 인식 지원을 확인하세요.")
            return
        }
        generation += 1
        let token = generation
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.requiresOnDeviceRecognition = onDevice
        request.taskHint = .dictation
        request.contextualStrings = ["헤이 티비디야", "티비디야 시작해줘", "티비디야 진행해줘", "티비디야 작업 시작해줘", "티비디야 취소해줘", "헤이 TBD야", "TBD야 시작해줘", "코덱스"]
        self.request = request
        latest = ""
        let node = engine.inputNode
        let format = node.outputFormat(forBus: 0)
        guard format.sampleRate > 0 && format.channelCount > 0 else {
            fail("사용할 수 있는 마이크가 없습니다. 시스템 설정 → 사운드 → 입력을 확인하세요.")
            return
        }
        let deviceName = AVCaptureDevice.default(for: .audio)?.localizedName ?? "시스템 기본 마이크"
        var nextMeterTime: TimeInterval = 0
        node.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
            let now = ProcessInfo.processInfo.systemUptime
            guard now >= nextMeterTime, let channels = buffer.floatChannelData, buffer.frameLength > 0 else { return }
            nextMeterTime = now + 1
            var sum: Double = 0
            for index in 0..<Int(buffer.frameLength) {
                let value = Double(channels[0][index])
                sum += value * value
            }
            let decibels = max(-120, 10 * log10(max(1e-12, sum / Double(buffer.frameLength))))
            let frames = Int(buffer.frameLength)
            DispatchQueue.main.async {
                guard token == self.generation && !self.paused && !self.finishing else { return }
                self.status.updateLevel(decibels)
                if CommandLine.arguments.contains("--diagnostics") {
                    emit(["type": "audio-level", "decibels": decibels, "frames": frames, "device": deviceName])
                }
            }
        }
        tapInstalled = true
        task = recognizer.recognitionTask(with: request) { result, error in
            DispatchQueue.main.async {
                guard token == self.generation && !self.paused else { return }
                if let result {
                    let text = result.bestTranscription.formattedString
                    self.status.updateTranscript(text)
                    if result.isFinal {
                        if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            self.failures = 0
                            emit(["type": "final", "id": token, "text": text])
                        }
                        self.restart()
                        return
                    }
                    if text != self.latest {
                        self.latest = text
                        emit(["type": "partial", "id": token, "text": text])
                        self.silence?.invalidate()
                        self.silence = Timer.scheduledTimer(withTimeInterval: 1.2, repeats: false) { _ in self.finishAudio(token: token) }
                    }
                }
                if let error {
                    let detail = error as NSError
                    // Silence is expected in wake-word standby and is not an outage.
                    if detail.domain == "kAFAssistantErrorDomain" && detail.code == 1110 && self.latest.isEmpty { self.restart() }
                    else { self.retry(error) }
                }
            }
        }
        do {
            engine.prepare()
            try engine.start()
            status.setCapture(.active)
            emit(["type": "ready"])
            // Speech tasks are bounded; re-arm listening during long standby periods.
            lifetime = Timer.scheduledTimer(withTimeInterval: 50, repeats: false) { _ in self.finishAudio(token: token) }
        } catch { retry(error) }
    }
}

if CommandLine.arguments.contains("--check") {
    let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ko-KR"))
    emit([
        "type": "check", "locale": "ko-KR",
        "supported": recognizer != nil,
        "onDevice": recognizer?.supportsOnDeviceRecognition ?? false,
        "speechAuthorization": SFSpeechRecognizer.authorizationStatus().rawValue,
        "microphoneAuthorization": AVCaptureDevice.authorizationStatus(for: .audio).rawValue,
        "bundleIdentifier": Bundle.main.bundleIdentifier ?? "unknown",
        "accessibility": AXIsProcessTrusted()
    ])
    exit(0)
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let input = SpeechInput(onDevice: CommandLine.arguments.contains("--on-device"))
// A pipe from the CLI controls capture. EOF also releases the microphone if the CLI dies.
DispatchQueue.global(qos: .userInitiated).async {
    while let line = readLine() {
        DispatchQueue.main.async { input.control(line) }
    }
    DispatchQueue.main.async { input.control("stop") }
}
signal(SIGINT, SIG_IGN)
signal(SIGTERM, SIG_IGN)
let interrupt = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
let termination = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
interrupt.setEventHandler { input.control("stop") }
termination.setEventHandler { input.control("stop") }
interrupt.resume()
termination.resume()
if CommandLine.arguments.contains("--warp-focus"), !CommandLine.arguments.contains("--feedback-only"), !CommandLine.arguments.contains("--dry-run") {
    WarpInput.requestPermission()
}
if CommandLine.arguments.contains("--feedback-only") { emit(["type": "feedback-ready"]) }
else { input.authorize() }
app.run()
