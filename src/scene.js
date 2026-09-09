import * as THREE from "three";
import { GLTFLoader } from "../assets/vendor/GLTFLoader.js";
import { clone } from "../assets/utils/SkeletonUtils.js";

// Ângulo do diorama. A vista de batalha usa o mesmo ângulo da vitrine para que
// o tabuleiro fique na diagonal: assim as três frentes se afastam na horizontal,
// que é o eixo com sobra numa tela de computador.
const AZIMUTH = Math.PI / 4;
const CAMERA_HEIGHT = 30;
const CAMERA_RADIUS = 32;
// Eixos de tela da câmera ortográfica. A direção é fixa, então dá para medir o
// tabuleiro contra eles uma única vez, sem depender do estado da câmera.
const CAMERA_LENGTH = Math.hypot(CAMERA_RADIUS, CAMERA_HEIGHT);
const FLATTEN = CAMERA_HEIGHT / CAMERA_LENGTH;
const RISE = CAMERA_RADIUS / CAMERA_LENGTH;
const RIGHT = new THREE.Vector3(Math.cos(AZIMUTH), 0, -Math.sin(AZIMUTH));
const UP = new THREE.Vector3(
  -FLATTEN * Math.sin(AZIMUTH),
  RISE,
  -FLATTEN * Math.cos(AZIMUTH),
);
const SITE_COORDS = [
  [-5.6, -8.4],
  [0, 10.4],
  [5.6, -8.4],
];

export async function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-19, 19, 19, -19, 0.1, 180);
  camera.position.set(26, 34, 38);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xc6edff, 0x567260, 2.4));
  const sun = new THREE.DirectionalLight(0xffe5bc, 3.4);
  sun.position.set(-15, 30, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -30,
    right: 30,
    top: 30,
    bottom: -30,
    near: 1,
    far: 85,
  });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x7bcaff, 1.5);
  rim.position.set(10, 5, -20);
  scene.add(rim);
  const island = new THREE.Group();
  scene.add(island);
  const mats = new Map();
  const material = (color) => {
    if (!mats.has(color))
      mats.set(
        color,
        new THREE.MeshStandardMaterial({ color, roughness: 0.87 }),
      );
    return mats.get(color);
  };
  const box = (w, h, d, color, x, y, z, parent = island) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  box(23, 2.2, 28, 0x667e86, 0, -1.5, 0);
  box(22.5, 0.55, 27.5, 0xa7b3a1, 0, -0.25, 0);
  box(21.6, 0.35, 26.6, 0x70a44d, 0, 0.12, 0);
  for (let x = -10; x <= 10; x += 2)
    for (let z = -12; z <= 12; z += 2)
      if (Math.abs(z) > 1)
        box(
          1.97,
          0.08,
          1.97,
          (x + z) % 4 === 0 ? 0x81b757 : 0x76ac50,
          x,
          0.34,
          z,
        );
  // Faceted underside makes the battlefield a floating diorama. It sits outside
  // the play area, so it is excluded when the camera frames the board.
  const rock = new THREE.Mesh(
    new THREE.CylinderGeometry(15, 8, 6, 7),
    material(0x344f65),
  );
  rock.scale.set(1, 1, 1.12);
  rock.position.set(0, -5, 0);
  rock.rotation.y = 0.2;
  rock.userData.decor = true;
  island.add(rock);
  const river = box(22, 0.16, 3.2, 0x3ebde3, 0, 0.38, 0);
  river.material = new THREE.MeshStandardMaterial({
    color: 0x38bada,
    roughness: 0.25,
    metalness: 0.18,
  });
  for (let x = -10; x < 11; x += 2.5)
    box(1.2, 0.02, 0.08, 0x9be8ed, x, 0.48, (x % 3) * 0.35);
  for (const x of [-5.6, 5.6]) {
    box(3.4, 0.25, 4.5, 0x624a38, x, 0.52, 0);
    for (let z = -2; z <= 2; z += 0.42)
      box(3.35, 0.16, 0.34, 0xc29762, x, 0.72, z);
    for (const dx of [-1.8, 1.8]) {
      box(0.14, 0.14, 4.7, 0xc9b184, x + dx, 1.3, 0);
      for (const z of [-2, 2]) box(0.22, 1.2, 0.22, 0x9a714e, x + dx, 0.95, z);
    }
  }
  for (const x of [-5.6, 5.6])
    for (let z = -11; z <= 11; z += 1.25)
      if (Math.abs(z) > 2.5)
        box(
          2.7,
          0.12,
          1.12,
          Math.round(z * 4) % 2 === 0 ? 0xbac4b2 : 0xaab7a6,
          x,
          0.47,
          z,
        );
  for (let z = -13; z <= 13; z += 1.65)
    for (const x of [-11.2, 11.2]) {
      box(0.9, 0.75, 1.45, 0xb4c4c4, x, 0.3, z);
      box(1, 0.13, 1.5, 0xd1d8ce, x, 0.74, z);
    }
  for (let x = -10; x <= 10; x += 1.7)
    for (const z of [-13.5, 13.5]) box(1.5, 0.7, 0.8, 0xa8b7b5, x, 0.26, z);
  const trees = [];
  function tree(x, z, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0.3, z);
    g.scale.setScalar(scale);
    box(0.35, 1.5, 0.35, 0x765941, 0, 0.7, 0, g);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(1.3 - i * 0.28, 1.9, 5),
        material([0x2e735b, 0x37876a, 0x55a274][i]),
      );
      leaf.position.y = 1.7 + i * 0.75;
      g.add(leaf);
    }
    island.add(g);
    trees.push(g);
  }
  [
    [-9, -10],
    [-9, 8],
    [9, -9],
    [9, 10],
    [-9, 4],
    [9, -5],
    [-8, 12],
    [8, -12],
  ].forEach(([x, z], i) => tree(x, z, 0.8 + (i % 3) * 0.18));
  // Flags carry the same blue and coral heraldry as the source component.
  for (const z of [-10, 10])
    for (const x of [-8, 8]) {
      box(0.08, 3.5, 0.08, 0xe1cda2, x, 1.9, z);
      box(1.1, 0.75, 0.06, z < 0 ? 0x529ff2 : 0xf77767, x + 0.58, 3.1, z);
    }
  const loader = new GLTFLoader(),
    actors = [],
    portraits = {},
    failures = [];
  let loaded = 0,
    total = 10;
  const buildings = [],
    templates = {},
    crew = new Map();
  let targetPoints = [],
    agentPoints = [],
    visibleTeam = null;
  function fit(obj, height) {
    const bounds = new THREE.Box3().setFromObject(obj);
    const size = bounds.getSize(new THREE.Vector3());
    obj.scale.setScalar(height / size.y);
    const b = new THREE.Box3().setFromObject(obj);
    obj.position.y -= b.min.y;
    obj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return obj;
  }
  const thumbRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  thumbRenderer.setSize(256, 300);
  thumbRenderer.setPixelRatio(1);
  thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
  thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  thumbRenderer.toneMappingExposure = 1.35;
  function portrait(obj, name) {
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight(0xcdeaff, 0x596c87, 2.8));
    const light = new THREE.DirectionalLight(0xffe8c5, 3.5);
    light.position.set(-3, 5, 6);
    s.add(light);
    s.add(obj);
    const c = new THREE.PerspectiveCamera(32, 256 / 300, 0.1, 30);
    c.position.set(2.4, 2.3, 5.8);
    c.lookAt(0, 1.1, 0);
    thumbRenderer.render(s, c);
    const image = new Image();
    image.src = thumbRenderer.domElement.toDataURL();
    portraits[name] = image;
    s.remove(obj);
  }
  const jobs = [];
  for (const team of ["blue", "red"])
    for (const [type, x] of [
      ["castle", 0],
      ["tower_A", -5.6],
      ["tower_B", 5.6],
    ]) {
      jobs.push(
        loader
          .loadAsync(`./assets/models/${team}/building_${type}_${team}.gltf`)
          .then((g) => {
            const obj = fit(g.scene, type === "castle" ? 5.1 : 3.3);
            obj.position.x = x;
            obj.position.z =
              (team === "blue" ? -1 : 1) * (type === "castle" ? 10.4 : 8.4);
            obj.rotation.y = team === "blue" ? 0 : Math.PI;
            island.add(obj);
            buildings.push({
              obj,
              scale: obj.scale.y,
              height: type === "castle" ? 5.1 : 3.3,
              siteId:
                team === "blue" && type === "tower_A"
                  ? 0
                  : team === "red" && type === "castle"
                    ? 1
                    : team === "blue" && type === "tower_B"
                      ? 2
                      : null,
            });
          })
          .catch(() => failures.push("Castelo " + team))
          .finally(() => loaded++),
      );
    }
  const names = ["Knight", "Barbarian", "Rogue_Hooded", "Mage"];
  names.forEach((name, i) =>
    jobs.push(
      loader
        .loadAsync(`./assets/models/${name}.glb`)
        .then((g) => {
          const obj = fit(g.scene, 2.1);
          portrait(obj, name);
          templates[name] = { obj, clips: g.animations };
          obj.position.set(
            [-3, -5.6, 5.6, 2.7][i],
            0.55,
            [-6.6, -4.3, 4.3, 6.2][i],
          );
          obj.rotation.y = i < 2 ? 0.4 : Math.PI + 0.3;
          island.add(obj);
          const mixer = new THREE.AnimationMixer(obj);
          const idle = g.animations.find((a) => /idle/i.test(a.name));
          if (idle) mixer.clipAction(idle).play();
          actors.push({ obj, mixer, x: obj.position.x, z: obj.position.z });
        })
        .catch(() => failures.push(name))
        .finally(() => loaded++),
    ),
  );
  Promise.allSettled(jobs).then(() => thumbRenderer.dispose());
  const motes = [];
  const geo = new THREE.OctahedronGeometry(0.12);
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: i % 2 ? 0xffd783 : 0x8de8ff,
        transparent: true,
        opacity: 0.8,
      }),
    );
    scene.add(m);
    motes.push(m);
  }
  const beacons = [];
  for (let i = 0; i < 6; i++) {
    const x = i < 3 ? -9 : 9,
      z = ((i % 3) - 1) * 4;
    const base = box(0.8, 0.35, 0.8, 0x9aa6aa, x, 0.7, z);
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.38),
      new THREE.MeshStandardMaterial({
        color: 0x567687,
        emissive: 0x000000,
        roughness: 0.2,
        metalness: 0.2,
      }),
    );
    gem.position.set(x, 1.4, z);
    island.add(gem);
    beacons.push(gem);
  }
  const siteCoords = SITE_COORDS;
  // Acampamento da guilda: os agentes precisam sair de algum lugar. Sem ele a
  // unidade aparecia e sumia no meio do campo, o que lia como falha de render.
  const CAMP = new THREE.Vector3(6.6, 0.55, 7.4);
  const camp = new THREE.Group();
  camp.position.set(CAMP.x, 0, CAMP.z);
  island.add(camp);
  box(4.2, 0.32, 4.2, 0x9c8a6d, 0, 0.46, 0, camp);
  box(3.7, 0.1, 3.7, 0xb9a27e, 0, 0.66, 0, camp);
  for (const [tx, tz] of [
    [-1.05, -0.95],
    [1.05, -0.95],
  ]) {
    const tent = new THREE.Mesh(
      new THREE.ConeGeometry(0.86, 1.5, 4),
      material(0xe6d3ab),
    );
    tent.position.set(tx, 1.45, tz);
    tent.rotation.y = Math.PI / 4;
    tent.castShadow = true;
    camp.add(tent);
  }
  box(0.12, 3.2, 0.12, 0xdccaa4, 1.5, 2.3, 1.4, camp);
  const campFlag = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.78, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x54baff, roughness: 0.8 }),
  );
  campFlag.position.set(2.08, 3.42, 1.4);
  camp.add(campFlag);
  const campGlow = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 2.15, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffe6a8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  campGlow.rotation.x = -Math.PI / 2;
  campGlow.position.y = 0.68;
  camp.add(campGlow);
  let campFlashAt = -99;
  // Rota até a frente. Quem atravessa o rio passa pela ponte: o trajeto conta
  // que o agente saiu da base e foi até o território.
  function routeTo(siteId) {
    const [x, z] = siteCoords[siteId];
    const target = new THREE.Vector3(x, 0.55, z);
    if (z < 0)
      return [
        CAMP.clone(),
        new THREE.Vector3(x < 0 ? -5.6 : 5.6, 0.55, 3.1),
        new THREE.Vector3(x < 0 ? -5.6 : 5.6, 0.55, -3.1),
        target,
      ];
    return [CAMP.clone(), new THREE.Vector3(x * 0.5 + 3, 0.55, 9.2), target];
  }
  // Percurso com velocidade constante: sem pesar pelo comprimento o agente
  // acelera e freia entre trechos de tamanhos diferentes.
  function along(path, t) {
    const lengths = [];
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const d = path[i].distanceTo(path[i + 1]);
      lengths.push(d);
      total += d;
    }
    let travelled = Math.max(0, Math.min(1, t)) * total;
    for (let i = 0; i < lengths.length; i++) {
      if (travelled <= lengths[i] || i === lengths.length - 1) {
        const f = lengths[i] ? Math.min(1, travelled / lengths[i]) : 1;
        return {
          position: path[i].clone().lerp(path[i + 1], f),
          heading: path[i + 1].clone().sub(path[i]),
        };
      }
      travelled -= lengths[i];
    }
    return { position: path[0].clone(), heading: new THREE.Vector3(0, 0, 1) };
  }
  // Cada frente carrega os seus estados no próprio terreno: anel de progresso,
  // cerca da worktree, cúpula do harness e cristais de falha. É esse conjunto
  // que faz o efeito de uma carta aparecer no mapa, e não apenas no painel.
  const zones = siteCoords.map(([x, z]) => {
    const group = new THREE.Group();
    group.position.set(x, 0.6, z);
    island.add(group);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.62, 2.86, 48),
      new THREE.MeshBasicMaterial({
        color: 0x74c5ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    // Anel segmentado: cada bloco aceso é um passo da obra. Substitui a barra de
    // 4 px que antes ficava escondida atrás da placa da construção.
    const segments = [];
    const steps = 28;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.09, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x8be3ac, transparent: true }),
      );
      seg.position.set(Math.cos(a) * 2.3, 0.02, Math.sin(a) * 2.3);
      seg.rotation.y = -a;
      group.add(seg);
      segments.push(seg);
    }
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(2.55, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.01;
    group.add(glow);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(2.9, 26, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x79bfff,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    group.add(dome);
    const domeLines = new THREE.Mesh(
      new THREE.SphereGeometry(2.92, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xbfe4ff,
        wireframe: true,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    group.add(domeLines);
    // Worktree: cada canteiro isolado é uma cerca. Duas cercas concêntricas
    // dizem, sem texto, que a frente comporta dois agentes em paralelo.
    const fences = [3.12, 3.62].map((radius) => {
      const fence = new THREE.Group();
      group.add(fence);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const post = box(
          0.2,
          0.95,
          0.2,
          0x83dbb1,
          Math.cos(a) * radius,
          0.45,
          Math.sin(a) * radius,
          fence,
        );
        post.rotation.y = -a;
      }
      const fenceRing = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.1, radius + 0.1, 44),
        new THREE.MeshBasicMaterial({
          color: 0x83dbb1,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.55,
        }),
      );
      fenceRing.rotation.x = -Math.PI / 2;
      fenceRing.position.y = 0.01;
      fence.add(fenceRing);
      return fence;
    });
    // Andaime: aparece enquanto a obra não fecha o nível.
    const scaffold = new THREE.Group();
    group.add(scaffold);
    for (const [sx, sz] of [
      [-1.5, -1.5],
      [1.5, -1.5],
      [-1.5, 1.5],
      [1.5, 1.5],
    ])
      box(0.16, 3.1, 0.16, 0xd8b06a, sx, 1.5, sz, scaffold);
    for (const y of [1.2, 2.5])
      for (const [ax, az, w, d] of [
        [0, -1.5, 3.16, 0.14],
        [0, 1.5, 3.16, 0.14],
        [-1.5, 0, 0.14, 3.16],
        [1.5, 0, 0.14, 3.16],
      ])
        box(w, 0.14, d, 0xe0bd80, ax, y, az, scaffold);
    // Falhas acumuladas: cristais vermelhos girando sobre a obra.
    const faults = [];
    for (let i = 0; i < 3; i++) {
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.34),
        new THREE.MeshStandardMaterial({
          color: 0xff7d63,
          emissive: 0x99271a,
          emissiveIntensity: 1.4,
          roughness: 0.25,
        }),
      );
      shard.position.set((i - 1) * 0.95, 3.5, 0);
      group.add(shard);
      faults.push(shard);
    }
    // Onda de choque do lançamento da carta, no estilo do deploy de arena.
    const pulse = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 1.05, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.y = 0.03;
    group.add(pulse);
    return {
      group,
      ring,
      segments,
      glow,
      dome,
      domeLines,
      fences,
      scaffold,
      faults,
      pulse,
      pulseAt: -99,
      pulseColor: new THREE.Color(0xffffff),
    };
  });
  function setClip(actor, name) {
    if (actor.clip === name) return;
    actor.mixer.stopAllAction();
    const clip =
      actor.clips.find((c) => c.name === name) ||
      actor.clips.find((c) => c.name === "Idle");
    if (clip) actor.mixer.clipAction(clip).play();
    actor.clip = name;
  }
  function addCrew(job) {
    const template = templates[job.cardId === "builder" ? "Barbarian" : "Mage"];
    if (!template) return;
    // O template é o mesmo objeto usado como ator da vitrine, e a batalha o
    // esconde no começo de cada quadro. Sem restaurar isto, o clone nasce
    // invisível e o agente nunca aparece caminhando até a frente.
    const obj = clone(template.obj);
    obj.visible = true;
    obj.scale.multiplyScalar(1.2);
    island.add(obj);
    const mixer = new THREE.AnimationMixer(obj);
    const [x, z] = siteCoords[job.siteId];
    const path = routeTo(job.siteId);
    // Frentes paralelas colocam até três agentes na mesma obra: cada um recebe
    // um posto próprio, senão os modelos ficam sobrepostos.
    const posted = [...crew.values()].filter(
      (a) => a.job.siteId === job.siteId,
    ).length;
    const lane = [0, -1.5, 1.5][posted % 3];
    path[path.length - 1] = new THREE.Vector3(
      x + lane,
      0.55,
      z + (job.siteId === 1 ? -2.9 : 2.5) + (posted >= 3 ? 1.1 : 0),
    );
    campFlashAt = prev;
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.86, 28),
      new THREE.MeshBasicMaterial({
        color: job.conflict ? 0xff8067 : 0xffd888,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
      }),
    );
    marker.rotation.x = -Math.PI / 2;
    island.add(marker);
    crew.set(job.id, {
      obj,
      mixer,
      clips: template.clips,
      job,
      path,
      grown: 0,
      baseScale: obj.scale.clone(),
      marker,
      retire: null,
    });
  }
  function dropCrew(id, actor) {
    island.remove(actor.obj, actor.marker);
    actor.mixer.stopAllAction();
    actor.marker.geometry.dispose();
    actor.marker.material.dispose();
    crew.delete(id);
  }
  // Enquadramento: o retângulo recebido é preenchido pelo eixo mais apertado,
  // em vez de ajustar só a altura. É o que faz o mapa aparecer de verdade.
  //
  // A extensão é medida malha a malha, não pela caixa envolvente do conjunto:
  // somar a altura do castelo à diagonal do terreno inflaria o eixo vertical em
  // torno de 20% e encolheria o tabuleiro na mesma proporção.
  const play = span(),
    full = span();
  function span() {
    return { h: [Infinity, -Infinity], v: [Infinity, -Infinity] };
  }
  function widen(target, value, axis) {
    const range = target[axis];
    if (value < range[0]) range[0] = value;
    if (value > range[1]) range[1] = value;
  }
  let boundsAt = -1;
  function measure() {
    if (boundsAt === loaded) return;
    boundsAt = loaded;
    const bob = island.position.y;
    island.position.y = 0;
    island.updateMatrixWorld(true);
    Object.assign(play, span());
    Object.assign(full, span());
    const bounds = new THREE.Box3(),
      corner = new THREE.Vector3();
    island.traverse((o) => {
      if (!o.isMesh) return;
      bounds.setFromObject(o);
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) {
            corner.set(x, y, z);
            const h = corner.dot(RIGHT),
              v = corner.dot(UP);
            widen(full, h, "h");
            widen(full, v, "v");
            if (!o.userData.decor) {
              widen(play, h, "h");
              widen(play, v, "v");
            }
          }
    });
    island.position.y = bob;
  }
  // A câmera desliza pelos próprios eixos de tela para centralizar o tabuleiro:
  // sem isso a borda inferior da ilha decide o zoom sozinha.
  function frame(bounds, aspect) {
    if (!Number.isFinite(bounds.h[0]))
      return { half: 18, shift: new THREE.Vector3() };
    const hc = (bounds.h[0] + bounds.h[1]) / 2,
      vc = (bounds.v[0] + bounds.v[1]) / 2;
    const half =
      Math.max(
        (bounds.v[1] - bounds.v[0]) / 2,
        (bounds.h[1] - bounds.h[0]) / 2 / aspect,
      ) * 1.04;
    const shift = RIGHT.clone()
      .multiplyScalar(hc)
      .addScaledVector(UP, vc);
    return { half, shift };
  }
  let burst = 0,
    prev = 0;
  return {
    portraits,
    get progress() {
      return { loaded, total, failures };
    },
    celebrate() {
      burst = 1;
    },
    targets() {
      return targetPoints;
    },
    agents() {
      return agentPoints;
    },
    // O cliente avisa o lançamento para a cena disparar a onda de choque no
    // ponto exato em que a carta foi solta.
    deploy(siteId, color = "#ffffff") {
      const zone = zones[siteId];
      if (!zone) return;
      zone.pulseAt = prev;
      zone.pulseColor.set(color);
    },
    draw({
      time,
      rect,
      width,
      height,
      reduced,
      team,
      elapsed = 0,
      progress = null,
      selectedSite = 0,
      selectedCard = null,
      targetSite = null,
      legal = null,
      paused = false,
    }) {
      const dt = Math.min((time - prev) / 1000, 0.05);
      prev = time;
      if (
        canvas.width !== Math.round(width * renderer.getPixelRatio()) ||
        canvas.height !== Math.round(height * renderer.getPixelRatio())
      )
        renderer.setSize(width, height, false);
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setViewport(rect.x, height - rect.y - rect.h, rect.w, rect.h);
      renderer.setScissor(rect.x, height - rect.y - rect.h, rect.w, rect.h);
      renderer.setScissorTest(true);
      const progress3d = (id, site) =>
        progress && Number.isFinite(progress[id]) ? progress[id] : site.built;
      island.position.y = reduced || team ? 0 : Math.sin(time * 0.0005) * 0.18;
      measure();
      // Na batalha o tabuleiro manda; na vitrine cabe a rocha inteira.
      const aspect = rect.w / rect.h,
        { half, shift } = frame(team ? play : full, aspect);
      camera.position.set(
        Math.sin(AZIMUTH) * CAMERA_RADIUS + shift.x,
        CAMERA_HEIGHT + shift.y,
        Math.cos(AZIMUTH) * CAMERA_RADIUS + shift.z,
      );
      camera.lookAt(shift.x, shift.y, shift.z);
      camera.left = -half * aspect;
      camera.right = half * aspect;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      if (visibleTeam !== team?.id) {
        for (const [id, actor] of crew) dropCrew(id, actor);
        visibleTeam = team?.id;
      }
      buildings.forEach(({ obj, scale, siteId }) => {
        obj.visible = !team || siteId !== null;
        if (!team) {
          obj.scale.y = scale;
          return;
        }
        if (siteId === null) return;
        const site = team.sites[siteId];
        // O progresso vem pronto do cliente, que é quem já o desenha na placa.
        // Recalcular aqui era a segunda cópia da mesma conta, e divergia dela.
        const progress = progress3d(siteId, site);
        // Piso mais alto: no nível 0 a construção precisa parecer uma obra, não
        // um seixo. Cada nível entregue soma um degrau visível.
        const height =
          scale *
          (0.46 + (0.54 * Math.min(3, site.level + progress / 100)) / 3);
        obj.scale.y +=
          (height - obj.scale.y) * (reduced ? 1 : Math.min(1, dt * 4));
      });
      zones.forEach((zone, i) => {
        zone.group.visible = Boolean(team);
        if (!team) return;
        const site = team.sites[i];
        const progress = progress3d(i, site);
        const done = site.level >= 3;
        const aiming = selectedCard && targetSite === i;
        const allowed = legal?.[i] !== false;
        // Cor do anel conta a leitura da carta em jogo: verde libera, vermelho
        // recusa, dourado é a frente escolhida.
        const tint = done
          ? "#8be3ac"
          : selectedCard
            ? allowed
              ? aiming
                ? "#ffffff"
                : "#ffdb8a"
              : "#ff7d63"
            : site.faults
              ? "#ff896d"
              : selectedSite === i
                ? "#ffffff"
                : team.color;
        zone.ring.material.color.set(tint);
        const beat = reduced ? 1 : 0.72 + Math.sin(time * 0.006 + i) * 0.28;
        zone.ring.material.opacity = selectedCard
          ? allowed
            ? aiming
              ? 1
              : beat
            : 0.5
          : selectedSite === i
            ? 1
            : 0.5;
        zone.group.scale.setScalar(aiming && allowed ? 1.06 : 1);
        zone.glow.material.color.set(tint);
        zone.glow.material.opacity = aiming && allowed ? 0.16 : 0;
        const lit = Math.round((progress / 100) * zone.segments.length);
        zone.segments.forEach((seg, s) => {
          seg.visible = !done && s < lit;
          seg.material.color.set(
            site.faults ? "#ff9a80" : site.reviewed ? "#8be3ac" : "#7fd0ff",
          );
        });
        zone.dome.visible = zone.domeLines.visible = site.harness;
        if (site.harness && !reduced)
          zone.domeLines.rotation.y = time * 0.00035;
        zone.fences.forEach((fence, f) => (fence.visible = site.worktrees > f));
        const building = team.jobs.some(
          (j) => j.cardId === "builder" && j.siteId === i,
        );
        zone.scaffold.visible = !done && (progress > 0 || building);
        zone.scaffold.scale.y = 0.35 + 0.65 * (progress / 100);
        zone.faults.forEach((shard, f) => {
          shard.visible = f < site.faults;
          if (!reduced) {
            shard.rotation.y = time * 0.002 + f;
            shard.position.y = 3.5 + Math.sin(time * 0.003 + f * 2) * 0.16;
          }
        });
        const age = (time - zone.pulseAt) / 620;
        if (age >= 0 && age <= 1) {
          zone.pulse.visible = true;
          zone.pulse.scale.setScalar(0.5 + age * 2.6);
          zone.pulse.material.color.copy(zone.pulseColor);
          zone.pulse.material.opacity = (1 - age) * 0.9;
        } else zone.pulse.visible = false;
      });
      camp.visible = Boolean(team);
      if (team) {
        campFlag.material.color.set(team.color);
        const flash = (time - campFlashAt) / 700;
        campGlow.material.opacity =
          flash >= 0 && flash <= 1 ? (1 - flash) * 0.75 : 0;
        campGlow.scale.setScalar(
          flash >= 0 && flash <= 1 ? 0.7 + flash * 0.5 : 1,
        );
      }
      beacons.forEach((gem, i) => {
        const lit = !team || team.sites[i % 3].level > Math.floor(i / 3);
        gem.material.color.setHex(lit ? 0x82e9ee : 0x567687);
        gem.material.emissive.setHex(lit ? 0x248eac : 0x000000);
        gem.material.emissiveIntensity = lit ? 1.5 : 0;
        gem.rotation.y = reduced ? 0 : time * 0.0006 + i;
      });
      actors.forEach((a) => {
        a.obj.visible = !team;
        if (!team) a.mixer.update(reduced ? 0 : dt);
      });
      if (team) {
        for (const job of team.jobs) {
          if (!crew.has(job.id)) addCrew(job);
          else crew.get(job.id).job = job;
        }
        for (const [id, actor] of crew) {
          const active = team.jobs.some((j) => j.id === id);
          if (!active && actor.retire === null) {
            actor.retire = elapsed;
            campFlashAt = time;
          }
          // Ida e volta percorrem a mesma rota. O trecho de volta termina no
          // acampamento, onde o agente encolhe até sumir.
          const walking = actor.retire === null;
          const step = walking
            ? Math.max(0, (elapsed - actor.job.startedAt) / 3.4)
            : 1 - Math.max(0, (elapsed - actor.retire) / 3);
          const { position, heading } = along(actor.path, step);
          actor.obj.position.copy(position);
          const arrived = walking && step >= 1;
          setClip(
            actor,
            arrived
              ? actor.job.cardId === "builder"
                ? "Interact"
                : "Spellcasting"
              : "Walking_A",
          );
          // Surge crescendo no acampamento e recolhe encolhendo: sem isto o
          // modelo aparecia e sumia de um quadro para o outro.
          const target = walking ? 1 : Math.max(0, Math.min(1, step * 4));
          actor.grown +=
            (target - actor.grown) * (reduced ? 1 : Math.min(1, dt * 7));
          if (!walking && actor.grown < 0.06) {
            dropCrew(id, actor);
            continue;
          }
          actor.obj.scale.copy(actor.baseScale).multiplyScalar(actor.grown);
          if (!walking) heading.negate();
          actor.obj.rotation.y = Math.atan2(heading.x, heading.z);
          actor.mixer.update(reduced || paused ? 0 : dt);
          actor.marker.position.set(
            actor.obj.position.x,
            0.57,
            actor.obj.position.z,
          );
          actor.marker.material.color.set(
            actor.job.conflict ? "#ff8067" : team.color,
          );
          actor.marker.material.opacity = 0.95 * actor.grown;
          actor.marker.scale.setScalar(
            (reduced ? 1 : 1 + Math.sin(time * 0.005 + id) * 0.07) *
              Math.max(0.2, actor.grown),
          );
        }
      }
      motes.forEach((m, i) => {
        const t = time * 0.0003 + i * 2.4;
        m.position.set(
          Math.sin(t * 0.8 + i) * 14,
          1 + (i % 6) + Math.sin(t) * 0.8,
          Math.cos(t + i) * 15,
        );
        m.visible = !reduced && (burst > 0 || !team);
        m.rotation.y = t;
      });
      burst = Math.max(0, burst - dt * 0.55);
      renderer.render(scene, camera);
      const project = (x, y, z) => {
        const p = island.localToWorld(new THREE.Vector3(x, y, z)).project(camera);
        return {
          x: rect.x + ((p.x + 1) * rect.w) / 2,
          y: rect.y + ((1 - p.y) * rect.h) / 2,
        };
      };
      targetPoints = team
        ? siteCoords.map(([x, z], id) => {
            // A placa se apoia no topo atual da construção: com altura fixa ela
            // flutuaria longe das frentes ainda baixas.
            const building = buildings.find((b) => b.siteId === id);
            const tall = building
              ? (building.height * building.obj.scale.y) / building.scale
              : 2.4;
            return {
              id,
              ...project(x, 0.65, z),
              top: project(x, tall + 0.7, z).y,
            };
          })
        : [];
      agentPoints = team
        ? [...crew.values()].map((actor) => ({
            id: actor.job.id,
            job: actor.job,
            ...project(actor.obj.position.x, 3.7, actor.obj.position.z),
          }))
        : [];
    },
  };
}
