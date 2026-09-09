import { drawIcon, type IconName } from "./icons.js";
import { COLORS } from "./theme.js";

export type Align = "left" | "center" | "right";

/**
 * As primitivas de desenho da interface.
 *
 * Toda a interface visível é pintada em Canvas 2D, e todo desenho passa por
 * aqui: painéis, textos, pílulas, ícones e escudos. Concentrar isto numa classe
 * é o que mantém a aparência coerente entre telas sem cada componente repetir
 * sombras, raios de canto e famílias de fonte.
 */
export class Painter {
  constructor(readonly ctx: CanvasRenderingContext2D) {}

  /** Instante do quadro atual, usado pelas animações que piscam. */
  time = 0;

  save(): void {
    this.ctx.save();
  }

  restore(): void {
    this.ctx.restore();
  }

  set alpha(value: number) {
    this.ctx.globalAlpha = value;
  }

  get alpha(): number {
    return this.ctx.globalAlpha;
  }

  path(x: number, y: number, w: number, h: number, radius = 12): void {
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, radius);
  }

  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string | CanvasGradient,
    radius = 12,
    stroke: string | null = null,
  ): void {
    this.path(x, y, w, h, radius);
    this.ctx.fillStyle = fill;
    this.ctx.fill();
    if (stroke) {
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }
  }

  gradient(
    x: number,
    y: number,
    w: number,
    h: number,
    top: string,
    bottom: string,
    radius = 12,
    stroke: string | null = null,
  ): void {
    const fill = this.ctx.createLinearGradient(x, y, x, y + h);
    fill.addColorStop(0, top);
    fill.addColorStop(1, bottom);
    this.path(x, y, w, h, radius);
    this.ctx.fillStyle = fill;
    this.ctx.fill();
    if (stroke) {
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }
  }

  text(
    value: string | number,
    x: number,
    y: number,
    size = 18,
    color: string = COLORS.cream,
    align: Align = "left",
    weight = 700,
    font = "Nunito",
  ): void {
    this.ctx.font = `${weight} ${size}px ${font}`;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(String(value), x, y);
  }

  /** Texto de destaque, com contorno para sobreviver a qualquer fundo. */
  display(
    value: string | number,
    x: number,
    y: number,
    size = 38,
    color: string = COLORS.cream,
    align: Align = "left",
  ): void {
    this.ctx.font = `${size}px Lilita`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = "middle";
    this.ctx.lineJoin = "round";
    this.ctx.strokeStyle = "#112032";
    this.ctx.lineWidth = Math.max(2, size * 0.09);
    this.ctx.strokeText(String(value), x, y + 3);
    this.ctx.fillStyle = color;
    this.ctx.fillText(String(value), x, y);
  }

  /** Quebra o texto na largura dada e devolve o y logo abaixo da última linha. */
  wrap(
    value: string,
    x: number,
    y: number,
    width: number,
    size = 18,
    color: string = COLORS.muted,
    lineHeight = 26,
    maxLines = 10,
  ): number {
    this.ctx.font = `700 ${size}px Nunito`;
    const words = String(value).split(" ");
    let row = "";
    let printed = 0;
    for (const word of words) {
      const candidate = row ? row + " " + word : word;
      if (this.ctx.measureText(candidate).width > width && row) {
        this.text(row, x, y + printed * lineHeight, size, color);
        printed++;
        row = word;
        if (printed >= maxLines) return y + printed * lineHeight;
      } else row = candidate;
    }
    if (row) this.text(row, x, y + printed * lineHeight, size, color);
    return y + (printed + 1) * lineHeight;
  }

  /**
   * Conta as linhas que `wrap` produziria. Serve para dimensionar um painel
   * antes de desenhar o texto dentro dele.
   */
  countLines(value: string, width: number, size: number, maxLines = 3): number {
    this.ctx.font = `700 ${size}px Nunito`;
    let lines = 1;
    let row = "";
    for (const word of String(value).split(" ")) {
      const candidate = row ? row + " " + word : word;
      if (this.ctx.measureText(candidate).width > width && row) {
        if (++lines >= maxLines) return maxLines;
        row = word;
      } else row = candidate;
    }
    return lines;
  }

  measure(value: string, size: number, weight = 800): number {
    this.ctx.font = `${weight} ${size}px Nunito`;
    return this.ctx.measureText(value).width;
  }

  line(
    x: number,
    y: number,
    x2: number,
    y2: number,
    color: string = COLORS.line,
    width = 1,
  ): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x2, y2);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.stroke();
  }

  icon(
    name: IconName | string,
    x: number,
    y: number,
    size = 32,
    color: string = COLORS.gold,
  ): void {
    drawIcon(this.ctx, name, x, y, size, color);
  }

  /** O brasão de uma guilda. */
  shield(
    x: number,
    y: number,
    size: number,
    color: string,
    mark: IconName | string = "crown",
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 60, size / 60);
    ctx.shadowColor = "#061322";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    ctx.beginPath();
    ctx.moveTo(-27, -29);
    ctx.lineTo(27, -29);
    ctx.lineTo(25, 5);
    ctx.quadraticCurveTo(20, 25, 0, 36);
    ctx.quadraticCurveTo(-20, 25, -25, 5);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, -30, 0, 36);
    fill.addColorStop(0, color);
    fill.addColorStop(1, "#25384b");
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = "#e8c68c";
    ctx.lineWidth = 3;
    ctx.stroke();
    drawIcon(ctx, mark, 0, -1, 31, COLORS.cream);
    ctx.restore();
  }

  /** A moldura padrão de qualquer painel. */
  panel(
    x: number,
    y: number,
    w: number,
    h: number,
    title: string | null = null,
  ): void {
    this.ctx.save();
    this.ctx.shadowColor = "#06132688";
    this.ctx.shadowBlur = 22;
    this.ctx.shadowOffsetY = 9;
    this.gradient(x, y, w, h, "#29435a", "#14283d", 17, "#698090");
    this.ctx.restore();
    this.rect(x + 5, y + 5, w - 10, 3, "#ffffff0d", 2);
    if (title) {
      this.display(title, x + 24, y + 32, 26);
      this.line(x + 20, y + 58, x + w - 20, y + 58, "#6c83943b");
    }
  }

  /** Etiqueta arredondada. A largura acompanha o texto quando não é informada. */
  pill(
    label: string,
    x: number,
    y: number,
    color: string = COLORS.gold,
    width: number | null = null,
  ): void {
    this.ctx.font = "800 12px Nunito";
    const w = width ?? this.ctx.measureText(label).width + 28;
    this.rect(x, y, w, 28, "#0d2035d9", 14, color + "55");
    this.text(label, x + w / 2, y + 14, 12, color, "center", 900);
  }
}
