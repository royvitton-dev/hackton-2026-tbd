import workbook from './battery/workbook.json';
import { summarizeUser, type RawSession } from '../lib/battery';
import { deriveChargeSession } from '../lib/chargeSessions';
import type { UserVehicleOption } from '../types/vehicle';

const usersById = new Map(workbook.users.map(user => [user.userId, user]));
const vehiclesById = new Map(workbook.vehicles.map(vehicle => [vehicle.vehicleId, vehicle]));
const sessionsByUser = new Map<string, RawSession[]>();
for (const session of workbook.sessions) {
  const sessions = sessionsByUser.get(session.userId);
  if (sessions) sessions.push(session);
  else sessionsByUser.set(session.userId, [session]);
}

// Server-side adapters: the 10,000 raw sessions never enter the client bundle.
export function getUserVehicle(userId:string) {
  const user=usersById.get(userId);
  const vehicle=vehiclesById.get(user?.vehicleId??'');
  if(!user||!vehicle)return null;
  return summarizeUser(user,vehicle,sessionsByUser.get(userId)??[],workbook.rules);
}
export function getMockUserVehicles() {
  return workbook.users.map(user => getUserVehicle(user.userId)!);
}
export function getUserVehicleOptions():UserVehicleOption[] {
  return workbook.users.map(user=>{
    const vehicle=vehiclesById.get(user.vehicleId);
    if(!vehicle)throw new Error(`Unknown vehicle: ${user.vehicleId}`);
    return {userId:user.userId,userName:null,driverProfile:user.driverProfile,vehicle:{
      vehicleId:vehicle.vehicleId,manufacturer:vehicle.manufacturer,model:vehicle.modelName,
      year:vehicle.modelYear,trim:vehicle.trimName,
    }};
  });
}
export function getUserChargeSessions(userId:string){
  const user=usersById.get(userId);
  const vehicle=vehiclesById.get(user?.vehicleId??'');
  if(!user||!vehicle)return null;
  return (sessionsByUser.get(userId)??[]).filter(s=>s.vehicleId===vehicle.vehicleId).map(s=>deriveChargeSession(s,vehicle,workbook.rules)).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt));
}
