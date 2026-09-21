// assets/wonder/park-source/castle.js
import * as THREE2 from "three";

// assets/wonder/park-source/materials.js
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
var cache = /* @__PURE__ */ new Map();
function material(color, options = {}) {
  const key = color + JSON.stringify(options);
  if (!cache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.72, ...options });
    m.userData.shared = true;
    cache.set(key, m);
  }
  return cache.get(key);
}
var boxGeometry = new THREE.BoxGeometry(1, 1, 1);
var sphereGeometry = new THREE.SphereGeometry(1, 16, 12);
var cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 24);
for (const g of [boxGeometry, sphereGeometry, cylinderGeometry]) g.userData.shared = true;
function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, typeof mat === "string" ? material(mat) : mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(parent, w, h, d, color, x = 0, y = 0, z = 0) {
  const m = mesh(parent, boxGeometry, color, x, y, z);
  m.scale.set(w, h, d);
  return m;
}
function rounded(parent, w, h, d, r, color, x = 0, y = 0, z = 0) {
  return mesh(parent, new RoundedBoxGeometry(w, h, d, 2, r), color, x, y, z);
}
function sphere(parent, xr, yr, zr, color, x = 0, y = 0, z = 0) {
  const m = mesh(parent, sphereGeometry, color, x, y, z);
  m.scale.set(xr, yr, zr);
  return m;
}
function cyl(parent, r, h, color, x = 0, y = 0, z = 0, top = r) {
  const m = mesh(parent, top === r ? cylinderGeometry : new THREE.CylinderGeometry(top, r, h, 32), color, x, y, z);
  if (top === r) m.scale.set(r, h, r);
  return m;
}
function cone(parent, r, h, color, x = 0, y = 0, z = 0) {
  return mesh(parent, new THREE.ConeGeometry(r, h, 32), color, x, y, z);
}
function torus(parent, r, t, color, x = 0, y = 0, z = 0) {
  return mesh(parent, new THREE.TorusGeometry(r, t, 8, 48), color, x, y, z);
}
function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
function seeded(seed = 42) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    return state / 4294967296;
  };
}
function texture(type) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d");
  const rand = seeded(61);
  if (type === "stone") {
    c.fillStyle = "#d2c2a5";
    c.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 32) for (let x = -64; x < 512; x += 64) {
      const xx = x + y / 32 % 2 * 32;
      c.fillStyle = `hsl(39 24% ${72 + rand() * 12}%)`;
      c.fillRect(xx + 1, y + 1, 62, 30);
    }
  } else if (type === "roof") {
    c.fillStyle = "#347184";
    c.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 20) for (let x = -20; x < 512; x += 28) {
      c.fillStyle = `hsl(${188 + rand() * 8} 36% ${25 + rand() * 18}%)`;
      c.fillRect(x + y / 20 % 2 * 14, y, 27, 18);
    }
  } else if (type === "grass") {
    c.fillStyle = "#789262";
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 6e4; i++) {
      c.fillStyle = `hsla(${74 + rand() * 30},${20 + rand() * 25}%,${25 + rand() * 30}%,.35)`;
      c.fillRect(rand() * 512, rand() * 512, 1 + rand() * 2, 1 + rand() * 4);
    }
  } else {
    c.fillStyle = "#e1d5bc";
    c.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 64) for (let x = 0; x < 512; x += 64) {
      c.strokeStyle = "#cabea5";
      c.strokeRect(x + 1, y + 1, 62, 62);
    }
    for (let i = 0; i < 15e3; i++) {
      c.fillStyle = `rgba(100,80,50,${rand() * 0.09})`;
      c.fillRect(rand() * 512, rand() * 512, 2, 2);
    }
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(type === "grass" ? 12 : 3, type === "grass" ? 12 : 3);
  t.anisotropy = 8;
  return t;
}
function textSign(parent, text, w, h, color = "#f7e8bc", background = "#244c46", x = 0, y = 0, z = 0, maxFontSize = 90) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = Math.round(1024 * h / w);
  const c = canvas.getContext("2d");
  c.fillStyle = background;
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.strokeStyle = color;
  c.lineWidth = 5;
  c.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  c.fillStyle = color;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `600 ${Math.min(maxFontSize, canvas.height * 0.5)}px Georgia, serif`;
  c.fillText(text, 512, canvas.height / 2, 940);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return mesh(parent, new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, roughness: 0.65 }), x, y, z);
}
function arch(parent, w, h, depth, color, x, y, z) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-w / 2, h - w / 2);
  s.absarc(0, h - w / 2, w / 2, Math.PI, 0, true);
  s.lineTo(w / 2, 0);
  s.closePath();
  return mesh(parent, new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 12 }), color, x, y, z);
}
function staticBatch(root) {
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const batches = /* @__PURE__ */ new Map(), originals = [];
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    let p = o;
    while (p && p !== root) {
      if (p.userData.dynamic) return;
      p = p.parent;
    }
    const key = o.material.uuid;
    if (!batches.has(key)) batches.set(key, { material: o.material, geometries: [] });
    const g = o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
    batches.get(key).geometries.push(g);
    originals.push(o);
  });
  for (const o of originals) o.removeFromParent();
  for (const { material: mat, geometries } of batches.values()) {
    const normalized = geometries.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      for (const key of Object.keys(n.attributes)) if (!["position", "normal", "uv"].includes(key)) n.deleteAttribute(key);
      if (!n.attributes.uv) n.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
      return n;
    });
    const merged = mergeGeometries(normalized);
    if (merged) {
      merged.userData.shared = false;
      mesh(root, merged, mat);
    }
    for (const g of /* @__PURE__ */ new Set([...geometries, ...normalized])) g.dispose();
  }
  for (const geometry of new Set(originals.map((o) => o.geometry))) if (!geometry.userData.shared) geometry.dispose();
}

// assets/wonder/park-source/castle.js
function createCastle(parent) {
  const root = group(parent, 0, 0, -9);
  root.scale.setScalar(1.06);
  const stoneMap = texture("stone"), roofMap = texture("roof");
  const stone = new THREE2.MeshStandardMaterial({ color: "#fff3d5", map: stoneMap, bumpMap: stoneMap, bumpScale: 0.065, roughness: 0.84 });
  const roof = new THREE2.MeshStandardMaterial({ color: "#98dcdf", map: roofMap, bumpMap: roofMap, bumpScale: 0.08, roughness: 0.37, metalness: 0.25 });
  const ivory = "#f0dfbb", pink = "#d98189", gold = material("#dbb451", { metalness: 0.78, roughness: 0.25 }), dark = material("#234451", { metalness: 0.35, roughness: 0.24, emissive: "#efb26f", emissiveIntensity: 0.13 });
  rounded(root, 11, 0.55, 7, 0.35, stone, 0, 0.38, 0);
  rounded(root, 10, 0.28, 6.4, 0.2, ivory, 0, 0.78, 0);
  box(root, 5.4, 4.8, 3.8, stone, 0, 3.05, 0);
  box(root, 3.7, 3.7, 2.7, pink, 0, 6.05, -0.45);
  box(root, 4, 0.25, 3, ivory, 0, 7.85, -0.45);
  box(root, 4.4, 0.2, 3.3, gold, 0, 7.98, -0.45);
  const highRoof = cone(root, 3.1, 3.2, roof, 0, 9.55, -0.45);
  highRoof.scale.z = 0.8;
  highRoof.rotation.y = Math.PI / 4;
  box(root, 6, 0.23, 4.2, ivory, 0, 5.55, 0);
  box(root, 6.15, 0.12, 4.32, gold, 0, 5.72, 0);
  for (const x of [-2.5, -1.25, 1.25, 2.5]) {
    box(root, 0.23, 4.8, 0.45, ivory, x, 3.15, 2.03);
    cone(root, 0.25, 1, gold, x, 6, 2.03);
  }
  for (const x of [-1.9, 0, 1.9]) {
    arch(root, 0.75, 1.5, 0.08, ivory, x, 3.6, 1.94);
    arch(root, 0.48, 1.2, 0.05, dark, x, 3.75, 2.035);
    box(root, 0.045, 1.15, 0.03, gold, x, 4.31, 2.1);
    box(root, 0.47, 0.05, 0.03, gold, x, 4.3, 2.1);
  }
  arch(root, 2.2, 2.85, 0.1, ivory, 0, 0.75, 2);
  arch(root, 1.7, 2.55, 0.06, dark, 0, 0.75, 2.13);
  for (const x of [-0.62, -0.31, 0, 0.31, 0.62]) box(root, 0.035, 2.2, 0.04, gold, x, 1.85, 2.2);
  box(root, 2.1, 0.09, 0.09, gold, 0, 2.35, 2.2);
  for (const x of [-1.12, 0, 1.12]) {
    arch(root, 0.58, 1.3, 0.06, ivory, x, 6.05, 0.94);
    arch(root, 0.35, 1.06, 0.06, dark, x, 6.15, 1.015);
  }
  function tower(x, z, r, h, roofH, rose = false) {
    const g = group(root, x, 0, z);
    cyl(g, r * 1.11, 0.32, stone, 0, 0.9, 0);
    cyl(g, r, h, rose ? pink : stone, 0, 0.85 + h / 2, 0);
    for (const yy of [1.05, h * 0.56 + 0.85, h + 0.8]) {
      cyl(g, r * 1.09, 0.15, ivory, 0, yy, 0);
      cyl(g, r * 1.13, 0.075, gold, 0, yy + 0.075, 0);
    }
    cyl(g, r * 1.18, 0.37, ivory, 0, h + 0.9, 0);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      box(g, 0.16, 0.34, 0.18, ivory, Math.sin(a) * r * 1.13, h + 1.12, Math.cos(a) * r * 1.13);
    }
    cone(g, r * 1.38, roofH, roof, 0, h + 1.16 + roofH / 2, 0);
    cyl(g, r * 1.4, 0.1, gold, 0, h + 1.17, 0);
    for (let j = 1; j < 8; j++) {
      const ring2 = torus(g, r * 1.38 * (1 - j / 8), 0.019, gold, 0, h + 1.16 + roofH * j / 8, 0);
      ring2.rotation.x = -Math.PI / 2;
    }
    cone(g, 0.085, 0.85, gold, 0, h + roofH + 1.48, 0);
    sphere(g, 0.09, 0.09, 0.09, gold, 0, h + roofH + 1.77, 0);
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const w = group(g, Math.sin(a) * (r + 0.012), h * 0.63 + 0.7, Math.cos(a) * (r + 0.012));
      w.rotation.y = a;
      arch(w, r * 0.62, Math.min(1.3, h * 0.3), 0.06, ivory, 0, 0, 0);
      arch(w, r * 0.4, Math.min(1.08, h * 0.23), 0.04, dark, 0, 0.08, 0.068);
    }
    return g;
  }
  tower(-4.25, 2.1, 0.91, 3.9, 2.4);
  tower(4.25, 2.1, 0.91, 4.2, 2.55);
  tower(-4, -2.05, 1, 5.8, 3, true);
  tower(4, -2, 1, 6.1, 2.9, true);
  tower(-2.5, -1.9, 0.64, 8.2, 2.75, true);
  tower(2.3, -1.7, 0.64, 8.9, 2.9, true);
  tower(0, -1.2, 0.85, 10.7, 3.3, true);
  tower(-1.4, 1.1, 0.42, 6.7, 2);
  tower(1.4, 1.1, 0.42, 6.6, 2);
  tower(-3.35, 0.45, 0.4, 5.25, 1.8);
  tower(3.35, 0.45, 0.4, 5.4, 1.9);
  for (const side of [-1, 1]) {
    box(root, 1.75, 2.3, 0.55, stone, side * 3.25, 2, 2.15);
    box(root, 1.85, 0.13, 0.75, ivory, side * 3.25, 3.2, 2.15);
    for (let i = 0; i < 5; i++) box(root, 0.24, 0.36, 0.74, ivory, side * 3.25 - 0.72 + i * 0.36, 3.42, 2.15);
  }
  const clock = group(root, 0, 5.85, 2.3);
  const ring = torus(clock, 0.41, 0.045, gold);
  cyl(clock, 0.37, 0.035, ivory).rotation.x = Math.PI / 2;
  box(clock, 0.025, 0.25, 0.025, dark, 0, 0.1, 0.04);
  const hand = box(clock, 0.18, 0.024, 0.025, dark, 0.08, 0, 0.04);
  hand.rotation.z = 0.4;
  const bridge = rounded(root, 3.2, 0.28, 3.8, 0.12, ivory, 0, 0.83, 4);
  for (let i = 0; i < 4; i++) box(root, 3.2, 0.13, 0.6, stone, 0, 0.73 - i * 0.13, 5.5 + i * 0.45);
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    cyl(root, 0.065, 0.55, gold, side * 1.42, 1.18, 2.65 + i * 0.58);
    sphere(root, 0.09, 0.09, 0.09, ivory, side * 1.42, 1.48, 2.65 + i * 0.58);
  }
  textSign(root, "WONDER CASTLE", 3.1, 0.44, "#6b5940", "#f4e9d0", 0, 3.33, 2.26);
  for (const side of [-1, 1]) {
    const wing = group(root, side * 5.25, 0, -0.3);
    box(wing, 2.35, 2.4, 3.1, stone, 0, 1.65, 0);
    box(wing, 2.6, 0.18, 3.4, gold, 0, 2.96, 0);
    const roofWing = cone(wing, 2.2, 1.45, roof, 0, 3.72, 0);
    roofWing.scale.z = 0.87;
    roofWing.rotation.y = Math.PI / 4;
    for (const x of [-0.72, 0, 0.72]) {
      arch(wing, 0.52, 1.15, 0.08, ivory, x, 1.5, 1.6);
      arch(wing, 0.32, 0.92, 0.08, dark, x, 1.62, 1.69);
    }
    for (const x of [-1.18, 1.18]) box(wing, 0.15, 2.45, 0.19, ivory, x, 1.7, 1.62);
    for (const x of [side * 2.5, side * 4.2]) {
      cyl(root, 0.1, 0.14, gold, x, 2.4, 2.85);
      sphere(root, 0.13, 0.19, 0.13, material("#ffe4a4", { emissive: "#ffba63", emissiveIntensity: 1.7 }), x, 2.62, 2.85);
    }
  }
  for (const [x, y, z] of [[0, 15.2, -1.2], [-2.5, 12.3, -1.9], [2.3, 13.1, -1.7]]) {
    cyl(root, 0.027, 1.1, gold, x, y, z);
    const shape = new THREE2.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.7, -0.2);
    shape.lineTo(0, -0.42);
    shape.closePath();
    meshFlag(shape, x, y + 0.5, z);
  }
  function meshFlag(shape, x, y, z) {
    const m = new THREE2.Mesh(new THREE2.ShapeGeometry(shape), material("#d57e82", { side: THREE2.DoubleSide }));
    m.position.set(x, y, z);
    root.add(m);
  }
  return root;
}

// assets/wonder/park-source/landscape.js
import * as THREE4 from "three";

// assets/wonder/park-source/landmark.js
import * as THREE3 from "three";

// assets/wonder/assets/gs-group-ci.png
var gs_group_ci_default = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASsAAACXCAIAAADCuepZAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2ZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo0NDg4RkE2MjAxQTVFNDExQUExQkRCMzRGQzQ0RDc3OCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDowNjgwREQ4MkQxREUxMUU0QjA0REM0RTQyMkE3RjkzRiIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDowNjgwREQ4MUQxREUxMUU0QjA0REM0RTQyMkE3RjkzRiIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjczMzlEM0ZFRERDRUU0MTFBOEQ4OTc2M0QwOEY5Qjk2IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjQ0ODhGQTYyMDFBNUU0MTFBQTFCREIzNEZDNDRENzc4Ii8+IDwvcmRmOkRlc2NyaXB0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";

// assets/wonder/park-source/landmark.js
function createLandmark(parent, { grounded = false } = {}) {
  const plaza = group(parent, 0, 0.39, 3.1);
  plaza.name = "GS central landmark";
  const brass = material("#d6ac57", { metalness: 0.82, roughness: 0.26 });
  cyl(plaza, 3.65, 0.14, "#d2c4a9", 0, 0.02, 0);
  cyl(plaza, 3.4, 0.19, "#f2e7d1", 0, 0.17, 0);
  for (const r of [3.45, 3.66]) {
    const ring = torus(plaza, r, 0.025, brass, 0, 0.22, 0);
    ring.rotation.x = -Math.PI / 2;
  }
  const sign = group(plaza, 0, 0.45, 0);
  sign.rotation.y = 0.28;
  if (grounded) {
    sign.rotation.set(-Math.PI / 2, 0, 0);
    sign.position.set(0, 0.3, 2);
  }
  rounded(sign, 6.9, 3.9, 0.26, 0.14, brass, 0, 2, 0);
  rounded(sign, 6.75, 3.75, 0.28, 0.13, material("#fffdf6", { roughness: 0.3, metalness: 0.08 }), 0, 2, 0.025);
  const print = new THREE3.MeshBasicMaterial({ color: 16777215, toneMapped: false });
  const logo = new THREE3.Mesh(new THREE3.PlaneGeometry(6.05, 6.05 * 151 / 299), print);
  logo.position.set(0, 2.03, 0.18);
  logo.name = "GS group CI \u2014 original colors";
  sign.add(logo);
  plaza.userData.ready = new THREE3.TextureLoader().loadAsync(gs_group_ci_default).then((map) => {
    map.colorSpace = THREE3.SRGBColorSpace;
    map.anisotropy = 8;
    print.map = map;
    print.needsUpdate = true;
  });
  textSign(sign, "GROW SUSTAINABLY", 3.3, 0.25, "#816c41", "#f2e7d1", 0, 0.12, 0.19);
  return plaza;
}

// assets/wonder/park-source/landscape.js
function tree(parent, x, z, size = 1, kind = "green") {
  const g = group(parent, x, 0.3, z);
  g.scale.setScalar(size);
  cyl(g, 0.12, 2.25, material("#796049", { roughness: 0.95 }), 0, 1.12, 0, 0.055);
  const rand = seeded(Math.abs(Math.round(x * 200 + z * 153)));
  for (let i = 0; i < 5; i++) {
    const branch = cyl(g, 0.045, 0.95, "#80674b", Math.cos(i * 2.4) * 0.27, 1.45 + i * 0.12, Math.sin(i * 2.4) * 0.27, 0.014);
    branch.rotation.z = Math.cos(i * 2.4) * 0.65;
    branch.rotation.x = Math.sin(i * 2.4) * 0.65;
  }
  const colors = kind === "pink" ? ["#dd81a3", "#efa8b9", "#c6668a"] : ["#416536", "#547b39", "#83a151"];
  g.userData.leaves = [];
  for (let i = 0; i < 180; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 1.12, y = 1.8 + rand() * 1.7;
    const crown = Math.sqrt(Math.max(0.05, 1 - ((y - 2.65) / 1.2) ** 2));
    g.userData.leaves.push({ x: Math.cos(a) * r * crown, y, z: Math.sin(a) * r * crown, s: 0.35 + rand() * 0.4, rx: rand() * Math.PI, ry: rand() * Math.PI, rz: rand() * Math.PI, color: colors[i % 3] });
  }
  return g;
}
function hedge(parent, x, z, w, d) {
  rounded(parent, w, 0.52, d, 0.2, "#526f47", x, 0.54, z);
  rounded(parent, w - 0.12, 0.12, d - 0.12, 0.05, "#6e8854", x, 0.85, z);
}
function lamp(parent, x, z) {
  cyl(parent, 0.045, 1.9, "#645638", x, 1.2, z);
  cyl(parent, 0.12, 0.13, "#d3c196", x, 0.31, z);
  sphere(parent, 0.19, 0.24, 0.19, material("#fff1c2", { emissive: "#ffca73", emissiveIntensity: 1.6 }), x, 2.23, z);
  cone(parent, 0.25, 0.2, "#395448", x, 2.5, z);
}
function foliage(root) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d");
  c.fillStyle = "#fff";
  for (const [x, y, a] of [[64, 30, 0], [40, 45, -0.8], [85, 49, 0.8], [43, 79, -0.65], [81, 86, 0.65], [61, 102, 0]]) {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.beginPath();
    c.ellipse(0, 0, 10, 23, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  const map = new THREE4.CanvasTexture(canvas);
  map.colorSpace = THREE4.SRGBColorSpace;
  map.anisotropy = 8;
  const leaves = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    for (const leaf of o.userData.leaves || []) leaves.push({ leaf, matrix: o.matrixWorld });
  });
  const mesh2 = new THREE4.InstancedMesh(new THREE4.PlaneGeometry(1, 1), new THREE4.MeshStandardMaterial({ map, alphaTest: 0.45, side: THREE4.DoubleSide, roughness: 0.94 }), leaves.length);
  const dummy = new THREE4.Object3D(), matrix = new THREE4.Matrix4(), color = new THREE4.Color();
  leaves.forEach(({ leaf, matrix: parent }, i) => {
    dummy.position.set(leaf.x, leaf.y, leaf.z);
    dummy.rotation.set(leaf.rx, leaf.ry, leaf.rz);
    dummy.scale.setScalar(leaf.s);
    dummy.updateMatrix();
    matrix.multiplyMatrices(parent, dummy.matrix);
    mesh2.setMatrixAt(i, matrix);
    mesh2.setColorAt(i, color.set(leaf.color));
  });
  mesh2.castShadow = true;
  mesh2.receiveShadow = true;
  mesh2.userData.dynamic = true;
  mesh2.name = "Instanced botanical foliage";
  root.add(mesh2);
}
function formalGardens(root) {
  const rand = seeded(912), heads = [];
  for (const side of [-1, 1]) {
    for (const z of [-1.5, 6, 11.5]) {
      const x = side * 7.2;
      rounded(root, 2.9, 0.2, 3.3, 0.55, "#b4a07d", x, 0.39, z);
      rounded(root, 2.65, 0.24, 3.05, 0.5, "#354f30", x, 0.55, z);
      for (let i = 0; i < 85; i++) heads.push({ x: x + (rand() - 0.5) * 2.3, y: 0.78 + rand() * 0.12, z: z + (rand() - 0.5) * 2.6, color: ["#dc4881", "#ffb661", "#eb6c67", "#e8d7ec"][Math.floor(rand() * 4)] });
    }
    for (const z of [-7, -2, 3, 8, 13, 17]) lamp(root, side * 21.7, z * 0.73);
    for (let i = 0; i < 4; i++) {
      const g = group(root, side * (18.3 + i * 0.95), 0.35, -7 + i * 3.3);
      g.rotation.y = side * -0.65;
      const facade = ["#e9b5a1", "#d1dcc5", "#c6d4dc", "#e7ce95"][i];
      rounded(g, 2.65, 2.6, 2.65, 0.05, facade, 0, 1.35, 0);
      box(g, 2.95, 0.2, 2.95, "#eee0c3", 0, 2.72, 0);
      const roof = cone(g, 2.15, 1.3, material("#426c78", { metalness: 0.16, roughness: 0.55 }), 0, 3.44, 0);
      roof.geometry = new THREE4.ConeGeometry(2.15, 1.3, 4);
      roof.rotation.y = Math.PI / 4;
      for (const x of [-0.72, 0.72]) {
        box(g, 0.63, 1.05, 0.05, "#326477", x, 1.83, 1.35);
        box(g, 0.05, 1.1, 0.07, "#f6e2b8", x, 1.83, 1.4);
        box(g, 0.68, 0.05, 0.07, "#f6e2b8", x, 1.84, 1.4);
      }
      box(g, 0.65, 1.4, 0.08, "#34524d", 0, 0.75, 1.36);
      for (let stripe = 0; stripe < 9; stripe++) {
        const awning = box(g, 0.3, 0.08, 0.8, stripe % 2 ? "#f5e7c8" : ["#ad5766", "#608b76", "#63838d", "#bd8f50"][i], -1.2 + stripe * 0.3, 1.45, 1.7);
        awning.rotation.x = 0.2;
      }
      for (const x of [-1.27, 1.27]) cyl(g, 0.028, 1.35, "#b99c62", x, 0.7, 2.05);
    }
  }
  const flowers = new THREE4.InstancedMesh(new THREE4.IcosahedronGeometry(0.085, 1), new THREE4.MeshStandardMaterial({ roughness: 0.78 }), heads.length);
  const dummy = new THREE4.Object3D(), color = new THREE4.Color();
  heads.forEach((h, i) => {
    dummy.position.set(h.x, h.y, h.z);
    dummy.scale.set(1, 0.55, 1);
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
    flowers.setColorAt(i, color.set(h.color));
  });
  flowers.userData.dynamic = true;
  flowers.castShadow = true;
  root.add(flowers);
  const glow = material("#fff1bf", { emissive: "#ffd591", emissiveIntensity: 2.3, roughness: 0.3 });
  for (const side of [-1, 1]) {
    for (const z of [-3, 2, 7, 12]) {
      cyl(root, 0.14, 2.75, "#ab8e53", side * 3.9, 1.7, z);
      sphere(root, 0.17, 0.17, 0.17, glow, side * 3.9, 3.15, z);
      if (z < 12) {
        const curve = new THREE4.CatmullRomCurve3([new THREE4.Vector3(side * 3.9, 3.1, z), new THREE4.Vector3(side * 3.9, 2.55, z + 2.5), new THREE4.Vector3(side * 3.9, 3.1, z + 5)]);
        const wire = new THREE4.Mesh(new THREE4.TubeGeometry(curve, 18, 0.018, 4, false), material("#756541"));
        root.add(wire);
        for (let j = 1; j < 10; j++) {
          const p = curve.getPoint(j / 10);
          sphere(root, 0.055, 0.08, 0.055, glow, p.x, p.y - 0.07, p.z);
        }
      }
    }
  }
}
function createLandscape(parent) {
  const root = group(parent);
  const animations = [];
  const rand = seeded(882);
  const grass = new THREE4.MeshStandardMaterial({ color: "#a4b979", map: texture("grass"), bumpMap: texture("grass"), bumpScale: 0.1, roughness: 0.94 });
  grass.name = "park-lawn";
  const paving = new THREE4.MeshStandardMaterial({ color: "#f3dec0", map: texture("path"), bumpMap: texture("path"), bumpScale: 0.065, roughness: 0.86 });
  const base = cyl(root, 28, 1.1, "#c7b999", 0, -0.66, 0);
  base.scale.z *= 0.79;
  const rim = cyl(root, 28.06, 0.16, "#e8d8b8", 0, -0.05, 0);
  rim.scale.z *= 0.79;
  const land = cyl(root, 27.72, 0.35, grass, 0, 0.13, 0);
  land.scale.z *= 0.79;
  for (const surface of [base, rim, land]) surface.geometry = new THREE4.CylinderGeometry(1, 1, 1, 128);
  const promenade = new THREE4.Mesh(new THREE4.RingGeometry(23.1, 25.4, 160), paving);
  promenade.rotation.x = -Math.PI / 2;
  promenade.scale.y = 0.77;
  promenade.position.y = 0.32;
  promenade.receiveShadow = true;
  root.add(promenade);
  const edging = torus(root, 25.45, 0.075, "#eee1c3", 0, 0.34, 0);
  edging.rotation.x = -Math.PI / 2;
  edging.scale.y = 0.77;
  rounded(root, 4.1, 0.1, 37, 0.08, paving, 0, 0.34, 0.8);
  rounded(root, 44, 0.1, 3.25, 0.06, paving, 0, 0.34, 3.1);
  const frontPath = torus(root, 6.2, 0.85, paving, 0, 0.35, 11.1);
  frontPath.rotation.x = -Math.PI / 2;
  frontPath.scale.y = 0.78;
  frontPath.scale.z = 0.08;
  const riverCurve = new THREE4.CatmullRomCurve3([new THREE4.Vector3(-25, 0.34, -7), new THREE4.Vector3(-24, 0.34, 6), new THREE4.Vector3(-18, 0.34, 15), new THREE4.Vector3(-3, 0.34, 18.2), new THREE4.Vector3(11, 0.34, 17.8), new THREE4.Vector3(23, 0.34, 9), new THREE4.Vector3(25, 0.34, -5)]);
  function riverStrip(width, color, height) {
    const count = 140, positions = [], uv = [], indices = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count, p = riverCurve.getPoint(t), tan = riverCurve.getTangent(t), nx = -tan.z, nz = tan.x;
      for (const s of [-1, 1]) {
        positions.push(p.x + nx * width * s, height, p.z + nz * width * s);
        uv.push(s === -1 ? 0 : 1, t * 20);
      }
      if (i < count) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE4.BufferGeometry();
    geo.setAttribute("position", new THREE4.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE4.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const m = new THREE4.Mesh(geo, typeof color === "string" ? material(color) : color);
    m.receiveShadow = true;
    root.add(m);
    return m;
  }
  riverStrip(1.08, "#cbbb95", 0.36);
  const waterMat = new THREE4.MeshPhysicalMaterial({ color: "#63aeb0", roughness: 0.19, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.17, side: THREE4.DoubleSide });
  const water = riverStrip(0.91, waterMat, 0.405);
  water.userData.dynamic = true;
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    waterMat.userData.shader = shader;
    shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.y += sin(position.x*3.0+uTime)*0.018 + cos(position.z*3.3+uTime*.8)*0.012;");
  };
  animations.push((t) => {
    if (waterMat.userData.shader) waterMat.userData.shader.uniforms.uTime.value = t;
  });
  rounded(root, 3.2, 0.18, 4.7, 0.08, paving, 0, 0.65, 17.8);
  for (const side of [-1, 1]) {
    box(root, 0.06, 0.07, 4.7, "#c6aa71", side * 1.48, 1.2, 17.8);
    for (let j = 0; j < 8; j++) cyl(root, 0.035, 0.52, "#b99c64", side * 1.48, 0.94, 15.7 + j * 0.6);
  }
  const fountain = group(root, 0, 0.38, 11.1);
  for (const [x, z, r] of [[0, 0.4, 2.5], [-2, -1.5, 1.55], [2, -1.5, 1.55]]) {
    cyl(fountain, r, 0.32, "#eadfca", x, 0.22, z);
    cyl(fountain, r - 0.17, 0.08, "#98c6c0", x, 0.42, z);
    const border = torus(fountain, r - 0.05, 0.09, "#f5e9d1", x, 0.45, z);
    border.rotation.x = -Math.PI / 2;
    cyl(fountain, 0.24, 0.33, "#e2d9bc", x, 0.59, z);
    sphere(fountain, 0.15, 0.23, 0.15, "#dadabf", x, 0.87, z);
    const jet = cone(fountain, 0.095, 0.93, material("#d4eded", { transparent: true, opacity: 0.7, roughness: 0.1 }), x, 1.27, z);
    jet.userData.dynamic = true;
    animations.push((t) => jet.scale.y = 0.92 + Math.sin(t * 2.5 + x) * 0.06);
    for (let j = 0; j < 3; j++) {
      const ripple = torus(fountain, 0.45 + j * 0.36, 0.018, material("#e6f4e8", { transparent: true, opacity: 0.5 }), x, 0.475, z);
      ripple.rotation.x = -Math.PI / 2;
    }
  }
  for (const side of [-1, 1]) {
    hedge(root, side * 5.3, 8.5, 0.48, 6.3);
    hedge(root, side * 3.5, 11.4, 3.8, 0.48);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 15; col++) {
      const x = side * (2.4 + row * 0.64), z = 8.1 + col * 0.19;
      sphere(root, 0.1, 0.075, 0.105, ["#be6c88", "#dfc779", "#e8b5ac"][row], x, 0.53, z);
    }
    for (const z of [-4, 0, 6, 11]) lamp(root, side * 2.4, z);
    for (const z of [6.3, 10.7]) {
      rounded(root, 1.25, 0.1, 0.43, 0.05, "#a88e63", side * 6.2, 0.75, z);
      for (const x of [-0.48, 0.48]) box(root, 0.09, 0.4, 0.32, "#4e6453", side * 6.2 + x, 0.53, z);
      box(root, 1.25, 0.32, 0.075, "#b29d77", side * 6.2, 1, z - 0.2);
    }
  }
  for (let i = 0; i < 82; i++) {
    const a = i / 82 * Math.PI * 2, r = 25.7 + rand() * 0.9, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.77;
    if (z > 17 && Math.abs(x) < 4) continue;
    tree(root, x, z, 0.78 + rand() * 0.62, i % 9 === 0 ? "pink" : "green");
  }
  for (const [x, z, s] of [[-6, -9, 1.05], [6, -9, 0.9], [-7, -3, 0.85], [6, -3, 0.83], [-16, -8, 0.9], [16, -7, 1], [-15, 7, 0.7], [16, 6, 0.7], [-6, 12, 0.8], [7, 12, 0.8]]) tree(root, x, z, s, Math.abs(x) % 2 === 0 ? "pink" : "green");
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2, r = 23 + rand() * 0.4;
    sphere(root, 0.3, 0.22, 0.3, ["#75925b", "#648755", "#8f9f63"][i % 3], Math.cos(a) * r, 0.48, Math.sin(a) * r * 0.78);
  }
  for (const side of [-1, 1]) {
    cyl(root, 0.6, 2.3, "#e4d2ae", side * 3.1, 1.47, 19.7);
    cone(root, 0.78, 1.3, "#507b7b", side * 3.1, 3.15, 19.7);
    cone(root, 0.07, 0.55, "#cdb277", side * 3.1, 4.02, 19.7);
  }
  textSign(root, "TBD \xB7 WONDER PARK", 5.55, 0.66, "#e8d6a3", "#304f44", 0, 2.75, 19.8);
  box(root, 6.35, 0.1, 0.16, "#cdb277", 0, 3.15, 19.75);
  const wheel = group(root, 15.7, 0.4, -11.8);
  wheel.rotation.y = -0.1;
  for (const side of [-1, 1]) {
    const strut = box(wheel, 0.18, 5.5, 0.2, "#e9d3ae", side * 1.05, 2.55, 0.3);
    strut.rotation.z = side * 0.4;
  }
  const spokes = group(wheel, 0, 5, 0);
  spokes.userData.dynamic = true;
  for (const z of [-0.25, 0.25]) torus(spokes, 3.5, 0.085, "#e6c28b", 0, 0, z);
  const seats = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const spoke = box(spokes, 0.05, 7, 0.06, "#ecdbb8");
    spoke.rotation.z = a;
    const seat = group(spokes, Math.sin(a) * 3.5, Math.cos(a) * 3.5, 0);
    rounded(seat, 0.65, 0.7, 0.7, 0.1, ["#cb8d79", "#94aaa0", "#ddb673", "#a79bbc"][i % 4], 0, -0.32, 0);
    cone(seat, 0.51, 0.35, "#e9d4af", 0, 0.18, 0);
    seats.push(seat);
  }
  animations.push((t) => {
    spokes.rotation.z = t * 0.065;
    seats.forEach((s) => s.rotation.z = -t * 0.065);
  });
  formalGardens(root);
  const landmark = createLandmark(root);
  foliage(root);
  return { root, animations, ready: landmark.userData.ready };
}

// assets/wonder/park-source/attractions.js
import * as THREE6 from "three";

// assets/wonder/park-source/character-friends.js
var ink = "#26282b";
var cream = "#fff7e7";
function eyes(body, y, z, spacing = 0.12, white = true) {
  for (const side of [-1, 1]) {
    if (white) sphere(body, 0.082, 0.12, 0.043, cream, side * spacing, y, z);
    sphere(body, 0.035, 0.054, 0.026, ink, side * spacing, y - 0.015, z + (white ? 0.036 : 0));
  }
}
function arm(body, side, y, color, arms, length = 0.25) {
  const pivot = group(body, side * 0.32, y, 0);
  pivot.rotation.z = side * 0.15;
  sphere(pivot, 0.12, length, 0.12, color, side * 0.055, -length * 0.55, 0);
  sphere(pivot, 0.13, 0.13, 0.12, color, side * 0.08, -length * 1.35, 0.025);
  arms.push(pivot);
  return pivot;
}
function smile(body, r, y, z, color = ink) {
  const curve = torus(body, r, 0.016, color, 0, y, z);
  curve.scale.y = 0.35;
  sphere(body, r * 1.05, 0.045, 0.035, color === ink ? "#e4b746" : "#8cb8d2", 0, y + 0.03, z + 8e-3);
}
function buildFriend(body, kind, arms, details) {
  if (kind === "goofy") {
    const orange = "#db864b", blue = "#436883", skin = "#e6cba0", green = "#9fb26d";
    sphere(body, 0.25, 0.4, 0.21, orange, 0, 1.15, 0);
    for (const side of [-1, 1]) {
      const vest = box(body, 0.115, 0.43, 0.27, ink, side * 0.21, 1.24, 0.06);
      vest.rotation.z = side * -0.13;
      const leg = cyl(body, 0.085, 0.57, blue, side * 0.14, 0.57, 0);
      leg.rotation.z = side * 0.08;
      sphere(body, 0.18, 0.115, 0.3, "#886443", side * 0.18, 0.16, 0.12);
      const a = arm(body, side, 1.4, orange, arms, 0.29);
      sphere(a, 0.13, 0.15, 0.11, cream, side * 0.08, -0.49, 0.02);
    }
    sphere(body, 0.27, 0.32, 0.22, ink, 0, 1.82, 0);
    for (const side of [-1, 1]) {
      sphere(body, 0.125, 0.215, 0.08, cream, side * 0.1, 1.98, 0.18);
      sphere(body, 0.035, 0.075, 0.026, ink, side * 0.085, 1.98, 0.26);
      const ear = sphere(body, 0.068, 0.35, 0.08, ink, side * 0.29, 1.68, -0.035);
      ear.rotation.z = side * 0.13;
    }
    sphere(body, 0.29, 0.13, 0.22, skin, 0, 1.76, 0.25);
    sphere(body, 0.11, 0.074, 0.09, ink, 0, 1.8, 0.46);
    sphere(body, 0.17, 0.065, 0.065, ink, 0, 1.63, 0.29);
    for (const side of [-1, 1]) box(body, 0.07, 0.08, 0.035, cream, side * 0.042, 1.66, 0.344);
    const hat = group(body, 0, 2.2, 0);
    hat.rotation.z = -0.16;
    cyl(hat, 0.27, 0.055, green);
    cyl(hat, 0.16, 0.27, green, 0, 0.14, 0, 0.2);
    cyl(hat, 0.177, 0.055, ink, 0, 0.08, 0);
  } else if (kind === "pluto") {
    const gold = "#dfae45";
    sphere(body, 0.29, 0.36, 0.48, gold, 0, 0.63, -0.03);
    for (const side of [-1, 1]) for (const z of [-0.31, 0.3]) {
      sphere(body, 0.09, 0.23, 0.1, gold, side * 0.23, 0.3, z);
      sphere(body, 0.135, 0.08, 0.2, gold, side * 0.24, 0.11, z + 0.07);
      for (const offset of [-0.045, 0.045]) box(body, 0.01, 0.016, 0.085, "#bb8536", side * 0.24 + offset, 0.17, z + 0.18);
    }
    sphere(body, 0.24, 0.25, 0.24, gold, 0, 0.99, 0.31);
    const collar = torus(body, 0.218, 0.04, "#497952", 0, 0.87, 0.3);
    collar.rotation.x = Math.PI / 2;
    sphere(body, 0.05, 0.065, 0.02, "#e6c36c", 0, 0.84, 0.52);
    eyes(body, 1.08, 0.515, 0.085);
    sphere(body, 0.205, 0.13, 0.28, gold, 0, 0.87, 0.55);
    sphere(body, 0.11, 0.085, 0.08, ink, 0, 0.94, 0.8);
    sphere(body, 0.15, 0.036, 0.13, ink, 0, 0.78, 0.64);
    sphere(body, 0.075, 0.026, 0.14, "#d98788", 0, 0.75, 0.69);
    for (const side of [-1, 1]) {
      const ear = sphere(body, 0.07, 0.33, 0.065, ink, side * 0.225, 0.85, 0.22);
      ear.rotation.z = side * 0.22;
    }
    const tail = group(body, 0, 0.69, -0.45);
    const tip = cone(tail, 0.043, 0.52, ink, 0, 0.2, -0.12);
    tip.rotation.x = -0.5;
    details.push({ part: tail, animate: (t) => tail.rotation.z = Math.sin(t * 5) * 0.5 });
  } else if (kind === "pooh") {
    const honey = "#e4b746", shirt = "#c94c42";
    sphere(body, 0.39, 0.45, 0.3, honey, 0, 0.63, 0);
    sphere(body, 0.35, 0.23, 0.285, shirt, 0, 0.96, 0);
    sphere(body, 0.35, 0.32, 0.29, honey, 0, 1.38, 0.02);
    for (const side of [-1, 1]) {
      sphere(body, 0.12, 0.135, 0.075, honey, side * 0.255, 1.64, 0.02);
      sphere(body, 0.067, 0.075, 0.025, "#ce9438", side * 0.255, 1.65, 0.085);
      sphere(body, 0.145, 0.11, 0.21, honey, side * 0.19, 0.13, 0.09);
      const a = arm(body, side, 1.03, honey, arms, 0.23);
      sphere(a, 0.135, 0.14, 0.14, shirt, side * 0.03, -0.02, 0);
      const brow = sphere(body, 0.065, 0.015, 0.02, "#855d2f", side * 0.12, 1.53, 0.263);
      brow.rotation.z = side * -0.12;
    }
    eyes(body, 1.43, 0.293, 0.12, false);
    sphere(body, 0.23, 0.12, 0.1, honey, 0, 1.25, 0.28);
    sphere(body, 0.065, 0.043, 0.037, ink, 0, 1.33, 0.374);
    smile(body, 0.105, 1.245, 0.374);
    const pot = group(body, -0.42, 0.21, 0.42);
    pot.rotation.z = 0.14;
    sphere(pot, 0.16, 0.19, 0.15, "#a881b0");
    cyl(pot, 0.14, 0.07, "#976fa3", 0, 0.16, 0);
    cyl(pot, 0.105, 0.015, "#e6b64e", 0, 0.201, 0);
    sphere(pot, 0.033, 0.07, 0.025, "#e6b64e", 0.07, 0.13, 0.13);
  } else if (kind === "stitch") {
    const blue = "#568fbd", pale = "#8cb8d2", dark = "#30567f", pink = "#c396bd";
    sphere(body, 0.29, 0.33, 0.25, blue, 0, 0.52, 0);
    sphere(body, 0.19, 0.24, 0.06, pale, 0, 0.5, 0.225);
    sphere(body, 0.43, 0.3, 0.3, blue, 0, 1.03, 0);
    for (const side of [-1, 1]) {
      sphere(body, 0.15, 0.105, 0.22, blue, side * 0.24, 0.14, 0.1);
      const a = arm(body, side, 0.7, blue, arms, 0.2);
      for (let i = 0; i < 3; i++) sphere(a, 0.022, 0.033, 0.04, cream, side * 0.08 + (i - 1) * 0.058, -0.32, 0.07);
      sphere(body, 0.17, 0.195, 0.05, pale, side * 0.215, 1.055, 0.248);
      const eye = sphere(body, 0.104, 0.133, 0.036, ink, side * 0.22, 1.06, 0.287);
      eye.rotation.z = side * -0.12;
      sphere(body, 0.027, 0.034, 0.013, cream, side * 0.205, 1.108, 0.32);
      const ear = group(body, side * 0.35, 1.19, -0.02);
      ear.rotation.z = -side * 0.63;
      sphere(ear, 0.16, 0.44, 0.085, blue, 0, 0.3, 0);
      sphere(ear, 0.112, 0.34, 0.021, pink, 0, 0.3, 0.079);
      sphere(ear, 0.055, 0.038, 0.027, blue, side * 0.107, 0.37, 0.08);
      details.push({ part: ear, animate: (t) => ear.rotation.z = -side * (0.63 + Math.sin(t * 1.7) * 0.065) });
    }
    sphere(body, 0.145, 0.095, 0.093, dark, 0, 1.045, 0.303);
    sphere(body, 0.23, 0.085, 0.08, pale, 0, 0.88, 0.253);
    smile(body, 0.15, 0.875, 0.328, dark);
    for (const side of [-1, 1]) {
      const tooth = cone(body, 0.03, 0.075, cream, side * 0.095, 0.863, 0.343);
      tooth.rotation.z = Math.PI;
    }
    const tuft = cone(body, 0.07, 0.19, dark, 0, 1.36, -0.035);
    tuft.rotation.z = 0.25;
  } else if (kind === "baymax") {
    const white = "#f4f2e9", seam = "#d8dfdc";
    sphere(body, 0.48, 0.6, 0.35, white, 0, 0.88, 0);
    sphere(body, 0.32, 0.34, 0.27, white, 0, 1.32, 0);
    sphere(body, 0.315, 0.215, 0.235, white, 0, 1.74, 0);
    for (const side of [-1, 1]) {
      sphere(body, 0.17, 0.29, 0.19, white, side * 0.21, 0.32, 0);
      sphere(body, 0.18, 0.095, 0.22, white, side * 0.21, 0.105, 0.045);
      const a = arm(body, side, 1.3, white, arms, 0.36);
      a.position.x = side * 0.37;
      for (let i = 0; i < 3; i++) sphere(a, 0.032, 0.085, 0.04, white, side * 0.08 + (i - 1) * 0.064, -0.51, 0.025);
      sphere(body, 0.035, 0.035, 0.015, ink, side * 0.135, 1.77, 0.23);
    }
    box(body, 0.27, 0.018, 0.017, ink, 0, 1.77, 0.238);
    const badge = torus(body, 0.055, 0.011, seam, -0.14, 1.31, 0.245);
    badge.scale.y = 0.9;
    for (const side of [-1, 1]) {
      const seamLine = torus(body, 0.15, 9e-3, seam, side * 0.215, 0.34, 0.145);
      seamLine.scale.y = 1.1;
    }
  }
}

// assets/wonder/park-source/characters.js
function disneyCharacter(parent, kind = "mickey", scale = 1) {
  const root = group(parent);
  root.name = `Disney character: ${kind}`;
  root.scale.setScalar(scale);
  root.userData.dynamic = true;
  root.userData.character = kind;
  const black = "#26282b", white = "#fff7e7", skin = "#f2d1aa", yellow = "#e5b440", red = kind === "minnie" ? "#d95979" : "#cb4640";
  const body = group(root);
  const arms = [], details = [];
  if (kind === "olaf") {
    sphere(body, 0.37, 0.46, 0.32, white, 0, 0.55, 0);
    sphere(body, 0.27, 0.27, 0.26, white, 0, 1.04, 0);
    sphere(body, 0.29, 0.4, 0.27, white, 0, 1.54, 0);
    for (let i = 0; i < 3; i++) sphere(body, 0.045, 0.045, 0.035, black, 0, 0.4 + i * 0.24, 0.3);
    for (const x of [-0.095, 0.095]) {
      sphere(body, 0.072, 0.08, 0.03, white, x, 1.66, 0.25);
      sphere(body, 0.033, 0.038, 0.02, black, x, 1.66, 0.278);
    }
    const nose = cone(body, 0.068, 0.36, "#df8941", 0, 1.5, 0.39);
    nose.rotation.x = Math.PI / 2;
    sphere(body, 0.2, 0.1, 0.25, white, -0.2, 0.1, 0.08);
    sphere(body, 0.2, 0.1, 0.25, white, 0.2, 0.1, 0.08);
    for (const side of [-1, 1]) {
      const a = group(body, side * 0.23, 1.05, 0);
      const stick = cyl(a, 0.035, 0.55, "#70503a", side * 0.21, 0.08, 0);
      stick.rotation.z = -side * 1.1;
      arms.push(a);
    }
  } else if (kind === "donald" || kind === "daisy") {
    const daisy = kind === "daisy";
    sphere(body, 0.29, 0.39, 0.25, daisy ? "#a886bc" : "#416d9b", 0, 0.75, 0);
    sphere(body, 0.31, 0.34, 0.28, white, 0, 1.29, 0);
    sphere(body, 0.26, 0.085, 0.25, yellow, 0, 1.15, 0.3);
    sphere(body, 0.22, 0.038, 0.19, "#dca340", 0, 1.08, 0.3);
    for (const x of [-0.1, 0.1]) {
      sphere(body, 0.085, 0.14, 0.04, white, x, 1.37, 0.253);
      sphere(body, 0.033, 0.06, 0.022, "#355271", x, 1.39, 0.29);
    }
    if (daisy) {
      for (const side of [-1, 1]) {
        sphere(body, 0.17, 0.115, 0.065, "#dc7eae", side * 0.14, 1.62, 0.1);
        for (let i = 0; i < 3; i++) {
          const lash = cyl(body, 0.012, 0.08, black, side * (0.07 + i * 0.035), 1.51, 0.28);
          lash.rotation.z = -side * (0.15 + i * 0.22);
        }
      }
      sphere(body, 0.065, 0.07, 0.055, "#c55d97", 0, 1.62, 0.15);
    } else {
      cyl(body, 0.23, 0.08, "#326591", 0, 1.59, 0);
      sphere(body, 0.22, 0.075, 0.2, "#5787b0", 0, 1.66, 0);
    }
    for (const side of [-1, 1]) {
      sphere(body, 0.15, 0.065, 0.24, daisy ? "#d87caa" : yellow, side * 0.16, 0.12, 0.1);
      cyl(body, 0.065, 0.25, yellow, side * 0.13, 0.3, 0);
      const a = group(body, side * 0.26, 0.95, 0);
      sphere(a, 0.085, 0.22, 0.085, white, side * 0.08, -0.1, 0);
      if (daisy) {
        sphere(a, 0.1, 0.1, 0.1, "#a886bc", side * 0.025, 0.025, 0);
        const bracelet = torus(a, 0.085, 0.018, "#dab655", side * 0.08, -0.23, 0);
        bracelet.rotation.x = Math.PI / 2;
      }
      arms.push(a);
    }
    if (!daisy) for (const side of [-1, 1]) {
      const b = cone(body, 0.14, 0.18, "#c94c47", side * 0.1, 0.96, 0.26);
      b.rotation.z = side * Math.PI / 2;
    }
  } else if (["goofy", "pluto", "pooh", "stitch", "baymax"].includes(kind)) {
    buildFriend(body, kind, arms, details);
  } else {
    sphere(body, 0.26, 0.38, 0.22, black, 0, 0.84, 0);
    sphere(body, 0.34, 0.36, 0.29, black, 0, 1.43, 0);
    for (const side of [-1, 1]) {
      sphere(body, 0.215, 0.22, 0.095, black, side * 0.285, 1.75, 0);
      sphere(body, 0.14, 0.235, 0.063, skin, side * 0.105, 1.43, 0.252);
    }
    sphere(body, 0.245, 0.135, 0.13, skin, 0, 1.24, 0.265);
    sphere(body, 0.09, 0.068, 0.07, black, 0, 1.32, 0.394);
    for (const side of [-1, 1]) {
      sphere(body, 0.058, 0.12, 0.025, white, side * 0.092, 1.46, 0.31);
      sphere(body, 0.025, 0.063, 0.016, black, side * 0.083, 1.44, 0.333);
    }
    const smile2 = torus(body, 0.11, 0.014, "#5a372e", 0, 1.24, 0.373);
    smile2.scale.y = 0.43;
    if (kind === "minnie") {
      cyl(body, 0.38, 0.31, red, 0, 0.53, 0, 0.2);
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5;
        sphere(body, 0.025, 0.025, 0.025, white, Math.cos(a) * 0.3, 0.51, Math.sin(a) * 0.3);
      }
      for (const side of [-1, 1]) {
        sphere(body, 0.155, 0.11, 0.06, red, side * 0.12, 1.78, 0.16);
        sphere(body, 0.025, 0.025, 0.014, white, side * 0.15, 1.81, 0.21);
      }
      sphere(body, 0.06, 0.065, 0.055, red, 0, 1.78, 0.21);
    } else {
      sphere(body, 0.28, 0.22, 0.24, red, 0, 0.56, 0);
      for (const side of [-1, 1]) sphere(body, 0.045, 0.065, 0.026, white, side * 0.12, 0.58, 0.235);
    }
    for (const side of [-1, 1]) {
      cyl(body, 0.069, 0.32, black, side * 0.145, 0.28, 0);
      sphere(body, 0.16, 0.115, 0.25, kind === "minnie" ? red : yellow, side * 0.18, 0.115, 0.085);
      const arm2 = group(body, side * 0.235, 1.03, 0);
      arm2.rotation.z = side * 0.35;
      sphere(arm2, 0.075, 0.21, 0.075, black, side * 0.03, -0.15, 0);
      const glove = group(arm2, side * 0.05, -0.36, 0);
      sphere(glove, 0.115, 0.13, 0.078, white);
      for (let i = 0; i < 3; i++) sphere(glove, 0.025, 0.062, 0.035, white, -0.07 + i * 0.055, -0.075, 0.02);
      sphere(glove, 0.06, 0.055, 0.06, white, side * -0.085, 0, 0.04);
      arms.push(arm2);
    }
  }
  const base = group(root);
  cyl(base, 0.54, 0.055, "#d8c4a0", 0, 0.015, 0);
  for (const arm2 of arms) {
    arm2.userData.dynamic = true;
    staticBatch(arm2);
  }
  for (const { part } of details) {
    part.userData.dynamic = true;
    staticBatch(part);
  }
  staticBatch(body);
  staticBatch(base);
  root.userData.animate = (time, motion = "wave") => {
    if (motion === "drive") {
      body.rotation.z = Math.sin(time * 2) * 0.09;
      arms.forEach((a, i) => a.rotation.x = -1.2 + Math.sin(time * 3 + i) * 0.08);
    } else if (motion === "dance") {
      body.position.y = Math.max(0, Math.sin(time * 3)) * 0.09;
      body.rotation.y = Math.sin(time * 1.5) * 0.25;
      arms.forEach((a, i) => a.rotation.z = (i ? 1 : -1) * (0.7 + Math.sin(time * 3 + i) * 0.3));
    } else {
      body.rotation.y = Math.sin(time * 0.8) * 0.12;
      if (arms[1]) arms[1].rotation.z = 2.1 + Math.sin(time * 3) * 0.25;
    }
    details.forEach((detail) => detail.animate(time));
  };
  return root;
}

// assets/wonder/park-source/vehicle-attractions.js
import * as THREE5 from "three";
var cream2 = "#eee2c9";
var ink2 = "#29473f";
var rubber = "#303936";
var mint = "#73bea3";
function car(parent, color) {
  const root = group(parent);
  rounded(root, 1.3, 0.3, 2.35, 0.13, material(color, { metalness: 0.35, roughness: 0.32 }), 0, 0.47, 0);
  rounded(root, 1.12, 0.12, 2.22, 0.05, ink2, 0, 0.29, 0);
  rounded(root, 1.03, 0.4, 1.03, 0.14, material("#527677", { metalness: 0.3, roughness: 0.22 }), 0, 0.79, -0.18);
  rounded(root, 1.07, 0.09, 0.8, 0.06, color, 0, 1.01, -0.23);
  for (const x of [-0.65, 0.65]) for (const z of [-0.73, 0.73]) {
    const wheel = cyl(root, 0.25, 0.16, rubber, x, 0.3, z);
    wheel.rotation.z = Math.PI / 2;
    const hub = cyl(root, 0.13, 0.175, "#bac3b6", x, 0.3, z);
    hub.rotation.z = Math.PI / 2;
  }
  for (const x of [-0.43, 0.43]) {
    box(root, 0.22, 0.075, 0.04, material("#fff1c9", { emissive: "#ffe6a5", emissiveIntensity: 0.35 }), x, 0.5, 1.18);
    box(root, 0.25, 0.065, 0.04, "#b9604e", x, 0.48, -1.18);
  }
  box(root, 0.18, 0.015, 0.66, cream2, 0, 0.63, 0.73);
  return root;
}
function cable(parent, points, color = ink2, radius = 0.035) {
  const curve = new THREE5.CatmullRomCurve3(points.map((point) => new THREE5.Vector3(...point)));
  return mesh(parent, new THREE5.TubeGeometry(curve, 24, radius, 6, false), color);
}
function charger(parent, x, z) {
  const root = group(parent, x, 0.46, z);
  root.name = "EV charging station";
  rounded(root, 0.74, 1.72, 0.55, 0.1, cream2, 0, 0.87, 0);
  rounded(root, 0.8, 0.16, 0.61, 0.05, mint, 0, 1.69, 0);
  box(root, 0.48, 0.61, 0.025, ink2, 0, 1.16, 0.29);
  textSign(root, "EV", 0.4, 0.32, "#b8efd1", ink2, 0, 1.26, 0.31);
  for (let i = 0; i < 3; i++) box(root, 0.075, 0.12, 0.03, mint, -0.12 + i * 0.12, 0.98, 0.31);
  cable(root, [[0.37, 1.28, 0.06], [0.7, 1.01, 0.13], [0.72, 0.35, 0.24], [0.47, 0.3, 0.36], [0.4, 0.99, 0.33]]);
  const plug = box(root, 0.13, 0.31, 0.14, ink2, 0.4, 1.05, 0.34);
  plug.rotation.z = -0.25;
}
function checkeredFlag(parent, x, z, reverse = false) {
  cyl(parent, 0.038, 2.1, "#c7b888", x, 4.28, z);
  const flag = group(parent, x, 4.75, z);
  flag.rotation.y = reverse ? -0.2 : 0.2;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    box(flag, 0.22, 0.22, 0.035, (row + col) % 2 ? ink2 : cream2, (col + 0.5) * 0.22 * (reverse ? -1 : 1), -row * 0.22, 0);
  }
}
function buildPitStop(parent, color = mint) {
  const root = group(parent), animation = [];
  root.name = "EVision service garage";
  const floor = material("#6e807a", { roughness: 0.94 });
  rounded(root, 8.6, 0.34, 7, 0.24, cream2, 0, 0.2, 0);
  rounded(root, 8.12, 0.1, 6.55, 0.12, floor, 0, 0.42, 0);
  rounded(root, 7.3, 3.1, 0.35, 0.06, cream2, -0.25, 2.02, -2.55);
  box(root, 3.55, 2.5, 0.05, ink2, -1.65, 1.94, -2.35);
  for (const x of [-3.65, 0.45, 3.15]) {
    box(root, 0.25, 3.2, 1.85, cream2, x, 2.05, -1.8);
    box(root, 0.27, 0.48, 1.88, color, x, 0.76, -1.8);
  }
  rounded(root, 7.65, 0.26, 2.15, 0.09, ink2, -0.25, 3.69, -1.69);
  box(root, 7.65, 0.11, 2.18, color, -0.25, 3.86, -1.69);
  box(root, 7.65, 0.56, 0.2, ink2, -0.25, 3.46, -0.58);
  textSign(root, "EVISION \xB7 PIT STOP", 6.2, 0.48, cream2, ink2, -0.25, 3.49, -0.465);
  textSign(root, "01 / SERVICE", 2.35, 0.32, cream2, ink2, -1.65, 2.98, -2.31);
  textSign(root, "CHARGE & GO", 1.98, 0.3, ink2, cream2, 1.8, 2.8, -2.34);
  for (const x of [-2.95, -0.35]) box(root, 0.055, 0.015, 3.85, cream2, x, 0.48, 0.15);
  box(root, 2.65, 0.015, 0.055, cream2, -1.65, 0.48, 2.05);
  for (const x of [-2.9, -0.4]) {
    rounded(root, 0.24, 2.35, 0.37, 0.04, color, x, 1.64, -0.25);
    box(root, 0.38, 0.1, 0.6, ink2, x, 0.53, -0.25);
  }
  const lift = group(root, -1.65, 0.65, 0.1);
  lift.name = "Vehicle service lift";
  lift.userData.dynamic = true;
  for (const x of [-0.56, 0.56]) box(lift, 0.24, 0.14, 2.75, "#b2b7a5", x, 0, 0);
  box(lift, 2.6, 0.12, 0.25, ink2, 0, -0.08, -0.35);
  const vehicle = car(lift, "#ece7d7");
  vehicle.position.y = 0.08;
  animation.push((time) => {
    lift.position.y = 0.76 + Math.sin(time * 0.55) * 0.2;
  });
  const tools = group(root, 1.05, 0.47, -0.45);
  tools.name = "Workshop tool trolley";
  rounded(tools, 0.94, 0.76, 0.62, 0.05, color, 0, 0.48, 0);
  box(tools, 1.05, 0.08, 0.72, ink2, 0, 0.91, 0);
  for (let i = 0; i < 3; i++) {
    box(tools, 0.79, 0.035, 0.025, cream2, 0, 0.32 + i * 0.2, 0.32);
    box(tools, 0.32, 0.035, 0.04, ink2, 0, 0.38 + i * 0.2, 0.34);
  }
  for (const x of [-0.34, 0.34]) for (const z of [-0.2, 0.2]) {
    const wheel = cyl(tools, 0.09, 0.09, rubber, x, 0.09, z);
    wheel.rotation.z = Math.PI / 2;
  }
  for (let i = 0; i < 3; i++) {
    const tire = torus(root, 0.29, 0.12, rubber, -3.36, 0.61 + i * 0.25, 0.85);
    tire.rotation.x = Math.PI / 2;
  }
  charger(root, 2.77, 0.6);
  rounded(root, 1.3, 0.06, 1.7, 0.04, color, 2.7, 0.5, 1.05);
  for (const x of [-3.6, 3.6]) {
    box(root, 0.38, 0.06, 0.38, ink2, x, 0.5, 2.65);
    mesh(root, new THREE5.ConeGeometry(0.15, 0.4, 12), "#c89954", x, 0.72, 2.65);
    cyl(root, 0.085, 0.07, cream2, x, 0.75, 2.65);
  }
  for (let i = 0; i < 20; i++) box(root, 0.37, 0.018, 0.18, i % 2 ? ink2 : cream2, -3.51 + i * 0.37, 0.49, 2.68);
  const lane = textSign(root, "PIT LANE", 2.1, 0.45, cream2, "#6e807a", -0.2, 0.485, 2.98);
  lane.rotation.x = -Math.PI / 2;
  checkeredFlag(root, -3.5, -1.85);
  checkeredFlag(root, 3, -1.85, true);
  return { root, animation };
}
function buildParking(parent, color = "#659c88") {
  const root = group(parent), animation = [];
  root.name = "ATLAS parking navigation";
  const road = "#71877b";
  rounded(root, 8.6, 0.34, 7.2, 0.25, cream2, 0, 0.2, 0);
  rounded(root, 8.18, 0.09, 6.8, 0.12, road, 0, 0.42, 0);
  for (const x of [-3.55, 1.1]) for (const z of [-2.75, 0.6]) box(root, 0.24, 1.95, 0.25, cream2, x, 1.46, z);
  box(root, 4.9, 0.25, 3.9, cream2, -1.22, 2.48, -1.12);
  box(root, 4.64, 0.035, 3.65, road, -1.22, 2.63, -1.12);
  for (const x of [-3.62, 1.18]) box(root, 0.12, 0.39, 3.9, color, x, 2.8, -1.12);
  box(root, 4.95, 0.39, 0.12, color, -1.22, 2.8, -3.02);
  box(root, 4.95, 0.25, 0.13, cream2, -1.22, 2.9, 0.8);
  for (const x of [-3.5, -2.3, -1.1, 0.1, 1.1]) box(root, 0.065, 0.02, 1.83, cream2, x, 2.655, -1.98);
  box(root, 4.62, 0.02, 0.055, cream2, -1.22, 2.655, -1.07);
  for (const [x, paint] of [[-2.91, "#deb26a"], [-0.5, "#d5e4d7"]]) {
    const parked = car(root, paint);
    parked.scale.setScalar(0.7);
    parked.position.set(x, 2.68, -2.02);
  }
  const lower = car(root, "#acbdce");
  lower.scale.setScalar(0.66);
  lower.position.set(-2.95, 0.47, -1.78);
  const rise = 2.18, run = 3.5, slope = Math.atan2(rise, run), length = Math.hypot(rise, run);
  const ramp = group(root, 2.32, 1.53, -1.08);
  ramp.rotation.x = slope;
  box(ramp, 1.62, 0.14, length, cream2);
  box(ramp, 1.4, 0.02, length, road, 0, 0.08, 0);
  for (const x of [-0.78, 0.78]) box(ramp, 0.095, 0.27, length, color, x, 0.2, 0);
  for (let i = 0; i < 7; i++) box(ramp, 0.055, 0.02, 0.29, cream2, 0, 0.097, -1.72 + i * 0.56);
  box(root, 1.2, 0.2, 0.7, cream2, 1.32, 2.48, -2.85);
  const tower = group(root, -3.65, 0.46, -2.9);
  tower.name = "Parking sign tower";
  rounded(tower, 0.88, 4.5, 0.86, 0.07, color, 0, 2.25, 0);
  rounded(tower, 1.26, 1.26, 0.2, 0.08, ink2, 0, 3.9, 0.49);
  textSign(tower, "P", 1.08, 1.08, cream2, ink2, 0, 3.9, 0.602, 600);
  textSign(tower, "02", 0.6, 0.4, cream2, ink2, 0, 2.83, 0.44);
  textSign(tower, "01", 0.6, 0.4, cream2, ink2, 0, 1.06, 0.44);
  box(tower, 1.11, 0.14, 1.09, cream2, 0, 4.58, 0);
  for (const x of [-3.7, 1.02]) cyl(root, 0.065, 1.22, ink2, x, 1.08, 1.65);
  box(root, 4.86, 0.61, 0.24, color, -1.34, 1.95, 1.65);
  textSign(root, "ATLAS \xB7 PARKING", 4.57, 0.48, cream2, ink2, -1.34, 1.96, 1.782);
  const gate = group(root, 0.3, 0.47, 1.6);
  rounded(gate, 0.3, 0.87, 0.32, 0.035, ink2, 0, 0.44, 0);
  box(gate, 1.9, 0.11, 0.1, cream2, -0.77, 0.85, 0);
  for (let i = 0; i < 5; i++) box(gate, 0.15, 0.115, 0.11, color, -1.57 + i * 0.35, 0.85, 0);
  charger(root, -3.25, 0.35);
  for (let i = 0; i < 9; i++) cyl(root, 0.055, 0.025, "#bce3bb", -1.5 + i * 0.45, 0.49, 2.55);
  const routeCar = car(root, "#d4ac6d");
  routeCar.name = "Parking approach vehicle";
  routeCar.userData.dynamic = true;
  routeCar.scale.setScalar(0.57);
  routeCar.rotation.y = Math.PI / 2;
  animation.push((time) => {
    routeCar.position.set(Math.sin(time * 0.3) * 1.15, 0.49, 2.46);
  });
  const entry = textSign(root, "IN  \u2192", 1, 0.4, cream2, road, -2.7, 0.49, 2.5);
  entry.rotation.x = -Math.PI / 2;
  return { root, animation };
}

// assets/wonder/park-source/attractions.js
function bumperCar(parent, color = "#cf654c") {
  const g = group(parent);
  g.userData.dynamic = true;
  rounded(g, 1.35, 0.32, 1.75, 0.16, "#2f3439", 0, 0.25, 0);
  rounded(g, 1.15, 0.42, 1.5, 0.2, material(color, { metalness: 0.35, roughness: 0.3 }), 0, 0.49, 0);
  rounded(g, 0.8, 0.34, 0.7, 0.14, "#322f36", 0, 0.75, -0.22);
  rounded(g, 0.82, 0.3, 0.18, 0.06, "#e8bf80", 0, 0.86, -0.55);
  for (const x of [-0.43, 0.43]) sphere(g, 0.105, 0.055, 0.045, material("#fff1b0", { emissive: "#ffcd6a", emissiveIntensity: 0.5 }), x, 0.57, 0.765);
  cyl(g, 0.025, 2.7, "#b7b0a0", 0, 1.75, -0.65);
  sphere(g, 0.085, 0.085, 0.085, "#edc981", 0, 3.08, -0.65);
  const steering = torus(g, 0.17, 0.027, "#ead5b0", 0, 0.78, 0.13);
  steering.rotation.x = -0.55;
  return g;
}
function buildBumper(parent) {
  const root = group(parent);
  const animation = [];
  const cream3 = "#ecdcc1", red = "#bc6051", gold = "#d4b477";
  rounded(root, 8.5, 0.42, 6.8, 0.3, cream3, 0, 0.22, 0);
  rounded(root, 7.8, 0.08, 5.9, 0.12, material("#7f9ca0", { metalness: 0.35, roughness: 0.3 }), 0, 0.48, 0);
  for (let i = 0; i < 5; i++) {
    const ring = torus(root, 1 + i * 0.38, 0.025, "#d9dfcc", 0, 0.54, 0);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.x = 1.42;
  }
  for (const x of [-3.7, 3.7]) for (const z of [-2.7, 2.7]) {
    cyl(root, 0.14, 3.4, cream3, x, 2.1, z);
    for (let j = 0; j < 5; j++) cyl(root, 0.147, 0.2, red, x, 0.8 + j * 0.57, z);
    cyl(root, 0.25, 0.15, gold, x, 3.74, z);
  }
  rounded(root, 8.4, 0.22, 2.5, 0.12, red, 0, 3.95, -1.75);
  box(root, 8.5, 0.18, 0.22, gold, 0, 3.76, -0.48);
  for (let i = 0; i < 18; i++) box(root, 0.22, 0.05, 2.5, cream3, -4 + i * 0.47, 4.08, -1.75);
  box(root, 8.6, 0.48, 0.38, red, 0, 3.66, 2.86);
  textSign(root, "DOPAMIN SPEEDWAY", 6.7, 0.58, "#fff1cd", "#ad4e43", 0, 3.67, 3.06);
  for (let i = 0; i < 22; i++) sphere(root, 0.065, 0.065, 0.065, material("#fff0bb", { emissive: "#ffd78a", emissiveIntensity: 0.7 }), -4.02 + i * 0.383, 3.31, 3.08);
  for (const x of [-3.7, 3.7]) box(root, 0.12, 0.5, 5.5, cream3, x, 0.83, 0);
  for (let i = 0; i < 4; i++) {
    const car2 = bumperCar(root, ["#dc765b", "#e4bf57", "#588f92", "#a98bb8"][i]);
    car2.scale.setScalar(0.8);
    animation.push((t) => {
      const a = t * 0.38 + i * Math.PI / 2;
      car2.position.set(Math.cos(a) * 2.35, 0.48, Math.sin(a) * 1.55);
      car2.rotation.y = -a + Math.PI;
    });
    if (i === 0) {
      const driver = disneyCharacter(car2, "mickey", 0.37);
      driver.position.set(0, 0.55, -0.15);
      animation.push((t) => driver.userData.animate(t, "drive"));
    }
  }
  return { root, animation };
}
function buildTheater(parent) {
  const root = group(parent);
  const cream3 = "#efdebf", rose = "#cc9790", dark = "#3b5553", gold = material("#d2b16c", { metalness: 0.5, roughness: 0.35 });
  rounded(root, 8.1, 0.42, 6.3, 0.3, cream3, 0, 0.22, 0);
  rounded(root, 7.3, 4.8, 5.2, 0.14, rose, 0, 2.75, -0.3);
  box(root, 7.6, 0.3, 5.5, cream3, 0, 5.24, -0.3);
  box(root, 7.7, 0.12, 5.6, gold, 0, 5.45, -0.3);
  box(root, 3.2, 1.75, 0.35, cream3, 0, 5.25, 2.46);
  box(root, 2.8, 1.6, 0.22, "#7b9a9b", 0, 5.39, 2.7);
  for (const x of [-3.35, -2.8, 2.8, 3.35]) {
    box(root, 0.2, 4.75, 0.38, cream3, x, 2.8, 2.45);
    box(root, 0.1, 4.8, 0.12, gold, x, 2.8, 2.68);
  }
  for (const x of [-1.45, 0, 1.45]) {
    arch(root, 1.22, 2.8, 0.08, cream3, x, 0.55, 2.4);
    arch(root, 0.97, 2.5, 0.06, dark, x, 0.6, 2.51);
    box(root, 0.025, 2, 0.035, gold, x, 1.6, 2.6);
    sphere(root, 0.055, 0.055, 0.025, gold, x + 0.15, 1.7, 2.64);
  }
  rounded(root, 7.9, 0.65, 1.8, 0.12, gold, 0, 3.6, 3.02);
  box(root, 7.55, 0.41, 0.035, "#f5eacb", 0, 3.6, 3.95);
  textSign(root, "STARLIGHT CINEMA", 6.85, 0.55, "#fff0ca", "#406561", 0, 4.52, 2.79);
  textSign(root, "NOW SHOWING \xB7 WONDER PARK", 6.6, 0.38, "#635646", "#f8edce", 0, 3.59, 3.98);
  for (let i = 0; i < 24; i++) sphere(root, 0.063, 0.063, 0.063, material("#ffefb0", { emissive: "#f2bb6b", emissiveIntensity: 0.8 }), -3.65 + i * 0.317, 3.23, 3.82);
  for (let i = -2; i <= 2; i++) box(root, 0.14, 0.9 - Math.abs(i) * 0.16, 0.2, gold, i * 0.33, 6.25, 2.52);
  const star = new THREE6.Shape();
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 0.21 : 0.48;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? star.lineTo(x, y) : star.moveTo(x, y);
  }
  star.closePath();
  const m = new THREE6.Mesh(new THREE6.ExtrudeGeometry(star, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }), gold);
  m.position.set(0, 6.2, 2.75);
  root.add(m);
  for (const x of [-3.1, 3.1]) {
    box(root, 0.75, 1.35, 0.04, "#45606b", x, 2, 2.73);
    textSign(root, "WONDER", 0.67, 0.27, "#f5e4be", "#45606b", x, 1.98, 2.765);
  }
  return { root, animation: [] };
}
function buildMusic(parent) {
  const root = group(parent);
  const teal = "#62928c", cream3 = "#eadbbd", gold = "#d3b06b";
  cyl(root, 3.7, 0.42, cream3, 0, 0.22, 0);
  cyl(root, 3.35, 0.18, "#aa9a7b", 0, 0.53, 0);
  cyl(root, 3.23, 0.08, "#d8bba1", 0, 0.66, 0);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const x = Math.cos(a) * 2.85, z = Math.sin(a) * 2.85;
    cyl(root, 0.11, 3.6, cream3, x, 2.4, z);
    cyl(root, 0.21, 0.15, gold, x, 4.16, z);
    cyl(root, 0.21, 0.12, gold, x, 0.78, z);
  }
  cyl(root, 3.3, 0.35, teal, 0, 4.17, 0);
  cone(root, 3.7, 1.65, teal, 0, 5.05, 0);
  cone(root, 0.16, 1, gold, 0, 6.34, 0);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const bar = cyl(root, 0.037, 3.72, cream3, Math.sin(a) * 1.74, 5.12, Math.cos(a) * 1.74);
    bar.rotation.set(Math.cos(a) * 1.16, 0, -Math.sin(a) * 1.16);
  }
  textSign(root, "MAGIC VOICE", 4.3, 0.58, "#fbe8bc", "#406c63", 0, 3.8, 3.05);
  for (let i = 0; i < 4; i++) box(root, 2.5, 0.15, 0.6, cream3, 0, 0.65 - i * 0.14, 3.1 + i * 0.48);
  const mic = group(root, 0, 0.66, 0.4);
  cyl(mic, 0.035, 1.5, gold, 0, 0.78, 0);
  cyl(mic, 0.34, 0.07, "#505453", 0, 0.07, 0);
  sphere(mic, 0.11, 0.23, 0.11, material("#a8b2ad", { metalness: 0.85, roughness: 0.3 }), 0, 1.6, 0);
  for (const x of [-2.2, 2.2]) {
    rounded(root, 0.62, 1.2, 0.55, 0.05, "#435b53", x, 1.3, 0);
    for (const y of [1.06, 1.6]) {
      const r = torus(root, 0.18, 0.03, "#8fa896", x, y, 0.29);
      sphere(root, 0.15, 0.15, 0.025, "#233e34", x, y, 0.3);
    }
  }
  return { root, animation: [] };
}
function buildGeneric(parent, theme, color) {
  const root = group(parent);
  const animation = [];
  const cream3 = "#e9dcc1", gold = "#ceb176";
  cyl(root, 3.6, 0.4, cream3, 0, 0.24, 0);
  if (theme === "construction") {
    box(root, 7.2, 0.15, 5.8, "#bbaa82", 0, 0.55, 0);
    for (const x of [-2, 0, 2]) for (const z of [-1.7, 1.7]) {
      box(root, 0.23, 3.8, 0.23, "#c9c6b5", x, 2.5, z);
      box(root, 2.2, 0.25, 0.35, "#d3cfba", x, 4.2, z);
    }
    box(root, 4.6, 0.2, 3.8, "#d6cfb7", 0, 2.4, 0);
    box(root, 2.2, 1.5, 0.13, "#a0b5b2", -1.1, 3.27, 1.77);
    for (const x of [-2.3, 2.3]) box(root, 0.16, 1.8, 3.8, "#c8bd9d", x, 1.45, 0);
    const crane = group(root, -2.8, 0.5, -1.6);
    for (const x of [-0.26, 0.26]) for (const z of [-0.26, 0.26]) box(crane, 0.08, 7, 0.08, "#c89640", x, 3.5, z);
    for (let i = 0; i < 11; i++) {
      box(crane, 0.59, 0.055, 0.59, "#e0b15d", 0, 0.45 + i * 0.58, 0);
      const cross = box(crane, 0.055, 0.83, 0.06, "#e0b15d", 0, 0.68 + i * 0.58, 0.27);
      cross.rotation.z = i % 2 ? 0.65 : -0.65;
    }
    const jib = group(crane, 0, 6.85, 0);
    jib.userData.dynamic = true;
    box(jib, 6.5, 0.15, 0.42, "#d6a144", 1.7, 0, 0);
    box(jib, 6.5, 0.12, 0.42, "#d6a144", 1.7, 0.62, 0);
    for (let i = 0; i < 12; i++) {
      const beam = box(jib, 0.065, 0.79, 0.08, "#e4bd73", -1.3 + i * 0.54, 0.31, 0.2);
      beam.rotation.z = i % 2 ? 0.7 : -0.7;
    }
    box(jib, 0.7, 0.75, 0.85, "#899693", -1.4, -0.2, 0);
    box(jib, 0.7, 0.7, 0.65, "#d9b05c", 0.7, -0.2, 0);
    box(jib, 0.03, 2.6, 0.03, "#7f7e70", 4.1, -1.33, 0);
    const hook = torus(jib, 0.15, 0.036, "#717971", 4.1, -2.7, 0);
    animation.push((t) => jib.rotation.y = Math.sin(t * 0.2) * 0.22);
    for (let i = 0; i < 8; i++) {
      const x = -3.2 + i * 0.9;
      box(root, 0.78, 0.8, 0.13, i % 2 ? "#d2a34d" : "#f0ddb2", x, 0.96, 3.05);
      box(root, 0.09, 1.1, 0.14, "#756c55", x, 0.85, 3);
    }
    textSign(root, "ATLAS \xB7 COMING TO LIFE", 5.8, 0.58, "#4d5643", "#f0dbab", 0, 1, 3.14);
    for (let i = 0; i < 4; i++) {
      const x = 2.7 + i % 2 * 0.43, z = -1 + Math.floor(i / 2) * 0.6;
      cone(root, 0.18, 0.45, "#cf8d4f", x, 0.79, z);
      box(root, 0.43, 0.05, 0.43, "#55574c", x, 0.57, z);
    }
  } else if (theme === "pinball") {
    rounded(root, 6.6, 1, 5.5, 0.28, color, 0, 0.9, 0);
    rounded(root, 6.2, 0.15, 5.1, 0.18, "#314e60", 0, 1.48, 0);
    for (const x of [-3, 3]) box(root, 0.16, 1.4, 5.1, cream3, x, 2.1, 0);
    box(root, 6.2, 1.4, 0.16, cream3, 0, 2.1, -2.5);
    for (let i = 0; i < 6; i++) {
      const x = (i % 3 - 1) * 1.5, z = Math.floor(i / 3) * 1.7 - 0.8;
      cyl(root, 0.45, 0.25, "#e0ae64", x, 1.7, z);
      cyl(root, 0.34, 0.22, i % 2 ? "#c77572" : "#8fb3a5", x, 1.91, z);
    }
    for (const side of [-1, 1]) {
      const flipper = rounded(root, 1.5, 0.16, 0.32, 0.1, "#e8d5a0", side * 0.82, 1.8, 1.78);
      flipper.userData.dynamic = true;
      animation.push((t) => flipper.rotation.y = side * (0.25 + Math.sin(t * 2) * 0.3));
    }
    const ball = sphere(root, 0.2, 0.2, 0.2, material("#e6e9e5", { metalness: 0.9, roughness: 0.18 }), 0, 1.9, 0);
    ball.userData.dynamic = true;
    animation.push((t) => ball.position.set(Math.sin(t * 0.85) * 2.3, 1.9, Math.cos(t * 1.1) * 1.8));
    for (const x of [-2.8, 2.8]) cyl(root, 0.1, 3.5, gold, x, 3, -2.45);
    textSign(root, "LUCKY PINBALL", 5.8, 1, "#f3e4b2", "#496c7c", 0, 4.5, -2.43);
    for (let i = 0; i < 10; i++) sphere(root, 0.06, 0.06, 0.06, material("#f6cf7b", { emissive: "#ebba59", emissiveIntensity: 0.4 }), -2.6 + i * 0.58, 5.08, -2.35);
  } else if (theme === "space") {
    const rocket = group(root, 0, 0.4, 0);
    rocket.userData.dynamic = true;
    cyl(rocket, 0.85, 3.4, "#e6e1d2", 0, 2.2, 0);
    cone(rocket, 0.85, 1.5, color, 0, 4.65, 0);
    cyl(rocket, 0.87, 0.5, color, 0, 1.3, 0);
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      const fin = box(rocket, 0.13, 1.6, 1.3, color, Math.sin(a) * 0.87, 0.95, Math.cos(a) * 0.87);
      fin.rotation.y = a;
    }
    sphere(rocket, 0.32, 0.32, 0.08, "#598b9c", 0, 2.9, 0.81);
    const orbit = torus(root, 2.8, 0.065, gold, 0, 3, 0);
    orbit.rotation.set(0.6, 0.3, 0.3);
    animation.push((t) => {
      rocket.position.y = 0.4 + Math.sin(t) * 0.16;
    });
  } else if (theme === "ocean") {
    sphere(root, 2.7, 2.3, 2.7, material("#6ba9ae", { transparent: true, opacity: 0.52, roughness: 0.15, metalness: 0.2 }), 0, 1.4, 0);
    for (let i = 0; i < 5; i++) {
      const fish = group(root);
      fish.userData.dynamic = true;
      sphere(fish, 0.3, 0.17, 0.12, ["#e2bb59", "#e69b77"][i % 2]);
      const tail = cone(fish, 0.19, 0.25, "#e5c173", -0.32, 0, 0);
      tail.rotation.z = Math.PI / 2;
      animation.push((t) => {
        const a = t * 0.35 + i;
        fish.position.set(Math.cos(a) * 1.8, 1.3 + i * 0.25, Math.sin(a) * 1.8);
        fish.rotation.y = -a;
      });
    }
  } else if (theme === "garden") {
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      cyl(root, 0.065, 2.5, "#65835a", Math.cos(a) * 2, 1.6, Math.sin(a) * 2);
      for (let j = 0; j < 5; j++) {
        const b = j / 5 * Math.PI * 2;
        sphere(root, 0.45, 0.18, 0.45, i % 2 ? "#c78194" : "#e1c57c", Math.cos(a) * 2 + Math.cos(b) * 0.3, 2.85, Math.sin(a) * 2 + Math.sin(b) * 0.3);
      }
      sphere(root, 0.22, 0.18, 0.22, "#e8c160", Math.cos(a) * 2, 2.95, Math.sin(a) * 2);
    }
  } else if (theme === "laboratory") {
    cyl(root, 2.6, 2.8, "#d9e2da", 0, 1.8, 0);
    sphere(root, 2.6, 1.6, 2.6, color, 0, 3.2, 0);
    for (let i = 0; i < 3; i++) {
      const ring = torus(root, 1.1, 0.055, gold, 0, 5.15, 0);
      ring.rotation.set(i * 0.8, 0.7 + i, 0.6);
    }
  } else {
    cyl(root, 3, 0.24, color, 0, 0.6, 0);
    cyl(root, 0.22, 4, cream3, 0, 2.6, 0);
    cone(root, 3.55, 1.5, color, 0, 4.55, 0);
    const carousel = group(root);
    carousel.userData.dynamic = true;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const g = group(carousel, Math.cos(a) * 2.35, 0, Math.sin(a) * 2.35);
      cyl(g, 0.055, 3.5, gold, 0, 2.35, 0);
      sphere(g, 0.5, 0.23, 0.22, cream3, 0, 1.35, 0);
      sphere(g, 0.2, 0.37, 0.19, cream3, 0.32, 1.65, 0);
      for (const x of [-0.25, 0.25]) cyl(g, 0.07, 0.5, gold, x, 1, 0);
      g.rotation.y = -a;
    }
    animation.push((t) => carousel.rotation.y = t * 0.13);
  }
  return { root, animation };
}
function createAttraction(parent, item, position, index) {
  const outer = group(parent, ...position);
  const built = item.theme === "pitstop" ? buildPitStop(outer, item.color) : item.theme === "parking" ? buildParking(outer, item.color) : item.theme === "bumper" ? buildBumper(outer) : item.theme === "theater" ? buildTheater(outer) : item.theme === "music" ? buildMusic(outer) : buildGeneric(outer, item.theme, item.color);
  const character = disneyCharacter(outer, item.character, 1.05);
  character.position.set(item.theme === "theater" ? -3.5 : 3.7, 0.55, 4.35);
  const motion = item.theme === "music" ? "dance" : item.theme === "bumper" ? "drive" : "wave";
  built.animation.push((t) => character.userData.animate(t + index, motion));
  const pick = new THREE6.Mesh(new THREE6.BoxGeometry(9, 7, 8), new THREE6.MeshBasicMaterial({ visible: false }));
  pick.position.y = 3;
  pick.userData.attraction = item.id;
  outer.add(pick);
  return { root: outer, animation: built.animation, pick, label: new THREE6.Vector3(position[0], position[1] + 0.6, position[2] + 5.5), character };
}
export {
  createAttraction,
  createCastle,
  createLandscape,
  staticBatch
};
