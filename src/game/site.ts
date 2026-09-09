import type { SiteView } from "../shared/protocol.js";
import type { SiteBlueprint } from "../content/story.js";
import { STORY } from "../content/story.js";

/** Quantas falhas uma frente acumula antes de saturar. */
const MAX_FAULTS = 3;

/**
 * Uma frente de obra: Portal, Forja ou Muralha.
 *
 * `built` é o progresso do nível atual, de 0 a 100, e sobe continuamente
 * conforme o ritmo somado dos Construtores. `contributors` conta quantos
 * agentes tocaram este nível, porque é isso que a revisão precisa convergir.
 */
export class Site {
  level = 0;
  built = 0;
  reviewed = false;
  faults = 0;
  worktrees = 0;
  harness = false;
  contributors = 0;
  conflicted = false;
  studyBonus = 0;

  constructor(private readonly blueprint: SiteBlueprint) {}

  get id(): number {
    return this.blueprint.id;
  }

  get name(): string {
    return this.blueprint.name;
  }

  /** A frente chegou ao nível máximo e não aceita mais trabalho. */
  get complete(): boolean {
    return this.level >= STORY.maxLevel;
  }

  /** A obra do nível atual está fechada, esperando revisão ou entrega. */
  get ready(): boolean {
    return this.built >= 100;
  }

  /** Uma entrega revisada e sem falhas vale a pontuação cheia. */
  get safe(): boolean {
    return this.reviewed && this.faults === 0;
  }

  /** Dois ou mais Construtores neste nível, cada um no seu diretório. */
  get parallel(): boolean {
    return this.contributors > 1 && !this.conflicted;
  }

  /**
   * O multiplicador desta entrega.
   *
   * É aqui que a combinação de jogadas vira placar: proteger a frente e
   * paralelizar sem disputar diretório multiplicam a entrega inteira. Um
   * conflito de checkout no nível derruba tudo para 1 — o retrabalho apaga o
   * valor da disciplina, mesmo que a revisão limpe as falhas depois.
   */
  multiplier(): number {
    if (this.conflicted) return 1;
    const level = Math.min(this.level, STORY.harnessBonus.length - 1);
    return (
      1 +
      (this.harness ? STORY.harnessBonus[level]! : 0) +
      (this.parallel ? STORY.parallelBonus : 0)
    );
  }

  /**
   * Os pontos desta entrega. O bônus de estudo já foi creditado quando a
   * pessoa acertou; aqui entra só a parte que o multiplicador acrescenta a ele,
   * para que responder certo continue pagando na hora e pagar mais no fim.
   */
  reward(): number {
    const multiplier = this.multiplier();
    const base = this.safe ? STORY.scoreSafe : STORY.scoreUnsafe;
    return Math.round(base * multiplier + this.studyBonus * (multiplier - 1));
  }

  /** Registra o conflito de checkout deste nível. */
  taint(): void {
    this.conflicted = true;
  }

  /** Ainda cabe abrir outro canteiro isolado nesta frente. */
  get acceptsWorktree(): boolean {
    return this.worktrees < STORY.maxWorktrees;
  }

  /**
   * Quanto a revisão vai levar. Falhas custam tempo, e cada frente paralela
   * extra precisa ser convergida: paralelismo compra latência pagando
   * coordenação.
   */
  reviewDuration(): number {
    return (
      STORY.reviewSeconds +
      this.faults * 3 +
      Math.max(0, this.contributors - 1) * STORY.integrationSeconds
    );
  }

  /** Avança a obra, sem passar de 100. */
  progress(amount: number): void {
    this.built = Math.min(100, this.built + amount);
  }

  /** Adianta uma fração do que falta. É o efeito de acertar a pergunta. */
  fastForward(fraction: number): void {
    this.built = Math.min(100, this.built + (100 - this.built) * fraction);
  }

  /** Registra uma falha e invalida a revisão que existia. */
  damage(): void {
    this.faults = Math.min(MAX_FAULTS, this.faults + 1);
    this.reviewed = false;
  }

  /** Sobe um nível e zera o que pertencia ao nível entregue. */
  deliver(): void {
    this.level++;
    this.built = 0;
    this.reviewed = false;
    this.faults = 0;
    this.contributors = 0;
    this.conflicted = false;
    this.studyBonus = 0;
  }

  view(): SiteView {
    return {
      id: this.blueprint.id,
      name: this.blueprint.name,
      icon: this.blueprint.icon,
      purpose: this.blueprint.purpose,
      level: this.level,
      built: this.built,
      reviewed: this.reviewed,
      faults: this.faults,
      worktrees: this.worktrees,
      harness: this.harness,
      contributors: this.contributors,
      conflicted: this.conflicted,
      studyBonus: this.studyBonus,
    };
  }
}
