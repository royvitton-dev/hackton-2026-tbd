// Shared by rendering and collision: rotation is about the left door jamb.
export function doorLeaf(door){
 const angle=door.angle||0,open=door.openAngle||0,w=door.width;
 const lx=-w/2+Math.cos(open)*w/2,lz=-Math.sin(open)*w/2;
 return {...door,x:door.x+Math.cos(angle)*lx+Math.sin(angle)*lz,z:door.z-Math.sin(angle)*lx+Math.cos(angle)*lz,depth:door.leafThickness||.06,angle:angle+open};
}
export const STRUCTURE_COLORS=Object.freeze({stairs:'#c46628',door:'#168798',exit:'#198653',lift:'#8363ac',ramp:'#4276bf'});
