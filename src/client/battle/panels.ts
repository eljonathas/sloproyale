import type { TeamView } from "../../shared/protocol.js";
import type { AgentArena } from "../app.js";
import type { AgentAnchor } from "../scene/world.js";
import { COLORS } from "../theme.js";

/**
 * O painel esquerdo: identidade da guilda, quem está nela e o placar.
 *
 * A lista de pessoas existe porque o contexto e o limite de agentes são do time
 * inteiro — sem ela ninguém percebe que está disputando o mesmo orçamento com
 * os colegas. O painel acompanha o tamanho da guilda, para não abrir um vão
 * antes do placar quando o time é pequeno.
 */
export class GuildPanel {
  constructor(private readonly app: AgentArena) {}

  draw(team: TeamView): void {
    const { painter, controls, state, session } = this.app;
    if (!state) return;
    const guild = state.players.filter((player) => player.teamId === team.id);
    const seats = Math.max(1, Math.min(5, guild.length));
    const rosterEnd = 214 + seats * 32 + (guild.length > 5 ? 24 : 0);
    const rankTop = rosterEnd + 42;
    const ranked = Math.min(4, state.teams.length);

    painter.panel(24, 92, 272, rankTop + ranked * 40 + 52 - 92);
    painter.shield(60, 128, 44, team.color, team.icon);
    painter.display(team.name, 92, 120, 26, team.color);
    painter.text(
      session.playing ? "sua guilda" : "acompanhando",
      93,
      143,
      12,
      COLORS.muted,
      "left",
      800,
    );
    painter.text(team.score, 272, 124, 30, COLORS.gold, "right", 900);
    painter.line(44, 166, 276, 166, "#6b8ca444");

    painter.text(`Sua guilda · ${guild.length}`, 44, 188, 13, COLORS.muted);
    guild.slice(0, 5).forEach((player, index) => {
      const y = 214 + index * 32;
      const job = team.jobs.find((task) => task.playerName === player.name);
      const card = job && state.cards.find((c) => c.id === job.cardId);
      if (player.id === state.me)
        painter.rect(38, y - 15, 244, 30, team.color + "1f", 8);
      painter.rect(48, y - 4, 8, 8, job ? COLORS.green : "#54708733", 4);
      painter.text(
        player.name,
        66,
        y,
        14,
        player.id === state.me ? COLORS.cream : COLORS.muted,
      );
      if (card && job)
        painter.text(
          `${card.name} → ${team.sites[job.siteId]!.name}`,
          276,
          y,
          11,
          card.color,
          "right",
          800,
        );
    });
    if (guild.length > 5)
      painter.text(
        `+${guild.length - 5} na guilda`,
        66,
        214 + 5 * 32,
        11,
        COLORS.muted,
      );
    if (!guild.length)
      painter.text("Ninguém entrou nesta guilda.", 66, 214, 12, COLORS.muted);

    painter.line(44, rosterEnd + 8, 276, rosterEnd + 8, "#6b8ca444");
    painter.text("Placar", 44, rosterEnd + 28, 13, COLORS.muted);
    [...state.teams]
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .slice(0, 4)
      .forEach((other, index) => {
        const y = rankTop + 18 + index * 40;
        if (other.id === team.id)
          painter.rect(38, y - 18, 244, 36, other.color + "22", 8);
        painter.shield(58, y - 1.3, 22, other.color, other.icon);
        painter.text(other.name, 79, y, 14);
        painter.text(other.score, 272, y, 17, COLORS.gold, "right", 900);
        controls.hit(
          "watch-" + other.id,
          38,
          y - 18,
          244,
          36,
          "Acompanhar " + other.name,
          () => {
            session.watchTeam = other.id;
            this.app.onWatch();
          },
          session.playing,
        );
      });
    controls.button(
      "all-rank",
      44,
      rankTop + ranked * 40 + 14,
      232,
      30,
      "Placar completo",
      () => (this.app.modal = "ranking"),
      { kind: "dark", small: true },
    );
  }
}

/** O painel direito: relógio, agentes em campo, diário e controles do admin. */
export class FieldPanel {
  constructor(private readonly app: AgentArena) {}

  draw(team: TeamView, clock: string, seconds: number, now: number): void {
    const { painter, controls, state, session } = this.app;
    if (!state) return;
    const crowded = team.jobs.length > 3;
    const extraHeight = crowded ? 32 : 0;
    painter.panel(1144, 92, 272, 356 + extraHeight);
    painter.display(
      state.paused ? "PAUSA" : clock,
      1280,
      130,
      42,
      seconds <= 30 ? COLORS.red : COLORS.cream,
      "center",
    );
    painter.text(
      "até a tempestade fechar a arena",
      1280,
      160,
      11,
      COLORS.muted,
      "center",
      800,
    );
    painter.line(1164, 180, 1396, 180, "#6b8ca444");
    painter.text(
      `Agentes em campo ${team.jobs.length}/${state.story.maxAgents}`,
      1164,
      202,
      15,
      COLORS.cream,
      "left",
      900,
    );
    if (!team.jobs.length)
      painter.wrap(
        "Nenhum agente mobilizado. Arraste uma carta até uma frente iluminada.",
        1164,
        228,
        232,
        13,
        COLORS.muted,
        19,
        3,
      );
    team.jobs.forEach((job, index) => {
      const y = 230 + index * (crowded ? 32 : 46);
      const card = state.cards.find((c) => c.id === job.cardId)!;
      painter.icon(card.icon, 1178, y + 14, 22, card.color);
      painter.text(
        `${card.name} → ${team.sites[job.siteId]!.name}`,
        1198,
        y + 7,
        13,
        COLORS.cream,
        "left",
        800,
      );
      painter.text(
        `${job.playerName} · ${Math.max(0, Math.ceil(job.endsAt - now))}s${
          job.conflict ? " · conflito" : ""
        }`,
        1198,
        y + 24,
        11,
        job.conflict ? COLORS.red : COLORS.muted,
      );
    });

    const latest = team.log[0];
    if (latest && !crowded) {
      painter.line(1164, 376, 1396, 376, "#6b8ca444");
      painter.wrap(
        latest.title,
        1164,
        394,
        232,
        13,
        latest.kind === "bad"
          ? COLORS.red
          : latest.kind === "score"
            ? COLORS.gold
            : COLORS.green,
        18,
        2,
      );
    }
    controls.button(
      "events",
      1164,
      420 + extraHeight,
      232,
      32,
      "Diário da guilda",
      () => (this.app.modal = "events"),
      { kind: "dark", small: true },
    );
    if (!session.isHost) return;
    const blocked = session.busy || !session.connected;
    controls.button(
      "pause",
      1164,
      462 + extraHeight,
      112,
      32,
      state.paused ? "Retomar" : "Pausar",
      () => session.hostAction("pause"),
      { kind: "dark", small: true, disabled: blocked },
    );
    controls.button(
      "finish",
      1284,
      462 + extraHeight,
      112,
      32,
      "Encerrar",
      () =>
        this.app.ask({
          title: "Encerrar a arena?",
          body: "As entregas já concluídas definem o placar final. O trabalho em andamento não soma pontos.",
          run: () => session.hostAction("finish"),
        }),
      { kind: "dark", small: true, disabled: blocked },
    );
  }
}

/**
 * A barra de contexto, no formato de elixir: as unidades que a carta
 * selecionada vai consumir piscam antes do gasto.
 */
export class EnergyBar {
  constructor(private readonly app: AgentArena) {}

  draw(
    x: number,
    y: number,
    w: number,
    h: number,
    energy: number,
    cost: number,
  ): void {
    const { painter, viewport, state, time } = this.app;
    const max = state?.story.maxEnergy ?? 12;
    const gap = viewport.mobile ? 3 : 5;
    const cell = (w - gap * (max - 1)) / max;
    for (let i = 0; i < max; i++) {
      const cx = x + i * (cell + gap);
      const full = i + 1 <= energy;
      const partial = !full && i < energy;
      painter.rect(cx, y, cell, h, "#132a41", 4, "#ffffff14");
      if (full || partial)
        painter.rect(
          cx,
          y,
          partial ? cell * (energy - i) : cell,
          h,
          "#a97ff0",
          4,
        );
      const doomed = cost && i >= energy - cost && i < energy;
      if (doomed && Math.floor(time / 260) % 2 === 0)
        painter.rect(cx, y, cell, h, COLORS.gold, 4);
    }
    painter.text(
      `${Math.floor(energy)}/${max}`,
      x + w + 10,
      y + h / 2,
      viewport.mobile ? 13 : 16,
      COLORS.gold,
      "left",
      900,
    );
  }
}

/**
 * Os rótulos dos agentes sobre o mapa.
 *
 * Cada agente carrega o nome de quem o enviou e quanto falta, mais um sinal de
 * que a pergunta dele ainda está aberta. Frentes paralelas colocam vários
 * agentes quase no mesmo ponto projetado, então os rótulos sobem em pilha para
 * que cada nome continue legível.
 */
export class AgentChips {
  constructor(private readonly app: AgentArena) {}

  draw(anchors: readonly AgentAnchor[], team: TeamView, now: number): void {
    const { painter, viewport, state } = this.app;
    if (!state) return;
    const mobile = viewport.mobile;
    const placed: { x: number; y: number; w: number; h: number }[] = [];

    for (const anchor of anchors) {
      const job = team.jobs.find((task) => task.id === anchor.id) ?? anchor.job;
      if (!job) continue;
      const card = state.cards.find((c) => c.id === job.cardId)!;
      const quiz = job.question;
      const badge = !quiz
        ? ""
        : quiz.chosen === null
          ? " · ?"
          : quiz.correct
            ? " · ✓"
            : " · ✗";
      const label = `${job.playerName} · ${Math.max(0, Math.ceil(job.endsAt - now))}s${badge}`;
      const size = mobile ? 10 : 12;
      const w = painter.measure(label, size, 800) + (mobile ? 30 : 36);
      const h = mobile ? 20 : 24;
      const x = anchor.x - w / 2;
      let y = anchor.y - h;
      for (let guard = 0; guard < 4; guard++) {
        const clash = placed.find(
          (other) =>
            Math.abs(other.y - y) < h + 3 &&
            x < other.x + other.w + 6 &&
            other.x < x + w + 6,
        );
        if (!clash) break;
        y = clash.y - h - 5;
      }
      placed.push({ x, y, w, h });
      painter.rect(
        x,
        y,
        w,
        h,
        "#0b1e30e8",
        h / 2,
        job.conflict ? COLORS.red : team.color,
      );
      painter.icon(
        card.icon,
        x + h / 2,
        y + h / 2,
        mobile ? 12 : 14,
        card.color,
      );
      painter.text(
        label,
        x + h - 2,
        y + h / 2,
        size,
        job.conflict ? COLORS.red : COLORS.cream,
        "left",
        800,
      );
    }
  }
}
