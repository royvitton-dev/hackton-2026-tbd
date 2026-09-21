# 프로젝트를 어트랙션으로 연결하기

최상위 프로젝트 폴더에 `package.json`, `README.md`, `attraction.json` 중 하나가 있으면 발견합니다. `webpage`, `park`, `node_modules`, 숨김 폴더와 빌드·보고서용 폴더는 제외합니다. 하위 프로젝트의 코드나 Git 상태를 변경하지 않습니다.

테마와 캐릭터를 지정하려면 해당 프로젝트에 다음 파일을 추가합니다.

```json
{
  "name": "은하수 어드벤처",
  "english": "GALAXY ADVENTURE",
  "description": "작은 로켓을 타고 새로운 아이디어를 찾아 떠납니다.",
  "theme": "space",
  "status": "open",
  "action": "우주 여행 입장",
  "character": "olaf",
  "color": "#779bab",
  "model": "assets/attraction.glb",
  "url": "http://localhost:5188/"
}
```

`model`과 `url`은 선택입니다. 모델은 해당 프로젝트 안의 상대 `.glb` 경로이며 외부·상위 경로는 허용하지 않습니다. 모델을 지정하면 테마 기본 건물에 실제 glTF 모델을 추가합니다. `url`은 http/https 주소만 허용합니다. URL이 없고 Vite 프로젝트이면 입장 버튼으로 별도 개발 서버를 실행할 수 있습니다.

| theme | 모델 |
| --- | --- |
| `bumper` | 움직이는 범퍼카와 줄무늬 파빌리온 |
| `theater` | 아르데코 영화관과 마키 조명 |
| `music` | 원형 음악당, 마이크와 스피커 |
| `space` | 로켓 발사대와 궤도 장식 |
| `ocean` | 수족관 돔과 움직이는 물고기 |
| `garden` | 꽃 정원 |
| `laboratory` | 돔 연구소와 원자 조형물 |
| `arcade`, `fantasy` | 회전목마 |
| `construction` | 골조·타워크레인·안전 펜스가 있는 공사장 |
| `pinball` | 움직이는 공과 플리퍼를 가진 대형 핀볼 머신 |

캐릭터: `mickey`, `minnie`, `donald`, `olaf`, `daisy`, `goofy`, `pluto`, `pooh`, `stitch`, `baymax`.

각 어트랙션은 작은 별의 곡면 위에 배치되며, 바닥도 곡률에 맞게 변형됩니다. 새 프로젝트를 추가해도 좌표를 수동으로 지정할 필요는 없습니다. 중앙 광장에는 GS 로고와 10종의 캐릭터가 있고, 위쪽 언덕의 성에서는 불꽃놀이가 계속 반복됩니다.

상태: `open`, `construction`, `attention`. `action`으로 입장 버튼 문구를 지정할 수 있습니다. Vite가 없는 정적 HTML 프로젝트도 프로젝트별 독립 경로로 입장할 수 있습니다.

명시적 테마가 없으면 폴더 이름, README, 패키지 설명의 주제어를 확인합니다. 분류되지 않은 새 주제는 기본 환상 테마를 사용합니다. 새로운 고유 모델이 필요하면 홈페이지 에이전트가 `park/src/attractions.js`에 테마 모델을 추가할 수 있습니다. 기존 프로젝트는 코드를 변경할 필요가 없습니다.
