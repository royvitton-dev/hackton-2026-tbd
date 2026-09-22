# 37 · 자석0.5~2초

모든5맵의자석2개씩에 holdMin0.5/holdMax2를설정. 포획시공마다독립난수·releaseAt을기존방식으로기록. 기존대포0.5~1초,캐논퍼레이드0.8~1.5초,회전0.4초는보존. 시간은고정120Hz시뮬레이션기준이며배속을높이면실제화면대기는짧아진다.

- `node --test tests/devices.test.mjs`:6검사PASS.실제포획/고정위치/일시정지/방출/재포획쿨다운,5개동시독립타이머,40시드자석시간다양성(1.8초초과포함),5맵장치설정,대포속도/회전보존.
- `node --test --test-name-pattern='1x and 3x|same-substep' tests/finish-rules.test.mjs`:2검사PASS.동시도착정렬/조기종료와1x·3x동일경기순위비교.
- `node scripts/build.mjs`:런타임26파일및문법검사PASS.
- 원더가든의보류된출구구조시험은실행하지않음.
- Android1.3(code4)/Mac패키지·APK추출브라우저검증은37-package-results.json/37-apk-results.json에별도기록. Android실기기실행은미실행.
