import { drawIcon, type IconName } from "./icons.js";
import { Painter } from "./painter.js";
import {
  BUTTON_PALETTES,
  CHOICE_PALETTES,
  COLORS,
  type ButtonKind,
  type ChoiceMark,
} from "./theme.js";

/** Uma área clicável registrada neste quadro. */
export interface Control {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Rotação visual em torno do centro, em radianos. */
  readonly rotation: number;
  /** Ordem de teclado independente da sobreposição visual. */
  readonly navigationOrder: number;
  /** Texto lido por tecnologias assistivas e usado pelos testes. */
  readonly label: string;
  readonly disabled: boolean;
  readonly run: () => unknown;
}

export interface ButtonOptions {
  kind?: ButtonKind;
  disabled?: boolean;
  small?: boolean;
  icon?: IconName | string | null;
}

export interface ChoiceOptions {
  disabled?: boolean;
  mark?: ChoiceMark | null;
  /** Deslocamento horizontal da animação de erro. */
  shake?: number;
  size?: number;
  /** Instante em que a marcação começou, para o ícone entrar crescendo. */
  markedAt?: number;
}

/**
 * O registro de áreas clicáveis do quadro.
 *
 * A interface inteira é pintada em canvas, então não há elementos de DOM para
 * receber clique ou foco. Cada componente registra aqui a área que desenhou, na
 * ordem em que desenhou, e o registro resolve o clique, o foco do teclado e o
 * espelho acessível — botões invisíveis que leitores de tela conseguem
 * percorrer.
 */
export class ControlRegistry {
  private controls: Control[] = [];
  hover = "";
  focus = "";
  private signature = "";

  constructor(
    private readonly painter: Painter,
    private readonly mirror: HTMLElement,
    private readonly announcer: HTMLElement,
  ) {}

  /** Limpa o registro para começar um quadro. */
  reset(): void {
    this.controls = [];
  }

  get all(): readonly Control[] {
    return this.controls;
  }

  find(id: string): Control | undefined {
    return this.controls.find((control) => control.id === id);
  }

  has(id: string): boolean {
    return this.controls.some((control) => control.id === id);
  }

  /**
   * Registra uma área clicável e desenha o realce de foco.
   * Quem registra depois ganha o clique onde as áreas se sobrepõem.
   */
  hit(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    run: () => unknown,
    disabled = false,
    rotation = 0,
    navigationOrder = this.controls.length,
  ): void {
    this.controls.push({
      id,
      x,
      y,
      w,
      h,
      label,
      disabled,
      run,
      rotation,
      navigationOrder,
    });
    if ((this.focus === id || this.hover === id) && !disabled) {
      this.painter.save();
      this.painter.ctx.translate(x + w / 2, y + h / 2);
      this.painter.ctx.rotate(rotation);
      this.painter.path(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 13);
      this.painter.ctx.strokeStyle =
        this.focus === id ? "#fff4c6" : "#ffe3a6aa";
      this.painter.ctx.lineWidth = 2;
      this.painter.ctx.stroke();
      this.painter.restore();
    }
  }

  /** Qual controle está sob um ponto, respeitando a ordem de desenho. */
  at(point: { x: number; y: number }): Control | undefined {
    return [...this.controls].reverse().find((control) => {
      const dx = point.x - control.x - control.w / 2;
      const dy = point.y - control.y - control.h / 2;
      const cos = Math.cos(control.rotation);
      const sin = Math.sin(control.rotation);
      return (
        !control.disabled &&
        Math.abs(dx * cos + dy * sin) <= control.w / 2 &&
        Math.abs(dy * cos - dx * sin) <= control.h / 2
      );
    });
  }

  /** Move o foco do teclado para o próximo controle habilitado. */
  step(direction: 1 | -1): void {
    const enabled = this.controls
      .filter((control) => !control.disabled)
      .sort((a, b) => a.navigationOrder - b.navigationOrder);
    if (!enabled.length) return;
    const current = enabled.findIndex((control) => control.id === this.focus);
    const next = (current + direction + enabled.length) % enabled.length;
    const target = enabled[next]!;
    this.focus = target.id;
    this.announcer.textContent = target.label;
  }

  say(message: string): void {
    this.announcer.textContent = message;
  }

  /**
   * Mantém o espelho acessível em dia. Só reconstrói quando a lista muda, senão
   * o leitor de tela recomeçaria a leitura a cada quadro.
   */
  syncAccessibility(): void {
    const ordered = [...this.controls].sort(
      (a, b) => a.navigationOrder - b.navigationOrder,
    );
    const signature = ordered
      .map((control) => `${control.id}:${control.label}:${control.disabled}`)
      .join("|");
    if (signature === this.signature) return;
    this.signature = signature;
    this.mirror.replaceChildren(
      ...ordered.map((control) => {
        const button = document.createElement("button");
        button.textContent = control.label;
        button.tabIndex = -1;
        button.disabled = control.disabled;
        button.onclick = () => {
          void this.find(control.id)?.run();
        };
        return button;
      }),
    );
  }

  // ── Controles desenhados ───────────────────────────────────────────────────

  button(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    run: () => unknown,
    options: ButtonOptions = {},
  ): void {
    const {
      kind = "gold",
      disabled = false,
      small = false,
      icon = null,
    } = options;
    const ctx = this.painter.ctx;
    ctx.save();
    if (disabled) ctx.globalAlpha = 0.42;
    const active = (this.hover === id || this.focus === id) && !disabled;
    const top = y + (active ? -2 : 0);
    const palette = BUTTON_PALETTES[kind];
    this.painter.rect(x, top + 5, w, h, palette[2], 12, "#0b192a");
    this.painter.gradient(x, top, w, h, palette[0], palette[1], 12, palette[3]);
    this.painter.line(x + 12, top + 3, x + w - 12, top + 3, "#ffffff55");
    this.painter.text(
      label,
      x + w / 2 + (icon ? 10 : 0),
      top + h / 2,
      small ? 14 : 18,
      kind === "dark" ? COLORS.cream : "#1e3547",
      "center",
      900,
    );
    if (icon)
      drawIcon(
        ctx,
        icon,
        x + 26,
        top + h / 2,
        23,
        kind === "dark" ? COLORS.gold : "#234253",
      );
    ctx.restore();
    this.hit(id, x, y, w, h, label, run, disabled);
  }

  /**
   * Uma alternativa da pergunta.
   *
   * Mesma construção do botão — sombra, gradiente, brilho no topo e elevação no
   * foco. Só o texto quebra em linhas e o estado pinta certo, errado ou apagado.
   */
  choice(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    index: number,
    label: string,
    run: () => unknown,
    options: ChoiceOptions = {},
  ): void {
    const {
      disabled = false,
      mark = null,
      shake = 0,
      size = 14,
      markedAt = 0,
    } = options;
    const ctx = this.painter.ctx;
    const active =
      (this.hover === id || this.focus === id) && !disabled && !mark;
    const lift = active ? -2 : 0;
    const palette = CHOICE_PALETTES[mark ?? (disabled ? "faded" : "idle")];

    ctx.save();
    ctx.translate(shake, lift);
    this.painter.rect(x, y + 5, w, h, palette[2], 12, "#0b192a");
    this.painter.gradient(x, y, w, h, palette[0], palette[1], 12, palette[3]);
    this.painter.line(x + 12, y + 3, x + w - 12, y + 3, "#ffffff44");

    // Só a alternativa certa e a escolhida recebem marca. As demais mantêm o
    // número, senão um "×" nelas leria como se tivessem sido respondidas.
    const marked = mark === "correct" || mark === "wrong";
    if (!marked) {
      this.painter.rect(
        x + 12,
        y + h / 2 - 13,
        26,
        26,
        "#0d1f3199",
        8,
        "#ffffff26",
      );
      this.painter.text(
        String(index + 1),
        x + 25,
        y + h / 2,
        14,
        mark === "faded" ? "#6d8698" : COLORS.gold,
        "center",
        900,
      );
    } else {
      // O pop do ícone marca o instante da correção, sem trocar o layout.
      const pop = Math.max(
        0,
        Math.min(1, (this.painter.time - markedAt) / 260),
      );
      ctx.save();
      ctx.translate(x + 25, y + h / 2);
      ctx.scale(0.4 + 0.6 * pop, 0.4 + 0.6 * pop);
      drawIcon(
        ctx,
        mark === "correct" ? "check" : "cross",
        0,
        0,
        26,
        palette[4],
      );
      ctx.restore();
    }
    this.painter.wrap(
      label,
      x + 48,
      y + h / 2,
      w - 62,
      size,
      palette[4],
      17,
      2,
    );
    ctx.restore();
    this.hit(
      id,
      x,
      y,
      w,
      h,
      `Alternativa ${index + 1}: ${label}`,
      run,
      disabled,
    );
  }
}
