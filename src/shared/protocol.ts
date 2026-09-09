/**
 * O contrato entre o servidor e o navegador.
 *
 * Antes disto o cliente lia `state.teams[0].jobs[0].question.answer` sem
 * garantia nenhuma de que o campo existia. Estes tipos são a única definição
 * do que trafega: o servidor promete produzi-los e o cliente só lê o que está
 * declarado aqui. São interfaces puras — o arquivo compilado não carrega
 * nenhum valor, então o navegador nunca recebe as regras nem os gabaritos.
 */

/** Identificadores das cartas. O servidor recusa qualquer outro valor. */
export type CardId = "builder" | "worktree" | "reviewer" | "harness";

/** Em que fase a sala está. */
export type Phase = "lobby" | "playing" | "finished";

/** Tom de uma entrada do diário, que decide a cor na interface. */
export type LogKind = "info" | "good" | "bad" | "score";

/** Uma carta do baralho, como o navegador a recebe. */
export interface CardView {
  readonly id: CardId;
  readonly name: string;
  /** Modelo 3D usado no retrato da carta. */
  readonly model: string;
  readonly icon: string;
  readonly color: string;
  readonly cost: number;
  readonly description: string;
  readonly lesson: string;
}

/**
 * A pergunta como o navegador a vê. `answer` e `why` chegam nulos até a
 * resposta ser enviada: é o que impede a turma de ler o gabarito pelo stream.
 */
export interface QuestionView {
  readonly id: string;
  readonly topic: string;
  readonly prompt: string;
  readonly options: readonly string[];
  /** Identificador de quem enviou o agente, e por isso responde. */
  readonly askedTo: string;
  /** Alternativa escolhida, ou null enquanto a pergunta está aberta. */
  readonly chosen: number | null;
  /** Se a escolha estava certa, ou null enquanto está aberta. */
  readonly correct: boolean | null;
  /** Índice da alternativa correta, revelado só depois de responder. */
  readonly answer: number | null;
  /** Explicação do slide, revelada só depois de responder. */
  readonly why: string | null;
}

/** Uma tarefa em andamento: um agente em campo. */
export interface JobView {
  readonly id: number;
  readonly cardId: CardId;
  readonly siteId: number;
  readonly playerName: string;
  readonly startedAt: number;
  /** Projeção de quando a tarefa termina, no relógio da partida. */
  readonly endsAt: number;
  /** Verdadeiro quando este agente divide o checkout com outro. */
  readonly conflict: boolean;
  /**
   * O diretório que este agente ocupa: um canteiro (`wt:<frente>:<n>`) ou o
   * checkout principal (`main`). A interface precisa disto para prever se o
   * próximo Construtor vai achar canteiro livre ou entrar em conflito.
   */
  readonly workspace: string;
  readonly question: QuestionView | null;
}

/** Uma frente de obra. */
export interface SiteView {
  readonly id: number;
  readonly name: string;
  readonly icon: string;
  readonly purpose: string;
  readonly level: number;
  /** Progresso da obra do nível atual, de 0 a 100. */
  readonly built: number;
  readonly reviewed: boolean;
  readonly faults: number;
  /** Quantos canteiros isolados a frente tem. */
  readonly worktrees: number;
  readonly harness: boolean;
  /** Construtores que trabalharam neste nível, e que a revisão vai convergir. */
  readonly contributors: number;
}

/** Contagens usadas no resumo do fim da partida. */
export interface TeamStats {
  readonly deliveries: number;
  readonly safe: number;
  readonly unsafe: number;
  readonly conflicts: number;
  readonly reviews: number;
  readonly blocked: number;
  readonly incidents: number;
  readonly learned: number;
  readonly missed: number;
}

/** Uma entrada do diário da guilda. */
export interface LogEntryView {
  readonly id: number;
  readonly at: number;
  readonly kind: LogKind;
  readonly title: string;
  readonly body: string;
  readonly siteId: number | null;
}

/** Uma guilda. */
export interface TeamView {
  readonly id: number;
  readonly name: string;
  readonly color: string;
  readonly icon: string;
  readonly capacity: number;
  readonly score: number;
  readonly energy: number;
  readonly sites: readonly SiteView[];
  readonly jobs: readonly JobView[];
  readonly log: readonly LogEntryView[];
  readonly stats: TeamStats;
}

/** Uma pessoa na sala. A chave de acesso nunca sai do servidor. */
export interface PlayerView {
  readonly id: string;
  readonly name: string;
  readonly teamId: number;
}

/** Parâmetros da partida, para a interface não repetir números. */
export interface StoryView {
  readonly title: string;
  readonly description: string;
  readonly maxLevel: number;
  /** Segundos que um Construtor sozinho leva para fechar a obra. */
  readonly buildSeconds: number;
  readonly reviewSeconds: number;
  /** Segundos acrescentados à revisão por frente paralela extra. */
  readonly integrationSeconds: number;
  /** Fração do ritmo de quem divide checkout com outro agente. */
  readonly conflictRate: number;
  readonly maxWorktrees: number;
  readonly maxEnergy: number;
  readonly regen: number;
  readonly scoreSafe: number;
  readonly scoreUnsafe: number;
}

/** Parâmetros do estudo em campo. */
export interface StudyView {
  readonly bonus: number;
  /** Fração do trabalho restante que o acerto adianta. */
  readonly speedup: number;
  readonly revealSeconds: number;
}

/** O estado inteiro da sala, do ponto de vista de uma pessoa. */
export interface Snapshot {
  readonly code: string;
  readonly phase: Phase;
  readonly participants: number;
  readonly duration: number;
  readonly practice: boolean;
  readonly teams: readonly TeamView[];
  readonly players: readonly PlayerView[];
  readonly isAdmin: boolean;
  /** Identificador de quem pediu o snapshot, ou null para quem só assiste. */
  readonly me: string | null;
  readonly elapsed: number;
  readonly paused: boolean;
  readonly deadline: number | null;
  readonly serverTime: number;
  readonly version: number;
  readonly storms: number;
  readonly cards: readonly CardView[];
  readonly story: StoryView;
  readonly study: StudyView;
  readonly winners: readonly number[];
}

/** O que uma resposta enviada devolve, para revelar a explicação na hora. */
export interface AnswerResult {
  readonly question: QuestionView;
  readonly siteId: number;
  readonly correct: boolean;
}

/** Ações que o navegador pode pedir. */
export type ActionName =
  | "play"
  | "deliver"
  | "answer"
  | "start"
  | "pause"
  | "finish"
  | "remove";

/** Corpo de um pedido de ação. Os campos usados variam por ação. */
export interface ActionRequest {
  readonly action: ActionName;
  readonly cardId?: CardId;
  readonly siteId?: number;
  readonly jobId?: number;
  readonly option?: number;
  readonly playerId?: string;
}

/** Resposta de uma ação: o estado novo e, quando houver, o resultado dela. */
export interface ActionResponse {
  readonly state: Snapshot;
  readonly result?: AnswerResult;
}
