import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import type { MetricKey } from './health';
import { createBodyFlow } from './microAnatomy';

type Ellipsoid = { x: number; y: number; z: number; a: number; b: number; c: number; rotation?: number };
let cachedSkinGeometry: THREE.BufferGeometry | undefined;

function createSkin() {
  const shapes: Ellipsoid[] = [
    { x: 0, y: 2.48, z: -.025, a: .295, b: .385, c: .275 },
    { x: 0, y: 2.32, z: .085, a: .226, b: .255, c: .212 },
    { x: 0, y: 2.34, z: .266, a: .055, b: .094, c: .07 },
    { x: 0, y: 1.995, z: -.012, a: .16, b: .27, c: .17 },
    { x: 0, y: 1.69, z: -.015, a: .59, b: .26, c: .27 },
    { x: 0, y: 1.36, z: .006, a: .57, b: .52, c: .305 },
    { x: 0, y: .87, z: 0, a: .41, b: .42, c: .25 },
    { x: 0, y: .48, z: -.013, a: .465, b: .36, c: .29 },
    { x: 0, y: .25, z: -.025, a: .38, b: .2, c: .235 },
  ];
  for (const sign of [-1, 1]) {
    shapes.push(
      { x: sign * .284, y: 2.418, z: -.003, a: .046, b: .078, c: .049 },
      { x: sign * .57, y: 1.64, z: 0, a: .235, b: .29, c: .25 },
      { x: sign * .742, y: 1.225, z: -.005, a: .186, b: .425, c: .195, rotation: sign * .21 },
      { x: sign * .851, y: .87, z: .018, a: .135, b: .17, c: .14 },
      { x: sign * .917, y: .595, z: .025, a: .147, b: .335, c: .147, rotation: sign * .2 },
      { x: sign * .993, y: .28, z: .026, a: .089, b: .17, c: .10, rotation: sign * .15 },
      { x: sign * 1.03, y: .075, z: .04, a: .112, b: .195, c: .076, rotation: sign * .14 },
      { x: sign * .927, y: .044, z: .055, a: .043, b: .12, c: .047, rotation: sign * -.25 },
      { x: sign * .265, y: -.165, z: -.012, a: .25, b: .58, c: .255, rotation: sign * -.04 },
      { x: sign * .285, y: -.63, z: -.008, a: .206, b: .405, c: .214 },
      { x: sign * .3, y: -1.005, z: .015, a: .157, b: .18, c: .17 },
      { x: sign * .3, y: -1.405, z: -.045, a: .179, b: .39, c: .185 },
      { x: sign * .307, y: -1.795, z: -.02, a: .126, b: .365, c: .132 },
      { x: sign * .308, y: -2.097, z: 0, a: .095, b: .16, c: .115 },
      { x: sign * .311, y: -2.222, z: .117, a: .128, b: .113, c: .255 },
    );
    for (let i = 0; i < 4; i++) shapes.push({ x: sign * (.977 + i * .035), y: -.121 - Math.sin(i / 3 * Math.PI) * .033, z: .035, a: .024, b: .113 - Math.abs(1.5 - i) * .014, c: .029, rotation: sign * (i - 1) * .055 });
  }
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, opacity: { value: .55 } },
    vertexShader: `varying vec3 vNormal; varying vec3 vWorld; void main(){vNormal=normalize(mat3(modelMatrix)*normal);vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec3 vNormal; varying vec3 vWorld; uniform float time; uniform float opacity; void main(){vec3 n=normalize(vNormal);vec3 view=normalize(cameraPosition-vWorld);float rim=pow(1.0-abs(dot(n,view)),2.2);float light=max(0.0,dot(n,normalize(vec3(-2.0,3.0,3.0))));float bands=pow(.5+.5*sin(vWorld.y*95.0),16.0)*.018;vec3 color=vec3(.52,.76,.69)*(.32+light*.52)+vec3(.65,.96,.81)*rim*.72;gl_FragColor=vec4(color,clamp((.22+rim*.72+bands)*opacity,0.0,1.0));}`,
    transparent: true, depthWrite: false, side: THREE.FrontSide,
  });
  if (cachedSkinGeometry) {
    const cached = new THREE.Mesh(cachedSkinGeometry.clone(), material);
    cached.scale.setScalar(3.05);
    return cached;
  }
  const resolution = 100;
  const skin = new MarchingCubes(resolution, material, false, false, 150000);
  skin.isolation = 0;
  skin.scale.setScalar(3.05);
  const prepared = shapes.map(s => ({ ...s, sin: Math.sin(s.rotation ?? 0), cos: Math.cos(s.rotation ?? 0) }));
  for (let z = 0; z < resolution; z++) for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
    const px = (x / resolution * 2 - 1) * 3.05;
    const py = (y / resolution * 2 - 1) * 3.05;
    const pz = (z / resolution * 2 - 1) * 3.05;
    let distance = 10;
    for (const s of prepared) {
      const dx = px - s.x, dy = py - s.y, dz = pz - s.z;
      if (Math.abs(dx) > s.a + s.b * Math.abs(s.sin) + .22 || Math.abs(dy) > s.b + .22 || Math.abs(dz) > s.c + .22) continue;
      const xx = (dx * s.cos + dy * s.sin) / s.a;
      const yy = (-dx * s.sin + dy * s.cos) / s.b;
      const zz = dz / s.c;
      const k0 = Math.sqrt(xx * xx + yy * yy + zz * zz);
      const k1 = Math.sqrt(xx * xx / (s.a * s.a) + yy * yy / (s.b * s.b) + zz * zz / (s.c * s.c));
      const d = k0 * (k0 - 1) / Math.max(k1, .00001);
      const h = Math.max(.085 - Math.abs(distance - d), 0) / .085;
      distance = Math.min(distance, d) - h * h * .085 * .25;
    }
    skin.field[z * resolution * resolution + y * resolution + x] = -distance;
  }
  skin.update();
  const geometry = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) {
    const attribute = skin.geometry.getAttribute(name);
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(attribute.array.slice(0, skin.count * 3), 3));
  }
  geometry.computeBoundingSphere();
  cachedSkinGeometry = geometry;
  skin.geometry.dispose();
  const mesh = new THREE.Mesh(geometry.clone(), material);
  mesh.scale.setScalar(3.05);
  return mesh;
}

export function createAnatomy() {
  const group = new THREE.Group();
  const skeleton = new THREE.Group();
  const softTissue = new THREE.Group();
  group.add(skeleton, softTissue);
  const skin = createSkin();
  group.add(skin);
  const surface = new THREE.Mesh(skin.geometry, new THREE.MeshPhysicalMaterial({ color: '#bc9780', roughness: .63, metalness: 0, clearcoat: .08, clearcoatRoughness: .65 }));
  surface.scale.copy(skin.scale); group.add(surface);
  const wire = new THREE.Mesh(skin.geometry, new THREE.MeshBasicMaterial({ color: '#b3e8d5', wireframe: true, transparent: true, opacity: .009, depthWrite: false }));
  wire.scale.copy(skin.scale);
  group.add(wire);
  const bone = new THREE.MeshStandardMaterial({ color: '#ded7be', roughness: .7 });
  const organs: Partial<Record<MetricKey, THREE.Group>> = {};
  const clickable: THREE.Object3D[] = [];
  const sphere = (parent: THREE.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material, key?: MetricKey) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 20), mat);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh);
    if (key) { mesh.userData.metric = key; clickable.push(mesh); }
    return mesh;
  };
  const tube = (parent: THREE.Object3D, points: number[][], radius: number, mat: THREE.Material, key?: MetricKey) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number])));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, radius, 6, false), mat);
    parent.add(mesh);
    if (key) { mesh.userData.metric = key; clickable.push(mesh); }
    return mesh;
  };
  // A stylized, illustrative skeleton. It is not a diagnostic anatomical model.
  for (let i = 0; i < 25; i++) {
    sphere(skeleton, 0, .15 + i * .082, -.12, .062, .033, .055, bone);
    sphere(skeleton, 0, .15 + i * .082, -.18, .028, .023, .044, bone);
  }
  sphere(skeleton,0,2.49,-.025,.255,.305,.235,bone);
  sphere(skeleton,0,2.29,.065,.17,.13,.17,bone);
  const cavity = new THREE.MeshStandardMaterial({color:'#3c3e30',roughness:1});
  for(const sign of [-1,1]) {
    sphere(skeleton,sign*.09,2.43,.188,.065,.052,.036,cavity);
    tube(skeleton,[[sign*.17,2.27,.035],[sign*.16,2.17,.10],[sign*.085,2.14,.18],[0,2.14,.20]],.027,bone);
    for(let i=0;i<5;i++) sphere(skeleton,sign*(.025+i*.025),2.205,.195-i*.008,.014,.025,.016,bone);
  }
  sphere(skeleton,0,2.325,.218,.024,.038,.022,cavity);
  tube(skeleton,[[0,1.59,.25],[0,1.26,.26],[0,1.01,.24]],.024,bone);
  tube(skeleton,[[0,1.79,-.12],[0,2.12,-.12],[0,2.23,-.075]],.024,bone);
  for (const sign of [-1, 1]) {
    tube(skeleton, [[0, 1.66, .075], [sign * .18, 1.68, .12], [sign * .46, 1.66, .06], [sign * .57, 1.59, 0]], .026, bone);
    for (let i = 0; i < 12; i++) {
      const yy = 1.59 - i * .067;
      const width = .24 + Math.sin((i + 1) / 14 * Math.PI) * .18;
      const points = [[0, yy, -.1], [sign * width * .82, yy + .012, -.18], [sign * width, yy - .03, -.02], [sign * width * .7, yy - .085, .20]];
      if(i<10)points.push([sign*.025,yy-.10,.255]);
      tube(skeleton, points, .014, bone);
    }
    tube(skeleton, [[sign * .19, .30, -.03], [sign * .32, .37, -.04], [sign * .40, .18, .02], [sign * .23, .04, .05], [sign * .07, .16, .045]], .05, bone);
    tube(skeleton, [[sign * .265, .1, 0], [sign * .3, -.55, 0], [sign * .3, -.94, 0]], .044, bone);
    tube(skeleton, [[sign * .3, -1.08, 0], [sign * .295, -1.6, 0], [sign * .31, -2.1, .03]], .028, bone);
    tube(skeleton, [[sign * .34, -1.08, -.015], [sign * .35, -1.6, -.01], [sign * .34, -2.1, .03]], .013, bone);
    tube(skeleton, [[sign * .59, 1.58, 0], [sign * .83, .87, 0]], .028, bone);
    tube(skeleton, [[sign * .84, .85, .01], [sign * .995, .28, .04]], .02, bone);
    tube(skeleton, [[sign * .89, .83, .01], [sign * 1.035, .28, .04]], .014, bone);
    sphere(skeleton, sign * .3, -1.015, .08, .1, .10, .045, bone);
    sphere(skeleton,sign*.59,1.58,0,.07,.07,.07,bone);
    sphere(skeleton,sign*.265,.11,0,.065,.065,.065,bone);
    for(let i=0;i<4;i++) {
      tube(skeleton,[[sign*(.98+i*.035),.23,.04],[sign*(.98+i*.035),.04,.04],[sign*(.98+i*.035),-.17+Math.abs(i-1.5)*.02,.04]],.012,bone);
      tube(skeleton,[[sign*(.25+i*.038),-2.11,.02],[sign*(.25+i*.038),-2.2,.15],[sign*(.25+i*.038),-2.22,.32-i*.02]],.017,bone);
    }
  }
  const lungMat = new THREE.MeshStandardMaterial({ color: '#799c90', emissive: '#40665a', emissiveIntensity: .17, transparent: true, opacity: .16, roughness: .8, depthWrite: false });
  for (const sign of [-1, 1]) {
    const lung = sphere(softTissue, sign * .238, 1.315, -.005, .19, .34, .16, lungMat);
    lung.rotation.z = sign * -.13;
    tube(softTissue, [[0, 1.92, .04], [0, 1.50, .04], [sign * .17, 1.36, .08], [sign * .28, 1.13, .08]], .025, bone);
  }
  const organMaterial = () => new THREE.MeshStandardMaterial({ color: '#b6ebcc', emissive: '#7eb99a', emissiveIntensity: .4, metalness: .17, roughness: .37, transparent: true, opacity: .88 });
  const heart = new THREE.Group(); organs.bloodPressure = heart; group.add(heart);
  const heartMat = organMaterial();
  sphere(heart, .135, 1.33, .225, .10, .125, .08, heartMat, 'bloodPressure');
  sphere(heart, .035, 1.34, .22, .07, .09, .07, heartMat, 'bloodPressure');
  const tip = sphere(heart, .118, 1.24, .22, .092, .135, .085, heartMat, 'bloodPressure'); tip.rotation.z = -.38;
  tube(heart, [[.075, 1.4, .22], [.06, 1.53, .15], [.16, 1.55, .1], [.18, 1.42, .04]], .034, heartMat, 'bloodPressure');
  const vessels = new THREE.Group(); organs.cholesterol = vessels; group.add(vessels);
  const vesselMat = organMaterial();
  tube(vessels, [[.035, 1.54, .09], [0, 1.2, .09], [-.025, .77, .09], [0, .38, .09]], .022, vesselMat, 'cholesterol');
  for (const sign of [-1, 1]) {
    tube(vessels, [[0, 1.59, .07], [sign * .35, 1.62, .06], [sign * .63, 1.42, .065], [sign * .86, .78, .07], [sign * .98, .3, .08]], .01, vesselMat, 'cholesterol');
    tube(vessels, [[0, .39, .07], [sign * .20, .20, .08], [sign * .28, -.55, .07], [sign * .3, -1.15, .08], [sign * .30, -1.9, .04]], .012, vesselMat, 'cholesterol');
    tube(vessels, [[0, 1.56, .04], [sign * .09, 1.83, .045], [sign * .11, 2.16, .08]], .012, vesselMat, 'cholesterol');
  }
  const liver = new THREE.Group(); organs.liver = liver; group.add(liver);
  const liverMat = organMaterial();
  const liverShape = new THREE.Shape();
  liverShape.moveTo(-.40, .94);
  liverShape.bezierCurveTo(-.44, 1.07, -.22, 1.11, -.08, 1.045);
  liverShape.bezierCurveTo(.015, 1.025, .19, 1.045, .22, .99);
  liverShape.bezierCurveTo(.21, .945, .04, .92, -.065, .835);
  liverShape.bezierCurveTo(-.19, .77, -.38, .805, -.40, .94);
  const liverMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(liverShape, { depth: .095, bevelEnabled: true, bevelThickness: .045, bevelSize: .018, bevelSegments: 4, steps: 1, curveSegments: 16 }), liverMat);
  liverMesh.position.z = .115; liverMesh.userData.metric = 'liver'; liver.add(liverMesh); clickable.push(liverMesh);
  const pancreas = new THREE.Group(); organs.glucose = pancreas; group.add(pancreas);
  const pancreasMat = organMaterial();
  for (let i = 0; i < 6; i++) sphere(pancreas, -.07 + i * .046, .755 + i * .014, .182, .065 - i * .004, .036, .055, pancreasMat, 'glucose');
  const kidneys = new THREE.Group(); organs.uricAcid = kidneys; group.add(kidneys);
  const kidneyMat = organMaterial();
  for (const sign of [-1, 1]) {
    const kidney = sphere(kidneys, sign * .269, .684, -.015, .079, .13, .072, kidneyMat, 'uricAcid'); kidney.rotation.z = sign * .2;
  }
  const gutMat = new THREE.MeshStandardMaterial({ color: '#668b7b', emissive: '#335546', transparent: true, opacity: .18, depthWrite: false });
  const gutPoints: number[][] = [];
  for (let i = 0; i < 70; i++) gutPoints.push([Math.sin(i / 69 * Math.PI * 9) * .20, .64 - i / 69 * .29, .16 + Math.cos(i / 69 * Math.PI * 9) * .015]);
  tube(softTissue, gutPoints, .024, gutMat);
  const flow = createBodyFlow(); group.add(flow.group);
  return { group, skin, surface, wire, skeleton, softTissue, bone, organs, clickable, flow };
}
