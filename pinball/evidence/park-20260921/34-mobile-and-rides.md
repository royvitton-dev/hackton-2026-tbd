# 34 — Android 안전 영역, 폴더블 화면, 하단 놀이기구 (2026-09-22)

## 변경
- 사용자 Android 화면 사진에서 상단 시스템 시간과 메뉴, 하단 시스템 버튼과 게임 조작이 겹치는 문제 확인. 원본 사진은 Git/결과물에 복사하지 않음.
- WebView 자체 padding을 제거하고 부모 FrameLayout이 시스템 바·화면 잘림·키보드 영역을 제외. 처리한 insets를 0으로 전달해 WebView의 중복 여백을 방지. API30이상 typed insets, 26~29 호환 분기. Android APK v1.1 / versionCode2.
- density 변경도 Activity 재생성 없이 처리. 접기/펼치기·회전 시 기존 WebView의 크기만 재계산. viewport meta와 WebView wide viewport 사용. WebGL은 화면 밀도 변경을 반영하되1.5DPR상한 유지.
- 세로로 긴 화면에서 실제 카메라가 보는 바닥 범위를 계산하여 출발부 위의 빈 공간 축소. ‘도착 이야기’ 옆 ‘처음부터’는 경기/결과를 초기화하고 기존 참가자/규칙을 유지한 채 출발 버튼으로 이동.
- 캔디 행성: 하단 대포 양쪽 범퍼를 (220,1765)/(400,1765),r43에서 (185,1790)/(435,1790),r36으로 이동·축소. 대포 깔때기와 범퍼 사이에 공 지름2개 이상의 물리 공간 확보.
- 구름 코스터: 하단 (150,1840)/(485,1930)에 대포2개 추가, 총4개. 서로 어긋나게 배치하고 기존과 동일한0.5~1초 독립 포획/방출,0.4초 회전 주기 적용. 자석2개 유지.
- 원더 가든: 사용자 추가 요청으로 BACK 앞 꽃잎 회전판만 omega -0.93으로 변경(위에서 봤을 때 반시계 방향). 기존 출구 구조와3회 실패한 정체 개선은 보류 유지.

## 실제 통과
- 캔디/구름2맵 × 공5/20/60개 × 시드1/7/19/43 =24경기 모두 완주. 경계 이탈 없음, 실제 GOAL통과 순위와 마지막 도착 당첨 일치, 중복 집계 없음. 추가 대포2개 모두 자연 경기에서 발사됨.
- 각 변경 맵에서 동일 시드 전체 완주와 첫째/N번째/마지막남은공 당첨6경기의 도착 목록 prefix/당첨 공 일치.
- 깔때기 통로 기하 검사2개, 기존 장치 검사5개, BACK 회전 방향1개, 당첨 prefix1개와24경기 테스트1개: 총10개 Node test 통과(명령별 로그 참조).
- 5개 CSS크기 × 따라가기/하프/전체15검사 + 도착 이야기 초기화1검사 =16. 픽셀 밀도1.25/2/2.625/3 전환, 같은 일시정지 경기의 ID/공/순위 유지, 가로 넘침 없음, 실제 버튼 클릭 확인.
- 9개 PC/모바일 크기의 하프·전체18흐름 + 플레이어/로또 실제 결과·재시작2흐름 =20검사.
- APK에서 추출한 파일로 모바일Chrome 플레이어/로또2흐름, 외부 요청/페이지오류0. APK의 실제 native WebView 실행과 다름.
- 웹 빌드22파일과메타1파일, Android/Mac내장23파일 일치, APK v2/v3, Mac로컬서명, ZIP CRC/실행권한 확인. 세부 해시34-package-results.json.
- 구름 코스터60개·3배속·하프·소리/효과켜짐8초 표본: desktop 60.0FPS / JS 3.89ms, mobile 60.0FPS / JS 4.02ms. 실제 휴대폰/GPU전체측정 아님.

## 실패와 미실행
- 밀도 검사1·2차: Playwright screenshot이CDP밀도를1로복원하고 다른CDP세션의 동일 override가효과없어 기대DPR불일치. 실제window.devicePixelRatio와renderer값이같음을진단해제품문제와구분. 최종검사는override를명시적으로clear하고CDP직접촬영으로16/16통과. 초기실패JSON/로그보존.
- APK자산검사1차: 이전스크립트가확대화면을닫지않은채숨겨진로또탭을누르려해타임아웃. 실제‘원래화면’클릭을추가한후2흐름통과. 초기실패로그보존.
- 미실행: Android실기기/에뮬레이터, GalaxyFold7실제접기/펼치기,상태표시줄/3버튼/제스처바/키보드의native실행. SDK설치/약관동의는없었음. 최신Mac런처실행과Safari/iOS도미실행.
- 원더가든의기존장시간정체를해결했다고주장하지않음. 이번방향변경은그재시도가아님.
- Fork푸시시도는Mac잠금때문에접근불가. 잠금해제요청후코드/앱준비진행. Git최종상태는별도전달기록참조.

## 명령
기존 bundled Node24, PLAYWRIGHT_MODULE_PATH와 별도 Chrome을 사용.
```
node --test tests/course-clearance.test.mjs tests/devices.test.mjs
node --test --test-name-pattern='Garden BACK' tests/course-clearance.test.mjs
node --test --test-name-pattern='arrival prefix' tests/course-clearance.test.mjs
node tests/fold-layout.mjs
LAYOUT_EVIDENCE=evidence/park-20260921/34-layout node tests/responsive-layout.mjs
PERFORMANCE_MAP=zigzag AUDIO_EVIDENCE=evidence/park-20260921/34-cloud-performance node tests/audio-load.mjs
node scripts/build.mjs
APK_ASSETS=<work/package-34/android-assets> EVIDENCE_PREFIX=evidence/park-20260921/34-apk-assets node tests/android-assets.mjs
python3 desktop/build-macos.py --node <bundled-node> --node-license <bundled-LICENSE> --out <work/package-34/DROP-LAND-macOS-arm64>
python3 desktop/build-android.py --tools <work/packaging-tools> --keystore <private-existing-key> --out <work/package-34/DROP-LAND-Android.apk>
```
첫 Node명령실행뒤사용자BACK방향요청이도착하여해당검사와prefix검사는후속명령으로수행함. 동일한성공검사를시간채우기로반복하지않음.

## 실기기에서 확인할 항목 (아직 미실행)
1. 기존앱위에v1.1APK설치(삭제불필요). 웹새로고침만으로native영역수정은반영되지않음.
2. 접힌화면에서상단로고/소리와하단조작이시스템UI에겹치지않는지확인.
3. 일시정지후펼침/접음/회전:설정,공위치,순위유지와시작/재개버튼확인. OS가앱프로세스를회수한경우경기복원기능은없음.
4. 참가자키보드열기/닫기,3버튼및제스처내비게이션,펼친화면의따라가기/하프/전체를확인.

근거: [Android WebView insets](https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets), [Android 게임 화면 크기 변경](https://developer.android.com/games/develop/multiplatform/support-large-screen-resizability). 네이티브구조변경은이공식안내에맞춘구현이며실기기성공증빙을대체하지않음.
