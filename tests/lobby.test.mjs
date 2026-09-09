import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../dist/server.js';
import { installBrowser, makeClient } from './harness.mjs';

async function lobby(t, participants = 4) {
  const { server } = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  installBrowser(`http://127.0.0.1:${server.address().port}`);
  const host = await makeClient();
  host.fields.participants = participants;
  host.fields.teamSize = 2;
  await host.create();
  return host;
}

async function guest(host, name) {
  const c = await makeClient();
  await c.lookup(host.state().code);
  c.fields.name = name;
  return c;
}

test('lobby: tocar na guilda cadastra, permite trocar e libera o início', async t => {
  const host = await lobby(t);
  const ana = await guest(host, 'Ana');
  assert.equal(host.draw().find(c => c.id === 'start').disabled, true);
  assert.equal(ana.draw().find(c => c.id === 'join-team').disabled, true);
  await ana.click('team-0');
  assert.equal(ana.state().players.find(p => p.id === ana.state().me).teamId, 0);
  await ana.click('team-1');
  assert.equal(ana.state().players.length, 1);
  assert.equal(ana.state().players[0].teamId, 1);
  for (const [name, team] of [['Bia', 0], ['Caio', 0], ['Dani', 1]]) {
    const c = await guest(host, name);
    await c.click('team-' + team);
    assert.ok(c.state().me);
  }
  await host.refresh();
  assert.equal(host.draw().find(c => c.id === 'start').disabled, false);
  await host.click('start');
  while (host.app.session.busy) await new Promise(resolve => setImmediate(resolve));
  assert.equal(host.state().phase, 'playing');
});

test('lobby: seleção sem nome pede preenchimento e guilda lotada bloqueia confirmação', async t => {
  const host = await lobby(t);
  const ana = await guest(host, '');
  await ana.click('team-0');
  assert.equal(ana.app.editing, 'name');
  assert.equal(ana.state().players.length, 0);
  assert.equal(ana.draw().find(c => c.id === 'join-team').disabled, true);
  ana.fields.name = 'Ana';
  await ana.click('join-team');
  assert.ok(ana.state().me);
  const bia = await guest(host, '');
  await bia.click('team-0');
  const caio = await guest(host, 'Caio');
  await caio.click('team-0');
  bia.fields.name = 'Bia';
  await bia.refresh();
  const controls = bia.draw();
  assert.equal(controls.find(c => c.id === 'team-0').disabled, true);
  assert.equal(controls.find(c => c.id === 'join-team').disabled, true);
  await bia.click('team-1');
  assert.ok(bia.state().me);
});

test('lobby: paginação e entrada têm áreas separadas no celular e após redimensionar', async t => {
  const host = await lobby(t, 32);
  const c = await guest(host, 'Ana');
  globalThis.innerWidth = 430;
  globalThis.innerHeight = 730;
  c.app.viewport.measure();
  const controls = c.draw().filter(k => k.id === 'name' || k.id.startsWith('team-') || k.id === 'join-team');
  for (const a of controls) for (const b of controls) {
    if (a === b) continue;
    assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y,
      `${a.id} não pode sobrepor ${b.id}`);
  }
  for (let page = 0; page < 3; page++) await c.click('team-next');
  assert.ok(c.draw().some(k => k.id === 'team-15'));
  globalThis.innerWidth = 1440;
  globalThis.innerHeight = 900;
  c.app.viewport.measure();
  assert.ok(c.draw().some(k => k.id === 'team-15'), 'redimensionar não deixa a página vazia');
  await c.click('team-15');
  assert.equal(c.state().players.find(p => p.id === c.state().me).teamId, 15);
});
