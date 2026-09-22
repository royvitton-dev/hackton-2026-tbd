# 코드세이: 집에 가는 길

GS 해커콘, 9월 21–22일 집에 못 가는 개발자 리그. **85초 / 2,040프레임 / 1920×1080 / 24fps / H.264·AAC 스테레오**. 영화 장면으로 AI의 엉뚱한 신탁과 밤샘 개발의 고비를 표현하고, 마지막에는 주인공이 상품 **맥미니**를 힘겹게 얻는다.

- [상영 페이지](index.html) · [MP4](../../output/gs-codeyssey-trailer.mp4)
- [장면별 타임라인](timeline.mjs) · [내레이션과 타이밍](voice-manifest.json)
- [렌더링 검증](../../output/odyssey/render-check.json) · [동작 검증](../../output/odyssey/motion-check.json)

## 장면 구성

| 시간 | 영상과 대사 |
| --- | --- |
| 00:00–00:05 | GS 지구 오프닝 → GS차지비 로고 |
| 00:05–00:12 | 9월 21일, 우리는 집을 떠났다. 집에 못 가는 개발자 리그. |
| 00:12–00:16 | 항해하는 원정대. 돌아갈 시간 따위는 없었다. |
| 00:16–00:20 | AI의 신탁. “이 코드는 완벽합니다.” |
| 00:20–00:24 | 존재하지 않는 해결책. “아, 그건 제가 지어냈어요.” |
| 00:24–00:31 | 버그 하나 해결. 열두 개가 돌아왔다. |
| 00:31–00:35 | “진짜 마지막 수정이야.” 오늘만 23번째. |
| 00:35–00:39 | 수정 요청 1줄. 변경된 파일 47개. |
| 00:39–00:43 | 9월 22일 새벽 3시 17분. 카페인 99%, 체력 1%. |
| 00:43–00:48 | 기억을 잃은 AI. “원래, 뭘 만들고 있었죠?” |
| 00:48–00:55 | 집은 다음 문제였다. 그래도 끝까지 버텼다. |
| 00:55–00:58 | 마지막 고비 몽타주. 배포까지 단 한 걸음. |
| 00:58–01:01 | 코드세이: 집에 가는 길 타이틀 |
| 01:01–01:05 | “이 모든 여정은…” |
| 01:05–01:10 | 결연한 표정. “키링을 얻기 위해서가 아니었다.” |
| 01:10–01:18 | “맥미니를 얻기 위해서였다.” 주인공이 마지막 힘을 모아 맥미니를 들어 올린다. |
| 01:18–01:23 | 맥미니를 품에 안은 주인공. “우리는 맥미니를 들고 돌아간다.” |
| 01:23–01:25 | GS 해커콘 · 9월 21일–22일 |

## 영상 제작 방식

85초 가운데 영화 장면은 62초, 실사풍 AI 피날레는 13초, 로고·타이틀·엔딩은 10초다. 영화 장면의 기존 자막을 크롭하고 새 한국어 대사를 아래 검은 여백에 배치했다. 느리게 편집한 영화 장면 14곳은 움직임을 보간했다.

피날레의 기준 이미지는 영화 속 주인공의 얼굴과 의상을 참고해 이미지 생성 도구로 제작했다. 이어서 LTX-2.3 Distilled 영상 모델이 몸, 손, 망토, 카메라의 연속 움직임을 생성했다. 첫 장면의 마지막 프레임을 다음 장면의 시작 이미지로 사용했다. 첫 클립은 32fps로 움직임을 보간해 0.75배속으로 편집했다. 생성 영상의 원본 해상도는 896×384이고, 영화와 함께 1920×1080 화면에 합성했다.

이는 이미지에서 생성한 실사풍 영상이다. 캐릭터의 관절을 직접 조작할 수 있는 3D 모델 파일은 포함하지 않는다. [영상 생성 기록](cinematic-generation.json)에 입력 이미지, 프롬프트, 모델, 시드와 클립 정보를 보관했다. 원본 생성 클립은 [맥미니 들어 올리기](cinematic-lift.mp4), [승리 장면](cinematic-victory.mp4)에서 확인할 수 있다.

## 음성·음악·출처

- 원본 영상: [유니버설 픽쳐스, 〈오디세이〉 파이널 예고편](https://www.youtube.com/watch?v=zz2ZH13NOi8). 영상 소스와 추출 프레임은 Git에서 제외된 `movie/tmp/odyssey/`에 있다. 원본 음원은 사용하지 않았다.
- GS 워드마크: [GS 공식 홈페이지](https://www.gs.co.kr/ko/main)의 SVG 경로. `gs.svg`.
- 차지비 워드마크: [GS차지비 공식 홈페이지](https://www.gschargev.co.kr/home)의 [헤더 로고](https://www.gschargev.co.kr/images/logo_header.png). `chargev.png`. 두 번째 슬레이트에는 GS차지비를 명시한다.
- 내레이션: [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)를 [MLX Audio](https://github.com/Blaizzy/mlx-audio)로 실행했다. VoiceDesign으로 만든 독자적인 남성 저음이며, 실제 배우의 목소리를 복제하지 않았다. 같은 합성 음성을 기준으로 15개 대사를 생성했다. 음높이와 재생 속도를 인위적으로 바꾸지 않았으며, 침묵 정리·EQ·음량 조정을 적용했다. [음성 설계](voice-design.json), [대사·타이밍·파일](voice-manifest.json).
- 영상 생성: [Lightricks LTX-2](https://github.com/Lightricks/LTX-2), [LTX-2 MLX](https://github.com/dgrauet/ltx-2-mlx), [LTX-2.3 4bit 모델](https://huggingface.co/dgrauet/ltx-2.3-mlx-q4). [실행 환경](cinematic-runtime.json).
- 음악과 효과음: 이 영상을 위해 합성한 브라스·스트링·타격음·파도·키보드·오류 알림.
- 오류 메시지, 대사와 상품 획득 장면은 패러디 연출이다. 맥미니의 행사 상품 세부 사양은 특정하지 않는다.

## 다시 렌더링

저장소 루트에서 실행한다. Node, Chrome, ffmpeg, Playwright가 필요하다. AI 음성과 피날레를 다시 생성할 때는 Apple Silicon에서 MLX를 사용할 수 있는 Python과 모델 파일이 필요하다. 모델과 임시 파일은 `movie/tmp/odyssey/`에 둔다.

~~~sh
# 원본 영화 프레임과 생성 클립이 준비된 상태에서
node movie/scripts/odyssey-slow-motion.mjs
node movie/scripts/odyssey-cinematic-frames.mjs
node movie/scripts/odyssey-cinematic-audio.mjs
node movie/scripts/odyssey-motion-check.mjs
node movie/scripts/odyssey-render.mjs
node movie/scripts/odyssey-check.mjs

# 실제 상영 서버에서 재생·탐색·모바일·다운로드 확인
PARK_URL=http://localhost:5190 node movie/scripts/odyssey-check.mjs
~~~

전체 MP4를 디코딩해 프레임 수와 영상·음성 스트림을 확인한다. 브라우저 검사에서는 실제 재생, 피날레 탐색, 23개 자막 구간, 15개 대사의 길이, 모바일 레이아웃과 부분 다운로드를 확인한다. 피날레 동작 검사는 서로 다른 시각의 원본 생성 프레임이 달라지는지와 재탐색의 일관성을 확인한다.
