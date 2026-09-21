import * as THREE from 'three';
import type { AnatomyFocus } from './clinical';

const vector = (point: number[]) => new THREE.Vector3(point[0], point[1], point[2]);
export function anatomyTube(parent: THREE.Object3D, points: number[][], radius: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points.map(vector));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 9, false), material);
  parent.add(mesh);
  return { mesh, curve };
}
function ellipsoid(parent: THREE.Object3D, position: number[], scale: number[], material: THREE.Material, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, 24), material);
  mesh.position.copy(vector(position)); mesh.scale.copy(vector(scale)); parent.add(mesh); return mesh;
}
export function createFlow(paths: number[][][], radius = .017, count = 12, opacity = .8) {
  const group = new THREE.Group();
  const colors = ['#e58278', '#79bce8'];
  const tracks = paths.map((points, index) => {
    const color = colors[index % 2];
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .24 });
    const { curve } = anatomyTube(group, points, radius * .48, material);
    const particleMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
    const particles = new THREE.InstancedMesh(new THREE.SphereGeometry(radius, 8, 6), particleMaterial, count);
    particles.frustumCulled = false; group.add(particles);
    return { curve, particles };
  });
  const dummy = new THREE.Object3D();
  return { group, update: (time: number, bpm = 72) => {
    const pulse = 1 + Math.sin(time * Math.PI * 2 * bpm / 60) * .12;
    for (const { curve, particles } of tracks) {
      for (let i = 0; i < count; i++) {
        dummy.position.copy(curve.getPointAt((i / count + time * .065) % 1));
        dummy.scale.setScalar(pulse); dummy.updateMatrix(); particles.setMatrixAt(i, dummy.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;
    }
  } };
}
export function createBodyFlow() {
  return createFlow([
    [[.1,1.36,.32],[.12,1.56,.28],[-.04,1.48,.30],[-.055,.8,.3],[-.18,.3,.20],[-.3,-.8,.17],[-.3,-1.95,.16]],
    [[-.34,-1.95,.14],[-.35,-.9,.15],[-.22,.25,.2],[-.11,.95,.28],[-.1,1.3,.27]],
    [[.07,1.5,.28],[.4,1.62,.2],[.66,1.37,.16],[.88,.75,.15],[1.02,.22,.11]],
    [[1.06,.22,.08],[.91,.78,.12],[.7,1.43,.16],[.43,1.67,.2],[-.08,1.36,.29]],
    [[-.03,.53,.29],[.19,.2,.2],[.29,-.8,.15],[.31,-1.95,.14]],
    [[.35,-1.95,.12],[.35,-.9,.12],[.23,.2,.15],[-.1,1.25,.23]],
    [[-.23,1.46,.08],[-.13,1.37,.2],[.13,1.32,.28]],
    [[-.04,1.34,.27],[-.17,1.48,.14],[-.25,1.56,.01]],
  ]);
}

export function createKidneyDetail() {
  const group = new THREE.Group();
  const outer = new THREE.MeshPhysicalMaterial({ color: '#a45f51', roughness: .5, metalness: .02, clearcoat: .35 });
  const cortexMat = new THREE.MeshStandardMaterial({ color: '#b77768', roughness: .8 });
  const innerMat = new THREE.MeshStandardMaterial({ color: '#d8a398', roughness: .67 });
  const pelvisMat = new THREE.MeshStandardMaterial({ color: '#e9d0a0', roughness: .5 });
  const arteryMat = new THREE.MeshStandardMaterial({ color: '#cc615b', emissive: '#8c2920', emissiveIntensity: .12, roughness: .38 });
  const veinMat = new THREE.MeshStandardMaterial({ color: '#6c9caf', roughness: .38 });
  const geometry = new THREE.SphereGeometry(1, 64, 48, Math.PI, Math.PI);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    positions.setXYZ(i, x * .69 - (x > 0 ? .32 * Math.exp(-y * y * 8) : 0), y, z * .43);
  }
  geometry.computeVertexNormals();
  const shell = new THREE.Mesh(geometry, outer); group.add(shell);
  const bean = new THREE.Shape(); bean.moveTo(.40, .82);
  bean.bezierCurveTo(.1, 1.17, -.76, 1.11, -.74, .1);
  bean.bezierCurveTo(-.78, -.74, -.37, -1.14, .17, -.96);
  bean.bezierCurveTo(.53, -.79, .55, -.4, .33, -.18);
  bean.bezierCurveTo(.14, -.04, .16, .15, .32, .29);
  bean.bezierCurveTo(.52, .45, .55, .63, .40, .82);
  const face = new THREE.Mesh(new THREE.ShapeGeometry(bean, 48), cortexMat); face.position.z = .023; group.add(face);
  const medulla = new THREE.Mesh(new THREE.ShapeGeometry(bean, 48), innerMat); medulla.scale.set(.79, .82, 1); medulla.position.set(-.055, 0, .03); group.add(medulla);
  for (let i = 0; i < 7; i++) {
    const angle = Math.PI * .3 + i / 6 * Math.PI * 1.37;
    const center = new THREE.Vector3(-.05 + Math.cos(angle) * .38, Math.sin(angle) * .66, .10);
    const toward = new THREE.Vector3(.16, 0, .12).sub(center).normalize();
    const pyramid = new THREE.Mesh(new THREE.ConeGeometry(.135, .33, 3, 1), new THREE.MeshStandardMaterial({ color: i % 2 ? '#a86159' : '#bc7970', roughness: .78 }));
    pyramid.position.copy(center); pyramid.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), toward); group.add(pyramid);
    anatomyTube(group, [[.17,0,.15],[center.x*.68,center.y*.7,.16],[center.x,center.y,.16]], .025, pelvisMat);
  }
  ellipsoid(group, [.16,-.06,.12], [.11,.22,.09], pelvisMat);
  anatomyTube(group, [[.19,.015,.16],[.32,-.2,.15],[.41,-.6,.12],[.38,-1.35,.08]], .061, pelvisMat);
  anatomyTube(group, [[.24,.23,.13],[.6,.22,.12],[.92,.39,.04]], .066, arteryMat);
  anatomyTube(group, [[.23,.07,.20],[.63,.05,.17],[.99,.15,.05]], .085, veinMat);
  const flow = createFlow([
    [[.97,.39,.12],[.6,.23,.20],[.20,.23,.21],[-.18,.55,.23],[-.46,.25,.24]],
    [[-.48,-.16,.24],[-.18,-.05,.24],[.21,.08,.27],[.65,.05,.25],[1.0,.15,.16]],
  ], .026, 9);
  group.add(flow.group);
  return { group, flow, highlight: outer, cortex: cortexMat, medulla: innerMat };
}

export function createHeartDetail() {
  const group = new THREE.Group();
  const pulseGroup = new THREE.Group(); group.add(pulseGroup);
  const muscle = new THREE.MeshPhysicalMaterial({ color: '#a7554c', roughness: .4, clearcoat: .38 });
  const artery = new THREE.MeshStandardMaterial({ color: '#ce6d61', roughness: .45 });
  const vein = new THREE.MeshStandardMaterial({ color: '#698ea9', roughness: .45 });
  const left = ellipsoid(pulseGroup, [.17,-.12,0], [.36,.63,.34], muscle); left.rotation.z = -.26;
  const right = ellipsoid(pulseGroup, [-.19,-.06,.06], [.29,.47,.30], muscle); right.rotation.z = -.10;
  ellipsoid(pulseGroup, [.2,.48,-.08], [.25,.23,.24], muscle);
  ellipsoid(pulseGroup, [-.27,.41,.01], [.21,.27,.23], muscle);
  anatomyTube(pulseGroup, [[.03,.42,.05],[.02,.94,-.04],[.25,1.08,-.11],[.49,.87,-.13],[.47,.4,-.15]], .11, artery);
  anatomyTube(pulseGroup, [[-.14,.44,.21],[-.09,.77,.28],[-.41,.81,.23],[-.68,.7,.08]], .095, vein);
  anatomyTube(pulseGroup, [[-.33,.32,.0],[-.41,.77,-.03],[-.44,1.11,-.07]], .09, vein);
  for (const x of [.1,.25,.38]) anatomyTube(pulseGroup, [[x,.96,-.08],[x-.025,1.30,-.09]], .045, artery);
  for (const sign of [-1,1]) {
    anatomyTube(pulseGroup, [[.04,.40,.34],[sign*.20,.15,.34],[sign*.18,-.19,.34],[sign*.12,-.47,.27]], .017, artery);
    anatomyTube(pulseGroup, [[sign*.18,.1,.33],[sign*.33,-.04,.30],[sign*.36,-.18,.26]], .012, artery);
  }
  const flow = createFlow([
    [[.08,-.40,.40],[.08,.25,.40],[.02,.8,.19],[.28,1.1,.04],[.48,.83,-.02],[.49,.33,-.06]],
    [[-.44,1.12,.02],[-.42,.69,.08],[-.27,.34,.32],[-.16,.12,.37],[-.10,.72,.35],[-.66,.70,.18]],
  ], .029, 11);
  group.add(flow.group);
  return { group, pulseGroup, flow, highlight: muscle };
}

function redCellGeometry() {
  const geometry = new THREE.SphereGeometry(1, 32, 24);
  const position = geometry.getAttribute('position');
  for (let i=0; i<position.count; i++) {
    const x=position.getX(i), y=position.getY(i), z=position.getZ(i);
    const radius=Math.sqrt(x*x+z*z);
    position.setXYZ(i, x, y*(.15+.40*radius*radius), z);
  }
  geometry.computeVertexNormals(); return geometry;
}
export function createCellView(focus: AnatomyFocus) {
  const group = new THREE.Group();
  const cells: THREE.Group[] = [];
  const blood = focus === 'bloodPressure' || focus === 'cholesterol';
  const membraneMaterial = new THREE.MeshPhysicalMaterial({ color: '#9bbcab', transparent: true, opacity: .25, roughness: .18, metalness: .02, side: THREE.DoubleSide, depthWrite: false, clearcoat: .6 });
  const nucleusMat = new THREE.MeshStandardMaterial({ color: '#b0a1cd', emissive: '#61596f', emissiveIntensity: .16, roughness: .42 });
  const mitochondriaMat = new THREE.MeshStandardMaterial({ color: '#d9a172', roughness: .38 });
  const bloodMat = new THREE.MeshPhysicalMaterial({ color: '#b85953', roughness: .46, clearcoat: .30 });
  const redGeometry = blood ? redCellGeometry() : null;
  for (let i=0; i<7; i++) {
    const cell = new THREE.Group();
    const renal=focus==='uricAcid';
    const angle=renal?i/7*Math.PI*2:i*Math.PI/3;
    const radius=renal?1.02:i===0?0:1.23;
    cell.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius*(renal?.93:.81),!renal&&i===0?.30:-.15-Math.abs(Math.sin(angle))*.12);
    const scale=renal?.49:i===0?.82:.53+(i%3)*.04; cell.scale.setScalar(scale);
    if (blood) {
      const mesh = new THREE.Mesh(redGeometry!, bloodMat); mesh.rotation.set(.65+i*.37, .16*i, i*.21); cell.add(mesh);
    } else {
      ellipsoid(cell,[0,0,0],[1,.87,.64],membraneMaterial);
      const edge = new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshBasicMaterial({ color:'#c0dbc6',wireframe:true,transparent:true,opacity:.04,depthWrite:false })); edge.scale.set(1,.87,.64); cell.add(edge);
      ellipsoid(cell,[-.06,.05,.05],[.31,.30,.28],nucleusMat);
      ellipsoid(cell,[-.075,.045,.28],[.078,.077,.068],new THREE.MeshStandardMaterial({color:'#ddbdd7',roughness:.7}));
      for(let j=0;j<7;j++) {
        const a=j/7*Math.PI*2;
        const mitochondrion = new THREE.Mesh(new THREE.CapsuleGeometry(.045,.15,5,10),mitochondriaMat);
        mitochondrion.position.set(Math.cos(a)*.62,Math.sin(a)*.49,.20+Math.sin(a*3)*.12); mitochondrion.rotation.z=a; cell.add(mitochondrion);
      }
      for(let j=0;j<19;j++) { const a=j*2.4; ellipsoid(cell,[Math.cos(a)*(.37+(j%4)*.1),Math.sin(a)*(.30+(j%4)*.075),Math.cos(a*2)*.3],[.012,.012,.012],nucleusMat,8); }
    }
    group.add(cell); cells.push(cell);
  }
  if(focus==='uricAcid'){
    const lumen=new THREE.Mesh(new THREE.CylinderGeometry(.52,.52,.7,40,1,true),new THREE.MeshPhysicalMaterial({color:'#9ed6c8',transparent:true,opacity:.10,side:THREE.DoubleSide,depthWrite:false,roughness:.6}));
    lumen.rotation.x=Math.PI/2;lumen.position.z=-.26;group.add(lumen);
  }
  const capillaryMat = new THREE.MeshStandardMaterial({color:'#689d9a',transparent:true,opacity:.14,roughness:.6,depthWrite:false});
  anatomyTube(group,[[-2,-1.4,-.4],[-1.1,-1.13,-.3],[0,-1.40,-.4],[1.2,-1.10,-.3],[2,-1.3,-.4]],.16,capillaryMat);
  const flow=createFlow([[[-2,-1.4,-.35],[-1.1,-1.13,-.25],[0,-1.4,-.35],[1.2,-1.1,-.25],[2,-1.3,-.35]]],.036,13,.9);group.add(flow.group);
  return {group,cells,flow,membraneMaterial,blood,update:(time:number)=>{cells.forEach((cell,i)=>{cell.rotation.y=Math.sin(time*.16+i)*.12;cell.rotation.z=Math.sin(time*.12+i)*.055;});}};
}
