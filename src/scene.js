import * as THREE from "three";
import { GLTFLoader } from "../assets/vendor/GLTFLoader.js";
import { clone } from "../assets/utils/SkeletonUtils.js";

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
  // Faceted underside makes the battlefield a floating diorama.
  const rock = new THREE.Mesh(
    new THREE.CylinderGeometry(15, 8, 6, 7),
    material(0x344f65),
  );
  rock.scale.set(1, 1, 1.12);
  rock.position.set(0, -5, 0);
  rock.rotation.y = 0.2;
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
  const siteCoords = [
    [-5.6, -8.4],
    [0, 10.4],
    [5.6, -8.4],
  ];
  const zones = siteCoords.map(([x, z]) => {
    const group = new THREE.Group();
    group.position.set(x, 0.6, z);
    island.add(group);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.3, 2.45, 40),
      new THREE.MeshBasicMaterial({
        color: 0x74c5ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x65b9ff,
        transparent: true,
        opacity: 0.13,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    group.add(dome);
    const corners = new THREE.Group();
    group.add(corners);
    for (const xx of [-2.65, 2.65])
      for (const zz of [-2.65, 2.65])
        box(0.22, 0.4, 0.22, 0x79dfa9, xx, 0.05, zz, corners);
    return { group, ring, dome, corners };
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
    const obj = clone(template.obj);
    island.add(obj);
    const mixer = new THREE.AnimationMixer(obj);
    const start = new THREE.Vector3(job.siteId === 0 ? -5.6 : 5.6, 0.55, 2.6);
    const [x, z] = siteCoords[job.siteId];
    const target = new THREE.Vector3(
      x + (job.id % 2 ? 0.75 : -0.75),
      0.55,
      z + (job.siteId === 1 ? -2.5 : 2),
    );
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.62, 24),
      new THREE.MeshBasicMaterial({
        color: job.conflict ? 0xff8067 : 0xffd888,
        side: THREE.DoubleSide,
      }),
    );
    marker.rotation.x = -Math.PI / 2;
    island.add(marker);
    crew.set(job.id, {
      obj,
      mixer,
      clips: template.clips,
      job,
      start,
      target,
      marker,
      retire: null,
    });
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
    draw(
      time,
      rect,
      width,
      height,
      reduced,
      team,
      elapsed = 0,
      selectedSite = 0,
      selectedCard = null,
      paused = false,
    ) {
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
      const aspect = rect.w / rect.h,
        half = team ? (width < 800 ? Math.min(18, rect.h / 16) : 17) : 18;
      camera.position.set(team ? 0 : 26, 34, team ? 30 : 38);
      camera.lookAt(0, 0, 0);
      camera.left = -half * aspect;
      camera.right = half * aspect;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();
      island.position.y = reduced || team ? 0 : Math.sin(time * 0.0005) * 0.18;
      if (visibleTeam !== team?.id) {
        for (const actor of crew.values()) {
          island.remove(actor.obj, actor.marker);
          actor.mixer.stopAllAction();
          actor.marker.geometry.dispose();
          actor.marker.material.dispose();
        }
        crew.clear();
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
        const working = team.jobs.filter(
          (j) => j.siteId === siteId && j.cardId === "builder",
        );
        const progress = Math.min(
          100,
          site.built +
            working.reduce(
              (v, j) =>
                v +
                (j.conflict ? 75 : 100) *
                  Math.max(
                    0,
                    Math.min(
                      1,
                      (elapsed - j.startedAt) / (j.endsAt - j.startedAt),
                    ),
                  ),
              0,
            ),
        );
        const height =
          scale *
          (0.32 + (0.68 * Math.min(3, site.level + progress / 100)) / 3);
        obj.scale.y +=
          (height - obj.scale.y) * (reduced ? 1 : Math.min(1, dt * 4));
      });
      zones.forEach((zone, i) => {
        zone.group.visible = Boolean(team);
        if (!team) return;
        const site = team.sites[i];
        zone.dome.visible = site.harness;
        zone.corners.visible = site.worktree;
        zone.ring.material.color.set(
          site.faults
            ? "#ff896d"
            : selectedCard
              ? "#ffdb8a"
              : selectedSite === i
                ? "#ffffff"
                : team.color,
        );
        zone.ring.material.opacity =
          selectedSite === i || selectedCard ? 1 : 0.55;
      });
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
          if (!active && actor.retire === null) actor.retire = elapsed;
          if (actor.retire !== null) {
            const back = Math.min(1, (elapsed - actor.retire) / 2);
            actor.obj.position.lerpVectors(actor.target, actor.start, back);
            setClip(actor, "Walking_A");
            if (back >= 1) {
              island.remove(actor.obj, actor.marker);
              actor.mixer.stopAllAction();
              actor.marker.geometry.dispose();
              actor.marker.material.dispose();
              crew.delete(id);
              continue;
            }
          } else {
            const step = Math.min(
              1,
              Math.max(0, (elapsed - actor.job.startedAt) / 2),
            );
            actor.obj.position.lerpVectors(actor.start, actor.target, step);
            setClip(
              actor,
              step < 1
                ? "Walking_A"
                : actor.job.cardId === "builder"
                  ? "Interact"
                  : "Spellcasting",
            );
          }
          const direction =
            actor.retire !== null
              ? actor.start.clone().sub(actor.target)
              : actor.target.clone().sub(actor.start);
          actor.obj.rotation.y = Math.atan2(direction.x, direction.z);
          actor.mixer.update(reduced || paused ? 0 : dt);
          actor.marker.position.set(
            actor.obj.position.x,
            0.57,
            actor.obj.position.z,
          );
          actor.marker.material.color.set(
            actor.job.conflict ? "#ff8067" : team.color,
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
      targetPoints = team
        ? siteCoords.map(([x, z], id) => {
            const p = island
              .localToWorld(new THREE.Vector3(x, 0.65, z))
              .project(camera);
            return {
              id,
              x: rect.x + ((p.x + 1) * rect.w) / 2,
              y: rect.y + ((1 - p.y) * rect.h) / 2,
            };
          })
        : [];
    },
  };
}
