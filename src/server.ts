import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { Arena } from "./game/arena.js";
import { GameError } from "./game/errors.js";
import type { Room } from "./game/room.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json",
  ".json": "application/json",
  ".gltf": "model/gltf+json",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * O que o navegador pode baixar.
 *
 * `dist/client` é a interface compilada; `assets` são modelos, fontes e a
 * Three.js versionada. Tudo o mais fica de fora — em especial `dist/content`,
 * que carrega o gabarito das perguntas, e `dist/game`, que carrega as regras.
 * Um teste verifica que esses caminhos respondem 404.
 */
const PUBLIC_DIRS = ["assets", "dist/client"].map((dir) => resolve(ROOT, dir));
const PUBLIC_FILES = [resolve(ROOT, "agent-arena.html")];

/** Uma conexão de eventos aberta com um navegador. */
interface Stream {
  readonly room: Room;
  readonly key: string | null;
  readonly response: http.ServerResponse;
}

const ROOM_ROUTE = /^\/api\/rooms\/([A-Z0-9]{5})$/i;
const EVENTS_ROUTE = /^\/api\/rooms\/([A-Z0-9]{5})\/events$/i;
const POST_ROUTE = /^\/api\/rooms\/([A-Z0-9]{5})\/(join|action)$/i;

const MAX_BODY = 4096;
const TICK_MS = 250;
const HEARTBEAT_MS = 15_000;

/**
 * O servidor da arena: uma API pequena, um stream de eventos por navegador e
 * os arquivos estáticos do jogo. Usa apenas a biblioteca padrão do Node.
 */
export class ArenaServer {
  readonly arena = new Arena();
  readonly server: http.Server;
  private readonly streams = new Set<Stream>();
  private readonly timers: NodeJS.Timeout[] = [];

  constructor() {
    this.server = http.createServer((request, response) => {
      void this.handle(request, response);
    });
    this.timers.push(
      setInterval(() => {
        for (const room of this.arena.tick()) this.publish(room);
      }, TICK_MS),
      setInterval(() => {
        for (const stream of this.streams) stream.response.write(": heartbeat\n\n");
      }, HEARTBEAT_MS),
    );
    for (const timer of this.timers) timer.unref();
    this.server.on("close", () => {
      for (const timer of this.timers) clearInterval(timer);
      for (const stream of this.streams) stream.response.end();
    });
  }

  /** Manda o estado novo para todo mundo que está olhando aquela sala. */
  private publish(room: Room): void {
    room.version++;
    room.updated = Date.now();
    for (const stream of this.streams)
      if (stream.room === room)
        stream.response.write(
          `data: ${JSON.stringify(room.snapshot(stream.key ?? undefined))}\n\n`,
        );
  }

  private async handle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ): Promise<void> {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        await this.api(request, response, url);
        return;
      }
      await this.static(request, response, url);
    } catch (error) {
      this.fail(response, error);
    }
  }

  // ── API ────────────────────────────────────────────────────────────────────

  private async api(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    url: URL,
  ): Promise<void> {
    if (request.method === "POST") return this.post(request, response, url);
    if (request.method === "GET") return this.get(request, response, url);
    throw new GameError("Método não permitido.", 405);
  }

  private async post(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    url: URL,
  ): Promise<void> {
    const origin = request.headers.origin;
    if (origin && new URL(origin).host !== request.headers.host)
      throw new GameError("Origem não permitida.", 403);
    const body = await readJson(request);

    if (url.pathname === "/api/rooms") {
      const room = this.arena.create(body);
      let key = room.admin;
      if (body.practice) {
        const player = this.arena.join(room, { name: "Você", teamId: 0 });
        key = player.key;
      }
      this.json(response, 201, {
        key,
        adminKey: body.practice ? room.admin : undefined,
        state: room.snapshot(key),
      });
      return;
    }

    const match = POST_ROUTE.exec(url.pathname);
    if (!match) throw new GameError("Rota não encontrada.", 404);
    const room = this.arena.get(match[1]);
    const key = bearer(request);

    if (match[2] === "join") {
      const player = this.arena.join(room, body, key);
      this.publish(room);
      this.json(response, 200, {
        key: player.key,
        state: room.snapshot(player.key),
      });
      return;
    }

    let result: unknown;
    try {
      result = this.arena.action(room, key, String(body.action), body);
    } finally {
      this.publish(room);
    }
    this.json(response, 200, { state: room.snapshot(key), result });
  }

  private async get(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    url: URL,
  ): Promise<void> {
    if (url.pathname === "/api/connection") {
      this.json(response, 200, { joinBase: this.joinBase(request) });
      return;
    }

    const events = EVENTS_ROUTE.exec(url.pathname);
    if (events) {
      const room = this.arena.get(events[1]);
      const key = url.searchParams.get("key");
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      response.write(
        `data: ${JSON.stringify(room.snapshot(key ?? undefined))}\n\n`,
      );
      const stream: Stream = { room, key, response };
      this.streams.add(stream);
      request.on("close", () => this.streams.delete(stream));
      return;
    }

    const single = ROOM_ROUTE.exec(url.pathname);
    if (!single) throw new GameError("Rota não encontrada.", 404);
    const room = this.arena.get(single[1]);
    this.json(response, 200, { state: room.snapshot(bearer(request)) });
  }

  /** Endereço que os celulares devem abrir para entrar na sala. */
  private joinBase(request: http.IncomingMessage): string {
    if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;
    const host = request.headers.host ?? "";
    const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
    const address = localAddresses()[0];
    const port = (this.server.address() as { port?: number } | null)?.port;
    return local && address ? `http://${address}:${port}` : `http://${host}`;
  }

  // ── Arquivos ───────────────────────────────────────────────────────────────

  private async static(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    url: URL,
  ): Promise<void> {
    if (request.method !== "GET" && request.method !== "HEAD")
      throw new GameError("Método não permitido.", 405);
    const path =
      url.pathname === "/" ? "/agent-arena.html" : decodeURIComponent(url.pathname);
    const file = resolve(ROOT, "." + path);
    const allowed =
      PUBLIC_FILES.includes(file) ||
      PUBLIC_DIRS.some((dir) => file.startsWith(dir + sep));
    if (!allowed) throw new GameError("Arquivo não encontrado.", 404);
    const info = await stat(file);
    if (!info.isFile()) throw new GameError("Arquivo não encontrado.", 404);
    response.writeHead(200, {
      "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
      // no-store: proxies (Cloudflare) must not keep a stale copy of JS/HTML
      // after the origin changes — a cached 404 from another host blanked the game.
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : await readFile(file));
  }

  // ── Respostas ──────────────────────────────────────────────────────────────

  private json(
    response: http.ServerResponse,
    status: number,
    data: unknown,
  ): void {
    response.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(data));
  }

  private fail(response: http.ServerResponse, error: unknown): void {
    if (response.headersSent) {
      response.end();
      return;
    }
    const missing = (error as NodeJS.ErrnoException)?.code === "ENOENT";
    const status =
      error instanceof GameError ? error.status : missing ? 404 : 500;
    const message =
      error instanceof GameError
        ? error.message
        : missing
          ? "Arquivo não encontrado."
          : "Erro no servidor.";
    this.json(response, status, { error: message });
  }
}

function bearer(request: http.IncomingMessage): string | undefined {
  return request.headers.authorization?.replace(/^Bearer /, "");
}

async function readJson(
  request: http.IncomingMessage,
): Promise<Record<string, any>> {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > MAX_BODY) throw new GameError("Pedido muito grande.", 413);
  }
  let body: unknown;
  try {
    body = JSON.parse(text || "{}");
  } catch {
    throw new GameError("Pedido inválido.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new GameError("Pedido inválido.");
  return body as Record<string, any>;
}

/** Endereços IPv4 desta máquina, com as interfaces cabeadas na frente. */
function localAddresses(): string[] {
  return Object.entries(networkInterfaces())
    .sort(([a], [b]) => Number(!/^en/.test(a)) - Number(!/^en/.test(b)))
    .flatMap(([, list]) => list ?? [])
    .filter((net) => net.family === "IPv4" && !net.internal)
    .map((net) => net.address);
}

/** Mantém a forma que os testes e o `npm start` já usavam. */
export function createServer(): { server: http.Server; arena: Arena } {
  const instance = new ArenaServer();
  return { server: instance.server, arena: instance.arena };
}

const entry = process.argv[1] ? resolve(process.argv[1]) : "";
if (entry === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8080;
  const { server } = createServer();
  server.on("error", (error: NodeJS.ErrnoException) => {
    console.error(
      error.code === "EADDRINUSE"
        ? `A porta ${port} já está em uso. Escolha outra: PORT=${port + 1} npm start`
        : error.message,
    );
    process.exitCode = 1;
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`Agent Arena: http://localhost:${port}`);
    for (const address of localAddresses())
      console.log(`Celulares na mesma rede: http://${address}:${port}`);
    console.log("Mantenha este terminal aberto durante a partida.");
  });
}
