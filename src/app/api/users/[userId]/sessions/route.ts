import { getUserChargeSessions } from '@/data/mockVehicles';

// Keep the large mock workbook in one server function instead of emitting a
// separate static response for every demo user during each deployment.
export const dynamic = 'force-dynamic';

export async function GET(_request:Request,{params}:{params:Promise<{userId:string}>}){
  const {userId}=await params;
  const sessions=getUserChargeSessions(userId);
  if(!sessions)return Response.json({error:'사용자를 찾을 수 없습니다.'},{status:404});
  return Response.json({userId,sessions},{headers:{
    'Cache-Control':'public, s-maxage=86400, stale-while-revalidate=604800',
  }});
}
