import { AgentArena } from "./app.js";
import { Chrome } from "./chrome.js";
import { InputRouter } from "./input.js";
import { GameLoop } from "./loop.js";
import { World } from "./scene/world.js";
import { Session } from "./session.js";
import { BattleScreen } from "./screens/battle.js";
import { HomeScreen } from "./screens/home.js";
import { LobbyScreen } from "./screens/lobby.js";
import { ModalStack } from "./screens/modals.js";
import { ResultsScreen } from "./screens/results.js";

/**
 * A entrada do programa: monta as peças, liga a entrada e começa a desenhar.
 * Nenhuma regra mora aqui.
 */
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const worldCanvas = document.querySelector<HTMLCanvasElement>("#world")!;
const textInput = document.querySelector<HTMLInputElement>("#text-entry")!;
const announcer = document.querySelector<HTMLElement>("#announcer")!;
const mirror = document.querySelector<HTMLElement>("#accessible-controls")!;

const app = new AgentArena(canvas, textInput, announcer, mirror);
const screens = {
  home: new HomeScreen(app),
  lobby: new LobbyScreen(app),
  battle: new BattleScreen(app),
  results: new ResultsScreen(app),
};
app.register("home", screens.home);
app.register("lobby", screens.lobby);
app.register("battle", screens.battle);
app.register("results", screens.results);
new InputRouter(app, screens.battle).listen();
const loop = new GameLoop(app, new Chrome(app), new ModalStack(app), screens);

await Promise.all([
  document.fonts.load("20px Lilita"),
  document.fonts.load("700 20px Nunito"),
]);
loop.start();

// O diorama carrega depois do primeiro quadro: a interface 2D já responde
// enquanto os modelos chegam, e uma falha aqui não impede a partida.
World.create(worldCanvas)
  .then((world) => {
    app.world = world;
  })
  .catch(() => {
    app.worldFailed = true;
  });

void app.session.loadInviteBase();

// Retoma a sala da aba, ou abre a que veio pelo endereço.
const roomFromUrl = new URLSearchParams(location.search).get("room")?.toUpperCase();
const saved = Session.restore();
if (saved?.code && (!roomFromUrl || roomFromUrl === saved.code)) {
  void app.session.work(async () => {
    app.session.key = saved.key;
    app.session.adminKey = saved.adminKey || "";
    try {
      await app.session.refresh(saved.code);
    } catch {
      app.session.key = "";
      app.session.adminKey = "";
      app.session.notify("A sala anterior foi encerrada. Crie uma nova arena.");
    }
  });
} else if (roomFromUrl && /^[A-Z0-9]{5}$/.test(roomFromUrl)) {
  app.fields.code = roomFromUrl;
  void app.session.lookup(roomFromUrl);
}
