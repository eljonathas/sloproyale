import type { CardId, CardView, TeamView } from "../../shared/protocol.js";
import type { AgentArena, Screen } from "../app.js";
import {
  AgentChips,
  EnergyBar,
  FieldPanel,
  GuildPanel,
} from "../battle/panels.js";
import { Deck } from "../battle/deck.js";
import { QuizPanel } from "../battle/quizPanel.js";
import {
  SiteBanners,
  type Boost,
  type GroundAction,
  type SitePoint,
  type SiteState,
} from "../battle/siteBanners.js";
import { BuildProgress, DeliveryValue, PlayPreview } from "../rules.js";
import { COLORS } from "../theme.js";

/** Uma carta sendo arrastada até uma frente. */
interface Drag {
  cardId: CardId;
  x: number;
  y: number;
  active: boolean;
}

/**
 * A tela de batalha.
 *
 * Ela não desenha quase nada por conta própria: decide o estado de cada frente,
 * mede as ações de chão, resolve o posicionamento das placas e entrega o resto
 * aos componentes. A ordem importa — as placas vêm primeiro, as ações de chão
 * depois, senão a placa de uma frente é pintada por cima do botão da anterior.
 */
export class BattleScreen implements Screen {
  selection: CardId | null = null;
  selectedSite = 0;
  drag: Drag | null = null;
  /** Frente sob a carta arrastada ou sob o cursor. */
  private aimed: number | null = null;
  private legality: boolean[] | null = null;
  private boost: Boost = { siteId: null, at: -9999 };
  private readonly boosted = new Set<number>();

  private readonly banners: SiteBanners;
  private readonly quiz: QuizPanel;
  private readonly guildPanel: GuildPanel;
  private readonly fieldPanel: FieldPanel;
  private readonly energyBar: EnergyBar;
  private readonly deck: Deck;
  private readonly chips: AgentChips;

  constructor(private readonly app: AgentArena) {
    this.banners = new SiteBanners(app);
    this.quiz = new QuizPanel(app, (siteId, jobId) =>
      this.markBoost(siteId, jobId),
    );
    this.guildPanel = new GuildPanel(app);
    this.fieldPanel = new FieldPanel(app);
    this.energyBar = new EnergyBar(app);
    this.deck = new Deck(app);
    this.chips = new AgentChips(app);
  }

  reset(): void {
    this.selection = null;
    this.selectedSite = 0;
    this.drag = null;
    this.quiz.reset();
    this.deck.reset();
  }

  /** Frente apontada e legalidade da carta, para o diorama pintar os anéis. */
  get aimedSite(): number | null {
    return this.aimed;
  }

  get aimLegality(): readonly boolean[] | null {
    return this.legality;
  }

  get selectedCard(): CardId | null {
    return this.selection;
  }

  /**
   * Calculado antes do render 3D para que anel, brilho e escala da frente
   * reajam no mesmo quadro em que a carta é apontada.
   */
  aim(): void {
    this.aimed = null;
    this.legality = null;
    const { state, session, controls } = this.app;
    if (!state || !this.selection) return;
    const team = session.team;
    if (!team) return;
    const card = state.cards.find((c) => c.id === this.selection);
    if (!card) return;

    const preview = PlayPreview.from(state);
    const energy = session.energy(team);
    this.legality = team.sites.map(
      (site) => preview.of(card, site, team, energy).ok !== false,
    );

    if (this.drag?.active) {
      this.aimed = this.dropTarget(this.app.pointer);
      return;
    }
    if (controls.hover.startsWith("site-"))
      this.aimed = Number(controls.hover.slice(5));
  }

  /** O destaque e o drop usam a mesma área ao redor da obra. */
  private dropTarget(pointer: { x: number; y: number }): number | null {
    let best: number | null = null;
    let near = this.app.viewport.mobile ? 96 : 140;
    for (const point of this.points()) {
      const distance = Math.hypot(pointer.x - point.x, pointer.y - point.y);
      if (distance < near) {
        near = distance;
        best = point.id;
      }
    }
    return best;
  }

  async drop(cardId: CardId, pointer: { x: number; y: number }): Promise<void> {
    if (!this.app.canPlay) return;
    // A obra destacada tem prioridade, mesmo se uma placa vizinha se sobrepõe.
    const siteId = this.dropTarget(pointer);
    if (siteId !== null) {
      await this.play(cardId, siteId);
      return;
    }
    const banner = this.app.controls.all.find(
      (control) =>
        control.id.startsWith("site-") &&
        !control.disabled &&
        pointer.x >= control.x &&
        pointer.x <= control.x + control.w &&
        pointer.y >= control.y &&
        pointer.y <= control.y + control.h,
    );
    if (banner) await this.play(cardId, Number(banner.id.slice(5)));
  }

  /**
   * O diorama devolve âncoras em pixels do dispositivo; a camada 2D desenha em
   * coordenadas de projeto. A conversão mora só aqui: quando ela estava
   * espalhada, as placas convertiam e os rótulos dos agentes não, e eles saíam
   * do lugar em qualquer janela que não fosse 1440×900 — a única em que a
   * escala é 1 e o erro some.
   */
  private toDesign(anchor: { x: number; y: number }): { x: number; y: number } {
    return this.app.viewport.toDesign(anchor.x, anchor.y);
  }

  /** Onde as frentes aparecem, vindas do diorama ou de posições de reserva. */
  points(): SitePoint[] {
    const { world, viewport } = this.app;
    const anchors = world?.siteAnchors();
    if (anchors?.length)
      return anchors.map((anchor) => ({
        id: anchor.id,
        ...this.toDesign(anchor),
        top: this.toDesign({ x: anchor.x, y: anchor.top }).y,
      }));
    const rect = viewport.sceneRect("battle");
    return [
      {
        id: 0,
        x: rect.x + rect.w * 0.38,
        y: rect.y + rect.h * 0.34,
        top: rect.y + rect.h * 0.12,
      },
      {
        id: 1,
        x: rect.x + rect.w * 0.52,
        y: rect.y + rect.h * 0.86,
        top: rect.y + rect.h * 0.64,
      },
      {
        id: 2,
        x: rect.x + rect.w * 0.66,
        y: rect.y + rect.h * 0.55,
        top: rect.y + rect.h * 0.33,
      },
    ];
  }

  /** Progresso de cada frente, a mesma conta que o diorama recebe. */
  progressOf(team: TeamView): number[] {
    const state = this.app.state;
    if (!state) return [0, 0, 0];
    const progress = new BuildProgress(state.story);
    const now = this.app.session.elapsed();
    return team.sites.map((site) =>
      progress.at(team, site, now, state.elapsed),
    );
  }

  private markBoost(siteId: number, jobId: number): void {
    this.boosted.add(jobId);
    this.boost = { siteId, at: this.app.time };
  }

  private async play(cardId: CardId, siteId: number): Promise<void> {
    this.selectedSite = siteId;
    // A onda de choque sai no ato do toque, sem esperar a resposta do servidor:
    // é o retorno imediato que faz a carta parecer aplicada ao mapa.
    const card = this.app.state?.cards.find((c) => c.id === cardId);
    this.app.world?.deploy(siteId, card?.color ?? "#ffffff");
    await this.app.session.playCard(cardId, siteId);
    this.selection = null;
  }

  draw(): void {
    const { painter, controls, viewport, session, state } = this.app;
    const team = session.team;
    if (!state || !team) return;

    const now = session.elapsed();
    const seconds = Math.max(0, Math.ceil(state.duration - now));
    const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    const energy = session.energy(team);
    const card = state.cards.find((c) => c.id === this.selection) ?? null;
    const progress = this.progressOf(team);
    const preview = PlayPreview.from(state);
    const delivery = DeliveryValue.from(state);

    // O acerto de qualquer pessoa da guilda acende a frente: o time precisa ver
    // que a obra acelerou, mesmo quem não respondeu.
    for (const job of [...team.jobs, ...team.quizzes])
      if (job.question?.correct && !this.boosted.has(job.id)) {
        this.boosted.add(job.id);
        this.boost = { siteId: job.siteId, at: this.app.time };
        this.app.world?.deploy(job.siteId, COLORS.gold);
      }

    const points = this.points();
    const states = new Map<number, SiteState>(
      points.map((point) => {
        const site = team.sites[point.id]!;
        return [
          point.id,
          {
            site,
            preview: card ? preview.of(card, site, team, energy) : null,
            aiming: this.aimed === point.id,
            progress: progress[point.id]!,
            multiplier: delivery.multiplier(site),
            value: delivery.reward(site),
            nextMove: delivery.nextMove(site, team),
            // Abre com uma carta na mão, na frente escolhida, na apontada e sob
            // o cursor ou o foco do teclado. A placa cresce para fora do ponto
            // que a chamou, então não há tremulação ao entrar nela.
            open:
              Boolean(card) ||
              this.selectedSite === point.id ||
              this.aimed === point.id ||
              controls.hover === "site-" + point.id ||
              controls.focus === "site-" + point.id,
          },
        ];
      }),
    );

    const actions = this.groundActions(points, states, team, Boolean(card));
    const boxes = this.banners.layout(points, states, actions);

    for (const point of points) {
      const state_ = states.get(point.id)!;
      const box = this.banners.draw(
        point,
        boxes.get(point.id)!,
        state_,
        team,
        this.boost,
      );
      // A área da frente é registrada antes do botão de entrega: onde as duas
      // se tocam, quem ganha o clique é o botão.
      controls.hit(
        "site-" + point.id,
        box.x - 6,
        box.y - 6,
        box.w + 12,
        point.y - box.y + (viewport.mobile ? 16 : 22),
        `${state_.site.name}, nível ${state_.site.level} de 3, construção ${Math.round(
          state_.progress,
        )} por cento${
          state_.preview && card ? `. ${card.name}: ${state_.preview.hint}` : ""
        }`,
        () => {
          this.selectedSite = point.id;
          if (this.selection && this.app.canPlay)
            return this.play(this.selection, point.id);
          return undefined;
        },
      );
    }
    this.drawGroundActions(points, states, team, Boolean(card));
    this.chips.draw(
      (this.app.world?.agentAnchors() ?? []).map((anchor) => ({
        ...anchor,
        ...this.toDesign(anchor),
      })),
      team,
      now,
    );

    // O botão de entrega precisa existir sempre: o teclado e os testes o
    // alcançam mesmo quando a frente escolhida ainda não está pronta.
    if (!controls.has("deliver"))
      controls.hit(
        "deliver",
        -400,
        -400,
        1,
        1,
        `Entregar ${team.sites[this.selectedSite]!.name}`,
        () => session.command("deliver", { siteId: this.selectedSite }),
        true,
      );

    if (viewport.mobile) this.mobileHeader(team, clock, seconds, now);
    else {
      this.guildPanel.draw(team);
      this.fieldPanel.draw(team, clock, seconds, now);
    }

    // A janela do estudo ocupa o lugar do baralho: enquanto ela está aberta,
    // jogar outra carta não é opção. É esse custo que faz a pergunta valer
    // atenção — e o botão Baralho é a saída, para o time não perder o
    // paralelismo entre frentes.
    if (this.quiz.draw(team, now)) return;
    if (viewport.mobile) this.mobileGuildStrip(team);

    this.drawDeck(team, energy, card);
    if (state.paused)
      painter.pill(
        "PAUSADO · agentes e contexto congelados",
        viewport.width / 2 - 172,
        viewport.mobile ? 130 : 100,
        COLORS.gold,
        344,
      );
    if (this.drag?.active) this.drawGhost();
  }

  private groundActions(
    points: readonly SitePoint[],
    states: Map<number, SiteState>,
    team: TeamView,
    holdingCard: boolean,
  ): GroundAction[] {
    const { painter, viewport } = this.app;
    const mobile = viewport.mobile;
    return points.flatMap((point) => {
      const state = states.get(point.id)!;
      const ready =
        state.progress >= 100 &&
        !team.jobs.some((job) => job.siteId === point.id);
      if (!ready || state.site.level >= 3 || holdingCard) return [];
      if (this.selectedSite === point.id) {
        const w = mobile ? 150 : 196;
        return [
          {
            id: point.id,
            x: point.x - w / 2,
            y: point.y + (mobile ? 8 : 12),
            w,
            h: mobile ? 34 : 40,
          },
        ];
      }
      const label = this.pillLabel(state);
      const w = painter.measure(label, 12, 800) + 28;
      return [
        {
          id: point.id,
          x: point.x - w / 2,
          y: point.y + (mobile ? 10 : 14),
          w,
          h: 28,
        },
      ];
    });
  }

  private pillLabel(state: SiteState): string {
    if (!state.site.reviewed) return "FALTA REVISAR";
    return this.app.viewport.mobile ? "PRONTA" : "PRONTA · TOQUE AQUI";
  }

  private drawGroundActions(
    points: readonly SitePoint[],
    states: Map<number, SiteState>,
    team: TeamView,
    holdingCard: boolean,
  ): void {
    const { painter, controls, viewport, session } = this.app;
    const mobile = viewport.mobile;
    for (const point of points) {
      const state = states.get(point.id)!;
      const ready =
        state.progress >= 100 &&
        !team.jobs.some((job) => job.siteId === point.id);
      if (!ready || state.site.level >= 3 || holdingCard) continue;

      if (this.selectedSite === point.id) {
        // O botão diz o que a entrega vai pagar de verdade, e não os 100 da
        // base: é aí que o multiplicador vira uma decisão visível.
        const label = state.site.reviewed
          ? `Entregar +${state.value}`
          : "Entregar sem revisão";
        const w = mobile ? 150 : 196;
        controls.button(
          "deliver",
          point.x - w / 2,
          point.y + (mobile ? 8 : 12),
          w,
          mobile ? 34 : 40,
          label,
          () => session.command("deliver", { siteId: this.selectedSite }),
          {
            kind: state.site.reviewed ? "green" : "dark",
            small: true,
            disabled: !this.app.canPlay,
          },
        );
        continue;
      }
      // A largura acompanha o texto: com valor fixo o rótulo transbordava a
      // pílula e a primeira letra ficava ilegível sobre o terreno.
      const label = this.pillLabel(state);
      const w = painter.measure(label, 12, 800) + 28;
      painter.pill(
        label,
        point.x - w / 2,
        point.y + (mobile ? 10 : 14),
        state.site.reviewed ? COLORS.green : COLORS.gold,
        w,
      );
    }
  }

  private mobileHeader(
    team: TeamView,
    clock: string,
    seconds: number,
    _now: number,
  ): void {
    const { painter, controls, viewport, session, state } = this.app;
    if (!state) return;
    const W = viewport.width;
    painter.display(team.name, 20, 82, 24, team.color);
    painter.text(team.score, 232, 82, 20, COLORS.gold, "right", 900);
    painter.display(
      state.paused ? "PAUSA" : clock,
      W - 20,
      82,
      28,
      seconds <= 30 ? COLORS.red : COLORS.cream,
      "right",
    );
    controls.button(
      "mobile-rank",
      20,
      96,
      86,
      26,
      "Placar",
      () => (this.app.modal = "ranking"),
      { kind: "dark", small: true },
    );
    controls.button(
      "events",
      112,
      96,
      86,
      26,
      "Diário",
      () => (this.app.modal = "events"),
      { kind: "dark", small: true },
    );
    painter.text(
      `${team.jobs.length}/${state.story.maxAgents} agentes`,
      W - 20,
      109,
      11,
      COLORS.muted,
      "right",
      800,
    );
    if (session.isHost) {
      const blocked = session.busy || !session.connected;
      controls.button(
        "pause",
        204,
        96,
        70,
        26,
        state.paused ? "Retomar" : "Pausar",
        () => session.hostAction("pause"),
        { kind: "dark", small: true, disabled: blocked },
      );
      controls.button(
        "finish",
        280,
        96,
        70,
        26,
        "Encerrar",
        () =>
          this.app.ask({
            title: "Encerrar a arena?",
            body: "As entregas já concluídas definem o placar final.",
            run: () => session.hostAction("finish"),
          }),
        { kind: "dark", small: true, disabled: blocked },
      );
    }
  }

  /**
   * A sobra abaixo do mapa vira a lista da guilda: no celular é o único lugar
   * em que dá para ver que o contexto e os agentes são disputados com o time.
   */
  private mobileGuildStrip(team: TeamView): void {
    const { painter, viewport, state } = this.app;
    if (!state) return;
    const map = viewport.sceneRect("battle");
    const stripY = map.y + map.h + 12 + (this.quiz.callingBack ? 54 : 0);
    const available = viewport.height - 242 - stripY;
    const guild = state.players.filter((player) => player.teamId === team.id);
    const stripH = Math.min(available, 32 + Math.max(1, guild.length) * 22);
    // A chamada da pergunta usa esta mesma faixa; uma de cada vez.
    if (stripH < 52 || this.quiz.covering) return;

    painter.panel(20, stripY, viewport.width - 40, stripH);
    painter.text(
      `Sua guilda · ${guild.length}`,
      36,
      stripY + 18,
      12,
      COLORS.muted,
    );
    const seats = Math.max(1, Math.floor((stripH - 24) / 22));
    guild.slice(0, seats).forEach((player, index) => {
      const y = stripY + 38 + index * 22;
      const job = team.jobs.find((task) => task.playerName === player.name);
      const card = job && state.cards.find((c) => c.id === job.cardId);
      painter.rect(36, y - 4, 7, 7, job ? COLORS.green : "#54708733", 4);
      painter.text(
        player.name,
        52,
        y,
        12,
        player.id === state.me ? COLORS.cream : COLORS.muted,
        "left",
        player.id === state.me ? 900 : 700,
      );
      painter.text(
        card && job
          ? `${card.name} → ${team.sites[job.siteId]!.name}`
          : "sem agente",
        viewport.width - 36,
        y,
        10,
        card ? card.color : "#6d8698",
        "right",
        800,
      );
    });
    if (guild.length > seats)
      painter.text(
        `+${guild.length - seats}`,
        viewport.width - 36,
        stripY + 18,
        11,
        COLORS.muted,
        "right",
      );
  }

  private drawDeck(
    team: TeamView,
    energy: number,
    card: CardView | null,
  ): void {
    const { painter, viewport } = this.app;
    const mobile = viewport.mobile;
    const barY = mobile ? viewport.height - 230 : 638;
    const barX = mobile ? 34 : 320;
    const barW = mobile ? viewport.width - 108 : 760;
    painter.icon(
      "gem",
      barX - 16,
      barY + (mobile ? 9 : 11),
      mobile ? 18 : 22,
      "#c5a3ff",
    );
    this.energyBar.draw(
      barX + 6,
      barY,
      barW,
      mobile ? 18 : 22,
      energy,
      card ? this.deck.quote(card, this.aimed).minimum : 0,
    );
    if (!mobile)
      painter.text(
        `contexto da guilda · +${this.app.state!.story.regen.toLocaleString("pt-BR")}/s`,
        barX + barW + 66,
        barY + 11,
        12,
        COLORS.muted,
      );

    this.deck.draw(
      mobile ? viewport.height - 188 : 690,
      energy,
      this.selection,
      (picked) => {
        this.selection = this.selection === picked.id ? null : picked.id;
      },
      this.drag?.active ? this.drag.cardId : null,
      this.aimed,
    );

    if (mobile)
      painter.text(
        card
          ? `${card.name}: toque numa frente dourada ou arraste`
          : "Escolha uma carta e toque na frente",
        viewport.width / 2,
        viewport.height - 14,
        10,
        COLORS.gold,
        "center",
        800,
      );
    else {
      painter.text(
        card ? "Escolha a frente" : "Toque ou arraste",
        1152,
        728,
        16,
        COLORS.gold,
        "left",
        900,
      );
      painter.wrap(
        card
          ? "Dourado: pode jogar. Vermelho: confira o motivo na frente."
          : "Leve a carta até uma construção para mobilizar o agente.",
        1152,
        757,
        232,
        13,
        COLORS.muted,
        20,
        3,
      );
      painter.text("1–4 selecionam · Esc cancela", 1152, 832, 12, COLORS.muted);
    }
    if (!this.app.session.playing && !mobile)
      painter.text(
        "Orquestrador: acompanhe as guildas pelo placar.",
        160,
        408,
        12,
        COLORS.muted,
        "center",
      );
    void team;
  }

  private drawGhost(): void {
    const { state, pointer } = this.app;
    const card = state?.cards.find((c) => c.id === this.drag!.cardId);
    if (!card) return;
    this.deck.ghost(card, pointer.x, pointer.y, this.aimed);
  }
}
