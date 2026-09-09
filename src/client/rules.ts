import type {
  CardId,
  CardView,
  SiteView,
  Snapshot,
  StoryView,
  TeamView,
} from "../shared/protocol.js";

/** O que aconteceria se esta carta fosse solta nesta frente. */
export interface Preview {
  /** Se o servidor aceitaria a jogada. */
  readonly ok: boolean;
  /** Preço desta carta no nível atual da frente. */
  readonly cost: number;
  /** Aceita, mas com consequência ruim: é o aviso de conflito. */
  readonly warn?: boolean;
  /** A frase mostrada na placa da frente. */
  readonly hint: string;
}

const MAIN_CHECKOUT = "main";

/**
 * A leitura da jogada antes de jogar.
 *
 * Esta classe repete as regras de `src/game` para que a pessoa saiba o que a
 * carta faz naquela frente antes de gastar o contexto. O servidor continua
 * sendo quem aceita ou recusa; isto é só a leitura. Um teste cruza as duas
 * decisões em 36 combinações — se uma regra mudar de um lado só, ele falha.
 */
export class PlayPreview {
  constructor(private readonly story: StoryView) {}

  static from(state: Snapshot): PlayPreview {
    return new PlayPreview(state.story);
  }

  static cost(card: CardView, level: number): number {
    return card.costs[Math.min(level, card.costs.length - 1)]!;
  }

  of(card: CardView, site: SiteView, team: TeamView, energy: number): Preview {
    const cost = PlayPreview.cost(card, site.level);
    return { ...this.availability(card, site, team, energy, cost), cost };
  }

  private availability(
    card: CardView,
    site: SiteView,
    team: TeamView,
    energy: number,
    cost: number,
  ): Omit<Preview, "cost"> {
    if (site.level >= this.story.maxLevel)
      return { ok: false, hint: "Frente concluída. Escolha outra." };
    if (energy + 1e-8 < cost)
      return {
        ok: false,
        hint: `Faltam ${Math.ceil(cost - energy)} de contexto.`,
      };

    if (card.id === "worktree") return this.worktree(site, team);
    if (card.id === "harness") return this.harness(site);

    const here = team.jobs.filter((job) => job.siteId === site.id);
    if (card.id === "builder") {
      if (site.built >= 100)
        return { ok: false, hint: "Obra pronta. Falta revisar ou entregar." };
      if (here.some((job) => job.cardId === "reviewer"))
        return { ok: false, hint: "Revisão em andamento nesta frente." };
    } else {
      if (site.built < 100)
        return { ok: false, hint: "Construa até 100% antes de revisar." };
      if (site.reviewed)
        return { ok: false, hint: "Já revisada. Pode entregar." };
      if (here.length)
        return {
          ok: false,
          hint: "Espere os agentes desta frente terminarem.",
        };
    }
    if (team.jobs.length >= this.story.maxAgents)
      return {
        ok: false,
        hint: `Os ${this.story.maxAgents} agentes da guilda estão ocupados.`,
      };

    if (card.id === "reviewer") return this.reviewer(site);
    return this.builder(site, team);
  }

  private worktree(site: SiteView, team: TeamView): Omit<Preview, "cost"> {
    if (site.worktrees >= this.story.maxWorktrees)
      return {
        ok: false,
        hint: `Esta frente já tem ${this.story.maxWorktrees} canteiros.`,
      };
    const stuck = team.jobs.some(
      (job) =>
        job.cardId === "builder" && job.siteId === site.id && job.conflict,
    );
    return {
      ok: true,
      hint: stuck
        ? "Tira um Construtor do checkout compartilhado e encerra o conflito."
        : `Abre o canteiro ${site.worktrees + 1}: mais um Construtor em paralelo aqui.`,
    };
  }

  private harness(site: SiteView): Omit<Preview, "cost"> {
    return site.harness
      ? { ok: false, hint: "O harness já protege esta frente." }
      : {
          ok: true,
          hint: "Bloqueia entrega sem revisão e comandos do caos.",
        };
  }

  private reviewer(site: SiteView): Omit<Preview, "cost"> {
    const integration =
      Math.max(0, site.contributors - 1) * this.story.integrationSeconds;
    const seconds = this.story.reviewSeconds + site.faults * 3 + integration;
    const extras: string[] = [];
    if (site.faults) extras.push(`${site.faults} falha(s)`);
    if (integration) extras.push(`${site.contributors} frentes a convergir`);
    return {
      ok: true,
      hint: `Valida a obra em ${seconds} s${
        extras.length ? ` · ${extras.join(" e ")}` : ""
      }.`,
    };
  }

  private builder(site: SiteView, team: TeamView): Omit<Preview, "cost"> {
    // Qual diretório sobra para este agente: um canteiro livre desta frente ou
    // o checkout principal, que é único para a guilda inteira.
    const busy = new Set(
      team.jobs
        .filter((job) => job.cardId === "builder")
        .map((job) => job.workspace),
    );
    let slot: string | null = null;
    for (let index = 0; index < site.worktrees; index++) {
      const name = `wt:${site.id}:${index}`;
      if (!busy.has(name)) {
        slot = name;
        break;
      }
    }
    // O aviso de conflito é o ponto pedagógico da carta Worktree: aparece antes
    // da jogada, não só no diário depois do estrago.
    if (!slot && busy.has(MAIN_CHECKOUT))
      return {
        ok: true,
        warn: true,
        hint: "Sem canteiro livre: os dois dividem o checkout e rendem metade cada.",
      };

    const crew =
      team.jobs.filter(
        (job) => job.cardId === "builder" && job.siteId === site.id,
      ).length + 1;
    const seconds = Math.round(
      ((100 - site.built) / 100) * (this.story.buildSeconds / crew),
    );
    if (crew > 1)
      return {
        ok: true,
        hint: `${crew}ª frente nesta obra: fecha em ${seconds} s. A revisão soma +${
          (crew - 1) * this.story.integrationSeconds
        } s para convergir.`,
      };
    return {
      ok: true,
      hint: `Constrói ${Math.round(site.built)}% → 100% em ${seconds} s. Um canteiro libera um 2º Construtor.`,
    };
  }
}

/**
 * A obra é acumulada pelo servidor em `site.built`. Entre um snapshot e outro o
 * cliente projeta pelo mesmo ritmo, em vez de somar uma barra por agente:
 * aquela conta contava o trabalho duas vezes e enchia a barra antes da hora.
 */
export class BuildProgress {
  constructor(private readonly story: StoryView) {}

  rate(team: TeamView, site: SiteView): number {
    if (site.level >= this.story.maxLevel || site.built >= 100) return 0;
    const perAgent = 100 / this.story.buildSeconds;
    return team.jobs.reduce(
      (total, job) =>
        job.cardId === "builder" && job.siteId === site.id
          ? total + perAgent * (job.conflict ? this.story.conflictRate : 1)
          : total,
      0,
    );
  }

  at(
    team: TeamView,
    site: SiteView,
    now: number,
    snapshotElapsed: number,
  ): number {
    return Math.min(
      100,
      site.built + this.rate(team, site) * Math.max(0, now - snapshotElapsed),
    );
  }
}

/**
 * O próximo passo que o Harness recomenda numa frente. Nunca é "harness": o
 * conselho só aparece onde a proteção já está em pé.
 */
export type NextMove = Exclude<CardId, "harness"> | "deliver";

/**
 * Quanto vale entregar esta frente, e qual é o próximo passo certo nela.
 *
 * Repete `Site.multiplier()`, `Site.reward()` e a ordem de jogo do servidor
 * para que a placa mostre o número antes da entrega, e para que a frente
 * protegida saiba apontar a carta seguinte. O servidor continua sendo quem
 * paga; isto é só a leitura, e um teste cruza as duas contas.
 */
export class DeliveryValue {
  constructor(private readonly story: StoryView) {}

  static from(state: Snapshot): DeliveryValue {
    return new DeliveryValue(state.story);
  }

  /** Dois ou mais Construtores neste nível, cada um no seu diretório. */
  parallel(site: SiteView): boolean {
    return site.contributors > 1 && !site.conflicted;
  }

  multiplier(site: SiteView): number {
    if (site.conflicted) return 1;
    const level = Math.min(site.level, this.story.harnessBonus.length - 1);
    return (
      1 +
      (site.harness ? this.story.harnessBonus[level]! : 0) +
      (this.parallel(site) ? this.story.parallelBonus : 0)
    );
  }

  reward(site: SiteView): number {
    const multiplier = this.multiplier(site);
    const safe = site.reviewed && site.faults === 0;
    const base = safe ? this.story.scoreSafe : this.story.scoreUnsafe;
    return Math.round(base * multiplier + site.studyBonus * (multiplier - 1));
  }

  /**
   * A carta que a frente protegida recomenda agora.
   *
   * É a ordem que a apresentação ensina: isolar antes de somar Construtores,
   * revisar antes de entregar. Devolve null quando somar mais um agente só
   * criaria conflito, que é justamente a jogada a não fazer.
   */
  nextMove(site: SiteView, team: TeamView): NextMove | null {
    if (site.level >= this.story.maxLevel) return null;
    if (
      team.jobs.some(
        (job) => job.siteId === site.id && job.cardId === "reviewer",
      )
    )
      return null;
    if (site.built >= 100) return site.reviewed ? "deliver" : "reviewer";

    const builders = team.jobs.filter((job) => job.cardId === "builder");
    const here = builders.filter((job) => job.siteId === site.id);
    if (!here.length) return "builder";

    const taken = new Set(builders.map((job) => job.workspace));
    const freeSlot = Array.from(
      { length: site.worktrees },
      (_, index) => `wt:${site.id}:${index}`,
    ).some((slot) => !taken.has(slot));
    if (freeSlot) return "builder";
    if (site.worktrees < this.story.maxWorktrees) return "worktree";
    return null;
  }
}
