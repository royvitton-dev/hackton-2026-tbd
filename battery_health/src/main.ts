import './style.css';
import { loadBatteryData } from './data';
import { calculateUserSummary, deriveSession, ruleMap } from './scoring';
import { batteryStorage } from './storage';
import { buildScoreNarrative, type ScoreNarrative } from './scoreNarrative';
import type { ChargingSession, SessionFeature, UserProfile, UserSummary, Vehicle, VehicleImage } from './types';

const app = document.querySelector<HTMLDivElement>('#app')!;
if (!app) throw new Error('App root was not found');

const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
});

const profileNames: Record<string, string> = {
  Balanced: '균형형', FastHeavy: '급속 선호형', NightSlow: '심야 완속형',
  LongIdleHighSoc: '고SOC 장시간 연결형', DeepDischarge: '저SOC 진입형',
  Mixed: '혼합형', Sparse: '데이터 수집 중',
};

const gradeLabels: Record<string, string> = {
  EXCELLENT: '매우 좋음', GOOD: '좋음', CAUTION: '주의', RISK: '개선 필요',
  LOW_CONFIDENCE: '낮은 신뢰도', INSUFFICIENT: '데이터 부족',
  PARTIAL: '부분 평가', REFERENCE: '참고 평가',
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function sessionLabel(type: string): string {
  return type === 'AC_SLOW' ? '완속' : type === 'DC_FAST' ? '급속' : '초급속';
}

function featureFlags(feature: SessionFeature): string {
  const flags: [boolean, string, string][] = [
    [feature.isNightCharge, '심야 완속', 'positive'],
    [feature.isHighC, '고 C-rate', 'warning'],
    [feature.isLongIdle, '장시간 연결', 'warning'],
    [feature.isDeepDischarge, '저SOC', 'warning'],
    [feature.isHighSocEnd, '고SOC', 'neutral'],
    [feature.isShortTopup, '보충 충전', 'neutral'],
  ];
  const active = flags.filter(([enabled]) => enabled);
  return active.length
    ? active.map(([, label, tone]) => `<span class="tag ${tone}">${label}</span>`).join('')
    : '<span class="tag neutral">일반</span>';
}

function metric(label: string, value: string, detail = ''): string {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong>${detail ? `<small>${detail}</small>` : ''}</div>`;
}

function guideList(items: string[]): string {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function scoreExplanation(report: ScoreNarrative): string {
  return `<details class="insufficient-note score-detail"><summary>${report.totalScore === null ? '기록이 더 필요한 이유' : `왜 ${report.totalScore}점인가요?`}</summary>
    <p>${escapeHtml(report.summary)}</p><p>충전 기록 기반 관리 점수이며, 실제 배터리 건강도나 남은 성능의 비율이 아닙니다.</p>
    <p>해석 범위: ${escapeHtml(report.confidenceLabel)}</p>
    ${report.factorExplanations.map(factor => `<details class="score-factor"><summary>${escapeHtml(factor.label)} · ${escapeHtml(factor.statusLabel)}</summary>
      <p>${escapeHtml(factor.description)}</p><p>${escapeHtml(factor.contributionLabel)}</p>
      <h3>좋은 점 · 확인한 내용</h3><p>${escapeHtml(factor.positiveReason)}</p>
      <h3>평가에 반영된 근거</h3><ul>${guideList(factor.evidence)}</ul>
      <h3>다음에 해보면 좋은 행동</h3><p>${escapeHtml(factor.tip)}</p></details>`).join('')}
    <details class="score-factor"><summary>계산 방식 · 데이터 출처</summary>
      <ol>${guideList(report.calculationSteps)}</ol>${report.arithmetic ? `<strong>${escapeHtml(report.arithmetic)}</strong>` : ''}
      ${report.rangeNote ? `<p>${escapeHtml(report.rangeNote)}</p>` : ''}
      <p>반영 기록 기준 시점: ${escapeHtml(report.asOf?.replace('T', ' ') ?? '평가 가능한 기록 없음')} · 실시간 측정 시각이 아닙니다.</p>
      <p>계산 방식: <code>${escapeHtml(report.algorithmVersion)}</code></p>
      ${report.dataSources.map(source => `<h3>${escapeHtml(source.label)}</h3><p>${escapeHtml(source.detail)}</p>`).join('')}
      <h3>이번 평가에 포함하지 않은 정보</h3><ul>${guideList(report.limitations)}</ul>
    </details>
    <details class="score-factor"><summary>논문 근거와 적용 한계</summary>
      <p><a href="https://doi.org/10.1016/j.jpowsour.2014.02.012" target="_blank" rel="noreferrer">Schmalstieg 외 (2014), Journal of Power Sources 257, 325–334</a>의 모델과 <a href="https://github.com/NatLabRockies/BLAST-Lite/blob/main/blast/models/nmc111_gr_Sanyo2Ah_2014.py" target="_blank" rel="noreferrer">BLAST-Lite 공개 구현</a>의 계수·잔량-전압 표를 참고했습니다. 원 구현의 사이클 부분은 약 1C·35°C 기준이며 속도·온도 차이에 따른 열화를 계산하지 않습니다.</p>
      <p>충전 기록만 쓰는 방식과 25°C 가정, 비교 기준·0~100점 환산은 서비스 정책입니다. 논문이 이 점수의 정확도를 검증한 것은 아닙니다. 계산용 0%·100% 대기 기준은 운전 권고가 아닙니다.</p>
    </details>
  </details>`;
}

function renderDashboard(
  user: UserProfile,
  vehicle: Vehicle,
  features: SessionFeature[],
  summary: UserSummary,
  allUsers: UserProfile[],
  sessionLimit: number,
  vehicleImage: VehicleImage | undefined,
): void {
  const recent = [...features]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, sessionLimit);
  const careScore = summary.batteryCareScore === null ? '—' : String(summary.batteryCareScore);
  const careArc = summary.batteryCareScore ?? 0;
  const profile = profileNames[user.driverProfile] ?? user.driverProfile;
  const report = buildScoreNarrative({ score: summary.batteryCareScore, confidence: summary.socConfidenceScore,
    recordCount: summary.sessionCount, vehicleId: vehicle.vehicleId, batteryUsableKwh: vehicle.batteryUsableKwh,
    assessment: summary, source: 'split-json' });
  const scoreDescription = report.summary;

  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="#" aria-label="Cellwise 홈">
          <span class="brand-mark"><i></i><i></i><i></i></span>
          <span>Cellwise<small>EV BATTERY CARE</small></span>
        </a>
        <div class="header-actions">
          <span class="data-status"><i></i> 정적 데이터 연결됨</span>
          <label class="user-picker">
            <span>분석 사용자</span>
            <select id="user-select" aria-label="분석 사용자 선택">
              ${allUsers.map((option) => `<option value="${escapeHtml(option.userId)}" ${option.userId === user.userId ? 'selected' : ''}>${escapeHtml(option.userId)} · ${escapeHtml(profileNames[option.driverProfile] ?? option.driverProfile)}</option>`).join('')}
            </select>
          </label>
        </div>
      </header>

      <main>
        <section class="hero">
          <div>
            <p class="eyebrow">BATTERY CARE OVERVIEW</p>
            <h1>${escapeHtml(vehicle.modelName)} <em>${escapeHtml(vehicle.trimName)}</em></h1>
            <p class="hero-copy">논문 열화식을 25°C 표준 조건에 적용한 상대 충전 스트레스 점수입니다.<br>온도·BMS가 없는 실제 SOH 진단값 또는 잔존수명 예측값이 아닙니다.</p>
          </div>
          <div class="identity-card">
            <span class="avatar">${escapeHtml(user.userId.slice(-2))}</span>
            <div><small>${escapeHtml(user.userId)}</small><strong>${escapeHtml(profile)}</strong><span>초기 SOC ${number.format(user.initialSocPct)}%</span></div>
          </div>
        </section>

        <section class="score-grid">
          <article class="score-card primary" data-tone="${report.tone}">
            <div class="score-heading"><span>BatteryCareScore</span><span class="pill ${summary.eligibleFlag ? 'eligible' : 'insufficient'}">${summary.eligibleFlag ? (summary.scoreScope === 'FULL' ? '분석 가능' : gradeLabels[summary.grade]) : 'INSUFFICIENT'}</span></div>
            <div class="score-body">
              <div class="score-ring" style="--score:${careArc}"><div><strong>${careScore}</strong><span>/ 100</span></div></div>
              <div class="score-copy"><small>충전 기록의 관리 흐름</small><h2>${report.statusLabel}</h2><p>${escapeHtml(scoreDescription)}</p></div>
            </div>
            ${summary.insufficientReasons.length ? `<div class="insufficient-note"><strong>추가 데이터 필요</strong><span>${escapeHtml(summary.insufficientReasons.join(' · '))}</span></div>` : ''}
            <div class="insufficient-note"><strong>평가 범위</strong><span>반영 ${summary.scoreSessionCount}건 · 제외 ${summary.scoreExcludedSessionCount}건 · ${number.format(summary.scoreObservationDays)}일<br>${escapeHtml(summary.referenceReasons.join(' '))}<br>0–100점 환산과 참고 평가 정책 자체는 논문으로 검증된 진단법이 아닙니다.</span></div>
            ${scoreExplanation(report)}
          </article>
          <article class="score-card confidence">
            <div class="score-heading"><span>SOC 데이터 품질</span><span class="hint">배터리 점수 아님</span></div>
            <div class="confidence-score"><strong>${summary.socConfidenceScore}</strong><span>/ 100</span></div>
            <div class="progress"><i style="width:${summary.socConfidenceScore}%"></i></div>
            <div class="confidence-meta">
              <span><small>SOC 앵커</small><strong>${summary.socAnchorCount}건</strong></span>
              <span><small>데이터 완성도</small><strong>${number.format(summary.dataCompletenessScore)}%</strong></span>
            </div>
            <p class="score-description">SOC 입력·앵커·결측 여부를 나타내며 현재 SOC나 배터리 건강도를 뜻하지 않습니다.</p>
          </article>
          <article class="score-card mix">
            <div class="score-heading"><span>충전 구성</span><span class="hint">전체 세션 기준</span></div>
            <div class="mix-chart" style="--slow:${summary.slowChargeRatio * 360}deg;--fast:${(summary.slowChargeRatio + summary.fastChargeRatio - summary.ultraFastChargeRatio) * 360}deg"><span></span></div>
            <div class="legend">
              <span><i class="slow"></i>완속 <strong>${percent(summary.slowChargeRatio)}</strong></span>
              <span><i class="fast"></i>급속 <strong>${percent(summary.fastChargeRatio - summary.ultraFastChargeRatio)}</strong></span>
              <span><i class="ultra"></i>초급속 <strong>${percent(summary.ultraFastChargeRatio)}</strong></span>
            </div>
          </article>
        </section>

        <section class="content-grid">
          <article class="panel habits">
            <div class="panel-title"><div><p class="eyebrow">CHARGING PATTERN</p><h2>충전 습관 요약</h2></div><span>관측 ${number.format(summary.observationDays)}일</span></div>
            <div class="metric-grid">
              ${metric('충전 세션', `${summary.sessionCount}건`, `최근 ${number.format(summary.observationDays)}일`)}
              ${metric('누적 충전량', `${number.format(summary.totalChargedKwh)} kWh`, `${summary.estimatedEfc} EFC`)}
              ${metric('급속 비율', percent(summary.fastChargeRatio), `초급속 ${percent(summary.ultraFastChargeRatio)}`)}
              ${metric('심야 완속', percent(summary.nightSlowChargeRatio), '23:00–07:00')}
              ${metric('장시간 미분리', `${summary.longIdleCount}회`, `고SOC 동반 ${summary.highSocIdleCount}회`)}
              ${metric('저SOC 충전', `${summary.deepDischargeCount}회`, '20% 미만 진입')}
              ${metric('평균 C-rate', `${summary.avgCRate} C`, `최대 ${summary.maxCRate} C`)}
              ${metric('데이터 상태', summary.eligibleFlag ? '분석 가능' : '수집 중', summary.eligibleFlag ? '최소 조건 충족' : '최소 조건 미충족')}
            </div>
          </article>

          <article class="panel vehicle-panel">
            <div class="panel-title"><div><p class="eyebrow">VEHICLE & PACK</p><h2>차량 배터리 정보</h2></div><span class="confidence-badge">${escapeHtml(vehicle.dataConfidence)}</span></div>
            ${vehicleImage ? `<figure class="vehicle-photo"><img src="${escapeHtml(vehicleImage.imagePath)}" alt="${escapeHtml(vehicle.manufacturer)} ${escapeHtml(vehicle.modelName)} 대표 이미지"><figcaption>선택 차량과 연결된 모델 대표 이미지</figcaption></figure>` : ''}
            <div class="vehicle-name"><div class="car-symbol">EV</div><div><strong>${escapeHtml(vehicle.manufacturer)} ${escapeHtml(vehicle.modelName)}</strong><span>${vehicle.modelYear} · ${escapeHtml(vehicle.trimName)}</span></div></div>
            <dl class="spec-list">
              <div><dt>배터리 용량</dt><dd>${number.format(vehicle.batteryUsableKwh)} <small>/ ${number.format(vehicle.batteryGrossKwh)} kWh</small></dd></div>
              <div><dt>셀 화학계</dt><dd>${escapeHtml(vehicle.batteryChemistry)}</dd></div>
              <div><dt>전압 아키텍처</dt><dd>${escapeHtml(vehicle.packVoltageClass)} <small>${integer.format(vehicle.packVoltage)}V</small></dd></div>
              <div><dt>최대 AC / DC</dt><dd>${number.format(vehicle.maxAcChargeKw)} / ${number.format(vehicle.maxDcChargeKw)} <small>kW</small></dd></div>
              <div><dt>인증 주행거리</dt><dd>${integer.format(vehicle.certifiedRangeKm)} <small>km</small></dd></div>
              <div><dt>공인 효율</dt><dd>${number.format(vehicle.efficiencyKmPerKwh)} <small>km/kWh</small></dd></div>
            </dl>
            <a class="source-link" href="${escapeHtml(vehicle.sourceUrl)}" target="_blank" rel="noreferrer">차량 제원 출처 보기 ↗</a>
            ${vehicleImage ? `<a class="source-link" href="${escapeHtml(vehicleImage.sourceUrl)}" target="_blank" rel="noreferrer">이미지: ${escapeHtml(vehicleImage.author)} · ${escapeHtml(vehicleImage.license)} ↗</a>` : ''}
          </article>
        </section>

        <section class="panel guide-panel">
          <div class="panel-title"><div><p class="eyebrow">PERSONALIZED GUIDE</p><h2>지금의 습관, 이렇게 관리해 보세요</h2></div><span>충전 기록 맞춤 분석</span></div>
          <div class="guide-grid">
            <div class="guide good"><span class="guide-icon">✓</span><div><h3>좋은 습관</h3><ul>${guideList(summary.goodHabits)}</ul></div></div>
            <div class="guide caution"><span class="guide-icon">!</span><div><h3>주의할 습관</h3><ul>${guideList(summary.cautions)}</ul></div></div>
            <div class="guide action"><span class="guide-icon">→</span><div><h3>다음 충전 추천</h3><ul>${guideList(summary.nextActions)}</ul></div></div>
          </div>
        </section>

        <section class="panel sessions-panel">
          <div class="panel-title"><div><p class="eyebrow">RECENT SESSIONS</p><h2>최근 충전 세션</h2></div><span>최근 ${recent.length}건 / 전체 ${summary.sessionCount}건</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>시작 / 종료</th><th>충전 방식</th><th>충전량</th><th>평균 전력</th><th>C-rate</th><th>ΔSOC</th><th>분리 대기</th><th>주요 플래그</th></tr></thead>
              <tbody>
                ${recent.map((feature) => `<tr>
                  <td><strong>${dateTime.format(new Date(feature.startedAt))}</strong><small>${dateTime.format(new Date(feature.endedAt))} 종료<br>${dateTime.format(new Date(feature.unpluggedAt))} 분리</small></td>
                  <td><span class="charger ${feature.chargerClass.toLowerCase()}">${sessionLabel(feature.chargerClass)}</span><small>${escapeHtml(feature.stationType)}</small></td>
                  <td><strong>${number.format(feature.chargedKwh)} kWh</strong></td>
                  <td>${number.format(feature.avgPowerKw)} kW</td>
                  <td>${feature.cRate} C</td>
                  <td>+${number.format(feature.deltaSocPct)}%</td>
                  <td>${integer.format(feature.idleMinutes)}분</td>
                  <td><div class="tags">${featureFlags(feature)}</div></td>
                </tr>`).join('') || '<tr><td colspan="8" class="empty">표시할 충전 세션이 없습니다.</td></tr>'}
              </tbody>
            </table>
          </div>
        </section>

        <footer><span>Cellwise Battery Care MVP</span><p>본 서비스는 차량 내부 BMS/SOH 직접 진단 서비스가 아닙니다. 충전 세션과 차량 제원을 이용한 관리 참고 지표입니다.</p></footer>
      </main>
    </div>`;
}

function showError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  app.innerHTML = `<div class="error-state"><strong>데이터를 불러오지 못했습니다.</strong><p>${escapeHtml(message)}</p><small><code>npm run convert:data</code> 실행 후 다시 시도해 주세요.</small></div>`;
}

async function init(): Promise<void> {
  try {
    const data = await loadBatteryData();
    if (!data.users.length) throw new Error('사용자 데이터가 비어 있습니다.');
    const vehicles = new Map(data.vehicles.map((vehicle) => [vehicle.vehicleId, vehicle]));
    const vehicleImages = new Map(data.vehicleImages.map((image) => [image.vehicleId, image]));
    const sessionsByUser = new Map<string, ChargingSession[]>();
    for (const session of data.sessions) {
      const bucket = sessionsByUser.get(session.userId) ?? [];
      bucket.push(session);
      sessionsByUser.set(session.userId, bucket);
    }
    const rules = ruleMap(data.rules);
    const storedUser = batteryStorage.selectedUser();
    let selected = data.users.find((user) => user.userId === storedUser) ?? data.users[0];
    const limit = Math.max(20, Math.min(50, batteryStorage.settings().recentSessionLimit));

    const update = (user: UserProfile): void => {
      const vehicle = vehicles.get(user.vehicleId);
      if (!vehicle) throw new Error(`${user.userId}의 차량 ${user.vehicleId}을 찾을 수 없습니다.`);
      const sessions = sessionsByUser.get(user.userId) ?? [];
      const features = sessions.map((session) => deriveSession(session, vehicle, rules));
      const summary = calculateUserSummary(features, vehicle, rules);
      batteryStorage.saveSelection(user.userId, vehicle.vehicleId, sessions, summary);
      renderDashboard(user, vehicle, features, summary, data.users, limit, vehicleImages.get(vehicle.vehicleId));
      document.querySelector<HTMLSelectElement>('#user-select')?.addEventListener('change', (event) => {
        const target = event.currentTarget as HTMLSelectElement;
        const next = data.users.find((candidate) => candidate.userId === target.value);
        if (next) {
          selected = next;
          update(selected);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    };
    update(selected);
  } catch (error) {
    showError(error);
  }
}

void init();
