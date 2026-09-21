import {parkingManeuverRoute} from './core/maneuver.js';
import {parkingCoverage} from './core/route-coverage.js';
self.onmessage=({data})=>{
 try{self.postMessage({route:data.task==='coverage'?parkingCoverage(data.plan,data.options):parkingManeuverRoute(data.plan,data.startId,data.spaceId,data.options)});}
 catch(error){self.postMessage({error:error.message});}
};
