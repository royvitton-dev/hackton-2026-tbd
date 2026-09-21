import {parkingManeuverRoute} from './core/maneuver.js';
self.onmessage=({data})=>{
 try{self.postMessage({route:parkingManeuverRoute(data.plan,data.startId,data.spaceId,data.options)});}
 catch(error){self.postMessage({error:error.message});}
};
