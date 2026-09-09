import type { AgentArena, Screen } from "../app.js";
import { COLORS } from "../theme.js";

/** O pódio do fim da partida, com confete e o resumo da guilda. */
export class ResultsScreen implements Screen {
  constructor(private readonly app: AgentArena) {}

  draw(): void {
    const { painter, controls, viewport, session, state } = this.app;
    if (!state) return;
    const mobile = viewport.mobile;
    const W = viewport.width;
    const H = viewport.height;

    const winners = state.teams.filter((team) =>
      state.winners.includes(team.id),
    );
    const tied = winners.length > 1;
    const order = [...state.teams].sort(
      (a, b) => b.score - a.score || a.id - b.id,
    );

    painter.display(
      state.practice
        ? "Treino concluído!"
        : tied
          ? "Uma conquista compartilhada!"
          : "A conquista das guildas!",
      W / 2,
      mobile ? 115 : 152,
      mobile ? 31 : 57,
      COLORS.gold,
      "center",
    );
    painter.text(
      state.practice
        ? "Sua guilda colocou os agentes em campo."
        : tied
          ? "As guildas empataram no maior placar."
          : `A guilda ${winners[0]!.name} conquistou a vitória.`,
      W / 2,
      mobile ? 163 : 217,
      mobile ? 14 : 23,
      COLORS.cream,
      "center",
    );

    if (mobile) this.compact(order, winners, tied);
    else this.podium(order);

    controls.button(
      "new-arena",
      mobile ? 20 : 908,
      mobile ? H - 86 : 831,
      mobile ? W - 40 : 314,
      46,
      "Voltar ao início",
      () => {
        session.leave();
        this.app.screen = "home";
        this.app.modal = null;
      },
      { kind: "gold", small: true },
    );
    this.confetti();
  }

  private compact(
    order: readonly { name: string; color: string; icon: string; score: number }[],
    winners: readonly { name: string }[],
    tied: boolean,
  ): void {
    const { painter, controls, viewport } = this.app;
    const W = viewport.width;
    const H = viewport.height;
    const top = order[0]!;
    painter.shield(W / 2, 254, 105, top.color, top.icon);
    painter.display(top.name, W / 2, 353, 39, COLORS.cream, "center");
    painter.display(`${top.score} pontos`, W / 2, 401, 36, COLORS.gold, "center");
    painter.panel(20, 451, W - 40, 137);
    painter.wrap(
      tied
        ? winners.length > 4
          ? `${winners.length} guildas dividem a vitória. Veja todas na classificação.`
          : "A vitória pertence a: " +
            winners.map((team) => team.name).join(", ") +
            "."
        : "O prêmio é da guilda inteira. Cada decisão ajudou a reconstruir o reino.",
      42,
      479,
      W - 84,
      16,
      COLORS.muted,
      24,
    );
    controls.hit(
      "report",
      20,
      451,
      W - 40,
      137,
      "Ver resumo da guilda",
      () => (this.app.modal = "summary"),
    );
    painter.text(
      "Toque aqui para ver o resumo da guilda",
      W / 2,
      566,
      11,
      COLORS.gold,
      "center",
    );
    controls.button(
      "final-rank",
      20,
      H - 150,
      W - 40,
      44,
      "Ver classificação completa",
      () => (this.app.modal = "ranking"),
      { kind: "blue", small: true },
    );
  }

  private podium(
    order: readonly {
      id: number;
      name: string;
      color: string;
      icon: string;
      score: number;
    }[],
  ): void {
    const { painter, controls, viewport, state } = this.app;
    if (!state) return;
    const W = viewport.width;
    const show = order.slice(0, 3);
    // O primeiro lugar fica no meio e mais alto, como num pódio de verdade.
    const slots = show.length === 1 ? [0] : show.length === 2 ? [1, 0] : [1, 0, 2];

    slots.forEach((index, position) => {
      const team = show[index]!;
      const cx =
        show.length === 1
          ? W / 2
          : W / 2 + (position - (show.length === 2 ? 0.5 : 1)) * 291;
      const top = index === 0 ? 451 : 507;
      const winner = state.winners.includes(team.id);
      painter.shield(cx, top - 89, index === 0 ? 105 : 78, team.color, team.icon);
      painter.display(
        team.name,
        cx,
        top - 13,
        index === 0 ? 37 : 28,
        COLORS.cream,
        "center",
      );
      painter.gradient(
        cx - 119,
        top + 35,
        238,
        650 - top,
        "#567083",
        "#253e54",
        12,
        "#9fb1b2",
      );
      painter.rect(cx - 122, top + 30, 244, 18, winner ? "#d8b774" : "#8198a7", 5);
      painter.display(String(team.score), cx, top + 94, 48, COLORS.gold, "center");
      painter.text(
        "pontos de reconstrução",
        cx,
        top + 135,
        13,
        COLORS.muted,
        "center",
      );
      if (winner)
        painter.pill("GUILDA VENCEDORA", cx - 91, top - 177, COLORS.gold, 182);
    });

    painter.text(
      state.practice
        ? "Pronto para reunir sua turma na próxima arena?"
        : "O brinde é de toda a guilda. A conquista também.",
      W / 2,
      744,
      23,
      COLORS.cream,
      "center",
    );
    painter.text(
      "Escopo claro. Contexto durável. Ferramentas certas. Autonomia com limites.",
      W / 2,
      786,
      16,
      COLORS.muted,
      "center",
    );
    controls.button(
      "report",
      218,
      831,
      314,
      46,
      "Resumo da guilda",
      () => (this.app.modal = "summary"),
      { kind: "dark", small: true },
    );
    controls.button(
      "final-rank",
      563,
      831,
      314,
      46,
      "Classificação completa",
      () => (this.app.modal = "ranking"),
      { kind: "blue", small: true },
    );
  }

  private confetti(): void {
    const { painter, viewport, time, phaseAt, reduced } = this.app;
    if (reduced) return;
    const W = viewport.width;
    const H = viewport.height;
    const ctx = painter.ctx;
    const palette = [COLORS.gold, COLORS.blue, COLORS.green, COLORS.red];
    for (let i = 0; i < 48; i++) {
      const t = (time - phaseAt) * 0.00012 + i * 0.057;
      const x = ((i * 139) % W) + Math.sin(t * 4 + i) * 25;
      const y = ((t * 430 + i * 31) % (H + 70)) - 35;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 3 + i);
      painter.rect(-3, -5, 6, 10, palette[i % 4]!, 1);
      ctx.restore();
    }
  }
}
