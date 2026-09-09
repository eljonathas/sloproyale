import type {
  AnswerResult,
  CardId,
  Phase,
  PlayerView,
  Snapshot,
} from "../shared/protocol.js";
import { CARDS, findCard } from "../content/cards.js";
import { STORY, STUDY } from "../content/story.js";
import { findQuestion } from "../content/questions.js";
import { check } from "./errors.js";
import { Job } from "./job.js";
import type { Site } from "./site.js";
import { Team } from "./team.js";

/** Uma pessoa na sala. A chave é o segredo que autentica as jogadas dela. */
export interface Player {
  readonly id: string;
  readonly key: string;
  name: string;
  teamId: number;
}

/** Em que frações da partida o caos age. */
const STORM_MARKS = [0.45, 0.75] as const;

/** Relógio da sala, injetado para os testes poderem controlá-lo. */
export type Clock = () => number;

/** Um evento agendado dentro de um avanço do relógio. */
type Event =
  | { at: number; order: number; kind: "build"; team: Team; site: Site }
  | { at: number; order: number; kind: "review"; team: Team; job: Job }
  | { at: number; order: number; kind: "storm" };

/**
 * Uma partida.
 *
 * A sala é a dona das regras: quem pode jogar o quê, quanto tempo cada tarefa
 * leva e como o tempo avança. O `Arena` só cuida do ciclo de vida das salas.
 */
export class Room {
  phase: Phase = "lobby";
  players: Player[] = [];
  elapsed = 0;
  paused = false;
  deadline: number | null = null;
  version = 0;
  storms = 0;
  updated: number;
  private lastTick: number;
  private lastSecond = -1;
  private sequence = 0;

  constructor(
    readonly code: string,
    readonly admin: string,
    readonly participants: number,
    readonly duration: number,
    readonly practice: boolean,
    readonly teams: readonly Team[],
    private readonly clock: Clock,
    private readonly newId: () => string,
  ) {
    this.lastTick = clock();
    this.updated = clock();
  }

  // ── Entrada ────────────────────────────────────────────────────────────────

  join(name: unknown, teamId: unknown, key?: string): Player {
    check(
      this.phase === "lobby",
      "A partida já começou. A escolha de time está encerrada.",
    );
    const clean =
      typeof name === "string"
        ? name
            .trim()
            // Remove caracteres de controle, nao espacos nem hifens.
            .replace(/[\u0000-\u001f\u007f]/g, "")
            .slice(0, 22)
        : "";
    check(clean.length >= 2, "Use um nome com pelo menos 2 letras.");
    const team = this.teams.find((candidate) => candidate.id === teamId);
    check(team, "Escolha um time.");
    const existing = this.players.find((player) => player.key === key);
    check(
      this.players.filter(
        (player) => player.teamId === teamId && player !== existing,
      ).length < team.capacity,
      "Esse time está cheio. Escolha outro.",
    );
    check(
      !this.players.some(
        (player) =>
          player !== existing &&
          player.name.toLocaleLowerCase("pt-BR") ===
            clean.toLocaleLowerCase("pt-BR"),
      ),
      "Esse nome já está na sala. Acrescente seu sobrenome.",
    );
    check(existing || this.players.length < this.participants, "Sala lotada.");
    if (existing) {
      existing.name = clean;
      existing.teamId = team.id;
      return existing;
    }
    const player: Player = {
      id: this.newId().slice(0, 12),
      key: this.newId(),
      name: clean,
      teamId: team.id,
    };
    this.players.push(player);
    return player;
  }

  /** Confirma que a chave é a do orquestrador. */
  assertAdmin(key: string | undefined): void {
    check(key === this.admin, "Somente o orquestrador pode fazer isso.", 403);
  }

  /** Encontra a pessoa e a guilda dela, ou recusa a jogada. */
  private actor(key: string | undefined): { player: Player; team: Team } {
    const player = this.players.find((candidate) => candidate.key === key);
    check(player, "Entre em uma guilda para jogar.", 403);
    return { player, team: this.teams[player.teamId]! };
  }

  private assertPlayable(): void {
    check(
      this.phase === "playing" && !this.paused,
      "A partida terminou ou está pausada.",
    );
  }

  private log(
    team: Team,
    kind: Parameters<Team["record"]>[2],
    title: string,
    body: string,
    siteId: number | null = null,
  ): void {
    team.record(++this.sequence, this.elapsed, kind, title, body, siteId);
  }

  // ── Comandos ───────────────────────────────────────────────────────────────

  start(): void {
    check(this.phase === "lobby", "Esta partida já começou.");
    check(
      this.teams.every((team) =>
        this.players.some((player) => player.teamId === team.id),
      ),
      "Cada time precisa de pelo menos uma pessoa.",
    );
    this.phase = "playing";
    this.lastTick = this.clock();
    this.deadline = this.clock() + this.duration * 1000;
    for (const team of this.teams)
      this.log(
        team,
        "info",
        "A Cidadela precisa de vocês",
        "Arraste um Construtor até uma frente. Depois revise a obra e faça a entrega.",
      );
  }

  play(key: string | undefined, cardId: unknown, siteId: unknown): void {
    this.assertPlayable();
    const { player, team } = this.actor(key);
    const card = findCard(String(cardId));
    const site = team.siteAt(Number(siteId));
    check(card && site, "Selecione uma carta e uma construção.");
    check(!site.complete, "Essa construção já chegou ao nível máximo.");
    const cost = card.costs[site.level]!;
    check(
      team.canAfford(cost),
      "Contexto insuficiente. Aguarde a regeneração do time.",
    );

    if (card.id === "worktree") {
      check(
        site.acceptsWorktree,
        `Esta frente já tem ${STORY.maxWorktrees} canteiros isolados.`,
      );
      team.spend(cost);
      this.openWorktree(team, site, player.name);
      return;
    }

    if (card.id === "harness") {
      check(!site.harness, "O harness já está protegendo esta frente.");
      team.spend(cost);
      site.harness = true;
      this.log(
        team,
        "good",
        `${player.name}: ${card.name} em ${site.name}`,
        card.lesson,
        site.id,
      );
      return;
    }

    if (card.id === "builder") {
      check(
        !site.ready,
        "A construção está pronta. Envie um Revisor ou faça a entrega.",
      );
      check(
        !team.jobsAt(site.id).some((job) => job.isReviewer),
        "Aguarde a revisão desta frente.",
      );
    } else {
      check(
        site.ready,
        "Construa primeiro. O Revisor precisa de uma obra pronta.",
      );
      check(!site.reviewed, "A obra já foi revisada. Faça a entrega.");
      check(
        team.jobsAt(site.id).length === 0,
        "Aguarde os agentes terminarem nesta frente.",
      );
    }
    check(
      team.jobs.length < STORY.maxAgents,
      `Os ${STORY.maxAgents} agentes da guilda estão ocupados. Aguarde uma tarefa terminar.`,
    );

    team.spend(cost);
    const job = new Job(
      ++this.sequence,
      card.id as CardId,
      site.id,
      player.name,
      this.elapsed,
      this.elapsed +
        (card.id === "builder" ? STORY.buildSeconds : site.reviewDuration()),
      card.id === "builder" ? team.assignWorkspace(site) : "review",
      team.nextQuestionId(),
      player.id,
    );

    if (job.isBuilder) this.dispatchBuilder(team, site, job, player.name);
    else
      this.log(
        team,
        "info",
        `${player.name} pediu revisão`,
        `${site.name}: ${
          site.faults
            ? `${site.faults} falha(s) aumentam o tempo de revisão.`
            : "O sentinela vai validar a obra."
        }`,
        site.id,
      );

    team.jobs.push(job);
    team.retime(this.elapsed);
  }

  /**
   * Um canteiro novo tira um Construtor do checkout compartilhado: isolar
   * durante o conflito encerra o conflito, como no repositório de verdade.
   */
  private openWorktree(team: Team, site: Site, playerName: string): void {
    site.worktrees++;
    const stuck = team.buildersAt(site.id).filter((job) => job.conflict);
    const slot = team.freeSlots(site)[0];
    const rescued = stuck[0];
    if (rescued && slot) rescued.workspace = slot;
    team.settleConflicts();
    team.retime(this.elapsed);
    this.log(
      team,
      "good",
      `${playerName}: canteiro ${site.worktrees} em ${site.name}`,
      rescued && slot
        ? `${rescued.playerName} saiu do checkout compartilhado e o conflito acabou. A obra volta ao ritmo cheio.`
        : `${site.name} aceita ${site.worktrees + 1} Construtores em paralelo. Cada frente extra soma ${STORY.integrationSeconds} s de integração na revisão.`,
      site.id,
    );
  }

  private dispatchBuilder(
    team: Team,
    site: Site,
    job: Job,
    playerName: string,
  ): void {
    const rivals = team.jobs.filter(
      (other) => other.isBuilder && other.workspace === job.workspace,
    );
    const helpers = team.buildersAt(site.id).length;
    site.contributors++;

    if (rivals.length) {
      job.conflict = true;
      site.damage();
      site.taint();
      team.stats.conflicts++;
      for (const rival of rivals) {
        rival.conflict = true;
        const hit = team.sites[rival.siteId]!;
        hit.damage();
        hit.taint();
      }
      this.log(
        team,
        "bad",
        "Dois agentes no mesmo checkout!",
        `Sem canteiro livre, ${playerName} e ${rivals[0]!.playerName} editam o mesmo diretório: cada um rende metade, as obras ganham falhas e estas entregas saem sem multiplicador. Abra uma Worktree antes de somar Construtores.`,
        site.id,
      );
      return;
    }

    if (helpers) {
      this.log(
        team,
        "good",
        `${site.name}: ${helpers + 1} frentes em paralelo`,
        `${playerName} entrou num canteiro isolado. A obra fecha em ${Math.round(
          STORY.buildSeconds / (helpers + 1),
        )} s em vez de ${STORY.buildSeconds} s, a revisão soma ${
          helpers * STORY.integrationSeconds
        } s para convergir as branches e a entrega ganha +${STORY.parallelBonus.toLocaleString(
          "pt-BR",
        )} no multiplicador.`,
        site.id,
      );
      return;
    }

    this.log(
      team,
      "info",
      `${playerName} mobilizou um Construtor`,
      `${site.name}: sozinho ele leva ${STORY.buildSeconds} s. Uma Worktree abre um canteiro e um segundo Construtor corta esse tempo pela metade.`,
      site.id,
    );
  }

  answer(
    key: string | undefined,
    jobId: unknown,
    option: unknown,
  ): AnswerResult {
    this.assertPlayable();
    const { player, team } = this.actor(key);
    const job = team.quizOf(jobId);
    check(job, "Essa pergunta expirou.");
    check(
      job.askedTo === player.id,
      "A pergunta é de quem enviou o agente.",
      403,
    );
    check(!job.answered, "Você já respondeu esta pergunta.");
    check(this.elapsed < job.questionExpiresAt, "Essa pergunta expirou.");
    // O agente ainda em campo é o que pode ser acelerado. Depois que ele volta,
    // a pergunta continua valendo pontos, mas não há mais obra para adiantar.
    const working = team.jobs.includes(job);
    const question = findQuestion(job.questionId);
    check(question, "Pergunta indisponível.");
    check(
      Number.isInteger(option) &&
        (option as number) >= 0 &&
        (option as number) < question.options.length,
      "Escolha uma alternativa.",
    );

    const chosen = option as number;
    const correct = chosen === question.answer;
    job.answered = { option: chosen, correct };
    const site = team.sites[job.siteId]!;

    if (correct) {
      // O acerto corta metade do que falta. Na obra isso empurra o trabalho em
      // si, e não um relógio, porque o ritmo é somado entre os Construtores.
      if (working && job.isBuilder) {
        site.fastForward(STUDY.speedup);
        team.retime(this.elapsed);
      } else if (working) {
        job.endsAt =
          this.elapsed + job.remaining(this.elapsed) * (1 - STUDY.speedup);
      }
      team.score += STUDY.bonus;
      site.studyBonus += STUDY.bonus;
      team.stats.learned++;
      this.log(
        team,
        "score",
        `${player.name} acertou · +${STUDY.bonus} pontos`,
        working
          ? `${question.why} O agente em ${site.name} acelerou.`
          : `${question.why} O agente já tinha voltado, então não houve obra para adiantar.`,
        job.siteId,
      );
    } else {
      team.stats.missed++;
      this.log(
        team,
        "bad",
        `${player.name} errou: ${question.topic}`,
        question.why,
        job.siteId,
      );
    }

    team.expireQuizzes(this.elapsed);
    return {
      question: job.questionView()!,
      siteId: job.siteId,
      correct,
    };
  }

  deliver(key: string | undefined, siteId: unknown): void {
    this.assertPlayable();
    const { player, team } = this.actor(key);
    const site = team.siteAt(Number(siteId));
    check(site, "Selecione uma construção.");
    check(!site.complete, "Essa frente já está concluída.");
    check(site.ready, "A obra ainda não terminou.");
    check(
      team.jobsAt(site.id).length === 0,
      "Aguarde os agentes desta frente terminarem.",
    );

    if (site.harness && !site.safe) {
      team.stats.blocked++;
      this.log(
        team,
        "good",
        "O harness bloqueou a entrega",
        `${site.name}: falta revisão. O bloqueio não consome contexto nem gera pontos. Envie o Revisor.`,
        site.id,
      );
      return;
    }

    const safe = site.safe;
    const multiplier = site.multiplier();
    const points = site.reward();
    team.score += points;
    team.stats.deliveries++;
    if (safe) team.stats.safe++;
    else team.stats.unsafe++;
    if (multiplier > 1) team.stats.combos++;
    // A frase da entrega é o momento de ensino: ela diz o que multiplicou o
    // placar, ou o que teria multiplicado se a frente tivesse sido conduzida
    // de outro jeito.
    const body = safe
      ? `${player.name} integrou uma entrega revisada. ${this.creditLine(site, multiplier)}`
      : "A obra foi entregue sem validação. A guilda perdeu a oportunidade dos 100 pontos deste nível. Revisão transforma trabalho em entrega confiável.";
    site.deliver();
    this.log(
      team,
      safe ? "score" : "bad",
      `${site.name} nível ${site.level} · +${points} pontos`,
      body,
      site.id,
    );

    if (this.teams.every((other) => other.sites.every((s) => s.complete)))
      this.finish();
  }

  /** Por que a entrega valeu o que valeu, na linguagem da apresentação. */
  private creditLine(site: Site, multiplier: number): string {
    if (site.conflicted)
      return "Sem multiplicador: houve conflito de checkout neste nível. A revisão limpou as falhas, mas o retrabalho já tinha custado o bônus.";
    const wins: string[] = [];
    if (site.harness) wins.push("Harness segurando a operação");
    if (site.parallel) wins.push(`${site.contributors} canteiros isolados`);
    if (!wins.length)
      return `Multiplicador 1×. Um Harness na frente e Construtores em canteiros próprios multiplicariam esta entrega.`;
    return `${wins.join(" e ")}: multiplicador ${multiplier.toLocaleString("pt-BR")}×.`;
  }

  togglePause(): void {
    check(this.phase === "playing", "Não há partida em andamento.");
    this.paused = !this.paused;
    this.lastTick = this.clock();
    this.deadline = this.paused
      ? null
      : this.clock() + (this.duration - this.elapsed) * 1000;
  }

  removePlayer(playerId: unknown): void {
    check(
      this.phase === "lobby",
      "Só é possível remover pessoas antes da partida.",
    );
    this.players = this.players.filter((player) => player.id !== playerId);
  }

  finish(): void {
    this.phase = "finished";
    this.deadline = null;
    this.paused = false;
    for (const team of this.teams) {
      team.jobs = [];
      team.quizzes = [];
    }
  }

  // ── Relógio ────────────────────────────────────────────────────────────────

  /**
   * Avança o tempo e devolve se algo mudou o suficiente para publicar.
   *
   * Os eventos são ordenados por instante antes de aplicados, para que um tick
   * atrasado do servidor continue causal: uma tempestade que caiu antes de uma
   * revisão precisa ser consertada por ela, e não aplicada depois.
   */
  advance(): boolean {
    if (this.phase !== "playing" || this.paused) return false;
    const previous = this.elapsed;
    const dt = Math.min(
      Math.max(0, (this.clock() - this.lastTick) / 1000),
      this.duration - this.elapsed,
    );
    const end = previous + dt;
    this.lastTick = this.clock();

    const events: Event[] = [];
    for (const team of this.teams) {
      team.regenerate(dt);
      for (const job of team.jobs)
        if (job.isReviewer && job.endsAt <= end)
          events.push({ at: job.endsAt, order: 0, kind: "review", team, job });
      // A obra não termina por relógio de agente: ela fecha quando o ritmo
      // somado dos Construtores completa os 100%.
      for (const site of team.sites) {
        const rate = team.buildRate(site);
        if (rate <= 0) continue;
        const at = previous + (100 - site.built) / rate;
        if (at <= end) events.push({ at, order: 0, kind: "build", team, site });
      }
    }
    for (const fraction of STORM_MARKS) {
      const at = this.duration * fraction;
      if (previous < at && end >= at)
        events.push({ at, order: 1, kind: "storm" });
    }
    events.sort((a, b) => a.at - b.at || a.order - b.order);

    for (const event of events) {
      this.soak(event.at);
      if (event.kind === "build") this.finishBuild(event.team, event.site);
      else if (event.kind === "storm") this.storm();
      else this.finishReview(event.team, event.job);
    }
    this.soak(end);
    for (const team of this.teams) team.expireQuizzes(this.elapsed);

    if (this.elapsed >= this.duration) this.finish();
    const second = Math.floor(this.elapsed);
    const changed = second !== this.lastSecond || events.length > 0;
    this.lastSecond = second;
    return changed;
  }

  /** Avança as obras de todas as guildas até um instante. */
  private soak(to: number): void {
    const dt = to - this.elapsed;
    if (dt > 0) for (const team of this.teams) team.soak(dt);
    this.elapsed = to;
  }

  private finishBuild(team: Team, site: Site): void {
    site.built = 100;
    site.reviewed = false;
    const crew = team.removeBuildersAt(site.id);
    team.retire(crew, this.elapsed);
    const extra = Math.max(0, site.contributors - 1);
    this.log(
      team,
      crew.some((job) => job.conflict) ? "bad" : "good",
      `${site.name}: obra pronta`,
      crew.length > 1
        ? `${crew.length} Construtores fecharam o nível juntos. Agora a revisão precisa convergir as frentes: +${
            extra * STORY.integrationSeconds
          } s de integração.`
        : "Obra pronta. Envie um Revisor para validar antes da entrega.",
      site.id,
    );
  }

  private finishReview(team: Team, job: Job): void {
    const site = team.sites[job.siteId]!;
    team.remove(job);
    team.retire([job], this.elapsed);
    site.reviewed = true;
    site.faults = 0;
    team.stats.reviews++;
    this.log(
      team,
      "good",
      `${site.name}: revisão concluída`,
      site.contributors > 1
        ? `${site.contributors} frentes foram convergidas numa entrega só. Agora vale 100 pontos.`
        : "A obra foi validada. Selecione a construção e entregue para ganhar 100 pontos.",
      site.id,
    );
  }

  /** O caos altera uma construção de cada guilda. O harness barra o comando. */
  private storm(): void {
    this.storms++;
    for (const team of this.teams) {
      const available = team.sites.filter((site) => !site.complete);
      if (!available.length) continue;
      const target = available[(this.storms - 1) % available.length]!;
      if (target.harness) {
        team.stats.blocked++;
        this.log(
          team,
          "good",
          "Comando do caos bloqueado",
          `${target.name}: as permissões do harness impediram uma alteração sem aprovação.`,
          target.id,
        );
      } else {
        target.damage();
        team.stats.incidents++;
        this.log(
          team,
          "bad",
          "O caos alterou a construção!",
          `${target.name} recebeu uma falha. Um Revisor pode corrigi-la. Worktree não restringe ferramentas: o Harness é quem bloqueia comandos indevidos.`,
          target.id,
        );
      }
    }
  }

  // ── Publicação ─────────────────────────────────────────────────────────────

  /** O estado da sala do ponto de vista de uma chave. */
  snapshot(key: string | undefined): Snapshot {
    const player = this.players.find((candidate) => candidate.key === key);
    const best = Math.max(...this.teams.map((team) => team.score));
    const players: PlayerView[] = this.players.map(({ id, name, teamId }) => ({
      id,
      name,
      teamId,
    }));
    return {
      code: this.code,
      phase: this.phase,
      participants: this.participants,
      duration: this.duration,
      practice: this.practice,
      teams: this.teams.map((team) => team.view()),
      players,
      isAdmin: key === this.admin,
      me: player?.id ?? null,
      elapsed: this.elapsed,
      paused: this.paused,
      deadline: this.deadline,
      serverTime: this.clock(),
      version: this.version,
      storms: this.storms,
      cards: CARDS,
      story: STORY,
      study: STUDY,
      winners:
        this.phase === "finished"
          ? this.teams
              .filter((team) => team.score === best)
              .map((team) => team.id)
          : [],
    };
  }
}
