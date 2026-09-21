# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: golden.spec.ts >> coffee truck desktop golden
- Location: tests/e2e/golden.spec.ts:40:34

# Error details

```
Error: page.evaluate: Execution context was destroyed, most likely because of a navigation
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - banner [ref=f1e4]:
    - generic [ref=f1e5]:
      - button "BREW RACERS 홈" [ref=f1e6] [cursor=pointer]:
        - generic [ref=f1e15]:
          - text: BREW
          - generic [ref=f1e16]:
            - text: RACERS
            - generic [ref=f1e17]: ®
      - navigation "메인 메뉴" [ref=f1e18]:
        - button "레이스 로비" [ref=f1e19] [cursor=pointer]
        - button "리플레이 00" [ref=f1e20] [cursor=pointer]:
          - text: 리플레이
          - generic [ref=f1e21]: "00"
        - button "플레이 가이드 ↗" [ref=f1e22] [cursor=pointer]
      - generic [ref=f1e23]:
        - generic [ref=f1e24]: LOCAL PLAY
        - button "사운드 끄기" [ref=f1e27] [cursor=pointer]
        - button "도움말" [ref=f1e32] [cursor=pointer]
  - main [ref=f1e36]:
    - generic [ref=f1e37]:
      - generic [ref=f1e38]:
        - generic [ref=f1e39]: A LITTLE RACE. A LOT AT STAKE.
        - heading "오늘 커피는, 누가 쏠까? ✳" [level=1] [ref=f1e41]:
          - text: 오늘 커피는, 누가 쏠까?
          - generic [ref=f1e42]: ✳
        - paragraph [ref=f1e43]: 목소리로 입장하고, 운명은 트랙에 맡기세요. 꼴찌가 쏘는 커피는 더 달콤하니까!
      - paragraph [ref=f1e46]:
        - text: 친구들과 가볍게.
        - strong [ref=f1e47]: 커피 내기는 짜릿하게.
    - generic [ref=f1e48]:
      - region "트랙 미리보기" [ref=f1e49]:
        - generic:
          - generic: LIVE TRACK PREVIEW
          - generic: 01 / 06
        - img "로스터리 서킷 3D 레이싱 트랙 · GS차지비, GS그룹, GS칼텍스, GS리테일, GS건설, GS에너지, GS EPS, GS글로벌 광고 배너" [ref=f1e51]
        - generic [ref=f1e52]:
          - generic [ref=f1e53]: 100%
          - generic [ref=f1e54]: AUTO RACING응원만 준비하세요.
        - generic:
          - generic:
            - generic: ROASTERY CIRCUIT
            - heading "로스터리 서킷 LV. 1" [level=2]:
              - text: 로스터리 서킷
              - generic: LV. 1
            - paragraph: 커피 향을 따라, 가볍게 한 바퀴.
          - generic:
            - generic: 2 LAPS
            - generic: 약 1분
      - complementary [ref=f1e58]:
        - generic [ref=f1e59]:
          - generic [ref=f1e60]: "01"
          - text: SELECT YOUR TRACK
        - heading "어디서 달려볼까요?" [level=2] [ref=f1e61]
        - paragraph [ref=f1e62]: 취향대로 고르는 6가지 작은 모험.
        - generic [ref=f1e63]:
          - button "로스터리 서킷 난이도 1" [pressed] [ref=f1e64] [cursor=pointer]:
            - strong [ref=f1e72]: 로스터리 서킷
            - generic [ref=f1e73]: LV.1
          - button "선셋 비치 난이도 2" [ref=f1e81] [cursor=pointer]:
            - strong [ref=f1e90]: 선셋 비치
            - generic [ref=f1e91]: LV.2
          - button "말차 포레스트 난이도 3" [ref=f1e99] [cursor=pointer]:
            - strong [ref=f1e107]: 말차 포레스트
            - generic [ref=f1e108]: LV.3
          - button "미드나잇 시티 난이도 4" [ref=f1e116] [cursor=pointer]:
            - strong [ref=f1e125]: 미드나잇 시티
            - generic [ref=f1e126]: LV.4
          - button "슈가 마운틴 난이도 5" [ref=f1e134] [cursor=pointer]:
            - strong [ref=f1e141]: 슈가 마운틴
            - generic [ref=f1e142]: LV.5
          - button "에스프레소 볼케이노 난이도 6" [ref=f1e150] [cursor=pointer]:
            - strong [ref=f1e157]: 에스프레소 볼케이노
            - generic [ref=f1e158]: LV.6
        - generic [ref=f1e170]:
          - strong [ref=f1e171]: 발은 쉬고, 심장은 바쁘게.
          - paragraph [ref=f1e172]: 주행도 아이템도 알아서. 100% 자동 레이스.
    - generic [ref=f1e173]:
      - generic [ref=f1e174]:
        - generic [ref=f1e175]:
          - generic [ref=f1e176]:
            - generic [ref=f1e177]: "02"
            - text: MEET THE RACERS
          - heading "함께 달릴 멤버 4/ 8" [level=2] [ref=f1e178]:
            - text: 함께 달릴 멤버
            - generic [ref=f1e179]: 4/ 8
        - generic [ref=f1e180]:
          - button "체험 멤버 비우기" [ref=f1e181] [cursor=pointer]
          - button "음료 말하기" [ref=f1e182] [cursor=pointer]
          - button "레이서 추가" [disabled] [ref=f1e186]
      - generic [ref=f1e188]:
        - button "김커피 프로필 수정" [ref=f1e189] [cursor=pointer]:
          - generic [ref=f1e190]: "01"
          - generic [ref=f1e191]: READY
          - generic [ref=f1e193]:
            - img "마리오 3D 얼굴 아바타" [ref=f1e195]
            - generic [ref=f1e196]:
              - heading "김커피" [level=3] [ref=f1e197]
              - generic [ref=f1e200]: 마리오
              - generic [ref=f1e201]: 공유 무드
              - paragraph [ref=f1e203]: 아이스 아메리카노
          - generic [ref=f1e206]:
            - generic [ref=f1e207]: TANGERINE KART
            - generic [ref=f1e209]: 체험 레이서
        - button "라떼러버 프로필 수정" [ref=f1e210] [cursor=pointer]:
          - generic [ref=f1e211]: "02"
          - generic [ref=f1e212]: READY
          - generic [ref=f1e214]:
            - img "키노피오 3D 얼굴 아바타" [ref=f1e216]
            - generic [ref=f1e217]:
              - heading "라떼러버" [level=3] [ref=f1e218]
              - generic [ref=f1e221]: 키노피오
              - generic [ref=f1e222]: 아이유 무드
              - paragraph [ref=f1e224]: 카페 라떼
          - generic [ref=f1e227]:
            - generic [ref=f1e228]: LAVENDER KART
            - generic [ref=f1e230]: 체험 레이서
        - button "샷추가 프로필 수정" [ref=f1e231] [cursor=pointer]:
          - generic [ref=f1e232]: "03"
          - generic [ref=f1e233]: READY
          - generic [ref=f1e235]:
            - img "피치 3D 얼굴 아바타" [ref=f1e237]
            - generic [ref=f1e238]:
              - heading "샷추가" [level=3] [ref=f1e239]
              - generic [ref=f1e242]: 피치
              - generic [ref=f1e243]: 박서준 무드
              - paragraph [ref=f1e245]: 콜드브루
          - generic [ref=f1e248]:
            - generic [ref=f1e249]: MATCHA KART
            - generic [ref=f1e251]: 체험 레이서
        - button "말차사랑 프로필 수정" [ref=f1e252] [cursor=pointer]:
          - generic [ref=f1e253]: "04"
          - generic [ref=f1e254]: READY
          - generic [ref=f1e256]:
            - img "동키콩 3D 얼굴 아바타" [ref=f1e258]
            - generic [ref=f1e259]:
              - heading "말차사랑" [level=3] [ref=f1e260]
              - generic [ref=f1e263]: 동키콩
              - generic [ref=f1e264]: 박보영 무드
              - paragraph [ref=f1e266]: 말차 라떼
          - generic [ref=f1e269]:
            - generic [ref=f1e270]: BUTTER KART
            - generic [ref=f1e272]: 체험 레이서
      - generic [ref=f1e273]:
        - generic [ref=f1e277]: 목소리와 프로필은 이 기기에 저장돼요.
        - generic [ref=f1e278]: ·
        - generic [ref=f1e279]: 아바타를 누르면 프로필과 음료를 바꿀 수 있어요.
    - generic [ref=f1e280]:
      - generic [ref=f1e286]:
        - strong [ref=f1e287]: 마지막으로 들어오는 사람이, 오늘의 커피 히어로.
        - paragraph [ref=f1e288]:
          - generic [ref=f1e289]: 2바퀴 자동 주행
          - generic [ref=f1e291]: 랜덤 아이템
          - generic [ref=f1e293]: 꼴찌가 커피 쏘기
      - generic [ref=f1e294]:
        - generic [ref=f1e295]:
          - generic [ref=f1e296]: 4명
          - text: 모두 준비 완료!
        - button "레이스 시작" [disabled] [ref=f1e297]
    - generic [ref=f1e300]: 아이템 한 방이면 순위는 뒤집힌다. 오늘의 행운을 믿어보세요.
  - contentinfo [ref=f1e303]:
    - generic [ref=f1e304]:
      - text: BREW RACERS
      - generic [ref=f1e307]: 작은 내기, 큰 즐거움.
    - generic [ref=f1e308]:
      - text: MADE FOR YOUR COFFEE BREAK
      - generic [ref=f1e309]: ✳
      - button "플레이 가이드" [ref=f1e310] [cursor=pointer]
      - link "검증 리포트 ↗" [ref=f1e311] [cursor=pointer]:
        - /url: /reports/index.html
      - generic [ref=f1e312]: © 2026 BREW RACERS
```

# Test source

```ts
  1  | import { expect, type Page } from '@playwright/test';
  2  | import { demoDrivers } from '../../src/core/catalog';
  3  | import { simulateRace } from '../../src/core/race';
  4  | import { raceMoment } from '../../src/core/presentation';
  5  | import type { Item, RaceLog } from '../../src/core/types';
  6  | export const actionLog=simulateRace(demoDrivers(),'roastery',1234,'2026-09-20T00:00:00Z');
  7  | export function actionTime(phase:'launch'|'hit'|'blocked'|'boost',item?:Item,log=actionLog){
  8  |   for(let t=1;t<log.duration;t+=.1){const time=Number(t.toFixed(1)),moment=raceMoment(log,time);if(moment.phase===phase&&moment.age>=.099&&moment.age<(phase==='boost'?2.3:.3)&&(!item||moment.event?.item===item))return time;}
  9  |   throw new Error(`No ${phase}/${item} event in fixture`);
  10 | }
  11 | export async function loadReplay(page:Page,log:RaceLog=actionLog){
> 12 |   await page.goto('/');await expect(page.locator('.race-canvas')).toHaveAttribute('data-ready','true');await page.evaluate(()=>document.fonts.ready);
     |                                                                                                                   ^ Error: page.evaluate: Execution context was destroyed, most likely because of a navigation
  13 |   await page.getByRole('button',{name:/^리플레이/}).click();
  14 |   await page.locator('input[type=file]').setInputFiles({name:'action.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(log))});
  15 |   await expect(page.getByText('RACE REPLAY',{exact:true})).toBeVisible();await page.getByRole('button',{name:'일시 정지',exact:true}).click();
  16 | }
  17 | export async function seek(page:Page,time:number){
  18 |   await page.getByRole('slider',{name:'리플레이 타임라인'}).fill(String(Number(time.toFixed(1))));
  19 |   await expect(page.locator('.race-canvas')).toHaveAttribute('data-time',time.toFixed(1));
  20 | }
  21 | 
  22 | export async function finishReplay(page:Page,log:RaceLog=actionLog){
  23 |   await loadReplay(page,log);await seek(page,Number((log.duration-.1).toFixed(1)));
  24 |   await page.getByRole('button',{name:'재생',exact:true}).click();
  25 |   await expect(page.locator('.podium-canvas')).toHaveAttribute('data-ready','true');
  26 | }
  27 | 
```