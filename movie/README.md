# Wonder Park — A Park Is Born

현재 `park/`의 3D 테마파크 제작 과정을 담은 30초 창작 영상. 디즈니 성 오프닝의 별빛 궤적·성·불꽃 연출을 응용했다. 기존 VITALIS 영상의 장면, 음악, 인터뷰, 이미지는 새 영상에 사용하지 않는다.

- 최종 MP4: [`output/wonder-park-30s.mp4`](output/wonder-park-30s.mp4)
- 규격: 1920×1080 · 30fps · 900프레임 · H.264 / AAC 스테레오 · 30초
- 미리보기: `npm run dev` → <http://localhost:5180>
- [장면별 콘티·촬영 안내·출처](STORYBOARD.md)
- 포스터: `output/wonder/poster.png`
- 한국어 선택 자막: `output/wonder/captions.vtt`
- 검증 결과: `output/wonder/render-check.json`, `output/wonder/playback-check.json`, `output/wonder/media-check.json`

## 매시간 자동 제작

macOS LaunchAgent `com.tbd.wonderpark.movie.hourly`가 **매시간 정각(맥의 현지 시간, 현재 Asia/Seoul)**에 실행한다. 이 대화나 터미널을 열어 둘 필요는 없다. 사용자가 로그인한 Mac에서 동작하며, 잠자기 중 놓친 예약은 깨어난 뒤 한 번 실행된다. 전원이 꺼진 동안은 실행되지 않는다. [Apple 예약 작업 문서](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html).

실행 순서:

1. 현재 `park/src/`의 모델 소스, `park/assets/`의 이미지와 커밋 번호를 복사하고 모델 모듈을 번들링한다. 아직 커밋하지 않은 최신 모델 수정도 영상에 반영한다.
2. 실제 파크 전경·어트랙션·야간 화면을 새로 촬영한다. 파크 서버가 꺼져 있으면 이번 제작에 필요한 임시 로컬 서버를 실행한다.
3. 별도 작업 폴더에서 30초 영상과 음악을 생성하고 전체 디코딩·재생·자막을 검사한다.
4. 검증을 통과한 영상만 미리보기와 극장 경로에 교체한다. 실패한 결과로 기존 정상 영상을 덮어쓰지 않는다.
5. 생성된 영상·캡처·모델 스냅샷·검증 결과만 자동 커밋한다. 다른 프로젝트나 편집 중인 영상 소스의 변경분은 커밋하지 않는다. 원격 푸시는 수행하지 않는다.

```sh
npm run auto:status  # 예약 등록 상태, 현재 단계, 최근 성공, 커밋 확인
npm run auto:once    # 즉시 한 번 전체 제작·검증·교체·커밋
npm run auto:run     # 설치된 예약 작업에 즉시 실행 요청
npm run auto:stop    # 정기 제작 해제; 기존 영상은 유지
npm run auto:install # 매시간 정각 예약을 다시 설치
npm test            # 실패 시 기존 영상 보존·중복 방지·커밋 범위 검증
```

최신 영상의 주소는 계속 `output/wonder-park-30s.mp4`이며 극장 호환 경로도 함께 갱신한다. `.movie-runtime/status.json`에 제작 단계와 마지막 성공 시각을, `.movie-runtime/history/`에 최근 성공본 24개를 보관한다. 실행 로그는 `.movie-runtime/logs/`의 최근 48개이며, 이 임시 데이터와 예약 파일은 Git에 포함하지 않는다. 영상 데이터에 변화가 없어도 매시간 다시 촬영하며, Git에 실제 변경분이 있을 때 커밋한다.

예약 설치는 `~/Library/LaunchAgents/com.tbd.wonderpark.movie.hourly.plist`에 등록한다. 작업이 겹치면 새 실행은 건너뛴다. 제작이나 자동 커밋이 실패하면 상태 파일에 원인을 기록하고 다음 예약에서 다시 시도한다. 실제 촬영 인터뷰·간식은 새로 수집하지 않으며, 예시 대사와 기존 창작 연출을 유지하면서 최신 파크 결과물을 갱신한다.

## 장면

별빛 → 설계도·제작 단계 → 정원·성·어트랙션 조립 → 인터뷰 예시 → 쿠키·커피 일러스트 → 실제 파크 조작 → 별빛 곡선·불꽃·Wonder Park 타이틀.

`assets/wonder/park-source/`는 현재 테마파크의 성, 정원, 어트랙션, 캐릭터, 재질 소스를 복사한 제작 시점의 스냅샷이다. `park-film-scene.js`가 실제 모델을 높이별로 나눠 조립 애니메이션과 영화용 카메라를 구성한다. 이는 실제 개발 시간순 화면 녹화가 아니라 제작 단계의 시각적 재구성이다. 디즈니 공식 영상이나 음원은 포함하지 않는다.

인터뷰는 새로 작성한 예시 대사를 macOS Yuna로 합성했다. 간식은 Canvas로 그린 일러스트이며 실제 행사 기록이 아니다. 생성 이미지 요청은 도구에서 거절되어 최종 영상에는 새 AI 생성 이미지를 사용하지 않았다. 기존 영상의 생성 이미지도 참조하지 않는다.

## 재생성

필수: Node.js 22.12+, ffmpeg, Google Chrome, 상위 프로젝트의 Playwright와 esbuild. macOS의 Baskerville·Apple SD Gothic Neo 글꼴을 사용한다. Three.js 0.180.0의 필요한 모듈은 `assets/wonder/vendor/`에 고정해 보관했으며 MIT 라이선스도 포함한다.

```sh
# 실제 파크는 http://localhost:5190 에서 실행
npm run capture
# 다른 파크 주소는 PARK_URL 환경 변수로 지정

# 필요할 때만 인터뷰 재생성
say -v Yuna -r 225 -o assets/wonder/interview.aiff '각자의 아이디어가, 하나의 놀이공원이 됐어요.'

npm run audio
npm run stills
npm run render
npm run verify
```

렌더링은 저장한 모델 번들과 캡처를 사용하므로 파크 서버 없이도 가능하다. 최신 소스·이미지·앱 화면으로 모두 갱신할 때는 `npm run auto:once`를 실행한다. 저장된 모델 소스를 직접 편집했다면 `npm run bundle:model`로 번들을 갱신한 뒤 렌더링한다.

- `film.js`: 타임라인·문구·별빛·불꽃·인터뷰·간식·데모 합성
- `park-film-scene.js`: 실제 파크 모델의 단계별 조립·카메라·조명
- `scripts/audio.mjs`: 새로 작곡한 벨·스트링·팀파니 계열 합성 스코어와 인터뷰 믹스
- `scripts/capture-demo.mjs`: 임시 Chrome 프로필로 전경·범퍼카·야간 전환 촬영
- `assets/wonder/demo/`: 실제 앱 조작 15fps 캡처, 최종 영상은 30fps
- `assets/wonder/park-catalog.json`: 촬영 당시의 어트랙션 목록

## 기존 극장 연결

현재 파크 극장은 `movie/output/vitalis-hackathon-30s.mp4`를 고정 참조한다. 이 파일의 **내용도 새 Wonder Park MP4와 동일하게 교체**한다. 이름은 기존 연결을 위한 호환 경로이며 이전 영상은 상영되지 않는다. `npm run verify` 통과 후 `npm run publish:local`로 두 경로를 동일하게 맞춘다. 외부 업로드는 하지 않는다. 파크 쪽의 고정된 예전 제목 문구는 별도 프로젝트에 남아 있을 수 있다.

`attraction.json`은 극장 안내를 새 상영작으로 갱신한다. 기존의 다른 작업 폴더는 수정하지 않는다. 이번 커밋에는 `movie/`의 변경분만 포함한다.
