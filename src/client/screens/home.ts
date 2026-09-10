import type { AgentArena, Screen } from "../arena.js";
import { COLORS, ROLE_CARDS } from "../theme.js";

/** A tela inicial: quem cria a arena, quem entra com código e quem treina. */
export class HomeScreen implements Screen {
  constructor(private readonly app: AgentArena) {}

  draw(): void {
    if (this.app.viewport.mobile) this.compact();
    else this.wide();
  }

  private compact(): void {
    const { painter, controls, viewport, session } = this.app;
    const W = viewport.width;
    const H = viewport.height;
    painter.pill("UMA MISSÃO. VÁRIAS MENTES.", 112, 78, COLORS.gold, 206);
    painter.display("AGENT ARENA", W / 2, 135, 49, COLORS.cream, "center");
    painter.text(
      "Reconstrua a Cidadela dos Agentes.",
      W / 2,
      176,
      16,
      COLORS.muted,
      "center",
    );
    painter.pill("A Cidadela espera pela sua guilda", 99, 365, COLORS.cream, 232);

    const y = Math.max(425, H - 340);
    controls.button(
      "create",
      26,
      y,
      W - 52,
      57,
      "Criar uma arena",
      () => (this.app.modal = "setup"),
      { icon: "crown" },
    );
    controls.button(
      "join",
      26,
      y + 76,
      W - 52,
      57,
      "Entrar com código",
      () => (this.app.modal = "join"),
      { kind: "blue", icon: "shield" },
    );
    controls.button(
      "practice",
      95,
      y + 152,
      W - 190,
      43,
      "Treinar sozinho",
      () => this.practice(),
      { kind: "dark", small: true },
    );
    void session;
    painter.text(
      "Agentes em campo  •  contexto compartilhado  •  uma conquista",
      W / 2,
      H - 65,
      12,
      COLORS.muted,
      "center",
    );
    painter.text(
      "Inspirado em estratégia. Movido por conhecimento.",
      W / 2,
      H - 39,
      11,
      "#7996ab",
      "center",
    );
  }

  private wide(): void {
    const { painter, controls, viewport } = this.app;
    const W = viewport.width;
    painter.pill("ESTRATÉGIA EM EQUIPE", 77, 137, COLORS.gold, 186);
    painter.display("AGENT", 73, 223, 99);
    painter.display("ARENA", 73, 314, 112, COLORS.gold);
    painter.text(
      "O reino precisa de boas decisões.",
      80,
      393,
      24,
      COLORS.cream,
      "left",
      800,
    );
    painter.wrap(
      "Reúna sua guilda. Comande os agentes. Reconstrua a Cidadela antes que o caos alcance os portões.",
      80,
      439,
      410,
      18,
      COLORS.muted,
      27,
    );
    controls.button(
      "create",
      80,
      551,
      360,
      61,
      "Criar uma arena",
      () => (this.app.modal = "setup"),
      { icon: "crown" },
    );
    controls.button(
      "join",
      80,
      632,
      223,
      51,
      "Entrar com código",
      () => (this.app.modal = "join"),
      { kind: "blue", small: true },
    );
    controls.button(
      "practice",
      316,
      632,
      124,
      51,
      "Treinar",
      () => this.practice(),
      { kind: "dark", small: true },
    );
    painter.pill("A CIDADELA DOS AGENTES", 888, 137, COLORS.cream, 220);
    painter.pill("DECISÕES CONSTROEM REINOS", 827, 638, COLORS.gold, 262);

    ROLE_CARDS.forEach((role, index) => {
      const x = 530 + index * 211;
      const y = 729;
      painter.panel(x, y, 194, 117);
      painter.rect(x + 7, y + 7, 180, 3, role.color, 2);
      this.app.portrait(role.model, x + 6, y + 13, 77, 90);
      painter.text(role.title, x + 81, y + 46, 14, COLORS.cream);
      painter.wrap(role.blurb, x + 81, y + 70, 104, 11, COLORS.muted, 15);
    });
    painter.text("Estratégia em tempo real", 80, 753, 17, COLORS.gold);
    painter.text("4–80 participantes", 80, 782, 16, COLORS.muted);
    painter.text(
      "Uma guilda vencedora. Um brinde de verdade.",
      80,
      823,
      13,
      COLORS.muted,
    );
    painter.text("Modelos KayKit · CC0", W - 38, 879, 11, "#839eac", "right");
  }

  private practice(): void {
    void this.app.session.createRoom(
      {
        participants: this.app.fields.participants,
        teamSize: this.app.fields.teamSize,
        duration: this.app.fields.duration,
      },
      true,
    );
  }
}
