import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../dist/server.js';
import { installBrowser, makeClient } from './harness.mjs';

async function arena(t, width = 1440, height = 900) {
  const { server } = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  installBrowser(`http://127.0.0.1:${server.address().port}`);
  globalThis.innerWidth = width;
  globalThis.innerHeight = height;
  const c = await makeClient();
  await c.create(true);
  let scene;
  c.app.world = {
    portraits: {},
    progress: { failures: [], loaded: 0, total: 0 },
    siteAnchors: () => [], agentAnchors: () => [], deploy: () => {},
    draw: value => { scene = value; },
  };
  const rect = c.app.viewport.sceneRect('battle');
  const ground = { x: rect.x + rect.w * 0.52, y: rect.y + rect.h * 0.86 + 40 };
  const event = point => {
    const device = c.app.viewport.toDevice({ ...point, w: 0, h: 0 });
    return { clientX: device.x, clientY: device.y, pointerId: 1, preventDefault() {} };
  };
  const begin = () => {
    const card = c.draw().find(control => control.id === 'card-builder');
    c.pointer('pointerdown', event({ x: card.x + card.w / 2, y: card.y + card.h / 2 }));
    c.pointer('pointermove', event(ground));
    c.draw();
  };
  return { c, ground, event, begin, scene: () => scene };
}

for (const [width, height] of [[1440, 900], [1024, 768], [390, 844]]) {
  test(`drop: obra destacada fora da placa recebe o agente em ${width}×${height}`, async t => {
    const { c, ground, event, begin, scene } = await arena(t, width, height);
    begin();
    assert.equal(scene().targetSite, 1);
    const banners = c.draw().filter(control => control.id.startsWith('site-'));
    assert.ok(banners.every(box => ground.x < box.x || ground.x > box.x + box.w || ground.y < box.y || ground.y > box.y + box.h),
      'a regressão precisa soltar fora das placas');
    await c.pointer('pointerup', event(ground));
    assert.equal(c.state().teams[0].jobs.length, 1);
    assert.equal(c.state().teams[0].jobs[0].siteId, 1);
    assert.equal(c.state().teams[0].jobs[0].cardId, 'builder');
  });
}

test('drop: usa a posição de soltura mesmo sem um novo quadro', async t => {
  const { c, ground, event, begin, scene } = await arena(t);
  begin();
  assert.equal(scene().targetSite, 1);
  const outside = { x: 10, y: 10 };
  await c.pointer('pointerup', event(outside));
  assert.equal(c.state().teams[0].jobs.length, 0, 'o destaque antigo não pode receber a carta');
  begin();
  c.pointer('pointermove', event(outside));
  c.draw();
  assert.equal(scene().targetSite, null);
  await c.pointer('pointerup', event(ground));
  assert.equal(c.state().teams[0].jobs[0].siteId, 1, 'a posição final encontra a obra sem depender do último destaque');
});

test('drop: pausa, modal e cancelamento impedem mobilização', async t => {
  const { c, ground, event, begin } = await arena(t);
  begin();
  await c.action('pause');
  await c.pointer('pointerup', event(ground));
  assert.equal(c.state().teams[0].jobs.length, 0);
  await c.action('pause');
  begin();
  c.app.modal = 'help';
  await c.pointer('pointerup', event(ground));
  assert.equal(c.state().teams[0].jobs.length, 0);
  c.app.modal = null;
  begin();
  c.pointer('pointercancel', event(ground));
  await c.pointer('pointerup', event(ground));
  assert.equal(c.state().teams[0].jobs.length, 0);
});
