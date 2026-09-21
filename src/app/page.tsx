import { VehicleBatteryDashboard } from '@/components/VehicleBatteryDashboard';
import { getMockUserVehicles } from '@/data/mockVehicles';
export default function Page(){return <VehicleBatteryDashboard users={getMockUserVehicles()}/>;}
