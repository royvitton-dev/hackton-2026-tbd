/**
 * Reference-condition battery stress score.
 *
 * Capacity-fade equations and parameters reproduce the NMC111/graphite model
 * reported by Schmalstieg et al., J. Power Sources 257 (2014) 325–334,
 * DOI 10.1016/j.jpowsour.2014.02.012, as implemented by NREL/NLR BLAST-Lite
 * (BSD-3-Clause, SWR-22-69). Temperature is fixed at 25 °C because the product
 * receives no temperature telemetry. The result is a comparative reference
 * stress score, never vehicle SOH or predicted capacity retention.
 */

export const SCIENTIFIC_MODEL = {
  id: 'SCHMALSTIEG_2014_NMC111_25C_REFERENCE',
  label: 'Schmalstieg–Ecker NMC111/Graphite · 25°C reference',
  doi: 'https://doi.org/10.1016/j.jpowsour.2014.02.012',
  implementation: 'https://github.com/NatLabRockies/BLAST-Lite',
  referenceTemperatureC: 25,
  maxChargeCRate: 1,
} as const;

const SOC = [0,0.008637153,0.026779514,0.044921875,0.063064236,0.081206597,0.099348958,0.117491319,0.135633681,0.153776042,0.171918403,0.190060764,0.208203125,0.226345486,0.244487847,0.262630208,0.280772569,0.298914931,0.317057292,0.335199653,0.353342014,0.371484375,0.389626736,0.407769097,0.425911458,0.444053819,0.462196181,0.480338542,0.498480903,0.516623264,0.534765625,0.552907986,0.571050347,0.589192708,0.607335069,0.625477431,0.643619792,0.661762153,0.679904514,0.698046875,0.716189236,0.734331597,0.752473958,0.770616319,0.788758681,0.806901042,0.825043403,0.843185764,0.861328125,0.879470486,0.897612847,0.915755208,0.933897569,0.952039931,0.970182292,0.988324653,0.998220486,1];
const OCV = [3.331,3.345014187,3.37917149,3.411603677,3.440585632,3.466289865,3.490268982,3.511315401,3.529946658,3.547197821,3.561688798,3.574972194,3.586357962,3.597053683,3.605506753,3.613442288,3.620342753,3.626380661,3.632073544,3.63690387,3.642079219,3.646909545,3.652084894,3.657605266,3.663470662,3.670198615,3.677444104,3.686759732,3.696420384,3.708323686,3.720572012,3.734372943,3.749553967,3.765252525,3.781123596,3.797857224,3.814590852,3.832532062,3.849783226,3.866861877,3.884458064,3.900846669,3.917752809,3.934831461,3.953462717,3.971921462,3.991415276,4.011771649,4.03195551,4.05196686,4.070770628,4.087849279,4.104237884,4.120108955,4.135980025,4.152541142,4.160649189,4.162];

const PARAMS = {
  qcalAV: 7.543, qcalBV: -23.75, qcalCT: -6976, qcalP: 0.75,
  qcycAV: 7.348e-3, qcycBV: 3.667, qcycC: 7.6e-4,
  qcycDDod: 4.081e-3, qcycP: 0.5,
};

export interface ScientificSessionInput {
  startSocPct: number | null;
  endSocPct: number | null;
  chargedKwh: number;
  cRate: number;
  idleMinutes: number;
  startedAt?: string;
  endedAt?: string;
  usesReferenceSoc?: boolean;
}

export interface StressComponent {
  observed: number;
  minimum: number;
  maximum: number;
}

export interface ScientificScoreResult {
  score: number | null;
  observedCapacityStress: number;
  minimumCapacityStress: number;
  maximumCapacityStress: number;
  cycleStress: StressComponent;
  idleStress: StressComponent;
  supportedSessionCount: number;
  outOfRangeSessionCount: number;
  missingSocSessionCount: number;
  modelId: string;
  modelLabel: string;
  referenceTemperatureC: number;
  limitations: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function voltage(soc: number): number {
  const value = clamp(soc, 0, 1);
  const upper = SOC.findIndex((point) => point >= value);
  if (upper <= 0) return OCV[0];
  const lower = upper - 1;
  const fraction = (value - SOC[lower]) / (SOC[upper] - SOC[lower]);
  return OCV[lower] + fraction * (OCV[upper] - OCV[lower]);
}

function rmsVoltage(start: number, end: number): number {
  const points = 32;
  let squares = 0;
  for (let index = 0; index <= points; index += 1) {
    const soc = start + (end - start) * index / points;
    squares += voltage(soc) ** 2;
  }
  return Math.sqrt(squares / (points + 1));
}

function calendarRate(soc: number): number {
  const temperatureK = SCIENTIFIC_MODEL.referenceTemperatureC + 273.15;
  return (PARAMS.qcalAV * voltage(soc) + PARAMS.qcalBV) * 1e6 * Math.exp(PARAMS.qcalCT / temperatureK);
}

function cycleRate(start: number, end: number): number {
  const dod = Math.abs(end - start);
  return PARAMS.qcycAV * (rmsVoltage(start, end) - PARAMS.qcycBV) ** 2
    + PARAMS.qcycC + PARAMS.qcycDDod * dod;
}

function cycleBounds(dod: number): [number, number] {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  const maxStart = 1 - dod;
  for (let index = 0; index <= 100; index += 1) {
    const start = maxStart * index / 100;
    const rate = cycleRate(start, start + dod);
    minimum = Math.min(minimum, rate);
    maximum = Math.max(maximum, rate);
  }
  return [minimum, maximum];
}

function updatePowerState(current: number, amount: number, rate: number, exponent: number): number {
  if (amount <= 0) return current;
  if (current === 0) return rate * amount ** exponent;
  const derivative = rate * exponent * (current / rate) ** ((exponent - 1) / exponent);
  return current + derivative * amount;
}

export function isNmcReferenceCompatible(chemistry: string): boolean {
  return ['NCM', 'NMC', 'NCMA', 'NMCA'].includes(chemistry.trim().toUpperCase());
}

/** One policy for both the equation and the history-eligibility calculation. */
export function scientificSessionStatus(session: ScientificSessionInput, referenceConditions = false): 'SUPPORTED' | 'MISSING_SOC' | 'OUT_OF_RANGE' {
  if (session.startSocPct == null || session.endSocPct == null) return 'MISSING_SOC';
  const numbers = [session.startSocPct, session.endSocPct, session.chargedKwh, session.cRate, session.idleMinutes];
  const invalidTime = (session.startedAt !== undefined || session.endedAt !== undefined)
    && !(Number.isFinite(Date.parse(session.startedAt ?? '')) && Date.parse(session.endedAt ?? '') > Date.parse(session.startedAt ?? ''));
  if (numbers.some(value => !Number.isFinite(value)) || invalidTime
    || session.startSocPct < 0 || session.endSocPct > 100 || session.endSocPct <= session.startSocPct
    || session.chargedKwh <= 0 || session.idleMinutes < 0
    || session.cRate <= 0 || (!referenceConditions && session.cRate > SCIENTIFIC_MODEL.maxChargeCRate)) return 'OUT_OF_RANGE';
  return 'SUPPORTED';
}

/**
 * referenceConditions compares SOC/idle patterns on a hypothetical reference cell.
 * It does NOT extrapolate charging-rate degradation or validate another chemistry.
 * Strict model-domain filtering remains the default for direct callers.
 */
export function calculateScientificScore(sessions: ScientificSessionInput[], referenceConditions = false): ScientificScoreResult {
  let observedCycle = 0;
  let minimumCycle = 0;
  let maximumCycle = 0;
  let observedCalendar = 0;
  let minimumCalendar = 0;
  let maximumCalendar = 0;
  let supportedSessionCount = 0;
  let outOfRangeSessionCount = 0;
  let missingSocSessionCount = 0;

  for (const session of sessions) {
    const status = scientificSessionStatus(session, referenceConditions);
    if (status === 'MISSING_SOC') {
      missingSocSessionCount += 1;
      continue;
    }
    if (status === 'OUT_OF_RANGE') {
      outOfRangeSessionCount += 1;
      continue;
    }
    const start = session.startSocPct! / 100;
    const end = session.endSocPct! / 100;
    supportedSessionCount += 1;
    const dod = end - start;
    // For the 2.15 Ah reference cell, a monotonic SOC rise of `dod` transfers
    // dod × 2.15 Ah. Pack size therefore cannot distort the comparative score.
    const throughput = dod * 2.15;
    const [minCycleRate, maxCycleRate] = cycleBounds(dod);
    observedCycle = updatePowerState(observedCycle, throughput, cycleRate(start, end), PARAMS.qcycP);
    minimumCycle = updatePowerState(minimumCycle, throughput, minCycleRate, PARAMS.qcycP);
    maximumCycle = updatePowerState(maximumCycle, throughput, maxCycleRate, PARAMS.qcycP);

    const idleDays = Math.max(0, session.idleMinutes) / 1_440;
    observedCalendar = updatePowerState(observedCalendar, idleDays, calendarRate(end), PARAMS.qcalP);
    minimumCalendar = updatePowerState(minimumCalendar, idleDays, calendarRate(0), PARAMS.qcalP);
    maximumCalendar = updatePowerState(maximumCalendar, idleDays, calendarRate(1), PARAMS.qcalP);
  }

  const observed = observedCycle + observedCalendar;
  const minimum = minimumCycle + minimumCalendar;
  const maximum = maximumCycle + maximumCalendar;
  const span = maximum - minimum;
  const score = supportedSessionCount > 0 && span > 0
    ? Math.round(clamp((maximum - observed) / span * 100, 0, 100))
    : null;
  return {
    score,
    observedCapacityStress: observed,
    minimumCapacityStress: minimum,
    maximumCapacityStress: maximum,
    cycleStress: { observed: observedCycle, minimum: minimumCycle, maximum: maximumCycle },
    idleStress: { observed: observedCalendar, minimum: minimumCalendar, maximum: maximumCalendar },
    supportedSessionCount,
    outOfRangeSessionCount,
    missingSocSessionCount,
    modelId: SCIENTIFIC_MODEL.id,
    modelLabel: SCIENTIFIC_MODEL.label,
    referenceTemperatureC: SCIENTIFIC_MODEL.referenceTemperatureC,
    limitations: [
      '온도 미제공으로 25°C 표준 조건을 사용합니다.',
      'NMC111/graphite 기준 셀의 상대 스트레스이며 차량 SOH 예측값이 아닙니다.',
      referenceConditions
        ? '1C 초과 충전도 SOC 변화·충전 후 연결 시간만 표준셀에 대입하며, 실제 급속 충전의 열화 영향은 계산하지 않습니다.'
        : '1C 초과·잔량 누락·유효하지 않은 기록은 점수에서 제외하며, 제외한 충전의 스트레스는 평가하지 않습니다.',
      '충전 속도·온도에 따른 사이클 열화 차이를 평가하지 않으며, 0–100점과 부분 평가는 제품의 참고 지표입니다.',
    ],
  };
}
