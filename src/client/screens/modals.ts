import type { AgentArena } from "../app.js";
import { COLORS } from "../theme.js";
import { Stepper, TextField } from "./field.js";

/** A caixa e o botão de fechar, comuns a todos os painéis sobrepostos. */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Os painéis sobrepostos.
 *
 * Cada um escurece a tela atrás e assume os controles do quadro: o registro é
 * limpo antes de desenhar, então nada por baixo continua clicável.
 */
export class ModalStack {
  private readonly field: TextField;
  private readonly stepper: Stepper;

  constructor(private readonly app: AgentArena) {
    this.field = new TextField(app);
    this.stepper = new Stepper(app);
  }

  draw(): void {
    const modal = this.app.modal;
    if (!modal) return;
    this.app.controls.reset();
    switch (modal) {
      case "setup":
        return this.setup();
      case "join":
        return this.join();
      case "rules":
        return this.rules();
      case "roster":
        return this.roster();
      case "ranking":
        return this.ranking();
      case "events":
        return this.events();
      case "summary":
        return this.summary();
      case "confirm":
        return this.confirm();
    }
  }

  private box(title: string, w = 660, h = 600): Box {
    const { painter, controls, viewport } = this.app;
    const x = (viewport.width - w) / 2;
    const y = (viewport.height - h) / 2;
    painter.rect(0, 0, viewport.width, viewport.height, "#051224cf", 0);
    painter.panel(x, y, w, h, title);
    controls.button(
      "close",
      x + w - 54,
      y + 14,
      36,
      32,
      "×",
      () => this.app.closeModal(),
      { kind: "dark" },
    );
    return { x, y, w, h };
  }

  private setup(): void {
    const { painter, controls, viewport, session, fields } = this.app;
    const mobile = viewport.mobile;
    const { x, y, w, h } = this.box(
      "Preparar a arena",
      mobile ? 398 : 650,
      mobile ? 617 : 606,
    );
    painter.wrap(
      "Você será o orquestrador geral: abre a sala, acompanha as guildas e controla o tempo da partida.",
      x + 26,
      y + 91,
      w - 52,
      16,
      COLORS.muted,
      24,
    );
    this.stepper.draw("participants", "Participantes", x + 27, y + 169, (w - 78) / 2, 4, 80);
    this.stepper.draw(
      "teamSize",
      "Pessoas por time",
      x + 51 + (w - 78) / 2,
      y + 169,
      (w - 78) / 2,
      2,
      8,
    );
    const count = Math.max(2, Math.ceil(fields.participants / fields.teamSize));
    painter.rect(x + 25, y + 260, w - 50, 83, "#0d2336", 12, "#819baf33");
    painter.shield(x + 59, y + 300, 37, COLORS.blue, "people");
    painter.display(`${count} guildas`, x + 91, y + 286, 27, COLORS.gold);
    painter.text(
      "Vagas distribuídas de forma equilibrada",
      x + 91,
      y + 317,
      mobile ? 11 : 14,
      COLORS.muted,
    );
    painter.text("Duração da partida", x + 27, y + 374, 15, COLORS.muted);
    [180, 240, 300, 420].forEach((value, index) =>
      controls.button(
        "duration-" + value,
        x + 27 + (index * (w - 54)) / 4,
        y + 396,
        (w - 70) / 4,
        42,
        value / 60 + " min",
        () => (fields.duration = value),
        { kind: fields.duration === value ? "gold" : "dark", small: true },
      ),
    );
    painter.wrap(
      "3 construções · 3 níveis por construção · entregas revisadas valem 100 pontos",
      x + 27,
      y + 474,
      w - 54,
      14,
      COLORS.muted,
      20,
    );
    controls.button(
      "open-room",
      x + 26,
      y + h - 77,
      w - 52,
      51,
      session.busy ? "Abrindo…" : "Abrir sala para a turma",
      () =>
        session.createRoom({
          participants: fields.participants,
          teamSize: fields.teamSize,
          duration: fields.duration,
        }),
      { disabled: session.busy || count > 16, icon: "crown" },
    );
    if (count > 16)
      painter.text(
        "Máximo de 16 guildas. Aumente pessoas por time.",
        x + w / 2,
        y + h - 92,
        12,
        COLORS.red,
        "center",
      );
  }

  private join(): void {
    const { painter, controls, viewport, session, fields } = this.app;
    const { x, y, w } = this.box(
      "Entre na sua guilda",
      viewport.mobile ? 398 : 540,
      375,
    );
    painter.wrap(
      "Digite o código que aparece na arena do apresentador.",
      x + 26,
      y + 92,
      w - 52,
      17,
      COLORS.muted,
      25,
    );
    this.field.draw("code", "Código da sala", x + 26, y + 153, w - 52, 5);
    controls.button(
      "find-room",
      x + 26,
      y + 280,
      w - 52,
      54,
      session.busy ? "Procurando…" : "Ver as guildas",
      () => session.lookup(fields.code),
      {
        kind: "blue",
        disabled: fields.code.length !== 5 || session.busy,
      },
    );
  }

  private rules(): void {
    const { painter, controls, viewport, state } = this.app;
    const mobile = viewport.mobile;
    const { x, y, w, h } = this.box(
      "Como conquistar a Cidadela",
      mobile ? 398 : 740,
      mobile ? Math.min(viewport.height - 24, 700) : 620,
    );
    const bonus = state?.study.bonus ?? 20;
    const rules: readonly [string, string, string][] = [
      [
        "tools",
        "1. Solte a carta na frente",
        "Toque na carta e depois na frente. A placa diz antes o que aconteceria ali.",
      ],
      [
        "brain",
        "2. Responda enquanto ele trabalha",
        `Cada Construtor ou Revisor abre uma pergunta da apresentação. Acertar corta metade do tempo e vale +${bonus} pontos.`,
      ],
      [
        "branch",
        "3. Abra canteiros para paralelizar",
        "Cada Worktree é um diretório e cabe um agente. Com canteiro livre, dois Construtores constroem em metade do tempo; sem ele, rendem metade cada.",
      ],
      [
        "gem",
        "4. Revise, integre e entregue",
        "A revisão soma +5 s por frente extra para convergir. Harness barra entrega sem revisão: revisada vale 100, sem revisão 40.",
      ],
    ];
    let cursor = y + 96;
    for (const [icon, title, body] of rules) {
      painter.icon(icon, x + 45, cursor + 12, 29, COLORS.gold);
      painter.text(title, x + 77, cursor, 17, COLORS.cream);
      cursor =
        painter.wrap(
          body,
          x + 77,
          cursor + 27,
          w - 106,
          mobile ? 14 : 16,
          COLORS.muted,
          mobile ? 21 : 23,
        ) + 26;
    }
    painter.wrap(
      "3 agentes e 12 de contexto para a guilda inteira. Paralelizar compra tempo pagando contexto e integração: decidam juntos onde vale a pena.",
      x + 27,
      cursor,
      w - 54,
      13,
      COLORS.gold,
      19,
    );
    controls.button(
      "understood",
      x + 26,
      y + h - 72,
      w - 52,
      47,
      "Vamos à arena",
      () => this.app.closeModal(),
      { kind: "blue" },
    );
  }

  private roster(): void {
    const { painter, controls, viewport, session, state } = this.app;
    if (!state) return;
    const mobile = viewport.mobile;
    const { x, y, w, h } = this.box(
      "Guildas na arena",
      mobile ? 398 : 650,
      Math.min(viewport.height - 40, 700),
    );
    const page = this.app.rosterPage;
    const people = state.players.slice(page * 8, page * 8 + 8);
    people.forEach((player, index) => {
      const py = y + 93 + index * 55;
      const team = state.teams[player.teamId]!;
      painter.shield(x + 45, py, 26, team.color, team.icon);
      painter.text(player.name, x + 75, py - 7, 16);
      painter.text(team.name, x + 75, py + 13, 12, team.color);
      if (session.isHost && state.phase === "lobby")
        controls.button(
          "remove-" + player.id,
          x + w - 112,
          py - 18,
          87,
          32,
          "Remover",
          () =>
            this.app.ask({
              title: "Remover participante?",
              body: `${player.name} perderá sua vaga e poderá entrar novamente antes da partida.`,
              run: () => session.hostAction("remove", { playerId: player.id }),
            }),
          { kind: "dark", small: true },
        );
    });
    if (!people.length)
      painter.text(
        "Aguardando os primeiros participantes.",
        x + w / 2,
        y + 130,
        16,
        COLORS.muted,
        "center",
      );
    if (state.players.length <= 8) return;
    controls.button(
      "prev-roster",
      x + 26,
      y + h - 74,
      80,
      42,
      "←",
      () => (this.app.rosterPage = Math.max(0, page - 1)),
      { kind: "dark", disabled: page === 0 },
    );
    painter.text(
      `${page + 1} / ${Math.ceil(state.players.length / 8)}`,
      x + w / 2,
      y + h - 52,
      16,
      COLORS.muted,
      "center",
    );
    controls.button(
      "next-roster",
      x + w - 106,
      y + h - 74,
      80,
      42,
      "→",
      () => this.app.rosterPage++,
      { kind: "dark", disabled: (page + 1) * 8 >= state.players.length },
    );
  }

  private ranking(): void {
    const { painter, controls, viewport, session, state } = this.app;
    if (!state) return;
    const { x, y, w } = this.box(
      "Placar das guildas",
      viewport.mobile ? 398 : 600,
      Math.min(viewport.height - 40, 710),
    );
    const spacing = 31;
    [...state.teams]
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .slice(0, Math.min(16, state.teams.length))
      .forEach((team, index) => {
        const ty = y + 87 + index * spacing;
        if (session.team?.id === team.id)
          painter.rect(x + 19, ty - 21, w - 38, spacing - 5, team.color + "18", 8);
        painter.shield(x + 43, ty, 21, team.color, team.icon);
        painter.text(team.name, x + 68, ty, 14);
        painter.text(team.score, x + w - 29, ty, 16, COLORS.gold, "right", 900);
        if (state.phase === "playing" && !session.playing)
          controls.hit(
            "rank-watch-" + team.id,
            x + 25,
            ty - spacing / 2,
            w - 50,
            spacing,
            "Acompanhar " + team.name,
            () => {
              session.watchTeam = team.id;
              this.app.onWatch();
              this.app.modal = null;
            },
          );
      });
  }

  private events(): void {
    const { painter, viewport, session } = this.app;
    const mobile = viewport.mobile;
    const { x, y, w } = this.box(
      "Diário da guilda",
      mobile ? 398 : 740,
      Math.min(viewport.height - 40, 710),
    );
    const entries = (session.team?.log ?? []).slice(0, mobile ? 4 : 5);
    let cursor = y + 91;
    for (const entry of entries) {
      painter.text(
        entry.title,
        x + 24,
        cursor,
        mobile ? 14 : 18,
        entry.kind === "bad"
          ? COLORS.red
          : entry.kind === "score"
            ? COLORS.gold
            : COLORS.green,
      );
      cursor =
        painter.wrap(
          entry.body,
          x + 24,
          cursor + 27,
          w - 48,
          mobile ? 13 : 15,
          COLORS.muted,
          mobile ? 19 : 22,
        ) + 25;
    }
  }

  private summary(): void {
    const { painter, controls, viewport, session } = this.app;
    const team = session.team;
    if (!team) return;
    const mobile = viewport.mobile;
    const { x, y, w, h } = this.box(
      "O que sua guilda construiu",
      mobile ? 398 : 650,
      Math.min(viewport.height - 40, 640),
    );
    const stats = team.stats;
    painter.shield(x + 47, y + 95, 37, team.color, team.icon);
    painter.display(
      `${team.name} · ${team.score} pontos`,
      x + 83,
      y + 96,
      mobile ? 23 : 31,
    );
    const rows: readonly [string, number, string][] = [
      [
        "Entregas revisadas",
        stats.safe,
        `${stats.safe * 100} pontos: trabalho validado antes de integrar.`,
      ],
      [
        "Entregas sem revisão",
        stats.unsafe,
        `${stats.unsafe * 40} pontos. A revisão poderia render mais ${stats.unsafe * 60}.`,
      ],
      [
        "Perguntas certas",
        stats.learned,
        `${stats.learned * (this.app.state?.study.bonus ?? 20)} pontos de estudo, e obras aceleradas.`,
      ],
      [
        "Conflitos de checkout",
        stats.conflicts,
        "Agentes no mesmo diretório rendem metade e geram falhas.",
      ],
      [
        "Bloqueios do harness",
        stats.blocked,
        "Ações barradas pelas permissões não viraram entregas inseguras.",
      ],
    ];
    let cursor = y + 163;
    for (const [label, count, body] of rows) {
      painter.text(
        `${count}  ${label}`,
        x + 25,
        cursor,
        17,
        count ? COLORS.gold : COLORS.muted,
      );
      cursor = painter.wrap(body, x + 25, cursor + 25, w - 50, 13, COLORS.muted, 19) + 20;
    }
    controls.button(
      "close-report",
      x + 25,
      y + h - 68,
      w - 50,
      43,
      "Voltar à conquista",
      () => (this.app.modal = null),
      { kind: "blue", small: true },
    );
  }

  private confirm(): void {
    const { painter, controls, viewport } = this.app;
    const pending = this.app.confirmation;
    if (!pending) return;
    const { x, y, w } = this.box(pending.title, viewport.mobile ? 398 : 570, 330);
    painter.wrap(pending.body, x + 27, y + 100, w - 54, 17, COLORS.muted, 25);
    controls.button(
      "cancel",
      x + 27,
      y + 239,
      (w - 67) / 2,
      49,
      "Voltar",
      () => (this.app.modal = null),
      { kind: "dark" },
    );
    controls.button(
      "confirm-action",
      x + 40 + (w - 67) / 2,
      y + 239,
      (w - 67) / 2,
      49,
      "Confirmar",
      () => {
        this.app.modal = null;
        pending.run();
      },
    );
  }
}
