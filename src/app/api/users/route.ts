import { getUserVehicleOptions } from '@/data/mockVehicles';

export const dynamic = 'force-static';

export function GET(){
  return Response.json({users:getUserVehicleOptions()},{headers:{
    'Cache-Control':'public, s-maxage=86400, stale-while-revalidate=604800',
  }});
}
