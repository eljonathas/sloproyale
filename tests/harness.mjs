/**
 * Monta o cliente real fora do navegador.
 *
 * As classes de `dist/client` são as mesmas que a turma usa. O que é
 * substituído aqui é só a superfície do navegador — canvas, DOM, rede e
 * relógio de quadro —, então regras, pedidos e transições continuam reais.
 */

/** Uma medida de texto grosseira, suficiente para as contas de layout. */
const measureText = (value) => ({ width: String(value).length * 8 });

function stubContext() {
  const noop = () => {};
  return new Proxy(
    {
      measureText,
      createLinearGradient: () => ({ addColorStop: noop }),
      canvas: { width: 0, height: 0 },
    },
    {
      get: (target, key) => target[key] ?? noop,
      set: (target, key, value) => ((target[key] = value), true),
    },
  );
}

function stubElement(listeners = {}) {
  return {
    addEventListener: (name, fn) => (listeners[name] = fn),
    removeEventListener: () => {},
    blur: () => {},
    focus: () => {},
    setAttribute: () => {},
    replaceChildren: () => {},
    style: {},
    value: "",
    textContent: "",
    disabled: false,
    tabIndex: 0,
  };
}

/** Instala as globais do navegador que as classes do cliente esperam. */
export function installBrowser(base) {
  globalThis.innerWidth = 1440;
  globalThis.innerHeight = 900;
  globalThis.devicePixelRatio = 1;
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.addEventListener = () => {};
  globalThis.requestAnimationFrame = () => 0;
  globalThis.performance ??= { now: () => 0 };
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
  globalThis.location = { origin: base, search: "", host: new URL(base).host };
  globalThis.history = { replaceState: () => {} };
  globalThis.EventSource = class {
    close() {}
  };
  globalThis.Image = class {};
  globalThis.AudioContext = class {};
  const real = globalThis.fetch;
  globalThis.fetch = (url, options) => real(new URL(url, base), options);
  globalThis.document = {
    createElement: () => stubElement(),
    fonts: { load: async () => {} },
    activeElement: null,
    documentElement: { requestFullscreen: () => Promise.resolve() },
    fullscreenElement: null,
  };
}

/**
 * Um cliente pronto para os testes: as mesmas classes, com atalhos para as
 * ações que uma pessoa faria na tela.
 */
export async function makeClient() {
  const { AgentArena } = await import("../dist/client/app.js");
  const { Chrome } = await import("../dist/client/chrome.js");
  const { GameLoop } = await import("../dist/client/loop.js");
  const { InputRouter } = await import("../dist/client/input.js");
  const { BattleScreen } = await import("../dist/client/screens/battle.js");
  const { HomeScreen } = await import("../dist/client/screens/home.js");
  const { LobbyScreen } = await import("../dist/client/screens/lobby.js");
  const { ModalStack } = await import("../dist/client/screens/modals.js");
  const { ResultsScreen } = await import("../dist/client/screens/results.js");
  const { BuildProgress, PlayPreview } = await import("../dist/client/rules.js");

  const listeners = {};
  const context = stubContext();
  const canvas = {
    ...stubElement(listeners),
    getContext: () => context,
    setPointerCapture: () => {},
    width: 0,
    height: 0,
  };
  const app = new AgentArena(canvas, stubElement(), stubElement(), stubElement());
  const screens = {
    home: new HomeScreen(app),
    lobby: new LobbyScreen(app),
    battle: new BattleScreen(app),
    results: new ResultsScreen(app),
  };
  for (const [name, screen] of Object.entries(screens)) app.register(name, screen);
  new InputRouter(app, screens.battle).listen();
  const loop = new GameLoop(app, new Chrome(app), new ModalStack(app), screens);

  // O relógio avança a cada quadro: sem isso as animações ficam paradas no
  // primeiro instante e os controles com entrada animada nunca habilitam.
  let clock = 1000;
  const step = () => (clock += 600);

  const draw = () => {
    loop.frame(step());
    return app.controls.all.map((control) => ({
      id: control.id,
      disabled: control.disabled,
      label: control.label,
      x: control.x,
      y: control.y,
      w: control.w,
      h: control.h,
    }));
  };

  return {
    app,
    fields: app.fields,
    state: () => app.session.state,
    key: () => app.session.key,
    toast: () => app.session.toast,
    team: (id) => (app.teamSelection = id),
    create: (practice = false) =>
      app.session.createRoom(
        {
          participants: app.fields.participants,
          teamSize: app.fields.teamSize,
          duration: app.fields.duration,
        },
        practice,
      ),
    lookup: (code) => app.session.lookup(code ?? app.fields.code),
    join: () => app.session.joinTeam(app.fields.name, app.teamSelection),
    action: (name, body) => app.session.act(name, body),
    refresh: () => app.session.refresh(app.session.state.code),
    preview: (cardId, siteId) => {
      const team = app.session.team;
      const card = app.session.state.cards.find((c) => c.id === cardId);
      return PlayPreview.from(app.session.state).of(
        card,
        team.sites[siteId],
        team,
        app.session.energy(team),
      );
    },
    progress: (siteId) => {
      const team = app.session.team;
      return new BuildProgress(app.session.state.story).at(
        team,
        team.sites[siteId],
        app.session.elapsed(),
        app.session.state.elapsed,
      );
    },
    draw,
    click: async (id) => {
      draw();
      const control = app.controls.find(id);
      if (!control || control.disabled)
        throw new Error("Control unavailable: " + id);
      await control.run();
    },
    pointer: (name, event) => listeners[name](event),
  };
}
