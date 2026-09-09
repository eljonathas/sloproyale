/**
 * Erro de regra do jogo. A mensagem é escrita para a pessoa que jogou, não para
 * o console: ela aparece direto no aviso da interface.
 */
export class GameError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "GameError";
  }
}

/** Recusa a jogada com uma explicação, no lugar de falhar silenciosamente. */
export function check(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new GameError(message, status);
}
