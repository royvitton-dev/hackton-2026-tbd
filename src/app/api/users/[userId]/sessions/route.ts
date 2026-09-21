import { getUserChargeSessions } from '@/data/mockVehicles';
export async function GET(_request:Request,{params}:{params:Promise<{userId:string}>}){
  const {userId}=await params;
  const sessions=getUserChargeSessions(userId);
  if(!sessions)return Response.json({error:'사용자를 찾을 수 없습니다.'},{status:404});
  return Response.json({userId,sessions});
}
