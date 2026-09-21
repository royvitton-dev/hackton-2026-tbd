import workbook from './battery/workbook.json';
import { summarizeUser, type RawSession } from '../lib/battery';
import { deriveChargeSession } from '../lib/chargeSessions';
// Server-side adapter: the 10,000 raw sessions never enter the client bundle.
export function getMockUserVehicles() {
  const byUser = new Map<string, RawSession[]>();
  for (const s of workbook.sessions) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);
  return workbook.users.map(user => {
    const vehicle = workbook.vehicles.find(v=>v.vehicleId===user.vehicleId);
    if (!vehicle) throw new Error(`Unknown vehicle: ${user.vehicleId}`);
    return summarizeUser(user, vehicle, byUser.get(user.userId) ?? [], workbook.rules);
  });
}
export function getUserChargeSessions(userId:string){
  const user=workbook.users.find(u=>u.userId===userId);
  const vehicle=workbook.vehicles.find(v=>v.vehicleId===user?.vehicleId);
  if(!user||!vehicle)return null;
  return workbook.sessions.filter(s=>s.userId===userId&&s.vehicleId===vehicle.vehicleId).map(s=>deriveChargeSession(s,vehicle,workbook.rules)).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt));
}
