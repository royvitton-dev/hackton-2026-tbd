# 25 — macOS 앱과 Android APK

2026-09-21 22:26 KST. 사용자가 간단한 실행 파일과 Android용을 추가 요청했다. 기존 게임 소스를 바꾸지 않고 플랫폼 실행기를 만들었다.

| 검사 | 결과 |
|---|---|
| macOS 앱 빌드·로컬 서명 | PASS. 포함 Node와 게임으로 별도 설치 없이 실행 |
| 실제 macOS 앱 시작·브라우저 자동 열기 | PASS. CUA로 앱을 직접 열어 실행 중 상태 확인 |
| 실제 앱 서버·21개 실행파일 해시 | PASS. 앱 전용 빈 포트에서 게임 로드 |
| Mac 수량/N번째·정지·결과·재시작 | PASS. 실제 앱의 서버에서 Chrome 검사 |
| 앱 종료 | PASS. 앱에 Cmd+Q 후 전용 포트 연결 거부 |
| Mac ZIP | CRC·실행 권한·Node 라이선스 포함 PASS |
| Android APK | Java/DEX/리소스 빌드·v2/v3 서명 PASS |
| APK 내 게임 | 빌드 원본과 모든 파일 바이트 일치 PASS |
| APK 추출 게임 모바일 Chrome | 플레이어·로또·정지·결과·재시작 2/2 PASS |
| 실제 Android 설치·WebView·네이티브 수명주기 | **미실행** |
| Apple 공증·Intel Mac·스토어 게시 | **미실행** |

Mac은 arm64/macOS 13.5 이상을 대상으로 한다. 공식 서명이 있는 기존 Node 바이너리와 전체 라이선스를 그대로 포함했다. Cocoa 런처는 127.0.0.1의 빈 포트를 사용하므로 기존 4188과 충돌하지 않는다. 앱 종료 시 전용 서버를 함께 종료한다.

Android는 minSdk26/target35다. 앱 자산을 HTTPS 로컬 콘텐츠 경로로 읽고 외부 요청과 탐색을 차단한다. 인터넷·저장소 권한이나 네이티브 JavaScript 브리지를 추가하지 않았다. 앱 백그라운드 시 일시정지하고 확대 화면 뒤로가기/종료 확인을 구현했지만, 네이티브 동작은 아직 실제 Android에서 확인하지 않았다. Chrome 검사를 Android 실행 통과로 취급하지 않는다.

공식 공개 Maven 도구와 Adoptium JDK를 작업 폴더에만 준비했다. 시스템 Java/Android Studio 설치나 SDK 약관 자동 동의를 하지 않았다. 개인 서명 키는 작업용 비공개 폴더에 보존하고 Git/전달 파일에 포함하지 않는다.

Mac 최초 Swift 모듈 캐시/SDK 오류 후 Cocoa 아이콘 생성으로 변경했다. iconutil은 샌드박스 안에서 실패했으나, 허용된 네이티브 아이콘 서비스를 사용한 25c 빌드는 정상 서명까지 통과했다. 처음 D8의 Object 라이브러리 경고는 JDK 라이브러리 경로를 추가해 해결했다. 실패 로그도 남겼다.

산출물은 `DROP-LAND-macOS-arm64.zip`, `DROP-LAND-Android.apk`와 각 실행 안내다. 원더 가든의 알려진 정체 한계는 두 패키지에도 동일하게 남아 있으며 안내에 명시했다.

[통합 결과·체크섬](25-package-results.json), [Mac 실제 실행](25-macos-browser-results.json), [Mac 종료](25-macos-quit.json), [APK 추출 파일 실행](25-android-assets-results.json), [Mac 빌드](25c-macos-build.log), [Android 빌드](25c-android-build.log), [재빌드 방법](../../desktop/README.md).

실행한 명령:

```sh
python3 desktop/build-macos.py --node /path/to/node --node-license /path/to/LICENSE --out /path/to/output
python3 desktop/build-android.py --tools /path/to/packaging-tools --keystore /private/path/dropland-local.p12 --out /path/to/DROP-LAND-Android.apk
BASE_URL=http://127.0.0.1:58993 node tests/launcher-browser.mjs
APK_ASSETS=/path/to/extracted-apk-assets node tests/android-assets.mjs
ditto -c -k --sequesterRsrc --keepParent /path/to/DROP-LAND-macOS-arm64 /path/to/DROP-LAND-macOS-arm64.zip
```

실제 절대 경로는 빌드 로그에 있으며, 서명 키 자체는 기록하지 않았다. 브라우저 검사는 이전과 같은 Playwright 모듈 경로를 사용했다.
