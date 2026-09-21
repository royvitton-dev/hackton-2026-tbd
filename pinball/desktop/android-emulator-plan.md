# Android APK 실행 검증 준비

현재 APK는 완성되어 있고 빌드·서명·웹 게임 검증을 통과했다. Android 자체의 설치·WebView·뒤로가기·백그라운드 복귀는 아직 미검증이다. 이 문서는 추가 검증 환경의 설치 제안이며 설치 완료 기록이 아니다.

이 Mac은 Apple Silicon / RAM16GiB / macOS26.5.1이며 조사 시 디스크 여유 약425GB였다. Android Studio·SDK·adb·emulator는 설치되어 있지 않았다.

Google 공식 저장소에서 확인한 구성은 다음과 같다. Android15(API35) AOSP arm64 가상 기기 하나를 새로 만들 계획이다.

| 구성 | 버전 | 다운로드 |
|---|---|---:|
| cmdline-tools;23.0 | 23.0 | 155.4 MB |
| platform-tools | 37.0.1 | 16.1 MB |
| emulator | 37.1.11 | 394.6 MB |
| system-images;android-35;default;arm64-v8a | 2 | 769.1 MB |

총 다운로드는 1,335,150,203bytes(약1.34GB)다. 압축 해제와 새 가상 기기 데이터용으로 약8GB를 우선 확보할 계획이며, 이는 사용량 실측이 아닌 준비 추정치다. 설치 위치는 이 작업의 work/android-test-sdk 안으로 한정한다. 기존 Android 기기나 개인 데이터를 사용하지 않는다. Google 계정 로그인·Play Store 공개 배포·유료 서비스는 필요하지 않다.

[Google Android SDK 약관](https://developer.android.com/studio/terms)2.1은 사용 전에 약관 동의를 요구한다. 현재 이 약관을 대신 동의하거나 SDK를 설치하지 않았다. 사용자의 동의와 설치 승인을 받은 뒤 진행한다. SDK 사용 통계 전송에는 동의하지 않을 계획이다.

설치 후에는 현재 APK를 새 가상 기기에 설치하고, 실행/5명 기본명단/플레이어·로또/골인/다시 플레이/뒤로가기/홈으로 나갔다 복귀/화면 회전을 검사한다. 실제 Android WebView의 화면·오류 로그·결과를 남기고, Chrome 모바일 에뮬레이션 결과와 구분한다. 에뮬레이터 측정치를 실제 휴대전화 성능으로 주장하지 않는다.

공식 자료: [에뮬레이터 실행과 APK 설치](https://developer.android.com/studio/run/emulator-commandline), [Apple Silicon 가속](https://developer.android.com/studio/run/emulator-acceleration). 선택한 다운로드 URL·크기·공식 체크섬은 [준비 자료](../evidence/park-20260921/30-android-emulator-plan.json)에 있다.
