import type { Snapshot } from "../shared/protocol.js";
import { ControlRegistry } from "./controls.js";
import { Painter } from "./painter.js";
import { World } from "./scene/world.js";
import { Session } from "./session.js";
import { COLORS, ROLE_CARDS } from "./theme.js";
import { Viewport, type ScreenName } from "./viewport.js";

/** Os painéis sobrepostos que a interface pode abrir. */
export type ModalName =
  | "setup"
  | "join"
  | "rules"
  | "roster"
  | "ranking"
  | "events"
  | "confirm"
  | "summary";

/** Uma confirmação pendente, mostrada antes de uma ação sem volta. */
export interface Confirmation {
  readonly title: string;
  readonly body: string;
  readonly run: () => void;
}

/** Os campos de texto e números da configuração. */
export interface Fields {
  name: string;
  code: string;
  participants: number;
  teamSize: number;
  duration: number;
}

/** Uma tela do jogo. */
export interface Screen {
  draw(): void;
}

/**
 * O jogo.
 *
 * Reúne o que é comum a todas as telas — desenho, controles, sessão, diorama e
 * o estado de interface que atravessa telas — e roda o laço de render. As telas
 * e os componentes recebem esta instância e leem daqui o que precisam, em vez
 * de compartilhar variáveis soltas de módulo.
 */
export class AgentArena {
  readonly painter: Painter;
  readonly controls: ControlRegistry;
  readonly viewport: Viewport;
  readonly session = new Session();
  world: World | null = null;
  worldFailed = false;

  screen: ScreenName = "home";
  modal: ModalName | null = null;
  confirmation: Confirmation | null = null;
  /** Campo de texto em edição, ligado ao input invisível do HTML. */
  editing: keyof Fields | null = null;
  fields: Fields = {
    name: "",
    code: "",
    participants: 24,
    teamSize: 6,
    duration: 180,
  };
  teamSelection = -1;
  rosterPage = 0;
  sound = false;
  private audio: AudioContext | null = null;

  time = 0;
  frame = 0;
  pointer = { x: -1, y: -1 };
  /** Instante da última troca de fase, usado pelas entradas animadas. */
  phaseAt = 0;
  readonly reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  private screens = new Map<ScreenName, Screen>();

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly textInput: HTMLInputElement,
    announcer: HTMLElement,
    mirror: HTMLElement,
  ) {
    const ctx = canvas.getContext("2d")!;
    this.painter = new Painter(ctx);
    this.viewport = new Viewport(canvas);
    this.controls = new ControlRegistry(this.painter, mirror, announcer);
    this.session.bind({
      onPhaseChange: (snapshot) => this.onPhaseChange(snapshot),
      onScore: () => this.world?.celebrate(),
      onTone: (ok) => this.tone(ok),
    });
    addEventListener("resize", () => this.viewport.measure());
  }

  register(name: ScreenName, screen: Screen): void {
    this.screens.set(name, screen);
  }

  get state(): Snapshot | null {
    return this.session.state;
  }

  /** Pode jogar agora: está numa guilda, a partida corre e a rede responde. */
  get canPlay(): boolean {
    return (
      this.session.playing &&
      !this.state?.paused &&
      this.session.connected &&
      !this.session.busy
    );
  }

  private onPhaseChange(snapshot: Snapshot): void {
    this.screen =
      snapshot.phase === "lobby"
        ? "lobby"
        : snapshot.phase === "finished"
          ? "results"
          : "battle";
    this.modal = null;
    this.phaseAt = this.time;
    for (const screen of this.screens.values())
      (screen as Partial<{ reset(): void }>).reset?.();
    this.controls.say(
      snapshot.phase === "playing"
        ? snapshot.story.description
        : snapshot.phase === "finished"
          ? "A partida terminou. Veja as guildas vencedoras."
          : "Escolha sua guilda.",
    );
  }

  /** Um bip curto de confirmação ou de recusa. O som é opcional. */
  tone(ok = true): void {
    if (!this.sound) return;
    try {
      this.audio ??= new AudioContext();
      void this.audio.resume();
      const context = this.audio;
      const start = context.currentTime;
      [ok ? 440 : 190, ok ? 660 : 150].forEach((hz, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = hz;
        gain.gain.setValueAtTime(0.035, start + index * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2 + index * 0.08);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start + index * 0.08);
        oscillator.stop(start + 0.25 + index * 0.08);
      });
    } catch {
      // Sem áudio disponível: o jogo segue em silêncio.
    }
  }

  /** Desenha o retrato de um modelo, ou o ícone do papel enquanto ele carrega. */
  portrait(name: string, x: number, y: number, w: number, h: number): void {
    const image = this.world?.portraits[name];
    if (image?.complete && image.naturalWidth) {
      this.painter.ctx.drawImage(image, x, y, w, h);
      return;
    }
    const role = ROLE_CARDS.find((card) => card.model === name);
    this.painter.icon(
      role?.icon ?? "shield",
      x + w / 2,
      y + h * 0.48,
      Math.min(w, h) * 0.5,
      COLORS.gold,
    );
  }

  /** Abre o teclado nativo do celular sobre um campo do canvas. */
  edit(field: keyof Fields, label: string, max: number): void {
    this.editing = field;
    this.textInput.value = String(this.fields[field]);
    this.textInput.maxLength = max;
    this.textInput.setAttribute("aria-label", label);
    this.textInput.focus({ preventScroll: true });
  }

  /** Trocou a guilda observada: a batalha volta para a primeira frente. */
  onWatch(): void {
    for (const screen of this.screens.values())
      (screen as Partial<{ reset(): void }>).reset?.();
  }

  closeModal(): void {
    this.modal = null;
    this.editing = null;
    this.textInput.blur();
  }

  ask(confirmation: Confirmation): void {
    this.confirmation = confirmation;
    this.modal = "confirm";
  }
}
