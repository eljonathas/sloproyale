import type { AgentArena } from "./arena.js";
import { COLORS } from "./theme.js";

/**
 * A moldura constante: a barra do topo, o aviso de conexão, o carregamento dos
 * modelos e o aviso passageiro. Fica fora das telas porque não muda com elas.
 */
export class Chrome {
  constructor(private readonly app: AgentArena) {}

  topbar(): void {
    const { painter, controls, viewport, state } = this.app;
    const mobile = viewport.mobile;
    const W = viewport.width;
    const y = mobile ? 27 : 39;

    painter.shield(mobile ? 31 : 52, y, mobile ? 25 : 31, COLORS.blue, "crown");
    painter.display("AGENT ARENA", mobile ? 54 : 79, y, mobile ? 22 : 25);

    if (state) {
      painter.pill(
        state.practice ? "Treino" : `Sala ${state.code}`,
        mobile ? 238 : 295,
        y - 14,
        COLORS.gold,
        mobile ? 111 : 130,
      );
      if (!mobile)
        painter.text(
          state.phase === "lobby"
            ? "A Cidadela dos Agentes"
            : "A reconstrução da Cidadela",
          W / 2,
          y,
          16,
          COLORS.muted,
          "center",
        );
    } else if (!mobile)
      painter.text(
        "A Cidadela dos Agentes",
        W / 2,
        y,
        16,
        COLORS.muted,
        "center",
      );

    const tools: readonly [string, string, () => void][] = mobile
      ? [["help", "?", () => (this.app.modal = "rules")]]
      : [
          [
            "sound",
            this.app.sound ? "Som ligado" : "Som desligado",
            () => {
              this.app.sound = !this.app.sound;
              if (this.app.sound) this.app.tone();
            },
          ],
          [
            "expand",
            "Tela cheia",
            () => {
              if (document.fullscreenElement) void document.exitFullscreen?.();
              else
                void document.documentElement
                  .requestFullscreen?.()
                  .catch(() => {});
            },
          ],
          ["help", "Como jogar", () => (this.app.modal = "rules")],
        ];

    tools.forEach(([icon, label, run], index) => {
      const x = W - (tools.length - index) * 49 - 20;
      painter.rect(x, y - 19, 38, 38, "#12263d88", 10, "#7896ab44");
      painter.icon(icon, x + 19, y, 21, COLORS.muted);
      if (icon === "sound" && !this.app.sound)
        painter.line(x + 10, y + 10, x + 28, y - 10, COLORS.muted, 2);
      controls.hit("tool-" + icon, x, y - 19, 38, 38, label, run);
    });
    painter.line(24, mobile ? 59 : 77, W - 24, mobile ? 59 : 77, "#a7bed71c");
  }

  /** Avisos que aparecem por cima de qualquer tela. */
  overlays(): void {
    const { painter, viewport, session, world, time } = this.app;
    const W = viewport.width;
    const H = viewport.height;
    const mobile = viewport.mobile;

    if (session.state && !session.connected) {
      painter.rect(0, 60, W, 32, "#8e432c", 0);
      painter.text(
        "Conexão perdida · tentando reconectar. Aguarde para mobilizar agentes.",
        W / 2,
        76,
        mobile ? 10 : 14,
        "#fff1dd",
        "center",
      );
    }

    if (world?.progress.failures.length || this.app.worldFailed)
      painter.text(
        "Modelos 3D indisponíveis · a arena continua funcionando.",
        W / 2,
        H - 9,
        10,
        COLORS.red,
        "center",
      );
    else if (world && world.progress.loaded < world.progress.total)
      painter.text(
        `Preparando a Cidadela ${world.progress.loaded}/${world.progress.total}`,
        W - 26,
        H - 12,
        11,
        COLORS.muted,
        "right",
      );

    const toast = session.toast;
    if (toast && toast.until > time) {
      const w = mobile ? W - 30 : Math.min(760, W - 80);
      const y = mobile ? 66 : H - 136;
      painter.panel((W - w) / 2, y, w, 69);
      painter.wrap(
        toast.message,
        (W - w) / 2 + 19,
        y + 24,
        w - 38,
        mobile ? 13 : 16,
        toast.error ? COLORS.red : COLORS.cream,
        21,
        2,
      );
    }

    if (session.busy)
      painter.pill(
        "Conectando…",
        W / 2 - 65,
        this.app.modal ? H - 29 : 73,
        COLORS.gold,
        130,
      );
  }
}
