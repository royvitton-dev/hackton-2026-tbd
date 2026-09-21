# VITALIS hackathon film

30초 · 1920×1080 · 30fps · H.264/AAC MP4. 해커톤 타임라인, 개발 과정, 인터뷰 예시, 야식 에피소드, 실제 앱 데모를 담은 샘플.

- 최종 영상: `output/vitalis-hackathon-30s.mp4`
- 로컬 재생 페이지: `index.html`
- 촬영·편집 계획과 재연 범위: [STORYBOARD.md](STORYBOARD.md)
- 한국어 선택 자막: `output/captions.vtt` (핵심 카피는 영상에 이미 포함)
- 장면 원본: `assets/team.png`, `assets/interview.png`, `assets/food.png`
- 실제 브라우저 캡처: `assets/demo/` (15fps, 최종 영화에서는 30fps로 합성)
- 음악: `assets/original-beat.wav`, 인터뷰 합성: `assets/interview.aiff`, 최종 믹스: `assets/soundtrack.wav`

## 보기

MP4를 직접 열거나 아래 명령으로 재생 페이지를 연다.

```sh
npm run dev
# http://localhost:5180
```

## 다시 만들기

Node.js, ffmpeg, Google Chrome과 `../webpage/node_modules/playwright`가 필요하다. 기존 형제 프로젝트의 Playwright를 재사용하며 별도 npm 패키지는 설치하지 않는다. 한글 렌더링은 macOS Apple SD Gothic Neo 글꼴을 사용한다.

```sh
# VITALIS는 http://localhost:5174/health/ 에서 실행 중이어야 함
npm run capture

# 인터뷰 합성 (이미 assets에 포함)
say -v Yuna -r 205 -o assets/interview.aiff '숫자로만 보던 건강을, 입체적으로 보고 싶었어요.'

npm run audio
node scripts/render.mjs --stills
npm run render
```

VITALIS 주소가 다르면 `VITALIS_URL` 환경 변수로 capture 스크립트에 전달한다. 데모 캡처는 임시 브라우저 프로필을 사용한다. 렌더는 저장된 캡처를 사용하므로 앱 서버가 필요 없다. 출력 파일은 다시 실행 시 덮어쓴다.

편집은 `film.js`에서 장면별 시간·텍스트·움직임을 조정한다. 영상은 900프레임, 30초로 고정되어 있다. `scripts/audio.mjs`가 120 BPM 오리지널 비트와 인터뷰 믹스를 만든다. 내장 imagegen의 이미지 생성 프롬프트는 `assets/image-prompts.json`에 보관했다.

샘플 인물·음식·일정·인터뷰는 실제 해커톤 기록이 아니다. 재연 스틸과 합성 음성임을 화면에 표시했다. 실제 VITALIS 앱 데모만 현행 프로젝트에서 직접 캡처했다.
