import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { IDOLS, TILES, level, type GameState } from './engine';

export type BoardHandle = { reset: () => void; zoom: (amount: number) => void; overhead: () => void };
type Props = { state: GameState; selected: number | null; onTile: (index: number) => void };
export function tilePosition(index: number): [number, number] {
  const step = 2.2;
  if (index <= 6) return [(3 - index) * step, 3 * step];
  if (index <= 12) return [-3 * step, (9 - index) * step];
  if (index <= 18) return [(index - 15) * step, -3 * step];
  return [3 * step, (index - 21) * step];
}
function textTexture(text: string, sub: string, bg: string, color = '#ffffff', size = 512) {
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  ctx.font = `800 ${text.length > 6 ? size * .11 : size * .18}px Arial, sans-serif`;
  ctx.fillText(text, size / 2, size * .49);
  ctx.globalAlpha = .75; ctx.font = `500 ${size * .065}px Arial, sans-serif`; ctx.fillText(sub, size / 2, size * .7);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function photoTexture(url: string, color: string, textures: Set<THREE.Texture>, isDisposed: () => boolean) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(128, 128, 125, 0, Math.PI * 2); ctx.fill();
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
  const photo = new Image(); photo.src = url;
  photo.onload = () => {
    if (isDisposed()) return;
    ctx.save(); ctx.beginPath(); ctx.arc(128, 128, 114, 0, Math.PI * 2); ctx.clip();
    const width = photo.naturalWidth; const height = Math.min(photo.naturalHeight, width);
    ctx.drawImage(photo, 0, 0, width, height, 14, 14, 228, 228); ctx.restore(); texture.needsUpdate = true;
  };
  return texture;
}
const BoardScene = forwardRef<BoardHandle, Props>(function BoardScene({ state, selected, onTile }, ref) {
  const mount = useRef<HTMLDivElement>(null);
  const current = useRef({ state, selected, onTile }); current.current = { state, selected, onTile };
  const api = useRef<BoardHandle>({ reset() {}, zoom() {}, overhead() {} });
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  useImperativeHandle(ref, () => ({ reset: () => api.current.reset(), zoom: n => api.current.zoom(n), overhead: () => api.current.overhead() }), []);
  useEffect(() => {
    const host = mount.current!; let disposed = false; let frame = 0;
    const textures = new Set<THREE.Texture>();
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
    host.appendChild(renderer.domElement); renderer.domElement.setAttribute('aria-label', '회전과 확대가 가능한 3D 연예기획사 보드');
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-15, 15, 10, -10, .1, 150);
    const defaultPosition = new THREE.Vector3(17, 24, 26); camera.position.copy(defaultPosition);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, .3, 0); controls.enableDamping = true; controls.dampingFactor = .08; controls.enablePan = false;
    controls.minPolarAngle = .1; controls.maxPolarAngle = Math.PI / 2.5; controls.minZoom = .65; controls.maxZoom = 1.8;
    controls.update();
    api.current = {
      reset: () => { camera.position.copy(defaultPosition); camera.zoom = 1; camera.updateProjectionMatrix(); controls.target.set(0, .3, 0); controls.update(); },
      zoom: n => { camera.zoom = Math.max(.65, Math.min(1.8, camera.zoom + n)); camera.updateProjectionMatrix(); },
      overhead: () => { camera.position.set(.01, 35, .01); controls.update(); },
    };
    scene.add(new THREE.HemisphereLight('#ddd8ff', '#484068', 2.6));
    const key = new THREE.DirectionalLight('#fff4e7', 4.5); key.position.set(-8, 18, 10); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -13; key.shadow.camera.right = 13; key.shadow.camera.top = 13; key.shadow.camera.bottom = -13; key.shadow.normalBias = .04; key.shadow.bias = -.0003; scene.add(key);
    const rim = new THREE.DirectionalLight('#ae95ff', 3); rim.position.set(10, 9, -12); scene.add(rim);
    const fill = new THREE.PointLight('#80ffe0', 25, 20); fill.position.set(0, 4, 3); scene.add(fill);
    function material(color: string, metalness = .05) { return new THREE.MeshStandardMaterial({ color, roughness: .52, metalness }); }
    function box(w: number, h: number, d: number, color: string, x: number, y: number, z: number, parent: THREE.Object3D = scene, radius = .08) {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, h / 3)), material(color));
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    }
    function cylinder(top: number, bottom: number, height: number, color: string, x: number, y: number, z: number, parent: THREE.Object3D = scene) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 48), material(color, .18)); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    }
    function sphere(radius: number, color: string, x: number, y: number, z: number, parent: THREE.Object3D = scene) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material(color)); mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
    }
    function planeLabel(label: string, subtitle: string, bg: string, color: string, width: number, height: number, parent: THREE.Object3D = scene) {
      const texture = textTexture(label, subtitle, bg, color); textures.add(texture);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })); parent.add(mesh); return mesh;
    }
    // A floating, softly lit game table with individually raised spaces.
    box(17.6, .75, 17.6, '#645581', 0, -.3, 0, scene, .32);
    box(17.5, .12, 17.5, '#ba9fe8', 0, .1, 0, scene, .3);
    box(17.3, .28, 17.3, '#aea0cb', 0, .26, 0, scene, .28);
    box(11, .08, 11, '#827798', 0, .44, 0, scene, .2);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .22 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.2; ground.receiveShadow = true; scene.add(ground);
    const tileMeshes: THREE.Mesh[] = [];
    TILES.forEach((tile, i) => {
      const [x, z] = tilePosition(i); const corner = i % 6 === 0;
      const tileMesh = box(2.04, .26, 2.04, '#e7dcf1', x, .56, z, scene, .09); tileMesh.userData.tile = i; tileMeshes.push(tileMesh);
      box(1.99, .035, .3, tile.color, x, .709, z - .84, scene, .02);
      const label = planeLabel(tile.name, tile.subtitle, corner ? tile.color : '#e7dcf1', '#4a355e', 1.84, 1.65); label.position.set(x, .716, z + .05); label.rotation.x = -Math.PI / 2;
      label.userData.tile = i; tileMeshes.push(label);
      if (corner) { const pip = sphere(.09, '#ffffff', x - .78, .85, z - .78); pip.castShadow = false; }
    });
    // Dashed pedestrian lanes around the inner city.
    for (let i = -4; i <= 4; i++) {
      box(.3, .012, .045, '#c7b7dd', i, .497, 4.9);
      box(.3, .012, .045, '#c7b7dd', i, .497, -4.9);
      box(.045, .012, .3, '#c7b7dd', -4.9, .497, i);
      box(.045, .012, .3, '#c7b7dd', 4.9, .497, i);
    }
    function building(name: string, x: number, z: number, color: string, height: number, rotation = 0) {
      const group = new THREE.Group(); group.position.set(x, .5, z); group.rotation.y = rotation; scene.add(group);
      box(1.75, .18, 1.6, '#d5c4e6', 0, .09, 0, group);
      box(1.48, height, 1.25, color, 0, height / 2 + .15, 0, group, .12);
      box(1.65, .18, 1.44, '#eee4f8', 0, height + .2, 0, group);
      box(.95, .15, .8, color, 0, height + .34, 0, group);
      for (let floor = 0; floor < Math.floor(height / .5); floor++) for (let col = -1; col <= 1; col++) {
        box(.26, .25, .015, '#f1eafb', col * .41, .68 + floor * .48, .636, group, .01);
        box(.018, .25, .25, '#b9c6ea', .747, .68 + floor * .48, col * .34, group, .01);
      }
      box(.4, .48, .03, '#6c6287', 0, .42, .65, group, .02);
      const sign = planeLabel(name, 'ENTERTAINMENT', color, '#49305c', 1.22, .78, group); sign.position.set(0, height + .72, .07);
      box(1.32, .82, .08, '#eee4f8', 0, height + .72, 0, group);
      box(.04, .5, .04, '#eee4f8', -.45, height + .4, 0, group); box(.04, .5, .04, '#eee4f8', .45, height + .4, 0, group);
    }
    building('SM', -3.55, -3.65, '#c3a5e6', 2.55, .12);
    building('JYP', .1, -3.9, '#95d4c7', 2.05);
    building('HYBE', 3.55, -3.65, '#d2c8ef', 2.9, -.15);
    building('YG', -3.85, .3, '#e4a5c8', 1.65, .7);
    building('CUBE', 3.8, .45, '#b6c1e9', 1.8, -.6);
    building('STARSHIP', -3.65, 3.8, '#d8b4df', 1.2, .3);
    function tree(x: number, z: number, color = '#8fbfaf') {
      cylinder(.22, .28, .25, '#d5cae4', x, .58, z); cylinder(.06, .07, .5, '#887585', x, .9, z);
      sphere(.32, color, x, 1.25, z); sphere(.24, color, x + .13, 1.5, z);
    }
    [[-4.5,-2],[-4.5,2],[4.5,2],[2,4.45],[4.4,4.4],[-1.9,-4.4],[2,-4.4],[-2,4.4]].forEach(([x,z],i) => tree(x,z, i % 2 ? '#b7a3d6' : '#a1c9b5'));
    // Central concert stage, glowing arch, speakers and a dimensional star.
    cylinder(3.02, 3.12, .25, '#77658c', .1, .67, .5);
    cylinder(2.9, 2.9, .08, '#ddc0f5', .1, .84, .5);
    cylinder(2.72, 2.72, .16, '#b097d0', .1, .94, .5);
    box(3.2, .14, .7, '#c8b1e2', .1, .65, 3.05); box(2.6, .12, .6, '#d8c5eb', .1, .54, 3.52);
    const backdrop = box(4.1, 2.15, .25, '#655277', .1, 2.08, -.65, scene, .18);
    const backdropLabel = planeLabel('DEBUT : ON', 'YOUR NEXT STAGE', '#463656', '#f2e1ff', 3.84, 1.94); backdropLabel.position.set(.1, 2.1, -.508);
    for (const x of [-2.18, 2.38]) {
      box(.17, 3.35, .17, '#d4b9e7', x, 2.57, -.75);
      for (const y of [1.3, 2.25, 3.35]) sphere(.08, '#fff2c1', x, y, -.62);
      box(.64, 1.13, .62, '#655471', x, 1.55, .45);
      for (const y of [1.27, 1.76]) { const speaker = cylinder(.19, .19, .06, '#342d43', 0, 0, 0); speaker.rotation.x = Math.PI / 2; speaker.position.set(x, y, .79); }
    }
    box(4.75, .18, .18, '#e0c7f2', .1, 4.2, -.75);
    for (let i = 0; i < 7; i++) sphere(.075, i % 2 ? '#b0ffe7' : '#ffdbf0', -1.7 + i * .6, 4.07, -.7);
    backdrop.castShadow = false;
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const angle = i * Math.PI / 5 + Math.PI / 2; const r = i % 2 ? .37 : .82; const x = Math.cos(angle) * r; const y = Math.sin(angle) * r; if (!i) shape.moveTo(x,y); else shape.lineTo(x,y); } shape.closePath();
    const star = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .22, bevelEnabled: true, bevelSize: .06, bevelThickness: .05, bevelSegments: 2, steps: 1 }), new THREE.MeshStandardMaterial({ color: '#ffe0a0', metalness: .5, roughness: .25, emissive: '#f2a03f', emissiveIntensity: .14 }));
    star.position.set(.1, 2.25, 1.5); star.castShadow = true; scene.add(star);
    const starBase = cylinder(.65, .85, .25, '#f2dba6', .1, 1.14, 1.5); starBase.castShadow = false;
    const floating: THREE.Mesh[] = [];
    for (let i = 0; i < 16; i++) { const mesh = sphere(.027 + i % 3 * .012, i % 2 ? '#dab7ff' : '#ffe6bd', Math.sin(i * 2.4) * 3.2, 1.7 + (i % 5) * .5, Math.cos(i * 2.4) * 2.5); mesh.userData.baseY = mesh.position.y; floating.push(mesh); }
    // Photo-textured pawn portraits remain camera facing while the miniature bodies grow.
    const pawns: THREE.Group[] = []; const portraits: THREE.Sprite[] = [];
    for (let i = 0; i < 4; i++) {
      const group = new THREE.Group(); scene.add(group); pawns.push(group);
      const idol = IDOLS[i]; group.userData.idol = i;
      cylinder(.36, .45, .17, idol.color, 0, .15, 0, group);
      cylinder(.19, .3, .48, idol.color, 0, .44, 0, group);
      sphere(.21, '#fde0d1', 0, .89, 0, group);
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: photoTexture(idol.image, idol.color, textures, () => disposed), transparent: true, depthTest: true }));
      badge.scale.set(.88, .88, 1); badge.position.set(0, 1.28, 0); group.add(badge); portraits.push(badge);
      for (const side of [-1, 1]) { const arm = cylinder(.065, .065, .3, '#fde0d1', side * .23, .55, 0, group); arm.rotation.z = side * .2; }
      const [x,z] = tilePosition(0); group.position.set(x + (i % 2 - .5) * .66, .79, z + (Math.floor(i / 2) - .5) * .66);
    }
    const activeRing = new THREE.Mesh(new THREE.RingGeometry(.55, .63, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .95, side: THREE.DoubleSide })); activeRing.rotation.x = -Math.PI / 2; scene.add(activeRing);
    const highlight = new THREE.Mesh(new THREE.RingGeometry(.94, 1.01, 4), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: .9 })); highlight.rotation.x = -Math.PI / 2; highlight.rotation.z = Math.PI / 4; scene.add(highlight);
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let down = { x: 0, y: 0 };
    const onDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; };
    const onUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(tileMeshes)[0]; if (hit) current.current.onTile(hit.object.userData.tile);
    };
    renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp);
    const loseContext = (event: Event) => { event.preventDefault(); setError(true); };
    renderer.domElement.addEventListener('webglcontextlost', loseContext);
    const resize = () => {
      const w = host.clientWidth; const h = host.clientHeight; if (!w || !h) return;
      const aspect = w / h; const halfHeight = Math.max(9, 13 / aspect);
      camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix(); renderer.setSize(w,h);
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    let lastTime = 0;
    function animate(time: number) {
      if (disposed) return; frame = requestAnimationFrame(animate);
      const t = time * .001; const delta = Math.min((time - lastTime) / 1000, .1); lastTime = time;
      const s = current.current.state;
      pawns.forEach((pawn, i) => {
        const player = s.players[i]; pawn.visible = !!player; if (!player) return;
        const idol = IDOLS[player.idol];
        if (pawn.userData.idol !== player.idol) {
          portraits[i].material.map = photoTexture(idol.image, idol.color, textures, () => disposed); portraits[i].material.needsUpdate = true;
          pawn.userData.idol = player.idol;
          pawn.children.slice(0,2).forEach(child => { ((child as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(idol.color); });
        }
        const [x,z] = tilePosition(player.position); const peers = s.players.filter(p => p.position === player.position); const offset = peers.findIndex(p => p.id === i);
        const dx = peers.length > 1 ? (offset % 2 - .5) * .7 : 0; const dz = peers.length > 2 ? (Math.floor(offset / 2) - .5) * .7 : 0;
        const moving = Math.hypot(pawn.position.x - x - dx, pawn.position.z - z - dz) > .08;
        pawn.position.x = THREE.MathUtils.damp(pawn.position.x, x + dx, 12, delta); pawn.position.z = THREE.MathUtils.damp(pawn.position.z, z + dz, 12, delta);
        pawn.position.y = .79 + (moving ? Math.abs(Math.sin(t * 17)) * .35 : Math.sin(t * 2 + i) * .025);
        pawn.scale.setScalar(1 + Math.min(level(player) - 1, 8) * .035);
      });
      const active = pawns[s.active]; activeRing.position.set(active.position.x, .79, active.position.z); activeRing.scale.setScalar(1 + Math.sin(t * 4) * .06);
      (activeRing.material as THREE.MeshBasicMaterial).color.set(IDOLS[s.players[s.active].idol].color);
      highlight.visible = current.current.selected !== null;
      if (highlight.visible) { const [x,z] = tilePosition(current.current.selected!); highlight.position.set(x,.76,z); }
      star.rotation.y = Math.sin(t * .7) * .25; star.position.y = 2.28 + Math.sin(t * 1.5) * .12;
      floating.forEach((mesh,i) => { mesh.position.y = mesh.userData.baseY + Math.sin(t * 1.15 + i) * .08; });
      controls.update(); renderer.render(scene,camera);
    }
    frame = requestAnimationFrame(animate); setReady(true);
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown',onDown); renderer.domElement.removeEventListener('pointerup',onUp); renderer.domElement.removeEventListener('webglcontextlost',loseContext);
      const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
      scene.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.geometry) geometries.add(mesh.geometry); if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => materials.add(m)); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <div ref={mount} className="board-canvas" data-ready={ready} data-webgl={!error}>
    {error && <div className="webgl-fallback"><strong>간편 보드 모드</strong><p>이 환경에서 3D 그래픽을 사용할 수 없어 2D 보드로 전환했어요.</p><div className="fallback-tiles">{TILES.map((t,i) => <button key={i} onClick={() => onTile(i)} style={{ borderColor: t.color }}><b>{t.name}</b><small>{state.players.filter(p => p.position === i).map(p => p.name).join(' · ') || t.subtitle}</small></button>)}</div></div>}
  </div>;
});
export default BoardScene;
