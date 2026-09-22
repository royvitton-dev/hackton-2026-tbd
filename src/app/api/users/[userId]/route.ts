import { getUserVehicle } from '@/data/mockVehicles';

export const dynamic = 'force-dynamic';

export async function GET(_request:Request,{params}:{params:Promise<{userId:string}>}){
  const {userId}=await params;
  const user=getUserVehicle(userId);
  if(!user)return Response.json({error:'사용자를 찾을 수 없습니다.'},{status:404});
  return Response.json({user},{headers:{
    'Cache-Control':'public, s-maxage=86400, stale-while-revalidate=604800',
  }});
}
