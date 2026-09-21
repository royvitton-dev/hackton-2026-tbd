import test from 'node:test';
import assert from 'node:assert/strict';
import { getMockUserVehicles, getUserChargeSessions } from '../src/data/mockVehicles';
import workbook from '../src/data/battery/workbook.json';
import { summarizeUser } from '../src/lib/battery';

test('Every workbook user maps to one vehicle and only their own charge sessions',()=>{
  const users=getMockUserVehicles();assert.equal(users.length,1250);
  assert.equal(new Set(users.map(u=>u.vehicle.vehicleId)).size,20);
  assert.equal(users.reduce((sum,u)=>sum+u.attribution.basisSessionCount,0),10000);
  for(const u of users){
    const raw=workbook.users.find(r=>r.userId===u.userId)!;
    assert.equal(raw.vehicleId,u.vehicle.vehicleId);
    assert.equal(raw.initialOdometerKm,u.initialOdometerKm);
    const sessions=workbook.sessions.filter(s=>s.userId===u.userId);
    const total=sessions.reduce((sum,s)=>sum+s.chargedKwh,0);
    assert.ok(Math.abs(total-u.totalChargedKwh)<1e-8);
    assert.equal(u.estimatedSoh,null);
    assert.ok(u.healthScore===null || u.healthScore>=0&&u.healthScore<=100);
  }
  assert.equal(users.filter(u=>u.healthScore!==null).length,1188);
  assert.equal(users.filter(u=>u.healthScore===null).length,62);
});
test('Known workbook user U0001 has genuine reported SOC and vehicle capacity',()=>{
  const [u]=getMockUserVehicles();assert.equal(u.userId,'U0001');
  assert.ok(Math.abs(u.vehicle.batteryCapacityKwh-59.85)<1e-8);
  assert.equal(u.attribution.basisSessionCount,9);
  assert.equal(u.initialOdometerKm,11194);
  assert.match(u.socSource,/사용자 입력/);
  const a=u.attribution;
  assert.equal(u.healthScore,Math.round(Math.max(0,Math.min(100,100-a.fastChargePenalty-a.ultraChargePenalty-a.longIdlePenalty-a.highSocIdlePenalty-a.highCRatePenalty-a.deepDischargePenalty-a.efcPenalty+a.stableSlowChargeBonus))));
});
test('Insufficient data never becomes a precise health score; missing SOC stays unknown',()=>{
  const user=workbook.users[0],vehicle=workbook.vehicles.find(v=>v.vehicleId===user.vehicleId)!;
  const empty=summarizeUser(user,vehicle,[],workbook.rules);
  assert.equal(empty.healthScore,null);assert.equal(empty.currentSoc,null);assert.equal(empty.grade,'INSUFFICIENT');
  const s={...workbook.sessions[0],userReportedStartSocPct:null,userReportedEndSocPct:null,mockTruthEndSocPct:null,taperDetected:'N'};
  const one=summarizeUser(user,vehicle,[s],workbook.rules);
  assert.equal(one.currentSoc,null);assert.equal(one.attribution.deepDischargePenalty,0);assert.equal(one.healthScore,null);
});
test('Session details are isolated by both user and vehicle; timing and power come from the resource',()=>{
  for(const id of ['U0001','U0002','U0100']){
    const sessions=getUserChargeSessions(id)!;
    const user=workbook.users.find(u=>u.userId===id)!;
    assert.ok(sessions.length>0);
    for(const session of sessions){
      assert.equal(session.userId,id);assert.equal(session.vehicleId,user.vehicleId);
      const raw=workbook.sessions.find(s=>s.sessionId===session.sessionId)!;
      assert.equal(session.chargedKwh,raw.chargedKwh);
      assert.equal(session.startSoc,raw.userReportedStartSocPct);
      assert.equal(session.endSoc,raw.userReportedEndSocPct);
      assert.ok(Math.abs(session.averagePowerKw*session.durationMinutes/60-session.chargedKwh)<1e-8);
    }
  }
  assert.equal(getUserChargeSessions('unknown'),null);
});
