import type { CardId, JobView, QuestionView } from "../shared/protocol.js";
import { STUDY } from "../content/story.js";
import { findQuestion } from "../content/questions.js";

/** O diretório de trabalho que um Construtor ocupa. */
export type Workspace = string;

/** O checkout compartilhado por toda a guilda. Só cabe um agente nele. */
export const MAIN_CHECKOUT: Workspace = "main";

/** Nome do canteiro isolado de índice `slot` numa frente. */
export function worktreeSlot(siteId: number, slot: number): Workspace {
  return `wt:${siteId}:${slot}`;
}

/** A resposta que a pessoa deu à pergunta da tarefa. */
export interface Answer {
  readonly option: number;
  readonly correct: boolean;
}

/**
 * Um agente em campo.
 *
 * A tarefa carrega a pergunta de quem a enviou: enquanto o agente trabalha,
 * quem o mandou precisa justificar a decisão. `questionId` e `answered` ficam
 * no servidor; o navegador só recebe a visão saneada de `view()`.
 */
export class Job {
  conflict = false;
  answered: Answer | null = null;

  constructor(
    readonly id: number,
    readonly cardId: CardId,
    readonly siteId: number,
    readonly playerName: string,
    readonly startedAt: number,
    public endsAt: number,
    public workspace: Workspace,
    readonly questionId: string,
    readonly askedTo: string,
  ) {}

  get isBuilder(): boolean {
    return this.cardId === "builder";
  }

  get isReviewer(): boolean {
    return this.cardId === "reviewer";
  }

  /**
   * Quando a pergunta fecha. Ela abre com a tarefa, mas tem o próprio relógio:
   * ler o enunciado não pode depender de quantos Construtores dividem a obra.
   */
  get questionExpiresAt(): number {
    return this.startedAt + STUDY.windowSeconds;
  }

  /** A pergunta ainda aceita resposta neste instante da partida. */
  open(elapsed: number): boolean {
    return !this.answered && elapsed < this.questionExpiresAt;
  }

  /** Quanto falta para a tarefa terminar, no relógio da partida. */
  remaining(elapsed: number): number {
    return Math.max(0, this.endsAt - elapsed);
  }

  /**
   * A pergunta como o navegador pode vê-la. O índice correto e a explicação só
   * entram depois da resposta — antes disso eles vazariam pelo stream, que
   * chega a todo mundo na sala.
   */
  questionView(): QuestionView | null {
    const question = findQuestion(this.questionId);
    if (!question) return null;
    const done = this.answered !== null;
    return {
      id: question.id,
      topic: question.topic,
      prompt: question.prompt,
      options: question.options,
      askedTo: this.askedTo,
      chosen: this.answered ? this.answered.option : null,
      correct: this.answered ? this.answered.correct : null,
      answer: done ? question.answer : null,
      why: done ? question.why : null,
      expiresAt: this.questionExpiresAt,
    };
  }

  view(): JobView {
    return {
      id: this.id,
      cardId: this.cardId,
      siteId: this.siteId,
      playerName: this.playerName,
      startedAt: this.startedAt,
      endsAt: this.endsAt,
      conflict: this.conflict,
      workspace: this.workspace,
      question: this.questionView(),
    };
  }
}
