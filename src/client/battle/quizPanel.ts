import type {
  AnswerResult,
  JobView,
  QuestionView,
  TeamView,
} from "../../shared/protocol.js";
import type { AgentArena } from "../app.js";
import { COLORS, clamp } from "../theme.js";

/** Duração da entrada da janela. Curta o bastante para não atrapalhar. */
const ENTRANCE_MS = 220;
/** Quanto tempo a marcação certo/errado dura antes da explicação entrar. */
const MARK_MS = 420;
/** Duração da aparição da explicação. */
const FADE_MS = 320;

/**
 * A janela do estudo em campo.
 *
 * A pergunta abre enquanto o agente trabalha e ocupa o lugar do baralho: é o
 * que impede pontuar só na velocidade de alocar agentes. Mas ela é dispensável
 * pelo botão **Baralho** — travar as cartas destruiria o paralelismo entre
 * frentes, que é justamente o que a partida ensina.
 *
 * A resposta acontece em duas batidas: primeiro a alternativa escolhida é
 * marcada e a errada estremece, depois a explicação toma o lugar das outras.
 */
export class QuizPanel {
  private jobId: number | null = null;
  private openedAt = 0;
  private reveal: QuestionView | null = null;
  private revealAt = 0;
  private minimized = false;
  private queued = 0;
  private sequence = false;
  private collapsed: number | null = null;

  constructor(
    private readonly app: AgentArena,
    /** Avisa a batalha que a obra acelerou, para a barra piscar. */
    private readonly onCorrect: (siteId: number, jobId: number) => void,
  ) {}

  reset(): void {
    this.jobId = null;
    this.reveal = null;
    this.minimized = false;
    this.queued = 0;
    this.sequence = false;
    this.collapsed = null;
  }

  /** Se a janela está ocupando o lugar do baralho neste quadro. */
  get covering(): boolean {
    return this.drawnFull;
  }

  private drawnFull = false;
  callingBack = false;

  /**
   * A tarefa cuja pergunta esta pessoa ainda deve responder.
   *
   * Procura também nas perguntas de agentes que já voltaram: a janela de
   * leitura é da pergunta, e não do trabalho, então ela sobrevive à tarefa.
   */
  private pending(team: TeamView, now: number): JobView[] {
    const me = this.app.session.me;
    if (!me) return [];
    return (
      [...team.jobs, ...team.quizzes]
        .filter(
          (job) =>
            job.question &&
            job.question.askedTo === me &&
            job.question.chosen === null &&
            (job.question.expiresAt === null || job.question.expiresAt > now),
        )
        .sort((a, b) => a.id - b.id)
    );
  }

  /** Escolhe uma alternativa e guarda o resultado para a revelação. */
  private async answer(option: number): Promise<void> {
    const jobId = this.jobId;
    if (jobId === null) return;
    const result: AnswerResult | null = await this.app.session.answer(
      jobId,
      option,
    );
    if (!result) return;
    this.reveal = result.question;
    this.revealAt = this.app.time;
    if (result.correct) {
      this.app.world?.deploy(result.siteId, COLORS.gold);
      this.onCorrect(result.siteId, jobId);
    }
    this.app.controls.say(
      `${result.correct ? "Resposta certa." : "Resposta errada."} ${result.question.why}`,
    );
  }

  /** Devolve true quando a janela cobriu o baralho neste quadro. */
  draw(team: TeamView, now: number): boolean {
    this.drawnFull = false;
    this.callingBack = false;
    const queue = this.pending(team, now);
    this.queued = queue.length;
    if (queue.length > 1) this.sequence = true;
    // A explicação pertence à resposta anterior. Novas chegadas não a apagam.
    const revealFor = (this.app.state?.study.revealSeconds ?? 9) * 1000;
    if (this.reveal && this.app.time - this.revealAt < revealFor) {
      this.drawnFull = true;
      this.panel(null, team, now);
      return true;
    }
    this.reveal = null;
    const pending = queue[0] ?? null;
    if (!pending) {
      this.jobId = null;
      this.sequence = false;
      return false;
    }
    if (this.jobId !== pending.id) {
      if (this.jobId === null) this.minimized = false;
      this.jobId = pending.id;
      this.openedAt = this.app.time;
      this.collapsed = null;
    }
    // Uma sequência permanece aberta mesmo depois que os agentes voltam.
    if (
      !this.sequence &&
      this.collapsed !== pending.id &&
      !team.jobs.some((job) => job.id === pending.id)
    ) {
      this.minimized = true;
      this.collapsed = pending.id;
    }
    if (
      !this.minimized &&
      pending.question!.expiresAt === null &&
      this.app.canPlay &&
      !this.app.session.busy
    )
      void this.app.session.command("open-quiz", { jobId: pending.id });
    if (this.minimized) {
      this.callingBack = true;
      this.callback(pending, now);
      return false;
    }
    this.drawnFull = true;
    this.panel(pending, team, now);
    return true;
  }

  /**
   * Chamada compacta: a pergunta continua aberta e cronometrada enquanto a
   * pessoa volta a jogar cartas.
   */
  private callback(job: JobView, now: number): void {
    const { painter, controls, viewport } = this.app;
    const mobile = viewport.mobile;
    const left = Math.max(0, (job.question!.expiresAt ?? now + 25) - now);
    const urgent = left <= 4;
    const map = viewport.sceneRect("battle");
    const x = mobile ? 18 : 1144;
    const w = mobile ? viewport.width - 36 : 272;
    const y = mobile ? map.y + map.h + 12 : 538;
    const h = mobile ? 44 : 96;
    const centerY = y + 24;

    painter.panel(x, y, w, h);
    painter.icon("brain", x + 24, centerY, 21, COLORS.gold);
    painter.pill(
      job.question!.topic.toUpperCase(),
      x + 42,
      centerY - 14,
      COLORS.gold,
      mobile ? 92 : 124,
    );
    painter.text(
      `${Math.ceil(left)}s`,
      x + w - (mobile ? 138 : 20),
      centerY,
      mobile ? 14 : 16,
      urgent ? COLORS.red : COLORS.muted,
      "right",
      900,
    );
    controls.button(
      "quiz-open",
      mobile ? x + w - 124 : x + 20,
      mobile ? y + 7 : y + 54,
      mobile ? 112 : w - 40,
      30,
      this.queued > 1
        ? `Responder (${this.queued})`
        : `Responder +${this.app.state?.study.bonus ?? 20}`,
      () => {
        this.minimized = false;
        this.openedAt = this.app.time;
      },
      { kind: urgent ? "gold" : "blue", small: true },
    );
  }

  private panel(pending: JobView | null, team: TeamView, now: number): void {
    const { painter, viewport } = this.app;
    const mobile = viewport.mobile;
    const question = pending ? pending.question! : this.reveal!;
    const answered = Boolean(this.reveal) && !pending;
    const since = this.app.time - this.revealAt;
    const explaining = answered && since >= MARK_MS;
    const shake =
      answered && !this.reveal!.correct && since < MARK_MS
        ? Math.sin(since / 26) * (1 - since / MARK_MS) * 9
        : 0;

    const map = viewport.sceneRect("battle");
    const pad = mobile ? 14 : 24;
    const x = mobile ? 18 : 180;
    const w = mobile ? viewport.width - 36 : 1080;
    const promptSize = mobile ? 14 : 19;
    const promptLine = mobile ? 19 : 25;
    const waiting = this.queued - (pending ? 1 : 0);
    const queueH = waiting > 0 ? 20 : 0;
    const headH = (mobile ? 56 : 64) + queueH;
    const gap = 6;

    // No computador a altura sai do conteúdo medido; no celular ela é o que
    // sobra abaixo do mapa, e são as alternativas que cedem espaço.
    const promptLines = painter.countLines(
      question.prompt,
      w - pad * 2,
      promptSize,
      2,
    );
    const optionH = mobile
      ? clamp(
          (viewport.height - 14 - (map.y + map.h + 10) - headH - 40 - 30) / 3 -
            gap,
          34,
          50,
        )
      : 44;
    const bodyH = headH + promptLines * promptLine + 10 + 3 * optionH + 2 * gap;
    const y = mobile
      ? map.y + map.h + 10
      : clamp(888 - (bodyH + 16), 604 - queueH, 700);
    const h = mobile ? viewport.height - 14 - y : bodyH + 16;

    // Entrada: sobe e aparece. O deslocamento entra nas coordenadas, e não numa
    // transformação, para a área clicável nunca sair de baixo do desenho.
    const grow = clamp((this.app.time - this.openedAt) / ENTRANCE_MS, 0, 1);
    const ease = 1 - Math.pow(1 - grow, 3);
    const top = y + (1 - ease) * 26;

    painter.save();
    painter.alpha = 0.25 + 0.75 * ease;
    painter.panel(x, top, w, h);

    const left = pending ? Math.max(0, (pending.question!.expiresAt ?? now + 25) - now) : 0;
    const span = this.app.state?.study.windowSeconds ?? 25;
    const urgent = Boolean(pending) && left <= 4;
    painter.rect(x + 8, top + 8, w - 16, 5, "#0b1c2e", 3);
    if (pending)
      painter.rect(
        x + 8,
        top + 8,
        (w - 16) * clamp(left / span, 0, 1),
        5,
        urgent && Math.floor(this.app.time / 260) % 2 === 0
          ? COLORS.red
          : COLORS.gold,
        3,
      );

    this.header(
      pending,
      team,
      question,
      answered,
      x,
      w,
      top,
      pad,
      left,
      urgent,
    );

    if (waiting > 0)
      painter.text(
        `${waiting} pergunta${waiting === 1 ? "" : "s"} na fila · 25s para cada uma`,
        x + pad,
        top + headH - 12,
        mobile ? 11 : 13,
        COLORS.gold,
      );

    if (!explaining)
      this.options(
        question,
        answered,
        shake,
        grow,
        x,
        w,
        top,
        pad,
        headH,
        promptLines,
        promptLine,
        promptSize,
        optionH,
        gap,
      );
    else
      this.explanation(question, x, w, top, h, pad, headH, optionH, gap, since);

    painter.restore();
  }

  /**
   * Cabeçalho montado da direita para a esquerda: relógio, saída para o baralho
   * e o contexto restante, que a janela esconde ao cobrir a barra.
   */
  private header(
    pending: JobView | null,
    team: TeamView,
    question: QuestionView,
    answered: boolean,
    x: number,
    w: number,
    top: number,
    pad: number,
    left: number,
    urgent: boolean,
  ): void {
    const { painter, controls, viewport, session, state } = this.app;
    const mobile = viewport.mobile;
    const head = top + (mobile ? 30 : 36);
    let edge = x + w - pad;

    if (pending) {
      const clock = `${Math.ceil(left)}s`;
      painter.text(
        clock,
        edge,
        head,
        mobile ? 17 : 21,
        urgent ? COLORS.red : COLORS.cream,
        "right",
        900,
      );
      edge -= painter.measure(clock, mobile ? 17 : 21, 900) + 16;
      // Sem esta saída a pergunta congelaria o baralho e o time perderia o
      // paralelismo entre frentes, que é justamente o que a partida ensina.
      const buttonW = mobile ? 76 : 96;
      controls.button(
        "quiz-later",
        edge - buttonW,
        head - 15,
        buttonW,
        30,
        "Baralho",
        () => (this.minimized = true),
        { kind: "dark", small: true },
      );
      edge -= buttonW + 16;
    }

    const fuel = `${Math.floor(session.energy(team))}/${state?.story.maxEnergy ?? 12}`;
    painter.text(
      fuel,
      edge,
      head,
      mobile ? 12 : 13,
      COLORS.muted,
      "right",
      800,
    );
    const fuelW = painter.measure(fuel, mobile ? 12 : 13, 800);
    painter.icon("gem", edge - fuelW - 11, head, 17, "#c5a3ff");
    const capLeft = edge - fuelW - 26;

    if (answered) {
      const won = this.reveal!.correct;
      const label = won
        ? `CERTO · +${state?.study.bonus ?? 20} PONTOS`
        : "RESPOSTA ERRADA";
      painter.pill(
        label,
        x + pad,
        head - 14,
        won ? COLORS.green : COLORS.red,
        Math.min(painter.measure(label, 12, 800) + 28, capLeft - x - pad),
      );
      return;
    }
    painter.icon("brain", x + pad + 11, head, 22, COLORS.gold);
    const label = question.topic.toUpperCase();
    painter.pill(
      label,
      x + pad + 28,
      head - 14,
      COLORS.gold,
      Math.min(
        painter.measure(label, 12, 800) + 28,
        Math.max(60, capLeft - x - pad - 28),
      ),
    );
  }

  private options(
    question: QuestionView,
    answered: boolean,
    shake: number,
    grow: number,
    x: number,
    w: number,
    top: number,
    pad: number,
    headH: number,
    promptLines: number,
    promptLine: number,
    promptSize: number,
    optionH: number,
    gap: number,
  ): void {
    const { painter, controls, viewport, session } = this.app;
    const mobile = viewport.mobile;
    painter.wrap(
      question.prompt,
      x + pad,
      top + headH,
      w - pad * 2,
      promptSize,
      COLORS.cream,
      promptLine,
      2,
    );
    const optionsY = top + headH + promptLines * promptLine + 10;
    question.options.forEach((label, index) => {
      const mark = answered
        ? index === this.reveal!.answer
          ? "correct"
          : index === this.reveal!.chosen
            ? "wrong"
            : "faded"
        : null;
      controls.choice(
        "quiz-" + index,
        x + pad,
        optionsY + index * (optionH + gap),
        w - pad * 2,
        optionH,
        index,
        label,
        () => this.answer(index),
        {
          disabled:
            answered ||
            question.expiresAt === null ||
            !this.app.canPlay ||
            session.busy ||
            !session.connected ||
            grow < 1,
          mark,
          shake: mark === "wrong" ? shake : 0,
          size: mobile ? 12 : 15,
          markedAt: this.revealAt,
        },
      );
    });
  }

  /**
   * Revelação: fica a alternativa certa, a escolhida quando errou, e o porquê
   * ocupa o espaço das outras.
   */
  private explanation(
    question: QuestionView,
    x: number,
    w: number,
    top: number,
    h: number,
    pad: number,
    headH: number,
    optionH: number,
    gap: number,
    since: number,
  ): void {
    const { painter, controls, viewport } = this.app;
    const mobile = viewport.mobile;
    const rows: { index: number; mark: "correct" | "wrong" }[] = [
      { index: this.reveal!.answer!, mark: "correct" },
    ];
    if (!this.reveal!.correct)
      rows.push({ index: this.reveal!.chosen!, mark: "wrong" });

    rows.forEach((row, index) =>
      controls.choice(
        "quiz-reveal-" + index,
        x + pad,
        top + headH + index * (optionH + gap),
        w - pad * 2,
        optionH,
        row.index,
        question.options[row.index]!,
        () => {},
        {
          disabled: true,
          mark: row.mark,
          size: mobile ? 12 : 15,
          markedAt: this.revealAt,
        },
      ),
    );

    const whyY = top + headH + rows.length * (optionH + gap) + 8;
    painter.save();
    painter.alpha = painter.alpha * clamp((since - MARK_MS) / FADE_MS, 0, 1);
    painter.wrap(
      question.why ?? "",
      x + pad,
      whyY + 6,
      w - pad * 2 - (mobile ? 0 : 150),
      mobile ? 12 : 14,
      COLORS.muted,
      mobile ? 17 : 21,
      mobile ? 5 : 3,
    );
    painter.restore();

    controls.button(
      "quiz-continue",
      mobile ? x + pad : x + w - pad - 136,
      mobile ? top + h - 46 : top + h - 54,
      mobile ? w - pad * 2 : 136,
      mobile ? 34 : 40,
      this.queued ? "Próxima pergunta" : "Continuar",
      () => {
        this.reveal = null;
        this.jobId = null;
      },
      { kind: "blue", small: true },
    );
  }
}
