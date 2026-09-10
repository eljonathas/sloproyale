import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { GameLoop } from '../dist/client/loop.js';
import { Painter } from '../dist/client/painter.js';

register('./three-loader.mjs', import.meta.url);
const THREE = await import('../assets/vendor/three.module.js');
const { World } = await import('../dist/client/scene/world.js');
const { CameraRig } = await import('../dist/client/scene/cameraRig.js');
const { AgentCrew } = await import('../dist/client/scene/agentCrew.js');

test('desempenho: buffer fracionário não é redimensionado a cada quadro', t => {
  const canvas = { width: 0, height: 0 };
  let resizes = 0;
  const world = Object.create(World.prototype);
  world.renderer = {
    domElement: canvas,
    getPixelRatio: () => 1.6,
    setSize: (w, h) => {
      resizes++;
      // Mesmo arredondamento de WebGLRenderer.setSize, na cópia local de Three.
      canvas.width = Math.floor(w * 1.6);
      canvas.height = Math.floor(h * 1.6);
    },
  };
  for (let frame = 0; frame < 600; frame++) world.resize(1366, 768);
  assert.equal(resizes, 1);
  assert.deepEqual(canvas, { width: 2185, height: 1228 });
  world.resize(1440, 900);
  assert.equal(resizes, 2, 'redimensionamento real continua funcionando');
  t.diagnostic('600 quadros com viewport estável: 1 redimensionamento do buffer');
});

test('desempenho: loop limita 120 Hz a 60 FPS, suspende oculto e não duplica', t => {
  const callbacks = new Map();
  const events = new Map();
  let id = 0, frames = 0;
  globalThis.requestAnimationFrame = callback => { callbacks.set(++id, callback); return id; };
  globalThis.cancelAnimationFrame = id => callbacks.delete(id);
  globalThis.document = {
    hidden: false,
    addEventListener: (name, callback) => events.set(name, callback),
    removeEventListener: name => events.delete(name),
  };
  const loop = new GameLoop();
  loop.frame = () => frames++;
  const tick = time => {
    const scheduled = [...callbacks.values()];
    callbacks.clear();
    for (const callback of scheduled) callback(time);
  };
  loop.start();loop.start();
  assert.equal(callbacks.size, 1);
  for (let i = 0; i < 1200; i++) tick(i * 1000 / 120);
  assert.equal(frames, 600);
  document.hidden = true;events.get('visibilitychange')();
  assert.equal(callbacks.size, 0);
  tick(15000);assert.equal(frames, 600);
  document.hidden = false;events.get('visibilitychange')();
  tick(15001);assert.equal(frames, 601, 'retoma sem tentar desenhar quadros atrasados');
  loop.stop();assert.equal(callbacks.size, 0);assert.equal(events.size, 0);
  loop.start();tick(15002);assert.equal(frames, 602);loop.stop();
  t.diagnostic('10 s em uma tela de 120 Hz: 600 quadros; oculto: 0');
});

test('desempenho: medidas de texto são reutilizadas por fonte com memória limitada', t => {
  let measures = 0;
  const ctx = {
    font: '',
    measureText: value => { measures++;return { width: value.length * 8 }; },
    fillText() {},
  };
  const painter = new Painter(ctx);
  for (let i = 0; i < 600; i++) {
    assert.equal(painter.countLines('Agentes na obra', 90, 14), 2);
    assert.equal(painter.wrap('Agentes na obra', 0, 0, 90, 14, '#fff', 20), 40);
  }
  assert.equal(measures, 3);
  painter.measure('Agentes', 20, 700);
  assert.equal(measures, 4, 'tamanho diferente tem outra medida');
  for (let i = 0; i < 1000; i++) painter.measure('Nome ' + i, 14);
  assert.ok(painter.textWidths.size <= 512);
  t.diagnostic('600 contagens + 600 quebras da mesma frase: 3 medidas de texto');
});

test('desempenho: câmera mantém enquadramento e só recalcula quando necessário', t => {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(20, 3, 30)));
  const rig = new CameraRig();
  rig.measure(group, 1);
  const rect = { x: 0, y: 0, w: 1440, h: 600 };
  let projections = 0;
  const update = rig.camera.updateProjectionMatrix.bind(rig.camera);
  rig.camera.updateProjectionMatrix = () => { projections++;update(); };
  rig.frame(rect, true);
  const before = rig.project(group, rect, 3, 2, 4);
  for (let i = 0; i < 600; i++) { rig.measure(group, 1);rig.frame(rect, true); }
  assert.equal(projections, 1);
  assert.deepEqual(rig.project(group, rect, 3, 2, 4), before);
  rig.frame({ ...rect, w: 430 }, true);assert.equal(projections, 2);
  rig.frame(rect, false);assert.equal(projections, 3);
  rig.measure(group, 2);rig.frame(rect, false);assert.equal(projections, 4);
  t.diagnostic('601 quadros sem mudar enquadramento: 1 cálculo da projeção');
});

test('desempenho: agentes liberam esqueletos sem destruir os modelos compartilhados', () => {
  const template = new THREE.Group();
  const bone = new THREE.Bone();
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(bone);mesh.bind(new THREE.Skeleton([bone]));template.add(mesh);
  const group = new THREE.Group();
  const island = {
    add: object => group.add(object), remove: (...objects) => group.remove(...objects),
    route: () => [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 1)],
    flashCamp() {},
  };
  const crew = new AgentCrew(island, { Barbarian: { object: template, clips: [] } });
  crew.follow(0);
  let disposed = 0, sharedDisposed = 0;
  geometry.addEventListener('dispose', () => sharedDisposed++);
  material.addEventListener('dispose', () => sharedDisposed++);
  for (let i = 0; i < 20; i++) {
    crew.update([{ id: i, cardId: 'builder', siteId: 0, startedAt: 0 }], 0, 0.016, 0, '#fff', false, false);
    const clone = group.children[0].children[0];
    assert.notEqual(clone.skeleton, mesh.skeleton);
    clone.skeleton.computeBoneTexture();
    clone.skeleton.boneTexture.addEventListener('dispose', () => disposed++);
    crew.update([], 25, 0.016, 25000, '#fff', false, false);
    crew.update([], 30, 1, 30000, '#fff', false, false);
    assert.equal(group.children.length, 0);
  }
  assert.equal(disposed, 20);
  assert.equal(sharedDisposed, 0);
});
