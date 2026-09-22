# 32 — 놀이동산 효과음 (2026-09-22 사용자 추가 요청)

원본13종 합성 효과음: 벨·통통 타악음·대포·자석·스윙·리턴·도착·짧은 당첨 팡파르. 외부 음원이나 경기 RNG 사용 없음. 기본 음소거 유지. 최대40음원과 종류별 재생 간격 제한, 일시정지/재시작/탭 이탈/음소거 시 예약 음원과 잔향 취소. 확대 화면에도 소리 버튼 제공.

- PASS: 효과음13종 오프라인 렌더링(최대 절댓값0.250, 2.3초 후 잔향0), 노드 정리.
- PASS: 초기 resume 대기 중 빠른 켜기/끄기, PC·모바일 실제 도착→당첨→재플레이 및 음소거, 60개 이벤트 폭주 제한. 브라우저 오류0. 5개 검사군 통과.
- PASS: 60개 공·캐논 퍼레이드·3배속·소리·효과 켜짐·하프 모드8초 표본. PC59.9FPS/4.05ms, 모바일 Chrome60.0FPS/4.20ms. 실제 휴대폰 또는 GPU 전체 비용 아님.
- PASS: PC/모바일 확대 음소거·전체맵 전환·320px 화면 가로 넘침 없음.
- PASS: 웹 빌드22파일과 Mac/APK 내23파일(빌드 정보 포함) 일치, Mac로컬서명·APK v2/v3·ZIP CRC.
- 초기 실패: 전체/하프 모드에서 기존 소리 버튼이 숨겨짐. 별도 확대 화면 버튼으로 수정 후 통과. 초기 Mac iconutil Invalid Iconset은 같은 빌드를 정상 macOS 접근으로 실행해 해결. 실패 로그 보존.
- 미실행: 실제 스피커 청취 평가는 하지 않았음. 최신 Mac 네이티브 실행·Android 실기기/에뮬레이터 실행은 미실행. 기존 원더 가든 출구 보류는 이번 변경에서 건드리지 않음.

명령: `node tests/soundscape.mjs`, `node tests/audio-load.mjs`, `node scripts/build.mjs`; 브라우저는 기존 bundled PLAYWRIGHT_MODULE_PATH와 Chrome을 사용. 패키지는 desktop/build-macos.py, desktop/build-android.py의 기존 절차로 work/package-32-final에 생성. 상세 해시는32-final-package-results.json. 직접 구성한 소리 미리듣기는32-audio/park-cues.wav.
