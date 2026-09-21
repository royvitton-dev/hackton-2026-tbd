export interface Vehicle {
  vehicleId: string; manufacturer: string; model: string; year: number; trim: string;
  batteryCapacityKwh: number; batteryGrossKwh: number; chemistry: string; voltageClass: string;
  maxAcChargeKw: number; maxDcChargeKw: number; certifiedRangeKm: number | null; efficiencyKmPerKwh: number | null; sourceUrl: string | null;
}
export interface BatteryAttribution {
  fastChargePenalty: number; ultraChargePenalty: number; longIdlePenalty: number;
  highSocIdlePenalty: number; highCRatePenalty: number; deepDischargePenalty: number;
  efcPenalty: number; stableSlowChargeBonus: number; recentHabitDegradation: number | null;
  basisSessionCount: number; basisPeriodDays: number;
}
export interface UserVehicle {
  initialOdometerKm: number | null; totalChargedKwh: number; latestChargedKwh: number | null; latestChargerType: string | null;
  userId: string; userName: string | null; driverProfile: string; vehicle: Vehicle;
  healthScore: number | null; estimatedSoh: number | null; currentSoc: number | null;
  socSource: string; socAsOf: string | null; confidence: number; grade: string;
  sessions30d: number; fastChargeRatio30d: number; highSocIdleCount30d: number;
  deepDischargeCount30d: number; averageChargedKwh30d: number; nightSlowRatio: number; slowCount: number; fastCount: number; ultraCount: number;
  windowStart: string; windowEnd: string; observationDays: number; efc: number;
  chargingHabitSummary: string[]; attribution: BatteryAttribution; insufficientReason: string | null;
}
export interface ChargeSession {
  sessionId: string; userId: string; vehicleId: string; startedAt: string; endedAt: string; unpluggedAt: string;
  chargerType: string; stationType: string | null; chargedKwh: number; paymentAmountKrw: number | null;
  durationMinutes: number; idleMinutes: number; averagePowerKw: number; estimatedCRate: number;
  startSoc: number | null; endSoc: number | null; socSource: string;
  isFast: boolean; isHighSocIdle: boolean; isDeepDischarge: boolean; isNightSlow: boolean;
}
export interface VehicleImage {
  vehicleId: string; manufacturer: string; model: string; year: number;
  imagePath: string; cutoutImagePath: string; resourceOriginalPath: string; resourceCutoutPath: string;
  imageSourceUrl: string; license: string; licenseUrl: string; author: string; representativeNote: string;
  glbPath: string | null; renderMode: 'glb' | 'unavailable'; depthLayerCount: number; extrusionDepth: number;
  modelDisplayNote: string | null;
  downloaded: boolean; cutoutGenerated: boolean; failureReason: string | null;
  batteryHotspot: { x: number; y: number; width: number; height: number };
}
