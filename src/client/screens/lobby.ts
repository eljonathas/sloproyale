import type { AgentArena, Screen } from "../app.js";
import { COLORS } from "../theme.js";
import { TextField } from "./field.js";

/**
 * O lobby.
 *
 * O orquestrador vê o convite e o botão de iniciar; os participantes escolhem a
 * guilda. As guildas são paginadas porque a arena chega a dezesseis.
 */
export class LobbyScreen implements Screen {
  private page = 0;
  private readonly field: TextField;

  constructor(private readonly app: AgentArena) {
    this.field = new TextField(app);
  }

  reset(): void {
    this.page = 0;
    this.app.teamSelection = -1;
  }

  draw(): void {
    const { painter, controls, viewport, session, state } = this.app;
    if (!state) return;
    const mobile = viewport.mobile;
    const W = viewport.width;
    const host = session.isHost;
    const me = state.players.find((player) => player.id === state.me);
    const x = mobile ? 20 : 68;

    painter.display(
      host
        ? "Reúna suas guildas"
        : me
          ? "Sua guilda está pronta"
          : "Escolha sua guilda",
      x,
      mobile ? 100 : 142,
      mobile ? 31 : 45,
    );

    if (mobile)
      painter.text(
        `${state.players.length}/${state.participants} pessoas · ${state.teams.length} guildas`,
        x,
        139,
        14,
        COLORS.muted,
      );
    else {
      painter.text(
        "A tempestade se aproxima. Ninguém reconstrói a Cidadela sozinho.",
        x,
        190,
        19,
        COLORS.muted,
      );
      painter.pill(
        `${state.players.length} / ${state.participants} participantes`,
        x,
        222,
        COLORS.green,
        202,
      );
      painter.pill(`${state.teams.length} guildas`, x + 217, 222, COLORS.blue, 123);
    }

    if (!host && !me)
      this.field.draw(
        "name",
        "Como você quer ser chamado?",
        x,
        mobile ? 170 : 280,
        mobile ? W - 40 : 620,
      );
    else if (!mobile)
      painter.text(
        host
          ? "Os participantes escolhem seus times antes da primeira missão."
          : `Você entrou como ${me!.name}. Pode trocar de guilda antes da partida.`,
        x,
        285,
        16,
        COLORS.muted,
      );

    const cols = mobile ? 2 : 4;
    const perPage = mobile ? 4 : 8;
    this.page = Math.min(this.page, Math.ceil(state.teams.length / perPage) - 1);
    const cardW = mobile ? (W - 54) / 2 : 210;
    const gap = mobile ? 14 : 17;
    const startY = mobile
      ? !host && !me
        ? 273
        : 181
      : !host && !me
        ? 373
        : 330;
    const cardH = mobile ? 120 : 184;

    if (!host && !me)
      painter.text(
        "Digite seu nome e toque na guilda para entrar.",
        x,
        startY - 18,
        mobile ? 13 : 16,
        COLORS.gold,
      );

    state.teams
      .slice(this.page * perPage, (this.page + 1) * perPage)
      .forEach((team, index) => {
        const cx = x + (index % cols) * (cardW + gap);
        const cy = startY + Math.floor(index / cols) * (cardH + 16);
        const members = state.players.filter(
          (player) => player.teamId === team.id,
        );
        const selected = me
          ? me.teamId === team.id
          : this.app.teamSelection === team.id;
        const full = members.length >= team.capacity;

        painter.panel(cx, cy, cardW, cardH);
        if (selected && !host) {
          painter.path(cx, cy, cardW, cardH, 17);
          painter.ctx.strokeStyle = team.color;
          painter.ctx.lineWidth = 3;
          painter.ctx.stroke();
        }
        painter.rect(cx + 12, cy + 9, cardW - 24, 3, team.color, 2);
        painter.shield(
          cx + cardW / 2,
          cy + (mobile ? 30 : 51),
          mobile ? 34 : 53,
          team.color,
          team.icon,
        );
        painter.display(
          team.name,
          cx + cardW / 2,
          cy + (mobile ? 64 : 106),
          mobile ? 23 : 27,
          COLORS.cream,
          "center",
        );
        painter.text(
          `${members.length} / ${team.capacity} pessoas`,
          cx + cardW / 2,
          cy + (mobile ? 86 : 134),
          13,
          COLORS.muted,
          "center",
        );
        painter.text(
          selected && !host
            ? me
              ? "Você está nesta guilda"
              : "Toque ou confirme abaixo"
            : full
              ? "Guilda completa"
              : !host
                ? me
                  ? "Toque para trocar"
                  : "Toque para entrar"
                : members.length
                  ? members
                      .map((player) => player.name)
                      .join(", ")
                      .slice(0, 22)
                  : "Esperando heróis",
          cx + cardW / 2,
          cy + cardH - 18,
          11,
          selected ? team.color : COLORS.muted,
          "center",
        );
        controls.hit(
          "team-" + team.id,
          cx,
          cy,
          cardW,
          cardH,
          `${team.name}, ${members.length} de ${team.capacity} vagas${
            selected ? ", seu time" : ""
          }`,
          () => {
            this.app.teamSelection = team.id;
            const name = me?.name ?? this.app.fields.name;
            if (name.trim().length < 2) {
              this.app.edit("name", "Como você quer ser chamado?", 22);
              session.notify("Digite pelo menos 2 letras e confirme sua entrada.");
              return;
            }
            return session.joinTeam(name, team.id);
          },
          host ||
            session.busy ||
            !session.connected ||
            (full && (!me || me.teamId !== team.id)),
        );
      });

    const bottom = mobile
      ? startY + 2 * (cardH + 16) + 2
      : 759;
    if (state.teams.length > perPage) {
      controls.button("team-prev", x, bottom - 2, 58, 37, "←", () => this.page--, {
        kind: "dark",
        disabled: this.page === 0,
      });
      painter.text(
        `${this.page + 1} / ${Math.ceil(state.teams.length / perPage)}`,
        x + 110,
        bottom + 18,
        14,
        COLORS.muted,
        "center",
      );
      controls.button(
        "team-next",
        x + 163,
        bottom - 2,
        58,
        37,
        "→",
        () => this.page++,
        {
          kind: "dark",
          disabled: (this.page + 1) * perPage >= state.teams.length,
        },
      );
    }

    if (!mobile) this.invite();
    this.callToAction(host, Boolean(me));
  }

  private invite(): void {
    const { painter, controls, session, state } = this.app;
    if (!state) return;
    painter.panel(1035, 221, 336, 404);
    painter.shield(1203, 280, 57, COLORS.gold, "crown");
    painter.text("Convide a turma", 1203, 340, 20, COLORS.cream, "center");
    painter.display(state.code, 1203, 394, 57, COLORS.gold, "center");
    painter.text(
      new URL(session.inviteBase).host,
      1203,
      444,
      15,
      COLORS.muted,
      "center",
    );
    painter.text(
      "Abra o endereço e digite o código.",
      1203,
      473,
      13,
      COLORS.muted,
      "center",
    );
    controls.button(
      "invite",
      1060,
      514,
      286,
      48,
      "Copiar link da sala",
      () => this.copyInvite(),
      { kind: "blue", small: true },
    );
    painter.text(
      "Na mesma rede do apresentador",
      1203,
      590,
      12,
      COLORS.muted,
      "center",
    );
  }

  private callToAction(host: boolean, joined: boolean): void {
    const { painter, controls, viewport, session, state } = this.app;
    if (!state) return;
    const mobile = viewport.mobile;
    const W = viewport.width;
    const H = viewport.height;

    if (host) {
      const ready = state.teams.every((team) =>
        state.players.some((player) => player.teamId === team.id),
      );
      controls.button(
        "start",
        mobile ? 20 : 1035,
        mobile ? H - 126 : 657,
        mobile ? W - 40 : 336,
        55,
        "Iniciar a reconstrução",
        () => {
          if (state.players.length < state.participants)
            this.app.ask({
              title: "Começar com a turma atual?",
              body: `Há ${state.players.length} de ${state.participants} participantes. A entrada e a troca de guilda serão encerradas.`,
              run: () => session.hostAction("start"),
            });
          else session.hostAction("start");
        },
        { disabled: !ready || session.busy || !session.connected },
      );
      painter.text(
        ready
          ? "Todos os times estão representados."
          : "Cada guilda precisa de pelo menos 1 pessoa.",
        mobile ? W / 2 : 1203,
        mobile ? H - 145 : 737,
        12,
        ready ? COLORS.green : COLORS.gold,
        "center",
      );
    } else if (!joined) {
      const selected = state.teams.find(
        (team) => team.id === this.app.teamSelection,
      );
      const full = selected &&
        state.players.filter((player) => player.teamId === selected.id).length >= selected.capacity;
      controls.button(
        "join-team",
        mobile ? 20 : 1035,
        mobile ? H - 126 : 657,
        mobile ? W - 40 : 336,
        55,
        session.busy
          ? "Entrando…"
          : full
            ? "Guilda completa — escolha outra"
            : selected
              ? "Entrar na guilda " + selected.name
              : "Toque em uma guilda para entrar",
        () =>
          session.joinTeam(this.app.fields.name, this.app.teamSelection),
        {
          kind: "gold",
          disabled:
            !selected ||
            Boolean(full) ||
            this.app.fields.name.trim().length < 2 ||
            session.busy ||
            !session.connected,
        },
      );
    } else {
      painter.pill(
        "Aguardando o orquestrador iniciar",
        mobile ? 80 : 1047,
        mobile ? H - 115 : 678,
        COLORS.green,
        mobile ? 270 : 312,
      );
    }

    if (mobile) {
      controls.button(
        "copy-mobile",
        20,
        H - 54,
        190,
        34,
        "Copiar convite",
        () => this.copyInvite(),
        { kind: "dark", small: true },
      );
      controls.button(
        "roster",
        224,
        H - 54,
        186,
        34,
        "Participantes",
        () => (this.app.modal = "roster"),
        { kind: "dark", small: true },
      );
      return;
    }
    controls.button(
      "roster",
      1035,
      778,
      336,
      43,
      "Ver participantes",
      () => (this.app.modal = "roster"),
      { kind: "dark", small: true },
    );
    painter.text(
      "3 frentes para reconstruir · até 900 pontos · o maior placar leva o prêmio",
      68,
      861,
      15,
      COLORS.muted,
    );
  }

  private async copyInvite(): Promise<void> {
    const { session } = this.app;
    try {
      await navigator.clipboard.writeText(session.inviteUrl());
      session.notify("Link copiado. Envie para a turma.");
    } catch {
      session.notify(
        `Endereço: ${new URL(session.inviteBase).host} · sala ${session.state!.code}`,
      );
    }
  }
}
