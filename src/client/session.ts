import type {
  ActionRequest,
  AnswerResult,
  CardId,
  Snapshot,
  TeamView,
} from "../shared/protocol.js";

/** Um aviso passageiro no rodapé. */
export interface Toast {
  readonly message: string;
  readonly error: boolean;
  readonly until: number;
}

/** O que a sessão avisa ao resto da interface quando algo acontece. */
export interface SessionListener {
  /** Uma fase nova começou: a interface troca de tela e limpa a seleção. */
  onPhaseChange(snapshot: Snapshot): void;
  /** A guilda pontuou. */
  onScore(): void;
  /** Um som curto de confirmação ou de recusa. */
  onTone(ok: boolean): void;
}

const STORAGE_KEY = "arena-session";

/** A sessão gravada na aba, para sobreviver a um recarregamento. */
interface StoredSession {
  code: string;
  key: string;
  adminKey: string;
}

/**
 * O elo com o servidor.
 *
 * Guarda o estado publicado, as chaves de acesso, o stream de eventos e todas
 * as chamadas de API. Nenhum componente de tela fala com o servidor por conta
 * própria: eles pedem à sessão, que trata erro, sinaliza ocupado e avisa quando
 * a fase muda.
 */
export class Session {
  state: Snapshot | null = null;
  key = "";
  adminKey = "";
  connected = true;
  busy = false;
  toast: Toast | null = null;
  /** Guilda observada quando quem olha não joga por nenhuma. */
  watchTeam = 0;
  inviteBase = location.origin;
  /** Diferença entre o relógio do servidor e o desta máquina. */
  private offset = 0;
  private stream: EventSource | null = null;
  private listener: SessionListener | null = null;

  bind(listener: SessionListener): void {
    this.listener = listener;
  }

  // ── Leitura do estado ──────────────────────────────────────────────────────

  /** A guilda que esta tela mostra: a sua, ou a que está sendo acompanhada. */
  get team(): TeamView | null {
    if (!this.state) return null;
    const me = this.state.players.find(
      (player) => player.id === this.state!.me,
    );
    return (
      this.state.teams[me?.teamId ?? this.watchTeam] ??
      this.state.teams[0] ??
      null
    );
  }

  get me(): string | null {
    return this.state?.me ?? null;
  }

  get isHost(): boolean {
    return Boolean(this.state?.isAdmin || this.adminKey);
  }

  /** Se esta pessoa joga, e não apenas assiste. */
  get playing(): boolean {
    return Boolean(this.state?.me);
  }

  /** O relógio da partida, projetado desde o último snapshot. */
  elapsed(): number {
    const state = this.state;
    if (!state) return 0;
    const running = !state.paused && state.phase === "playing";
    const drift = running
      ? Math.max(0, Date.now() + this.offset - state.serverTime) / 1000
      : 0;
    return Math.min(state.duration, state.elapsed + drift);
  }

  /** O contexto da guilda agora, projetado desde o último snapshot. */
  energy(team: TeamView): number {
    if (!this.state) return 0;
    return Math.min(
      this.state.story.maxEnergy,
      team.energy + (this.elapsed() - this.state.elapsed) * this.state.story.regen,
    );
  }

  // ── Transporte ─────────────────────────────────────────────────────────────

  private async api<T>(
    path: string,
    body: unknown = null,
    credential: string = this.key,
  ): Promise<T> {
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(credential ? { Authorization: "Bearer " + credential } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Não foi possível completar a ação.");
    return result as T;
  }

  /** Executa uma ação de rede, sinalizando ocupado e avisando o erro. */
  async work(task: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await task();
    } catch (error) {
      this.notify(
        (error as Error).message || "Sem conexão com a arena.",
        true,
      );
    } finally {
      this.busy = false;
    }
  }

  notify(message: string, error = false): void {
    this.toast = { message, error, until: performance.now() + 5000 };
    if (error) this.listener?.onTone(false);
  }

  apply(next: Snapshot): void {
    const phaseChanged = this.state?.phase !== next.phase;
    const previousScore = this.team?.score ?? 0;
    this.state = next;
    this.offset = next.serverTime - Date.now();
    if (phaseChanged) this.listener?.onPhaseChange(next);
    if ((this.team?.score ?? 0) > previousScore) this.listener?.onScore();
  }

  private subscribe(): void {
    this.stream?.close();
    this.stream = new EventSource(
      `/api/rooms/${this.state!.code}/events?key=${encodeURIComponent(this.key)}`,
    );
    this.stream.onmessage = (event) => {
      this.connected = true;
      this.apply(JSON.parse(event.data) as Snapshot);
    };
    this.stream.onerror = () => {
      this.connected = false;
    };
    this.stream.onopen = () => {
      this.connected = true;
    };
  }

  private remember(): void {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          code: this.state!.code,
          key: this.key,
          adminKey: this.adminKey,
        }),
      );
    } catch {
      // Aba privada ou armazenamento bloqueado: seguir sem lembrar.
    }
  }

  static restore(): StoredSession | null {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    } catch {
      return null;
    }
  }

  // ── Comandos ───────────────────────────────────────────────────────────────

  async createRoom(
    config: { participants: number; teamSize: number; duration: number },
    practice = false,
  ): Promise<void> {
    await this.work(async () => {
      const result = await this.api<{
        key: string;
        adminKey?: string;
        state: Snapshot;
      }>("/api/rooms", { ...config, practice }, "");
      this.key = result.key;
      this.adminKey = result.adminKey ?? "";
      this.apply(result.state);
      this.remember();
      this.subscribe();
      if (practice) await this.act("start");
    });
  }

  async lookup(code: string): Promise<void> {
    await this.work(async () => {
      const result = await this.api<{ state: Snapshot }>(
        "/api/rooms/" + code.toUpperCase(),
        null,
        "",
      );
      this.key = "";
      this.adminKey = "";
      this.apply(result.state);
      this.subscribe();
      history.replaceState({}, "", `?room=${this.state!.code}`);
    });
  }

  async joinTeam(name: string, teamId: number): Promise<void> {
    await this.work(async () => {
      const result = await this.api<{ key: string; state: Snapshot }>(
        `/api/rooms/${this.state!.code}/join`,
        { name, teamId },
      );
      this.key = result.key;
      this.apply(result.state);
      this.remember();
      this.subscribe();
      this.listener?.onTone(true);
      this.notify(
        "Você entrou na guilda " + this.state!.teams[teamId]!.name + ".",
      );
    });
  }

  /** Uma ação do orquestrador, enviada com a chave de admin. */
  async act(action: ActionRequest["action"], body: Partial<ActionRequest> = {}): Promise<void> {
    const result = await this.api<{ state: Snapshot }>(
      `/api/rooms/${this.state!.code}/action`,
      { action, ...body },
      this.adminKey || this.key,
    );
    if (this.adminKey) {
      const own = await this.api<{ state: Snapshot }>(
        `/api/rooms/${this.state!.code}`,
      );
      this.apply(own.state);
    } else this.apply(result.state);
  }

  /** A mesma ação, mas tratando erro e ocupado. */
  hostAction(action: ActionRequest["action"], body: Partial<ActionRequest> = {}): void {
    void this.work(() => this.act(action, body));
  }

  /** Uma jogada de quem está numa guilda. */
  async command(
    action: ActionRequest["action"],
    body: Partial<ActionRequest> = {},
  ): Promise<void> {
    await this.work(async () => {
      const result = await this.api<{ state: Snapshot }>(
        `/api/rooms/${this.state!.code}/action`,
        { action, ...body },
        this.key,
      );
      this.apply(result.state);
      this.listener?.onTone(true);
    });
  }

  /**
   * Envia a resposta da pergunta e devolve o resultado, que traz a alternativa
   * correta e a explicação — dados que o snapshot só passa a expor depois disto.
   */
  async answer(jobId: number, option: number): Promise<AnswerResult | null> {
    let result: AnswerResult | null = null;
    await this.work(async () => {
      const response = await this.api<{
        state: Snapshot;
        result?: AnswerResult;
      }>(
        `/api/rooms/${this.state!.code}/action`,
        { action: "answer", jobId, option },
        this.key,
      );
      this.apply(response.state);
      result = response.result ?? null;
      this.listener?.onTone(Boolean(result?.correct));
    });
    return result;
  }

  async playCard(cardId: CardId, siteId: number): Promise<void> {
    await this.command("play", { cardId, siteId });
  }

  async refresh(code: string): Promise<void> {
    const result = await this.api<{ state: Snapshot }>("/api/rooms/" + code);
    this.apply(result.state);
    this.subscribe();
  }

  async loadInviteBase(): Promise<void> {
    try {
      const data = await this.api<{ joinBase: string }>(
        "/api/connection",
        null,
        "",
      );
      this.inviteBase = data.joinBase;
    } catch {
      // Sem o endereço da rede, o convite cai no endereço da própria página.
    }
  }

  inviteUrl(): string {
    return `${this.inviteBase}/?room=${this.state!.code}`;
  }

  leave(): void {
    this.stream?.close();
    this.stream = null;
    this.state = null;
    this.key = "";
    this.adminKey = "";
    history.replaceState({}, "", "/");
  }
}
