import type { ScoreExplanation } from './scoreExplanation';
import type { ScoreEvidence } from './scoreNarrative';

export type ChargerType = 'AC_SLOW' | 'DC_FAST' | 'ULTRA_FAST';

export interface Vehicle {
  vehicleId: string;
  manufacturer: string;
  modelName: string;
  modelYear: number;
  trimName: string;
  batteryGrossKwh: number;
  usableFactor: number;
  batteryUsableKwh: number;
  batteryChemistry: string;
  packVoltage: number;
  packVoltageClass: string;
  maxAcChargeKw: number;
  maxDcChargeKw: number;
  certifiedRangeKm: number;
  efficiencyKmPerKwh: number;
  sourceUrl: string;
  dataConfidence: string;
}

export interface UserProfile {
  userId: string;
  vehicleId: string;
  driverProfile: string;
  initialSocPct: number;
  initialOdometerKm: number;
  mockStartDate: string;
  mockEndDate: string;
  plannedSessions: number;
  profileNote: string;
}

export interface ChargingSession {
  sessionId: string;
  userId: string;
  vehicleId: string;
  chargedKwh: number;
  startedAt: string;
  endedAt: string;
  unpluggedAt: string;
  chargerType: ChargerType;
  paymentAmountKrw: number;
  stationType: string;
  taperDetected: string;
  userReportedStartSocPct: number | null;
  userReportedEndSocPct: number | null;
  mockTruthStartSocPct: number | null;
  mockTruthEndSocPct: number | null;
  note: string;
}

export interface ScoreRule {
  parameter: string;
  value: number;
  unit: string;
  category: string;
  basis: string;
  sourceUrl: string;
}

export interface Guide {
  category: string;
  criteria: string;
  message: string;
  algorithm: string;
}

export interface VehicleImage {
  vehicleId: string;
  imagePath: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  author: string;
  representativeNote: string;
}

export interface SessionFeature extends ChargingSession {
  chargingDurationMinutes: number;
  idleMinutes: number;
  avgPowerKw: number;
  deltaSocPct: number;
  cRate: number;
  chargerClass: ChargerType;
  isNightCharge: boolean;
  isLongIdle: boolean;
  isShortTopup: boolean;
  isHighC: boolean;
  isDeepDischarge: boolean;
  isHighSocEnd: boolean;
  isHighSocIdle: boolean;
  hasSocAnchor: boolean;
  dataIssue: boolean;
}

export type ScoreGrade = 'EXCELLENT' | 'GOOD' | 'CAUTION' | 'RISK' | 'LOW_CONFIDENCE' | 'INSUFFICIENT' | 'PARTIAL' | 'REFERENCE';

export interface UserSummary {
  sessionCount: number;
  observationDays: number;
  totalChargedKwh: number;
  estimatedEfc: number;
  fastChargeRatio: number;
  ultraFastChargeRatio: number;
  slowChargeRatio: number;
  nightSlowChargeRatio: number;
  longIdleCount: number;
  highSocIdleCount: number;
  deepDischargeCount: number;
  avgCRate: number;
  maxCRate: number;
  socAnchorCount: number;
  dataCompletenessScore: number;
  eligibleFlag: boolean;
  insufficientReasons: string[];
  socConfidenceScore: number;
  batteryCareScore: number | null;
  scoreModelId: string;
  scoreModelLabel: string;
  referenceTemperatureC: number;
  modelSupportedSessionCount: number;
  modelOutOfRangeSessionCount: number;
  modelMissingSocSessionCount: number;
  scoreSessionCount: number;
  scoreExcludedSessionCount: number;
  scoreObservationDays: number;
  scoreEstimatedEfc: number;
  scoreScope: 'FULL' | 'PARTIAL' | 'REFERENCE' | 'NONE';
  scorePolicyId: string;
  referenceReasons: string[];
  modeledCapacityStress: number;
  scoreExplanation: ScoreExplanation | null;
  scoreEvidence: ScoreEvidence;
  scoreLimitations: string[];
  grade: ScoreGrade;
  goodHabits: string[];
  cautions: string[];
  nextActions: string[];
}
