import type { CardId } from "../shared/protocol.js";
import type { AgentArena } from "./app.js";
import type { BattleScreen } from "./screens/battle.js";

/**
 * Toque, mouse e teclado.
 *
 * Como a interface inteira é canvas, não há elementos que recebam evento: o
 * roteador traduz cada evento em coordenadas de projeto e pergunta ao registro
 * de controles quem está ali. Também cuida do arrasto de carta e da entrada de
 * texto pelo input invisível.
 */
export class InputRouter {
  constructor(
    private readonly app: AgentArena,
    private readonly battle: BattleScreen,
  ) {}

  listen(): void {
    const { canvas, textInput } = this.app;
    canvas.addEventListener("pointermove", (event) => this.move(event));
    canvas.addEventListener("pointerleave", () => {
      this.app.controls.hover = "";
    });
    canvas.addEventListener("pointerdown", (event) => this.down(event));
    // O retorno de um listener é ignorado pelo navegador, mas devolver a
    // promessa deixa os testes esperarem a jogada terminar.
    canvas.addEventListener("pointerup", (event) => this.up(event));
    canvas.addEventListener("pointercancel", () => {
      this.battle.drag = null;
    });
    addEventListener("keydown", (event) => this.key(event));

    textInput.addEventListener("input", () => this.type());
    textInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "Escape") {
        textInput.blur();
        this.app.editing = null;
        this.app.canvas.focus();
      }
    });
    textInput.addEventListener("blur", () => {
      this.app.editing = null;
    });
  }

  private point(event: PointerEvent): { x: number; y: number } {
    return this.app.viewport.toDesign(event.clientX, event.clientY);
  }

  private move(event: PointerEvent): void {
    this.app.pointer = this.point(event);
    const drag = this.battle.drag;
    if (
      drag &&
      Math.hypot(this.app.pointer.x - drag.x, this.app.pointer.y - drag.y) > 8
    )
      drag.active = true;
    this.app.controls.hover = this.app.controls.at(this.app.pointer)?.id ?? "";
    this.app.canvas.style.cursor = drag?.active
      ? "grabbing"
      : this.app.controls.hover
        ? "pointer"
        : "default";
  }

  private down(event: PointerEvent): void {
    this.app.pointer = this.point(event);
    const control = this.app.controls.at(this.app.pointer);
    if (!control) {
      this.app.textInput.blur();
      this.app.editing = null;
      event.preventDefault();
      return;
    }
    this.app.controls.focus = control.id;
    this.app.editing = null;
    this.app.textInput.blur();
    if (control.id.startsWith("card-")) {
      this.battle.drag = {
        cardId: control.id.slice(5) as CardId,
        x: this.app.pointer.x,
        y: this.app.pointer.y,
        active: false,
      };
      this.app.canvas.setPointerCapture?.(event.pointerId);
    }
    void control.run();
    if (this.battle.drag) this.battle.selection = this.battle.drag.cardId;
    this.app.tone();
    event.preventDefault();
  }

  private async up(event: PointerEvent): Promise<void> {
    const drag = this.battle.drag;
    this.battle.drag = null;
    if (!drag?.active || this.app.modal) return;
    const point = this.point(event);
    const target = this.app.controls.all.find(
      (control) =>
        control.id.startsWith("site-") &&
        point.x >= control.x &&
        point.x <= control.x + control.w &&
        point.y >= control.y &&
        point.y <= control.y + control.h,
    );
    if (target) await target.run();
  }

  private key(event: KeyboardEvent): void {
    if (document.activeElement === this.app.textInput) return;
    const { controls } = this.app;

    if (event.key === "Tab") {
      event.preventDefault();
      controls.step(event.shiftKey ? -1 : 1);
      this.app.canvas.focus();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      const control = controls.find(controls.focus);
      if (control && !control.disabled) {
        event.preventDefault();
        void control.run();
        this.app.tone();
      }
      return;
    }
    if (event.key === "Escape") {
      this.app.modal = null;
      this.battle.selection = null;
      controls.focus = "";
      return;
    }
    if (
      !["1", "2", "3", "4"].includes(event.key) ||
      this.app.screen !== "battle" ||
      this.app.modal
    )
      return;

    // Com a pergunta aberta, os mesmos números escolhem a alternativa.
    const slot = Number(event.key) - 1;
    const option = controls.find("quiz-" + slot);
    if (option && !option.disabled) {
      void option.run();
      return;
    }
    if (controls.all.some((control) => control.id.startsWith("quiz-"))) return;
    const card = this.app.state?.cards[slot];
    if (!card) return;
    const control = controls.find("card-" + card.id);
    if (control && !control.disabled) void control.run();
  }

  private type(): void {
    const field = this.app.editing;
    if (!field) return;
    const value = this.app.textInput.value;
    if (field === "code")
      this.app.fields.code = value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 5);
    else if (field === "name") this.app.fields.name = value.slice(0, 22);
  }
}
