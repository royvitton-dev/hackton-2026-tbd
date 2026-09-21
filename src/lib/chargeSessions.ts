import type { ChargeSession } from '../types/vehicle';
import type { RawSession, RawVehicle } from './battery';

export function deriveChargeSession(s:RawSession,vehicle:RawVehicle,rules:Record<string,number>):ChargeSession{
  const durationMinutes=(Date.parse(s.endedAt)-Date.parse(s.startedAt))/60000;
  const idleMinutes=Math.max(0,(Date.parse(s.unpluggedAt)-Date.parse(s.endedAt))/60000);
  const averagePowerKw=durationMinutes>0?s.chargedKwh/(durationMinutes/60):0;
  const hour=Number(s.startedAt.slice(11,13));
  return {sessionId:s.sessionId,userId:s.userId,vehicleId:s.vehicleId,startedAt:s.startedAt,endedAt:s.endedAt,unpluggedAt:s.unpluggedAt,
    chargerType:s.chargerType,stationType:s.stationType??null,chargedKwh:s.chargedKwh,paymentAmountKrw:s.paymentAmountKrw??null,
    durationMinutes,idleMinutes,averagePowerKw,estimatedCRate:averagePowerKw/(vehicle.batteryGrossKwh*vehicle.usableFactor),
    startSoc:s.userReportedStartSocPct,endSoc:s.userReportedEndSocPct,socSource:'사용자 입력 SOC · 미입력 값은 표시하지 않음',
    isFast:s.chargerType!=='AC_SLOW'||averagePowerKw>vehicle.maxAcChargeKw*1.3,
    isHighSocIdle:((s.userReportedEndSocPct!==null&&s.userReportedEndSocPct>=rules.high_end_soc_threshold_pct)||s.taperDetected==='Y')&&idleMinutes>=rules.long_idle_threshold_min,
    isDeepDischarge:s.userReportedStartSocPct!==null&&s.userReportedStartSocPct<rules.deep_start_soc_threshold_pct,
    isNightSlow:(hour>=23||hour<7)&&averagePowerKw<=vehicle.maxAcChargeKw*1.3};
}
