# 실제 엔진 CPU·메모리 그래프

`2026-09-21T11-01-25-875Z-engine-load-8774ce30` 실행이 끝난 뒤 root가 원시 자료를 읽어 생성했다. 부하 중 그래프 렌더링이나 의존성 설치는 실행하지 않았다. PNG를 실제 열어 축·단위·WS 단절 표시·잘림 여부를 확인했다.

- [PNG](engine-cpu-memory.png), [SVG](engine-cpu-memory.svg)
- [입력 SHA·버전·67개 구간 재계산 기록](plot-verification.json)
- [생성 스크립트](../../scripts/plot-engine-load.py)

Python 3.12 및 matplotlib 3.11.2를 사용했다. 무료 의존성은 `trading/.tools/plot-libs`, pip cache는 `trading/.tools/pip-cache`, matplotlib cache는 `trading/.tmp/matplotlib-resource`에만 두었다. 재생성 시 `PYTHONPATH`, `MPLCONFIGDIR`, `PYTHONDONTWRITEBYTECODE=1`을 해당 경계로 설정한 뒤 다음 명령을 사용한다.

```text
python scripts/plot-engine-load.py 2026-09-21T11-01-25-875Z-engine-load-8774ce30
```

재실행은 새 고유 evidence 폴더를 만든다. CPU는 원시 누적 CPU 시간 차이를 표본 간 시간·16논리CPU로 나눈 값이다. 500ms 전후 구간 평균이며 순간 최대값은 아니다. 메모리는 MiB(1,048,576 bytes), working set과 private bytes를 구분한다. 원문 결과표의 MB와 단위가 다르다. WS 단절 후 96단계의 CPU 감소는 동일 조건의 성능 향상을 입증하지 않는다.
