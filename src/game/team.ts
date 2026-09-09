import type {
  LogEntryView,
  LogKind,
  TeamStats,
  TeamView,
} from "../shared/protocol.js";
import { SITES, STORY } from "../content/story.js";
import { QUESTIONS } from "../content/questions.js";
import { Job, MAIN_CHECKOUT, worktreeSlot, type Workspace } from "./job.js";
import { Site } from "./site.js";

/** Quantas entradas o diário guarda. */
const LOG_SIZE = 12;

/** A identidade visual de uma guilda. */
export interface TeamStyle {
  readonly name: string;
  readonly color: string;
  readonly icon: string;
}

export const TEAM_STYLES: readonly TeamStyle[] = [
  { name: "Aurora", color: "#54baff", icon: "shield" },
  { name: "Brasa", color: "#ff8768", icon: "swords" },
  { name: "Arcana", color: "#be94ff", icon: "mage" },
  { name: "Bosque", color: "#7ee4a3", icon: "branch" },
  { name: "Solar", color: "#ffd675", icon: "crown" },
  { name: "Maré", color: "#58e1d7", icon: "shield" },
  { name: "Ônix", color: "#a8bad8", icon: "swords" },
  { name: "Rosa", color: "#ff96bc", icon: "scroll" },
];

/**
 * Uma guilda.
 *
 * O contexto e o limite de agentes são do time inteiro, não da pessoa: é esse
 * compartilhamento que obriga a turma a combinar as frentes. A guilda também
 * guarda a própria ordem de perguntas, para que times vizinhos não copiem a
 * resposta um do outro.
 */
export class Team {
  score = 0;
  energy = STORY.maxEnergy;
  readonly sites: Site[] = SITES.map((blueprint) => new Site(blueprint));
  jobs: Job[] = [];
  /**
   * Tarefas que já acabaram e cuja pergunta continua aberta.
   *
   * O agente voltou para o acampamento e não conta mais no limite da guilda,
   * mas quem o enviou ainda pode responder — a janela de leitura é da pergunta,
   * não do trabalho.
   */
  quizzes: Job[] = [];
  log: LogEntryView[] = [];
  quizAt = 0;
  readonly stats: {
    -readonly [K in keyof TeamStats]: TeamStats[K];
  } = {
    deliveries: 0,
    safe: 0,
    unsafe: 0,
    conflicts: 0,
    reviews: 0,
    blocked: 0,
    incidents: 0,
    learned: 0,
    missed: 0,
    combos: 0,
  };

  constructor(
    readonly id: number,
    readonly style: TeamStyle,
    readonly capacity: number,
    /** Ordem em que esta guilda vê as perguntas. */
    readonly quiz: readonly number[],
  ) {}

  siteAt(siteId: number): Site | undefined {
    return this.sites.find((site) => site.id === siteId);
  }

  jobsAt(siteId: number): Job[] {
    return this.jobs.filter((job) => job.siteId === siteId);
  }

  buildersAt(siteId: number): Job[] {
    return this.jobs.filter((job) => job.isBuilder && job.siteId === siteId);
  }

  /**
   * Ritmo da obra de uma frente: cada Construtor isolado soma uma frente de
   * trabalho e quem divide checkout com outro rende metade. É isso que faz dois
   * agentes construírem em metade do tempo — e o conflito não render nada.
   */
  buildRate(site: Site): number {
    if (site.complete || site.ready) return 0;
    const perAgent = 100 / STORY.buildSeconds;
    return this.buildersAt(site.id).reduce(
      (rate, job) => rate + perAgent * (job.conflict ? STORY.conflictRate : 1),
      0,
    );
  }

  /**
   * Canteiros livres de uma frente. Cada worktree é um diretório e cabe um
   * agente em cada; quem não acha canteiro cai no checkout compartilhado.
   */
  freeSlots(site: Site): Workspace[] {
    const taken = new Set(
      this.jobs.filter((job) => job.isBuilder).map((job) => job.workspace),
    );
    const free: Workspace[] = [];
    for (let slot = 0; slot < site.worktrees; slot++) {
      const name = worktreeSlot(site.id, slot);
      if (!taken.has(name)) free.push(name);
    }
    return free;
  }

  /** O diretório que sobra para um agente novo nesta frente. */
  assignWorkspace(site: Site): Workspace {
    return this.freeSlots(site)[0] ?? MAIN_CHECKOUT;
  }

  /** Conflito é ocupar o mesmo diretório, não a mesma frente. */
  settleConflicts(): void {
    const crowd = new Map<Workspace, number>();
    for (const job of this.jobs)
      if (job.isBuilder)
        crowd.set(job.workspace, (crowd.get(job.workspace) ?? 0) + 1);
    for (const job of this.jobs)
      if (job.isBuilder) job.conflict = (crowd.get(job.workspace) ?? 0) > 1;
  }

  /**
   * Recalcula o relógio de cada Construtor com o ritmo atual. Serve ao contador
   * na tela e ao prazo da pergunta; a obra em si fecha pelo progresso.
   */
  retime(elapsed: number): void {
    for (const site of this.sites) {
      const rate = this.buildRate(site);
      const left = rate > 0 ? (100 - site.built) / rate : STORY.buildSeconds;
      for (const job of this.buildersAt(site.id)) job.endsAt = elapsed + left;
    }
  }

  /** Avança todas as obras da guilda por um intervalo. */
  soak(seconds: number): void {
    if (seconds <= 0) return;
    for (const site of this.sites) {
      const rate = this.buildRate(site);
      if (rate > 0) site.progress(rate * seconds);
    }
  }

  regenerate(seconds: number): void {
    this.energy = Math.min(
      STORY.maxEnergy,
      this.energy + seconds * STORY.regen,
    );
  }

  spend(cost: number): void {
    this.energy = Math.max(0, this.energy - cost);
  }

  canAfford(cost: number): boolean {
    return this.energy + 1e-8 >= cost;
  }

  /** A próxima pergunta da fila desta guilda. */
  nextQuestionId(): string {
    const index = this.quiz[this.quizAt++ % this.quiz.length] ?? 0;
    return QUESTIONS[index]!.id;
  }

  remove(job: Job): void {
    this.jobs = this.jobs.filter((other) => other !== job);
  }

  /** Guarda a pergunta ainda aberta de uma tarefa que terminou. */
  retire(jobs: readonly Job[], elapsed: number): void {
    for (const job of jobs) if (job.open(elapsed)) this.quizzes.push(job);
  }

  /** Descarta as perguntas cuja janela fechou sem resposta. */
  expireQuizzes(elapsed: number): void {
    this.quizzes = this.quizzes.filter((job) => job.open(elapsed));
  }

  /** A tarefa dona desta pergunta, esteja o agente em campo ou não. */
  quizOf(jobId: unknown): Job | undefined {
    return (
      this.jobs.find((job) => job.id === jobId) ??
      this.quizzes.find((job) => job.id === jobId)
    );
  }

  removeBuildersAt(siteId: number): Job[] {
    const crew = this.buildersAt(siteId);
    this.jobs = this.jobs.filter(
      (job) => !(job.isBuilder && job.siteId === siteId),
    );
    return crew;
  }

  record(
    id: number,
    at: number,
    kind: LogKind,
    title: string,
    body: string,
    siteId: number | null = null,
  ): void {
    this.log.unshift({ id, at, kind, title, body, siteId });
    this.log = this.log.slice(0, LOG_SIZE);
  }

  view(): TeamView {
    return {
      id: this.id,
      name: this.style.name,
      color: this.style.color,
      icon: this.style.icon,
      capacity: this.capacity,
      score: this.score,
      energy: this.energy,
      sites: this.sites.map((site) => site.view()),
      jobs: this.jobs.map((job) => job.view()),
      quizzes: this.quizzes.map((job) => job.view()),
      log: this.log,
      stats: { ...this.stats },
    };
  }
}
