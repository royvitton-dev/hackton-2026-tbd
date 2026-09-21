import type { ChargingSession, UserSummary } from './types';

export const STORAGE_KEYS = {
  selectedUser: 'ev_battery_selected_user_v1',
  selectedVehicle: 'ev_battery_selected_vehicle_v1',
  sessions: 'ev_battery_charging_sessions_v1',
  healthState: 'ev_battery_health_state_v1',
  settings: 'ev_battery_settings_v1',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Could not persist ${key}`, error);
  }
}

export const batteryStorage = {
  selectedUser: () => read<string | null>(STORAGE_KEYS.selectedUser, null),
  settings: () => read<{ recentSessionLimit: number }>(STORAGE_KEYS.settings, { recentSessionLimit: 20 }),
  saveSelection(userId: string, vehicleId: string, sessions: ChargingSession[], summary: UserSummary): void {
    write(STORAGE_KEYS.selectedUser, userId);
    write(STORAGE_KEYS.selectedVehicle, vehicleId);
    write(STORAGE_KEYS.sessions, sessions);
    write(STORAGE_KEYS.healthState, { userId, vehicleId, calculatedAt: new Date().toISOString(), summary });
    if (localStorage.getItem(STORAGE_KEYS.settings) === null) {
      write(STORAGE_KEYS.settings, { recentSessionLimit: 20 });
    }
  },
};
