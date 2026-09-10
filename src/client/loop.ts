import type { AgentArena } from "./arena.js";
import type { Chrome } from "./chrome.js";
import type { BattleScreen } from "./screens/battle.js";
import type { HomeScreen } from "./screens/home.js";
import type { LobbyScreen } from "./screens/lobby.js";
import type { ModalStack } from "./screens/modals.js";
import type { ResultsScreen } from "./screens/results.js";

/** As telas que o laço alterna. */
export interface Screens {
  readonly home: HomeScreen;
  readonly lobby: LobbyScreen;
  readonly battle: BattleScreen;
  readonly results: ResultsScreen;
}

/**
 * O laço de render.
 *
 * A ordem importa: a mira é calculada antes do diorama, para que anel, brilho e
 * escala da frente reajam no mesmo quadro em que a carta é apontada; o diorama
 * desenha por baixo, no próprio canvas; e o espelho acessível é reconstruído a
 * cada doze quadros, para não recomeçar a leitura do leitor de tela toda hora.
 *
 * Fica separado da entrada do programa para que os testes possam desenhar um
 * quadro sem um navegador de verdade.
 */
export class GameLoop {
  private running = false;
  private animationFrame: number | null = null;
  private nextFrameAt = 0;

  private readonly step = (time: number): void => {
    this.animationFrame = null;
    if (!this.running || document.hidden) return;
    // Telas de 120/144 Hz não precisam duplicar todo o trabalho de 2D e 3D.
    const interval = 1000 / 60;
    if (time >= this.nextFrameAt - 0.1) {
      this.nextFrameAt +=
        Math.max(1, Math.floor((time - this.nextFrameAt) / interval) + 1) * interval;
      this.frame(time);
    }
    this.animationFrame = requestAnimationFrame(this.step);
  };

  private readonly visibilityChanged = (): void => {
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.nextFrameAt = 0;
    if (this.running && !document.hidden)
      this.animationFrame = requestAnimationFrame(this.step);
  };

  constructor(
    private readonly app: AgentArena,
    private readonly chrome: Chrome,
    private readonly modals: ModalStack,
    private readonly screens: Screens,
  ) {}

  frame(time: number): void {
    const app = this.app;
    app.time = time;
    app.painter.time = time;
    app.frame++;

    const ratio = Math.min(devicePixelRatio, 2);
    const ctx = app.painter.ctx;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.translate(app.viewport.offsetX, app.viewport.offsetY);
    ctx.scale(app.viewport.scale, app.viewport.scale);
    app.controls.reset();

    const battle = this.screens.battle;
    if (app.screen === "battle") battle.aim();

    const team = app.screen === "battle" ? app.session.team : null;
    app.world?.draw({
      time,
      rect: app.viewport.toDevice(app.viewport.sceneRect(app.screen)),
      width: innerWidth,
      height: innerHeight,
      reduced: app.reduced,
      team,
      elapsed: app.session.elapsed(),
      progress: team ? battle.progressOf(team) : null,
      selectedSite: battle.selectedSite,
      selectedCard: battle.selectedCard,
      targetSite: battle.aimedSite,
      legal: battle.aimLegality,
      paused: Boolean(app.state?.paused),
    });

    if (app.screen === "results")
      app.painter.rect(0, 0, app.viewport.width, app.viewport.height, "#0d233ac9", 0);
    if (app.screen === "lobby")
      app.painter.rect(
        0,
        82,
        app.viewport.mobile ? app.viewport.width : 1010,
        app.viewport.height - 82,
        "#10263b66",
        0,
      );

    this.chrome.topbar();
    if (app.screen === "home") this.screens.home.draw();
    else if (app.screen === "lobby") this.screens.lobby.draw();
    else if (app.screen === "battle") battle.draw();
    else this.screens.results.draw();
    this.modals.draw();
    this.chrome.overlays();

    if (app.frame % 12 === 0) app.controls.syncAccessibility();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    document.addEventListener("visibilitychange", this.visibilityChanged);
    this.visibilityChanged();
  }

  stop(): void {
    this.running = false;
    document.removeEventListener("visibilitychange", this.visibilityChanged);
    this.visibilityChanged();
  }
}
