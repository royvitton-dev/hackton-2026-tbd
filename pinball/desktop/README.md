# DROP LAND 실행 파일

현재 Mac용 `.app`과 Android용 `.apk`에 빌드된 게임을 그대로 내장한다. 웹 소스는 `dist/`에서 복사하며 패키지마다 해시를 확인한다. 출력 바이너리와 개인 서명 키는 Git에 넣지 않는다.

## macOS

Apple Silicon / macOS13.5이상. Cocoa 런처가 포함된Node로127.0.0.1의빈포트를열고기본브라우저를연다. 서버는앱종료시함께종료하며원래4188미리보기와충돌하지않는다. Node는이머신에있던공식서명바이너리를그대로복사하고전체라이선스를함께포함했다. 새외부실행파일을다운로드하지않았다. Apple공증은없다.

```sh
node scripts/build.mjs
python3 desktop/build-macos.py --node /path/to/node --node-license /path/to/LICENSE --out /path/to/output
```

macOSCommandLineTools의clang/iconutil이필요하다. 아이콘은Cocoa로직접그려생성한다. 빌드산출물은`.app`을폴더째배포한다.

## Android

Java의WebView가APK내부게임을HTTPS의로컬콘텐츠경로로읽는다. 네트워크요청은차단하며인터넷권한도없다. 외부페이지를열거나JavaScript네이티브브리지를노출하지않는다. minSdk26,targetSdk35. AndroidView수명주기에맞춰일시정지하고확대화면뒤로가기및종료확인을제공한다. 실제기기동작은아직미검증이다.

Gradle/AndroidStudio설치없이공개Maven도구로빌드했다. 공식AAPT2/R8/apksig,AdoptiumJDK21,Apache라이선스Robolectric의Android15API/resources를컴파일참조로사용한다. 도구나Android참조jar를APK에포함하지않는다. 버전과SHA256은`toolchain-manifest.json`에있다.

```sh
python3 desktop/build-android.py --tools /path/to/packaging-tools --keystore /private/path/dropland-local.p12 --out /path/to/DROP-LAND-Android.apk
```

도구폴더는`aapt2/aapt2`, `android-all.jar`, `r8.jar`, `apksig.jar`, `jdk/<version>/Contents/Home/bin/java`를포함한다. 입력키가없으면로컬개발인증서를생성한다. 동일기기에업데이트하려면키를보존해야한다. 개인키는이저장소/결과물에포함하지않는다.

소스검토중확대화면에서뒤로가기확인창뒤로경기가계속될수있는분기를수정했다. 실제WebView호출순서/Android설치테스트는미실행이며Chrome패키지자산검사와구분한다.

## 검증

[실행파일검증기록](../evidence/park-20260921/25-package-results.json)과각빌드로그에통과/실패/미실행을기록한다. Mac실행과종료는실제네이티브앱에서확인했다. Android는빌드·서명·정적구성과패키지파일의모바일Chrome실행검사만수행했다.

참고한공식자료: [Android로컬콘텐츠](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content), [AAPT2 Maven배포](https://developer.android.com/tools/aapt2), [D8/R8](https://r8.googlesource.com/r8), [Robolectric android-all](https://central.sonatype.com/artifact/org.robolectric/android-all), [Adoptium다운로드검증](https://adoptium.net/installation/ci-scripts).


후속 결과 화면 수정이 포함된 최신 패키지는 [28 검증](../evidence/park-20260921/28-package-results.json)에 기록했다. Mac 빌드·서명·내장 파일 일치는 재확인했으나 Mac 잠금으로 최신 번들의 네이티브 창 재실행은 미실행이다. 네이티브 런처 소스는25실행검사와 같다. 최신 APK 추출 파일은 모바일 Chrome의 플레이어·로또2흐름을 다시 통과했으며 Android 실기기 실행은 여전히 미검증이다.


현재 그래픽 복구 수정이 포함된 패키지는 [29 검증](../evidence/park-20260921/29-package-results.json)을 따른다. Mac/APK 모두 Chrome에서 검증한 최신dist22파일(메타포함)과 바이트가 일치한다. 이번판 APK 추출파일을 별도 브라우저에서 다시 실행하지는 않았으며, 이전28추출검사와 구분한다. 실제Android와 최신Mac네이티브창 재실행은 미실행이다.
