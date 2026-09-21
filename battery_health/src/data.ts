import type { ChargingSession, Guide, ScoreRule, UserProfile, Vehicle, VehicleImage } from './types';

export interface BatteryData {
  vehicles: Vehicle[];
  rules: ScoreRule[];
  users: UserProfile[];
  sessions: ChargingSession[];
  guides: Guide[];
  vehicleImages: VehicleImage[];
}

async function json<T>(name: string): Promise<T> {
  const response = await fetch(`./data/battery/${name}`);
  if (!response.ok) throw new Error(`${name} 로드 실패 (${response.status})`);
  return response.json() as Promise<T>;
}

export async function loadBatteryData(): Promise<BatteryData> {
  const [vehicles, rules, users, sessions, guides, vehicleImages] = await Promise.all([
    json<Vehicle[]>('vehicleMaster.json'),
    json<ScoreRule[]>('scoreRules.json'),
    json<UserProfile[]>('mockUsers.json'),
    json<ChargingSession[]>('mockChargingSessions.json'),
    json<Guide[]>('guides.json'),
    json<VehicleImage[]>('vehicleImages.json'),
  ]);
  return { vehicles, rules, users, sessions, guides, vehicleImages };
}
