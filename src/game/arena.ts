import { randomBytes, randomInt } from "node:crypto";
import type { ActionRequest, Snapshot } from "../shared/protocol.js";
import { QUESTIONS } from "../content/questions.js";
import { check, GameError } from "./errors.js";
import { type Clock, type Player, Room } from "./room.js";
import { Team, TEAM_STYLES } from "./team.js";

/** Durações de partida oferecidas na configuração. */
const DURATIONS = [180, 240, 300, 420] as const;

/** Quantas guildas a arena comporta. */
const MAX_TEAMS = 16;

/** Sem I, O e 1 para o código não ser confundido ao ser lido em voz alta. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Depois disto uma sala abandonada é descartada. */
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;

/** O que a configuração de uma arena aceita. */
export interface ArenaOptions {
  participants?: number;
  teamSize?: number;
  duration?: number;
  practice?: boolean;
}

const token = (): string => randomBytes(24).toString("hex");

/**
 * Cada guilda recebe as perguntas numa ordem própria, para que times vizinhos
 * não copiem a resposta um do outro.
 */
function shuffled(length: number): number[] {
  const order = [...Array(length).keys()];
  for (let i = length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

/**
 * O conjunto de salas vivas e o relógio que as move.
 *
 * A arena não conhece as regras da partida: ela cria salas, encontra salas,
 * encaminha ações e recolhe as que ficaram para trás. Quem decide o que pode
 * ser jogado é a `Room`.
 */
export class Arena {
  readonly rooms = new Map<string, Room>();
  now: Clock;

  constructor({ now = Date.now }: { now?: Clock } = {}) {
    this.now = now;
  }

  create(options: ArenaOptions = {}): Room {
    const {
      participants = 24,
      teamSize = 6,
      duration = 180,
      practice = false,
    } = options;
    check(
      Number.isInteger(participants) && participants >= 4 && participants <= 80,
      "Escolha de 4 a 80 participantes.",
    );
    check(
      Number.isInteger(teamSize) && teamSize >= 2 && teamSize <= 8,
      "Escolha de 2 a 8 pessoas por time.",
    );
    check(
      (DURATIONS as readonly number[]).includes(duration),
      "Escolha uma partida de 3, 4, 5 ou 7 minutos.",
    );
    const count = practice ? 1 : Math.max(2, Math.ceil(participants / teamSize));
    check(count <= MAX_TEAMS, `Use até ${MAX_TEAMS} times. Aumente o tamanho do grupo.`);

    const seats = practice ? 1 : participants;
    const teams = Array.from({ length: count }, (_, index) => {
      const base = TEAM_STYLES[index % TEAM_STYLES.length]!;
      const style = {
        ...base,
        name: base.name + (index >= TEAM_STYLES.length ? " II" : ""),
      };
      const capacity = practice
        ? 1
        : Math.floor(participants / count) +
          (index < participants % count ? 1 : 0);
      return new Team(index, style, capacity, shuffled(QUESTIONS.length));
    });

    const room = new Room(
      this.uniqueCode(),
      token(),
      seats,
      duration,
      practice,
      teams,
      () => this.now(),
      token,
    );
    this.rooms.set(room.code, room);
    return room;
  }

  private uniqueCode(): string {
    let code: string;
    do {
      code = Array.from(
        { length: 5 },
        () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
      ).join("");
    } while (this.rooms.has(code));
    return code;
  }

  get(code: unknown): Room {
    const room = this.rooms.get(String(code).toUpperCase());
    check(room, "Sala não encontrada. Confira o código.", 404);
    return room;
  }

  join(
    room: Room,
    body: { name?: unknown; teamId?: unknown },
    key?: string,
  ): Player {
    return room.join(body.name, body.teamId, key);
  }

  /**
   * Encaminha uma ação para a sala, depois de pôr o relógio dela em dia.
   * O retorno só existe para a resposta da pergunta, que revela a explicação.
   */
  action(
    room: Room,
    key: string | undefined,
    action: string,
    body: Partial<ActionRequest> = {},
  ): unknown {
    room.advance();
    switch (action) {
      case "play":
        return room.play(key, body.cardId, body.siteId);
      case "deliver":
        return room.deliver(key, body.siteId);
      case "answer":
        return room.answer(key, body.jobId, body.option);
      case "open-quiz":
        return room.openQuiz(key, body.jobId);
      case "start":
        room.assertAdmin(key);
        return room.start();
      case "pause":
        room.assertAdmin(key);
        return room.togglePause();
      case "finish":
        room.assertAdmin(key);
        check(room.phase === "playing", "Não há partida em andamento.");
        return room.finish();
      case "remove":
        room.assertAdmin(key);
        return room.removePlayer(body.playerId);
      default:
        room.assertAdmin(key);
        throw new GameError("Ação desconhecida.");
    }
  }

  /** Move todas as salas e devolve as que mudaram o suficiente para publicar. */
  tick(): Room[] {
    const changed: Room[] = [];
    for (const room of this.rooms.values()) {
      if (room.advance()) changed.push(room);
      if (this.now() - room.updated > ROOM_TTL_MS) this.rooms.delete(room.code);
    }
    return changed;
  }

  snapshot(room: Room, key: string | undefined): Snapshot {
    return room.snapshot(key);
  }
}

export { GameError } from "./errors.js";
export type { Room } from "./room.js";
