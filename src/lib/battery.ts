import type { UserVehicle, Vehicle, BatteryAttribution } from '../types/vehicle';
import { assessScientificHistory } from '../../battery_health/src/scoreCoverage';

export interface RawVehicle {
  vehicleId: string; manufacturer: string; modelName: string; modelYear: number; trimName: string;
  batteryGrossKwh: number; usableFactor: number; packVoltage: number;
  batteryChemistry: string; maxAcChargeKw: number; maxDcChargeKw: number;
  certifiedRangeKm?: number; efficiencyKmPerKwh?: number; sourceUrl?: string;
}
export interface RawUser { userId: string; vehicleId: string; driverProfile: string; initialSocPct: number; initialOdometerKm?: number }
export interface RawSession {
  sessionId: string; userId: string; vehicleId: string; startedAt: string; endedAt: string; unpluggedAt: string;
  chargerType: string; chargedKwh: number; taperDetected: string;
  stationType?: string; paymentAmountKrw?: number;
  userReportedStartSocPct: number | null; userReportedEndSocPct: number | null;
  mockTruthStartSocPct: number | null; mockTruthEndSocPct: number | null;
}
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const day = 86400000;
export function adaptVehicle(v: RawVehicle): Vehicle {
  return { vehicleId: v.vehicleId, manufacturer: v.manufacturer, model: v.modelName, year: v.modelYear, trim: v.trimName,
    batteryCapacityKwh: v.batteryGrossKwh * v.usableFactor, batteryGrossKwh: v.batteryGrossKwh,
    chemistry: v.batteryChemistry, voltageClass: v.packVoltage >= 550 ? '800V' : v.packVoltage >= 300 ? '400V' : 'LOW',
    maxAcChargeKw:v.maxAcChargeKw,maxDcChargeKw:v.maxDcChargeKw,certifiedRangeKm:v.certifiedRangeKm??null,efficiencyKmPerKwh:v.efficiencyKmPerKwh??null,sourceUrl:v.sourceUrl??null };
}

/** Workbook 05/06 rules. Missing reported SOC is unknown, never coerced to zero. */
export function summarizeUser(user: RawUser, raw: RawVehicle, input: RawSession[], r: Record<string, number>): UserVehicle {
  const vehicle = adaptVehicle(raw);
  const sessions = input.filter(s => s.userId === user.userId && s.vehicleId === user.vehicleId).sort((a,b)=>Date.parse(a.startedAt)-Date.parse(b.startedAt));
  const feature = sessions.map(s => {
    const hours = (Date.parse(s.endedAt)-Date.parse(s.startedAt))/3600000;
    const power = s.chargedKwh/hours;
    const idle = (Date.parse(s.unpluggedAt)-Date.parse(s.endedAt))/60000;
    const startHour = Number(s.startedAt.slice(11,13));
    const fast = s.chargerType !== 'AC_SLOW' || power > raw.maxAcChargeKw*1.3;
    const ultra = s.chargerType === 'ULTRA_FAST' || power >= r.ultra_power_threshold_kw;
    const slowNight = (startHour>=23 || startHour<7) && power <= raw.maxAcChargeKw*1.3;
    const longIdle = idle >= r.long_idle_threshold_min;
    const taper = s.taperDetected === 'Y' || (s.userReportedEndSocPct !== null && s.userReportedEndSocPct>=97);
    const anchor = s.userReportedStartSocPct !== null || s.userReportedEndSocPct !== null;
    const highSoc = (s.userReportedEndSocPct !== null && s.userReportedEndSocPct>=r.high_end_soc_threshold_pct) || taper;
    const deep = s.userReportedStartSocPct !== null && s.userReportedStartSocPct<r.deep_start_soc_threshold_pct;
    const highC = power/vehicle.batteryCapacityKwh>=r.high_c_rate_threshold;
    const issue = hours<=0 || s.chargedKwh<=0 || (s.chargerType==='AC_SLOW' ? power>raw.maxAcChargeKw*1.6 : power>raw.maxDcChargeKw*1.3);
    const startSoc = s.mockTruthStartSocPct ?? s.userReportedStartSocPct;
    const endSoc = s.mockTruthEndSocPct ?? s.userReportedEndSocPct;
    return {s,fast,ultra,slowNight,longIdle,taper,anchor,highSocIdle:highSoc&&longIdle,deep,highC,issue,power,idle,startSoc,endSoc};
  });
  const count = feature.length;
  const countWhere = (key: 'fast'|'ultra'|'slowNight'|'longIdle'|'taper'|'anchor'|'highSocIdle'|'deep'|'highC'|'issue') => feature.filter(f=>f[key]).length;
  const ratio = (key: 'fast'|'ultra'|'slowNight'|'highC') => count ? countWhere(key)/count : 0;
  const end = sessions.at(-1)?.endedAt ?? null;
  const period = count ? (Date.parse(end!)-Date.parse(sessions[0].startedAt))/day : 0;
  const efc = sessions.reduce((sum,s)=>sum+s.chargedKwh,0)/vehicle.batteryCapacityKwh;
  const assessment = assessScientificHistory(feature.map((item) => ({
    startedAt: item.s.startedAt,
    endedAt: item.s.endedAt,
    unpluggedAt: item.s.unpluggedAt,
    startSocPct: item.startSoc,
    endSocPct: item.endSoc,
    usesReferenceSoc: item.s.mockTruthStartSocPct != null || item.s.mockTruthEndSocPct != null,
    chargedKwh: item.s.chargedKwh,
    cRate: item.power / vehicle.batteryCapacityKwh,
    idleMinutes: item.idle,
  })), vehicle.chemistry, vehicle.batteryCapacityKwh, r);
  const { scientific, eligibleFlag: eligible } = assessment;
  const attribution: BatteryAttribution = {
    fastChargePenalty: 0, ultraChargePenalty: 0, longIdlePenalty: 0,
    highSocIdlePenalty: 0, highCRatePenalty: 0, deepDischargePenalty: 0,
    efcPenalty: 0, stableSlowChargeBonus: 0,
    recentHabitDegradation: null, basisSessionCount: count, basisPeriodDays: period,
    scoreModelId: scientific.modelId, scoreModelLabel: scientific.modelLabel,
    referenceTemperatureC: scientific.referenceTemperatureC,
    modelSupportedSessionCount: assessment.modelSupportedSessionCount,
    modelOutOfRangeSessionCount: assessment.modelOutOfRangeSessionCount,
    modelMissingSocSessionCount: scientific.missingSocSessionCount,
    scoreSessionCount: scientific.supportedSessionCount,
    scoreExcludedSessionCount: assessment.excludedSessionCount,
    scoreObservationDays: assessment.observationDays,
    scoreEstimatedEfc: assessment.estimatedEfc,
    scoreScope: assessment.scoreScope,
    scorePolicyId: assessment.scorePolicyId,
    referenceReasons: assessment.referenceReasons,
    modeledCapacityStress: scientific.observedCapacityStress,
    scoreExplanation: assessment.scoreExplanation,
    scoreEvidence: assessment.scoreEvidence,
    scoreLimitations: scientific.limitations,
  };
  const score = eligible ? scientific.score : null;
  const confidence = Math.round(Math.min(100,
    Math.min(r.soc_conf_sessions_weight,count/r.minimum_sessions_required*r.soc_conf_sessions_weight)+
    Math.min(r.soc_conf_days_weight,period/r.minimum_period_days*r.soc_conf_days_weight)+
    Math.min(r.soc_conf_anchor_weight,(countWhere('taper')+countWhere('anchor'))/2*r.soc_conf_anchor_weight)+
    Math.max(0,r.soc_conf_quality_weight-countWhere('issue')*5)));
  const cutoff = end ? Date.parse(end)-30*day : 0;
  const recent = feature.filter(f=>Date.parse(f.s.endedAt)>cutoff);
  const last = sessions.at(-1);
  const reported = last?.userReportedEndSocPct;
  const truth = last?.mockTruthEndSocPct;
  const soc = reported ?? truth ?? null;
  const habits = [ratio('fast')>0.5 ? '급속·초급속 충전 비중이 높습니다. 일상 충전은 완속 위주로 분산하세요.' : ratio('slowNight')>=0.4 ? '심야 완속 충전 비중이 높습니다. 현재의 안정적인 습관을 유지하세요.' : '완속·심야 충전 비중을 조금 더 높여 보세요.',
    countWhere('highSocIdle')>0 ? '고SOC 상태에서 장시간 연결한 기록이 있습니다. 충전 완료 후 분리해 주세요.' : countWhere('deep')>0 ? '20% 미만으로 내려가기 전에 충전을 시작해 보세요.' : '20~80% 범위를 중심으로 운용하면 안정적입니다.'];
  return { userId:user.userId,userName:null,driverProfile:user.driverProfile,vehicle,
    initialOdometerKm:user.initialOdometerKm??null,totalChargedKwh:sessions.reduce((sum,s)=>sum+s.chargedKwh,0),latestChargedKwh:last?.chargedKwh??null,latestChargerType:last?.chargerType??null,
    healthScore:score,estimatedSoh:null,currentSoc:soc,socSource:reported!=null?'사용자 입력 · 마지막 충전 종료':truth!=null?'Mock truth · 마지막 충전 종료':'SOC 데이터 없음',socAsOf:end,
    confidence,grade:score===null?'INSUFFICIENT':assessment.scoreScope==='REFERENCE'?'REFERENCE':assessment.scoreScope==='PARTIAL'?'PARTIAL':confidence<60?'LOW_CONFIDENCE':score>=85?'EXCELLENT':score>=75?'GOOD':score>=60?'CAUTION':'RISK',
    sessions30d:recent.length,fastChargeRatio30d:recent.length?recent.filter(f=>f.fast).length/recent.length:0,
    highSocIdleCount30d:recent.filter(f=>f.highSocIdle).length,
    deepDischargeCount30d:recent.filter(f=>f.deep).length,averageChargedKwh30d:recent.length?recent.reduce((sum,f)=>sum+f.s.chargedKwh,0)/recent.length:0,
    nightSlowRatio:ratio('slowNight'),slowCount:count-countWhere('fast'),fastCount:countWhere('fast')-countWhere('ultra'),ultraCount:countWhere('ultra'),
    windowStart:end?new Date(cutoff).toISOString():'',windowEnd:end??'',observationDays:period,efc,
    chargingHabitSummary:habits,attribution,
    insufficientReason:eligible?null:assessment.insufficientReasons.join(' · ') };
}
