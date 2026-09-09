import { randomBytes, randomInt } from "node:crypto";
import { CARDS, SITES, STORY } from "./missions.mjs";
export const TEAM_STYLES = [
  ["Aurora", "#54baff", "shield"],
  ["Brasa", "#ff8768", "swords"],
  ["Arcana", "#be94ff", "mage"],
  ["Bosque", "#7ee4a3", "branch"],
  ["Solar", "#ffd675", "crown"],
  ["Maré", "#58e1d7", "shield"],
  ["Ônix", "#a8bad8", "swords"],
  ["Rosa", "#ff96bc", "scroll"],
];
const token = () => randomBytes(24).toString("hex");
export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
function check(condition, message, status) {
  if (!condition) throw new GameError(message, status);
}
export class Arena {
  constructor({ now = Date.now } = {}) {
    this.rooms = new Map();
    this.now = now;
  }
  create({
    participants = 24,
    teamSize = 6,
    duration = 180,
    practice = false,
  } = {}) {
    check(
      Number.isInteger(participants) && participants >= 4 && participants <= 80,
      "Escolha de 4 a 80 participantes.",
    );
    check(
      Number.isInteger(teamSize) && teamSize >= 2 && teamSize <= 8,
      "Escolha de 2 a 8 pessoas por time.",
    );
    check(
      [180, 240, 300, 420].includes(duration),
      "Escolha uma partida de 3, 4, 5 ou 7 minutos.",
    );
    const count = practice
      ? 1
      : Math.max(2, Math.ceil(participants / teamSize));
    check(count <= 16, "Use até 16 times. Aumente o tamanho do grupo.");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;
    do {
      code = Array.from(
        { length: 5 },
        () => alphabet[randomInt(alphabet.length)],
      ).join("");
    } while (this.rooms.has(code));
    const room = {
      code,
      admin: token(),
      phase: "lobby",
      participants: practice ? 1 : participants,
      duration,
      practice,
      players: [],
      elapsed: 0,
      paused: false,
      deadline: null,
      lastTick: this.now(),
      created: this.now(),
      updated: this.now(),
      version: 0,
      sequence: 0,
      storms: 0,
      lastSecond: -1,
      teams: Array.from({ length: count }, (_, i) => ({
        id: i,
        name: TEAM_STYLES[i % 8][0] + (i >= 8 ? " II" : ""),
        color: TEAM_STYLES[i % 8][1],
        icon: TEAM_STYLES[i % 8][2],
        capacity: practice
          ? 1
          : Math.floor(participants / count) +
            (i < participants % count ? 1 : 0),
        score: 0,
        energy: 12,
        sites: SITES.map((s) => ({
          ...s,
          level: 0,
          built: 0,
          reviewed: false,
          faults: 0,
          worktree: false,
          harness: false,
        })),
        jobs: [],
        log: [],
        stats: {
          deliveries: 0,
          safe: 0,
          unsafe: 0,
          conflicts: 0,
          reviews: 0,
          blocked: 0,
          incidents: 0,
        },
      })),
    };
    this.rooms.set(code, room);
    return room;
  }
  get(code) {
    const room = this.rooms.get(String(code).toUpperCase());
    check(room, "Sala não encontrada. Confira o código.", 404);
    return room;
  }
  join(room, { name, teamId }, key) {
    check(
      room.phase === "lobby",
      "A partida já começou. A escolha de time está encerrada.",
    );
    const clean =
      typeof name === "string"
        ? name
            .trim()
            .replace(/[\u0000-\u001f\u007f]/g, "")
            .slice(0, 22)
        : "";
    check(clean.length >= 2, "Use um nome com pelo menos 2 letras.");
    const team = room.teams.find((t) => t.id === teamId);
    check(team, "Escolha um time.");
    const existing = room.players.find((p) => p.key === key);
    check(
      room.players.filter((p) => p.teamId === teamId && p !== existing).length <
        team.capacity,
      "Esse time está cheio. Escolha outro.",
    );
    check(
      !room.players.some(
        (p) =>
          p !== existing &&
          p.name.toLocaleLowerCase("pt-BR") ===
            clean.toLocaleLowerCase("pt-BR"),
      ),
      "Esse nome já está na sala. Acrescente seu sobrenome.",
    );
    check(existing || room.players.length < room.participants, "Sala lotada.");
    if (existing) {
      existing.name = clean;
      existing.teamId = teamId;
      return existing;
    }
    const player = {
      id: token().slice(0, 12),
      key: token(),
      name: clean,
      teamId,
    };
    room.players.push(player);
    return player;
  }
  admin(room, key) {
    check(key === room.admin, "Somente o orquestrador pode fazer isso.", 403);
  }
  log(room, team, kind, title, body, siteId = null) {
    team.log.unshift({
      id: ++room.sequence,
      at: room.elapsed,
      kind,
      title,
      body,
      siteId,
    });
    team.log = team.log.slice(0, 12);
  }
  start(room, key) {
    this.admin(room, key);
    check(room.phase === "lobby", "Esta partida já começou.");
    check(
      room.teams.every((t) => room.players.some((p) => p.teamId === t.id)),
      "Cada time precisa de pelo menos uma pessoa.",
    );
    room.phase = "playing";
    room.lastTick = this.now();
    room.deadline = this.now() + room.duration * 1000;
    for (const team of room.teams)
      this.log(
        room,
        team,
        "info",
        "A Cidadela precisa de vocês",
        "Arraste um Construtor até uma frente. Depois revise a obra e faça a entrega.",
      );
  }
  playerTeam(room, key) {
    const player = room.players.find((p) => p.key === key);
    check(player, "Entre em uma guilda para jogar.", 403);
    return { player, team: room.teams[player.teamId] };
  }
  playable(room) {
    check(
      room.phase === "playing" && !room.paused,
      "A partida terminou ou está pausada.",
    );
  }
  play(room, key, cardId, siteId) {
    this.playable(room);
    const { player, team } = this.playerTeam(room, key);
    const card = CARDS.find((c) => c.id === cardId),
      site = team.sites.find((s) => s.id === siteId);
    check(card && site, "Selecione uma carta e uma construção.");
    check(
      site.level < STORY.maxLevel,
      "Essa construção já chegou ao nível máximo.",
    );
    check(
      team.energy + 1e-8 >= card.cost,
      "Contexto insuficiente. Aguarde a regeneração do time.",
    );
    if (cardId === "worktree")
      check(!site.worktree, "Esta frente já possui uma worktree.");
    if (cardId === "harness")
      check(!site.harness, "O harness já está protegendo esta frente.");
    if (cardId === "builder") {
      check(
        site.built < 100,
        "A construção está pronta. Envie um Revisor ou faça a entrega.",
      );
      check(
        !team.jobs.some((j) => j.siteId === siteId && j.cardId === "reviewer"),
        "Aguarde a revisão desta frente.",
      );
    }
    if (cardId === "reviewer") {
      check(
        site.built >= 100,
        "Construa primeiro. O Revisor precisa de uma obra pronta.",
      );
      check(!site.reviewed, "A obra já foi revisada. Faça a entrega.");
      check(
        !team.jobs.some((j) => j.siteId === siteId),
        "Aguarde os agentes terminarem nesta frente.",
      );
    }
    if (["builder", "reviewer"].includes(cardId))
      check(
        team.jobs.length < 3,
        "Os 3 agentes da guilda estão ocupados. Aguarde uma tarefa terminar.",
      );
    team.energy = Math.max(0, team.energy - card.cost);
    if (cardId === "worktree" || cardId === "harness") {
      site[cardId] = true;
      this.log(
        room,
        team,
        "good",
        `${player.name}: ${card.name} em ${site.name}`,
        card.lesson,
        siteId,
      );
      return;
    }
    const job = {
      id: ++room.sequence,
      cardId,
      siteId,
      playerName: player.name,
      startedAt: room.elapsed,
      endsAt:
        room.elapsed +
        (cardId === "builder"
          ? STORY.buildSeconds
          : STORY.reviewSeconds + site.faults * 3),
      conflict: false,
    };
    if (cardId === "builder") {
      const workspace = site.worktree ? site.id : "main";
      const collisions = team.jobs.filter(
        (j) =>
          j.cardId === "builder" &&
          (team.sites[j.siteId].worktree ? j.siteId : "main") === workspace,
      );
      if (collisions.length) {
        job.conflict = true;
        site.faults = Math.min(3, site.faults + 1);
        team.stats.conflicts++;
        for (const other of collisions) {
          other.conflict = true;
          const target = team.sites[other.siteId];
          target.faults = Math.min(3, target.faults + 1);
          target.reviewed = false;
        }
        this.log(
          room,
          team,
          "bad",
          "Conflito de arquivos!",
          site.worktree
            ? "Dois construtores editaram a mesma frente. Worktree separa frentes, não resolve sobreposição dentro delas."
            : "Agentes trabalharam no mesmo checkout. Cada construção afetada entrega só 75% do trabalho. Isole frentes com Worktree.",
          siteId,
        );
      } else
        this.log(
          room,
          team,
          "info",
          `${player.name} mobilizou um Construtor`,
          `${site.name}: o agente está a caminho. O time pode coordenar outra frente enquanto ele trabalha.`,
          siteId,
        );
    } else
      this.log(
        room,
        team,
        "info",
        `${player.name} pediu revisão`,
        `${site.name}: ${site.faults ? `${site.faults} falha(s) aumentam o tempo de revisão.` : "O sentinela vai validar a obra."}`,
        siteId,
      );
    team.jobs.push(job);
  }
  deliver(room, key, siteId) {
    this.playable(room);
    const { player, team } = this.playerTeam(room, key);
    const site = team.sites.find((s) => s.id === siteId);
    check(site, "Selecione uma construção.");
    check(site.level < STORY.maxLevel, "Essa frente já está concluída.");
    check(site.built >= 100, "A obra ainda não terminou.");
    check(
      !team.jobs.some((j) => j.siteId === siteId),
      "Aguarde os agentes desta frente terminarem.",
    );
    const safe = site.reviewed && site.faults === 0;
    if (site.harness && !safe) {
      team.stats.blocked++;
      this.log(
        room,
        team,
        "good",
        "O harness bloqueou a entrega",
        `${site.name}: falta revisão. O bloqueio não consome contexto nem gera pontos. Envie o Revisor.`,
        siteId,
      );
      return;
    }
    const points = safe ? STORY.scoreSafe : STORY.scoreUnsafe;
    team.score += points;
    team.stats.deliveries++;
    team.stats[safe ? "safe" : "unsafe"]++;
    site.level++;
    site.built = 0;
    site.reviewed = false;
    site.faults = 0;
    this.log(
      room,
      team,
      safe ? "score" : "bad",
      `${site.name} nível ${site.level} · +${points} pontos`,
      safe
        ? `${player.name} integrou uma entrega revisada. A construção evoluiu!`
        : "A obra foi entregue sem validação. A guilda perdeu a oportunidade dos 100 pontos deste nível. Revisão transforma trabalho em entrega confiável.",
      siteId,
    );
    if (
      room.teams.every((t) => t.sites.every((s) => s.level === STORY.maxLevel))
    )
      this.finish(room);
  }
  storm(room) {
    room.storms++;
    for (const team of room.teams) {
      const available = team.sites.filter((s) => s.level < STORY.maxLevel);
      if (!available.length) continue;
      const target = available[(room.storms - 1) % available.length];
      if (target.harness) {
        team.stats.blocked++;
        this.log(
          room,
          team,
          "good",
          "Comando do caos bloqueado",
          `${target.name}: as permissões do harness impediram uma alteração sem aprovação.`,
          target.id,
        );
      } else {
        target.faults = Math.min(3, target.faults + 1);
        target.reviewed = false;
        team.stats.incidents++;
        this.log(
          room,
          team,
          "bad",
          "O caos alterou a construção!",
          `${target.name} recebeu uma falha. Um Revisor pode corrigi-la. Worktree não restringe ferramentas: o Harness é quem bloqueia comandos indevidos.`,
          target.id,
        );
      }
    }
  }
  advance(room) {
    if (room.phase !== "playing" || room.paused) return false;
    const previous = room.elapsed,
      dt = Math.min(
        Math.max(0, (this.now() - room.lastTick) / 1000),
        room.duration - room.elapsed,
      ),
      end = previous + dt;
    room.lastTick = this.now();
    const events = [];
    for (const team of room.teams) {
      team.energy = Math.min(STORY.maxEnergy, team.energy + dt * STORY.regen);
      for (const job of team.jobs)
        if (job.endsAt <= end)
          events.push({ at: job.endsAt, team, job, order: 0 });
    }
    for (const fraction of [0.45, 0.75]) {
      const at = room.duration * fraction;
      if (previous < at && end >= at) events.push({ at, order: 1 });
    }
    // Process causally even after a delayed server tick: a storm before a review
    // must be repaired by that review, not applied afterwards.
    events.sort((a, b) => a.at - b.at || a.order - b.order);
    for (const event of events) {
      room.elapsed = event.at;
      if (!event.job) {
        this.storm(room);
        continue;
      }
      const { team, job } = event,
        site = team.sites[job.siteId];
      team.jobs = team.jobs.filter((j) => j.id !== job.id);
      if (job.cardId === "builder") {
        site.built = Math.min(100, site.built + (job.conflict ? 75 : 100));
        site.reviewed = false;
        this.log(
          room,
          team,
          job.conflict ? "bad" : "good",
          `${site.name}: construção ${site.built}%`,
          job.conflict
            ? "O conflito deixou trabalho incompleto. Isole a frente e envie outro Construtor."
            : "Obra pronta. Arraste um Revisor até ela para validar antes da entrega.",
          site.id,
        );
      } else {
        site.reviewed = true;
        site.faults = 0;
        team.stats.reviews++;
        this.log(
          room,
          team,
          "good",
          `${site.name}: revisão concluída`,
          "A obra foi validada. Selecione a construção e entregue para ganhar 100 pontos.",
          site.id,
        );
      }
    }
    room.elapsed = end;
    if (room.elapsed >= room.duration) this.finish(room);
    const second = Math.floor(room.elapsed),
      changed = second !== room.lastSecond || events.length > 0;
    room.lastSecond = second;
    return changed;
  }
  finish(room) {
    room.phase = "finished";
    room.deadline = null;
    room.paused = false;
    for (const team of room.teams) team.jobs = [];
  }
  action(room, key, action, body = {}) {
    this.advance(room);
    if (action === "play") this.play(room, key, body.cardId, body.siteId);
    else if (action === "deliver") this.deliver(room, key, body.siteId);
    else {
      this.admin(room, key);
      if (action === "start") this.start(room, key);
      else if (action === "pause") {
        check(room.phase === "playing", "Não há partida em andamento.");
        room.paused = !room.paused;
        room.lastTick = this.now();
        room.deadline = room.paused
          ? null
          : this.now() + (room.duration - room.elapsed) * 1000;
      } else if (action === "finish") {
        check(room.phase === "playing", "Não há partida em andamento.");
        this.finish(room);
      } else if (action === "remove") {
        check(
          room.phase === "lobby",
          "Só é possível remover pessoas antes da partida.",
        );
        room.players = room.players.filter((p) => p.id !== body.playerId);
      } else throw new GameError("Ação desconhecida.");
    }
  }
  tick() {
    const changed = [];
    for (const room of this.rooms.values()) {
      if (this.advance(room)) changed.push(room);
      if (this.now() - room.updated > 12 * 60 * 60 * 1000)
        this.rooms.delete(room.code);
    }
    return changed;
  }
  snapshot(room, key) {
    const player = room.players.find((p) => p.key === key);
    return {
      code: room.code,
      phase: room.phase,
      participants: room.participants,
      duration: room.duration,
      practice: room.practice,
      teams: room.teams,
      players: room.players.map(({ key, ...p }) => p),
      isAdmin: key === room.admin,
      me: player?.id ?? null,
      elapsed: room.elapsed,
      paused: room.paused,
      deadline: room.deadline,
      serverTime: this.now(),
      version: room.version,
      storms: room.storms,
      cards: CARDS,
      story: STORY,
      winners:
        room.phase === "finished"
          ? room.teams
              .filter(
                (t) => t.score === Math.max(...room.teams.map((t) => t.score)),
              )
              .map((t) => t.id)
          : [],
    };
  }
}
