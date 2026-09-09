import type { AgentArena, Fields } from "../app.js";
import { COLORS } from "../theme.js";

/**
 * Um campo de texto desenhado no canvas.
 *
 * Não existe elemento de formulário na tela: o toque no campo põe o foco num
 * input invisível do HTML, que é o que abre o teclado nativo do celular. O
 * cursor piscante é desenhado a partir da largura do texto já digitado.
 */
export class TextField {
  constructor(private readonly app: AgentArena) {}

  draw(
    id: keyof Fields,
    label: string,
    x: number,
    y: number,
    w: number,
    max = 22,
  ): void {
    const { painter, controls, time } = this.app;
    const value = String(this.app.fields[id] ?? "");
    const editing = this.app.editing === id;
    painter.text(label, x, y, 14, COLORS.muted);
    painter.rect(x, y + 18, w, 50, "#102338", 9, editing ? COLORS.gold : "#60798d");
    painter.text(
      value || (id === "name" ? "Seu nome" : id === "code" ? "ABCDE" : ""),
      x + 16,
      y + 43,
      20,
      value ? COLORS.cream : "#718da3",
    );
    if (editing && Math.floor(time / 500) % 2 === 0) {
      const width = painter.measure(value, 20, 700);
      painter.line(x + 17 + width, y + 30, x + 17 + width, y + 55, COLORS.gold, 2);
    }
    controls.hit(id, x, y + 18, w, 50, label, () =>
      this.app.edit(id, label, max),
    );
  }
}

/** Um seletor de número com − e +, usado na configuração da arena. */
export class Stepper {
  constructor(private readonly app: AgentArena) {}

  draw(
    id: "participants" | "teamSize",
    label: string,
    x: number,
    y: number,
    w: number,
    min: number,
    max: number,
    step = 1,
  ): void {
    const { painter, controls } = this.app;
    const value = this.app.fields[id];
    painter.text(label, x, y, 16, COLORS.muted);
    controls.button(
      id + "-",
      x,
      y + 22,
      48,
      43,
      "−",
      () => (this.app.fields[id] = Math.max(min, value - step)),
      { kind: "dark", disabled: value <= min },
    );
    painter.display(String(value), x + w / 2, y + 44, 28);
    controls.button(
      id + "+",
      x + w - 48,
      y + 22,
      48,
      43,
      "+",
      () => (this.app.fields[id] = Math.min(max, value + step)),
      { kind: "dark", disabled: value >= max },
    );
  }
}
