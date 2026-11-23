// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  // Close the mobile menu after picking a link (matters for same-page #anchors)
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', false);
  }));
}

// Dropdown menus: open on click (and hover on desktop), close on outside click or Escape
const dropdowns = [...document.querySelectorAll('.dropdown')];
const hoverable = window.matchMedia('(hover: hover) and (min-width: 881px)');

function setOpen(dd, open) {
  dd.classList.toggle('open', open);
  dd.querySelector('button').setAttribute('aria-expanded', open);
}

dropdowns.forEach((dd) => {
  const btn = dd.querySelector('button');
  let closeTimer;
  btn.addEventListener('click', () => {
    // With a mouse, hover already opened it; a click shouldn't immediately close it
    const open = hoverable.matches || !dd.classList.contains('open');
    dropdowns.forEach((other) => { if (other !== dd) setOpen(other, false); });
    setOpen(dd, open);
  });
  dd.addEventListener('mouseenter', () => {
    if (!hoverable.matches) return;
    clearTimeout(closeTimer);
    dropdowns.forEach((other) => setOpen(other, other === dd));
  });
  dd.addEventListener('mouseleave', () => {
    if (!hoverable.matches) return;
    closeTimer = setTimeout(() => setOpen(dd, false), 150);
  });
  dd.addEventListener('focusout', (e) => {
    if (!dd.contains(e.relatedTarget)) setOpen(dd, false);
  });
});

document.addEventListener('click', (e) => {
  dropdowns.forEach((dd) => { if (!dd.contains(e.target)) setOpen(dd, false); });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = dropdowns.find((dd) => dd.classList.contains('open'));
  if (open) { setOpen(open, false); open.querySelector('button').focus(); }
});

// Footer year
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Header gets a shadow once the page scrolls
const header = document.querySelector('.site-header');
if (header) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// Scroll reveal: content eases in as it enters the screen
if (!reduceMotion && 'IntersectionObserver' in window) {
  const targets = document.querySelectorAll(
    'main > section:not(.marquee) > .container > *:not(.grid):not(.gallery), .grid > *, .gallery > *, .step'
  );
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  targets.forEach((el) => {
    const siblings = el.parentElement ? [...el.parentElement.children] : [];
    el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 5) * 80}ms`;
    el.classList.add('reveal');
    io.observe(el);
  });
}

// 3D bridge: the club's Onshape model (images/bridge.glb), loaded only on pages that show it.
//   data-bridge3d="float"  turns and drifts as the page scrolls, leaning toward the cursor
//   data-bridge3d="orbit"  drag to spin, slow auto-rotation when idle
// three.js is only loaded on pages that show a 3D model
let threePromise;
function loadThree() {
  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  threePromise = threePromise || loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
  return threePromise;
}

const bridgeMounts = document.querySelectorAll('[data-bridge3d]');
if (bridgeMounts.length) {
  loadThree()
    .then(() => loadThree.gltf = loadThree.gltf || new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
      s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    }))
    .then(() => new THREE.GLTFLoader().loadAsync('images/bridge.glb?v=2'))
    .then((gltf) => bridgeMounts.forEach((mount) => mountBridge(mount, gltf.scene.clone(true))))
    .catch(() => { /* keep the static fallback */ });
}

function mountBridge(mount, model) {
  const mode = mount.dataset.bridge3d;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  mount.appendChild(renderer.domElement);
  mount.classList.add('live');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
  scene.add(new THREE.HemisphereLight(0xfff1e0, 0x1f3550, mode === 'float' ? 0.55 : 0.75));
  const sun = new THREE.DirectionalLight(0xfff6ec, mode === 'float' ? 0.85 : 0.8);
  sun.position.set(220, 400, 300);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xff6a2b, mode === 'float' ? 0.9 : 0.35);
  rim.position.set(-300, 120, -260);
  scene.add(rim);

  // Plywood material plus crisp dark edges so it reads like a CAD model
  const ply = new THREE.MeshStandardMaterial({ color: 0xa8683a, roughness: 0.75, metalness: 0 });
  const edgeMat = new THREE.LineBasicMaterial({ color: mode === 'float' ? 0x2a1a0e : 0x3a2414, transparent: true, opacity: 0.55 });
  model.traverse((o) => {
    if (!o.isMesh) return;
    // Wood parts get the shared plywood look; steel hardware and the load plate keep their own materials
    if (!o.material || o.material.name === 'plywood' || !o.material.name) o.material = ply;
    o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), edgeMat));
  });

  // CAD is Z-up in millimetres; stand it up and centre it
  const pivot = new THREE.Group();
  model.rotation.x = -Math.PI / 2;
  pivot.add(model);
  const box = new THREE.Box3().setFromObject(pivot);
  model.position.sub(box.getCenter(new THREE.Vector3()));
  scene.add(pivot);
  const radius = box.getSize(new THREE.Vector3()).length() / 2;

  function resize() {
    const w = mount.clientWidth, h = mount.clientHeight || w * 0.75;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, radius * 0.55, radius * (mode === 'float' ? 4.4 : 4.0) / Math.min(camera.aspect, 1.4));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let spin = -0.6, tilt = 0.18, dragging = false, lastX = 0, idle = 0;
  const mouse = { x: 0, y: 0 };

  if (mode === 'orbit') {
    mount.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; mount.setPointerCapture(e.pointerId); });
    mount.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      spin += (e.clientX - lastX) * 0.01; lastX = e.clientX; idle = 0;
    });
    const stop = () => { dragging = false; };
    mount.addEventListener('pointerup', stop);
    mount.addEventListener('pointercancel', stop);
  } else {
    window.addEventListener('pointermove', (e) => {
      mouse.x = e.clientX / window.innerWidth - 0.5;
      mouse.y = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
  }

  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(mount);

  let last = performance.now(), t = 0, curRotY = spin, curRotX = tilt, curY = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!visible) return;
    t += dt;
    let rotY, rotX, posY = 0;
    if (mode === 'float') {
      // Scroll through the header: the bridge turns about half a revolution and drifts down
      const hero = mount.closest('.hero') || document.body;
      const p = Math.min(Math.max(window.scrollY / Math.max(hero.offsetHeight, 1), 0), 1.2);
      rotY = -0.75 + p * Math.PI * 0.9 + mouse.x * 0.35 + (reduceMotion ? 0 : Math.sin(t * 0.4) * 0.06);
      rotX = 0.22 - p * 0.18 + mouse.y * 0.12;
      posY = -p * radius * 0.35 + (reduceMotion ? 0 : Math.sin(t * 0.8) * radius * 0.015);
    } else {
      idle += dt;
      if (!dragging && idle > 1.5 && !reduceMotion) spin += dt * 0.35;
      rotY = spin; rotX = tilt;
    }
    curRotY += (rotY - curRotY) * Math.min(dt * 6, 1);
    curRotX += (rotX - curRotX) * Math.min(dt * 6, 1);
    curY += (posY - curY) * Math.min(dt * 6, 1);
    pivot.rotation.set(curRotX, curRotY, 0);
    pivot.position.y = curY;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

// Live FEA viewer: the club's SimScale results (images/bridge-fea.bin, built from the exported VTU files).
// Load slider scales the solver's displacement and von Mises stress (linear analysis), hover reads stress,
// drag orbits. File layout is documented in the converter: header, i16 positions, i16 displacements,
// u16 von Mises, u32 triangle indices.
const feaMount = document.querySelector('[data-fea]');
if (feaMount) {
  Promise.all([loadThree(), fetch('images/bridge-fea.bin?v=1').then((r) => {
    if (!r.ok) throw new Error('fea data');
    return r.arrayBuffer();
  })]).then(([, buf]) => mountFEA(feaMount, buf)).catch(() => { /* keep the screenshot fallback */ });
}

function mountFEA(box, buf) {
  const stage = box.querySelector('.fea-stage');
  const tip = box.querySelector('.fea-tip');
  const slider = box.querySelector('[data-load]');
  const sliderOut = box.querySelector('[data-load-out]');
  const playBtn = box.querySelector('[data-play]');
  const modeBtn = box.querySelector('[data-mode]');
  const readout = box.querySelector('.fea-readout');
  const EXAGGERATE = 20;
  if (window.matchMedia('(hover: none)').matches) box.querySelector('.fea-hint').textContent = 'Drag to orbit · tap for stress';

  // ---- decode the binary ----
  const dv = new DataView(buf);
  const nv = dv.getUint32(8, true), nt = dv.getUint32(12, true);
  const f = (o) => dv.getFloat32(o, true);
  const bmin = [f(16), f(20), f(24)], bmax = [f(28), f(32), f(36)];
  const dmax = f(40), vmax = f(44);
  let off = 48;
  const qpos = new Int16Array(buf, off, nv * 3); off += nv * 6;
  const qdisp = new Int16Array(buf, off, nv * 3); off += nv * 6;
  const qvm = new Uint16Array(buf, off, nv); off += nv * 2;
  const idx = new Uint32Array(buf.slice(off, off + nt * 12)); // copied: the index block isn't 4-byte aligned

  const base = new Float32Array(nv * 3), disp = new Float32Array(nv * 3), vm = new Float32Array(nv);
  for (let i = 0; i < nv * 3; i++) {
    const k = i % 3;
    base[i] = (bmin[k] + ((qpos[i] + 32767) / 65534) * (bmax[k] - bmin[k])) * 1000; // metres -> mm
    disp[i] = (qdisp[i] / 32767) * dmax * 1000;
  }
  for (let i = 0; i < nv; i++) vm[i] = (qvm[i] / 65535) * vmax / 1e6; // Pa -> MPa
  const vmMaxMPa = vmax / 1e6;

  // ---- scene ----
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  stage.insertBefore(renderer.domElement, tip); // linear output keeps the stress colours as vivid as SimScale's
  box.classList.add('live');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 0.55); key.position.set(200, 400, 300); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.2); fill.position.set(-300, 100, -200); scene.add(fill);

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(base);
  const col = new Float32Array(nv * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const centre = geo.boundingBox.getCenter(new THREE.Vector3());
  const radius = geo.boundingBox.getSize(new THREE.Vector3()).length() / 2;

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(centre).multiplyScalar(-1);
  const model = new THREE.Group();
  model.add(mesh);
  model.rotation.x = -Math.PI / 2; // CAD is Z-up
  const pivot = new THREE.Group();
  pivot.add(model);
  scene.add(pivot);

  const marker = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.012, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  marker.visible = false;
  model.add(marker);

  // SimScale-style rainbow: blue -> cyan -> green -> yellow -> red
  const STOPS = [[0, [0.05, 0.1, 0.85]], [0.25, [0.1, 0.75, 1]], [0.5, [0.3, 0.9, 0.3]], [0.75, [1, 0.88, 0.1]], [1, [0.9, 0.12, 0.1]]];
  const WOOD = [0.72, 0.5, 0.32];
  function cmap(t, out, o) {
    t = Math.min(Math.max(t, 0), 1);
    for (let s = 1; s < STOPS.length; s++) {
      if (t <= STOPS[s][0]) {
        const [t0, c0] = STOPS[s - 1], [t1, c1] = STOPS[s], u = (t - t0) / (t1 - t0);
        out[o] = c0[0] + (c1[0] - c0[0]) * u; out[o + 1] = c0[1] + (c1[1] - c0[1]) * u; out[o + 2] = c0[2] + (c1[2] - c0[2]) * u;
        return;
      }
    }
  }

  let load = 0, stressMode = true;
  function applyLoad() {
    for (let i = 0; i < nv * 3; i++) pos[i] = base[i] + disp[i] * load * EXAGGERATE;
    for (let i = 0; i < nv; i++) {
      if (stressMode) cmap((vm[i] * load) / vmMaxMPa, col, i * 3);
      else { col[i * 3] = WOOD[0]; col[i * 3 + 1] = WOOD[1]; col[i * 3 + 2] = WOOD[2]; }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.computeBoundingSphere();
    slider.value = Math.round(load * 100);
    sliderOut.textContent = `${Math.round(load * 100)}%`;
    readout.textContent = `Peak stress ${(vmMaxMPa * load).toFixed(1)} MPa · max deflection ${(dmax * 1000 * load).toFixed(3)} mm`;
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, radius * 1.1, radius * 4.3 / Math.min(camera.aspect, 1.3));
    camera.lookAt(0, -radius * 0.05, 0);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- interaction ----
  let yaw = -0.6, pitch = 0.05, vyaw = 0, dragging = false, lastX = 0, lastY = 0, idle = 0, hover = null;
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); idle = 0; hover = e; });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tri = new THREE.Triangle(), bary = new THREE.Vector3();
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) {
      vyaw = (e.clientX - lastX) * 0.008; yaw += vyaw;
      pitch = Math.min(Math.max(pitch + (e.clientY - lastY) * 0.006, -0.6), 0.9);
      lastX = e.clientX; lastY = e.clientY; idle = 0;
    }
    hover = e;
  });
  canvas.addEventListener('pointerleave', () => { hover = null; tip.hidden = true; marker.visible = false; });

  function probe(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(mesh)[0];
    if (!hit) { tip.hidden = true; marker.visible = false; return; }
    const { a, b, c } = hit.face;
    va.fromArray(pos, a * 3); vb.fromArray(pos, b * 3); vc.fromArray(pos, c * 3);
    tri.set(va, vb, vc).getBarycoord(mesh.worldToLocal(hit.point.clone()), bary);
    const s = (vm[a] * bary.x + vm[b] * bary.y + vm[c] * bary.z) * load;
    tip.textContent = load > 0 ? `σ = ${s.toFixed(1)} MPa` : 'Add load to see stress';
    tip.style.left = `${e.clientX - r.left}px`;
    tip.style.top = `${e.clientY - r.top}px`;
    tip.hidden = false;
    marker.position.copy(mesh.worldToLocal(hit.point.clone())).add(mesh.position);
    marker.visible = true;
  }

  // ---- load animation ----
  let anim = null;
  function play() {
    anim = { t: 0 };
    playBtn.classList.add('playing');
  }
  playBtn.addEventListener('click', () => { if (anim) { anim = null; playBtn.classList.remove('playing'); } else play(); });
  slider.addEventListener('input', () => { anim = null; playBtn.classList.remove('playing'); load = slider.value / 100; applyLoad(); });
  modeBtn.addEventListener('click', () => {
    stressMode = !stressMode;
    modeBtn.textContent = stressMode ? 'Plywood view' : 'Stress view';
    modeBtn.setAttribute('aria-pressed', String(!stressMode));
    box.classList.toggle('wood', !stressMode);
    applyLoad();
  });

  let visible = true, autoplayed = false;
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible && !autoplayed && !reduceMotion) { autoplayed = true; play(); }
  }, { threshold: 0.3 }).observe(box);
  if (reduceMotion) { load = 1; }
  applyLoad();

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!visible) return;
    if (anim) {
      anim.t += dt / 2.6;
      const t = Math.min(anim.t, 1);
      load = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease in-out
      applyLoad();
      if (anim.t >= 1) { anim = null; playBtn.classList.remove('playing'); }
    }
    idle += dt;
    if (!dragging) {
      yaw += vyaw; vyaw *= 0.92;
      if (idle > 2.5 && !reduceMotion) yaw += dt * 0.25;
    }
    pivot.rotation.set(pitch, yaw, 0);
    if (hover && !dragging) probe(hover);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
