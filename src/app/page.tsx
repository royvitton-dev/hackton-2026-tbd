import { VehicleBatteryDashboard } from '@/components/VehicleBatteryDashboard';
import { getUserVehicle } from '@/data/mockVehicles';
export default function Page(){return <VehicleBatteryDashboard initialUser={getUserVehicle('U0001')!}/>;}
