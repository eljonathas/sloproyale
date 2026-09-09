const canvas = document.querySelector("#game"),
  ctx = canvas.getContext("2d");
const input = document.querySelector("#text-entry"),
  announcer = document.querySelector("#announcer");
const C = {
  cream: "#fff2d0",
  gold: "#ffd17c",
  goldDark: "#9f682f",
  ink: "#112237",
  panel: "#1d344b",
  line: "#4b6477",
  muted: "#b4c9d6",
  blue: "#62bcff",
  green: "#8be3ac",
  red: "#ff947c",
};
let W = 1440,
  H = 900,
  scale = 1,
  ox = 0,
  oy = 0,
  mobile = false,
  world = null,
  worldError = false,
  screen = "home",
  modal = null,
  state = null,
  key = "",
  adminKey = "",
  connection = null,
  connected = true,
  busy = false;
let controls = [],
  hover = "",
  focus = "",
  pointer = { x: -1, y: -1 },
  frame = 0,
  time = 0,
  offset = 0,
  selection = null,
  teamSelection = 0,
  page = 0,
  rosterPage = 0;
let fields = {
    name: "",
    code: "",
    participants: 24,
    teamSize: 6,
    duration: 180,
  },
  editing = null,
  toast = null,
  sound = false,
  audio = null,
  confirm = null,
  animation = 0;
let selectedSite = 0,
  watchTeam = 0,
  drag = null;
let inviteBase = location.origin;
let saved = null;
try {
  saved = JSON.parse(sessionStorage.getItem("arena-session"));
} catch {}
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const roleCards = [
  ["Knight", "Orquestrador", "Divide e consolida", "crown", "#70b8f2"],
  ["Barbarian", "Construtor", "Implementa a missão", "tools", "#f5b779"],
  ["Rogue_Hooded", "Explorador", "Investiga o contexto", "branch", "#8cddb6"],
  ["Mage", "Sentinela", "Revisa e protege", "shield", "#c4a2ff"],
];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function resize() {
  mobile = innerWidth < 800;
  W = mobile ? 430 : 1440;
  scale = mobile
    ? innerWidth / W
    : Math.min(innerWidth / 1440, innerHeight / 900);
  H = mobile ? Math.max(730, innerHeight / scale) : 900;
  ox = (innerWidth - W * scale) / 2;
  oy = mobile ? 0 : (innerHeight - H * scale) / 2;
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize);
resize();
function round(x, y, w, h, r = 12) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function rect(x, y, w, h, fill, r = 12, stroke = null) {
  round(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
function grad(x, y, w, h, a, b, r = 12, stroke = null) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  rect(x, y, w, h, g, r, stroke);
}
function text(
  str,
  x,
  y,
  size = 18,
  color = C.cream,
  align = "left",
  weight = 700,
  font = "Nunito",
) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(String(str), x, y);
}
function display(str, x, y, size = 38, color = C.cream, align = "left") {
  ctx.font = `${size}px Lilita`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#112032";
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeText(str, x, y + 3);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}
function wrap(str, x, y, w, size = 18, color = C.muted, line = 26, max = 10) {
  ctx.font = `700 ${size}px Nunito`;
  const words = String(str).split(" ");
  let row = "",
    n = 0;
  for (const word of words) {
    const test = row ? row + " " + word : word;
    if (ctx.measureText(test).width > w && row) {
      text(row, x, y + n * line, size, color);
      n++;
      row = word;
      if (n >= max) return y + n * line;
    } else row = test;
  }
  if (row) text(row, x, y + n * line, size, color);
  return y + (n + 1) * line;
}
function line(x, y, x2, y2, color = C.line, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function icon(name, x, y, size = 32, color = C.gold) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 40, size / 40);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (name === "shield") {
    ctx.moveTo(-14, -16);
    ctx.lineTo(14, -16);
    ctx.lineTo(13, 4);
    ctx.quadraticCurveTo(10, 14, 0, 20);
    ctx.quadraticCurveTo(-10, 14, -13, 4);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-1, 5);
    ctx.lineTo(7, -5);
    ctx.stroke();
  } else if (name === "crown") {
    ctx.moveTo(-17, -9);
    ctx.lineTo(-13, 12);
    ctx.lineTo(13, 12);
    ctx.lineTo(17, -9);
    ctx.lineTo(7, -2);
    ctx.lineTo(0, -16);
    ctx.lineTo(-7, -2);
    ctx.closePath();
    ctx.fill();
    line(-11, 17, 11, 17, color, 3);
  } else if (name === "branch") {
    line(-9, -14, -9, 14, color, 3);
    line(-9, 7, 11, -5, color, 3);
    for (const [a, b] of [
      [-9, -15],
      [-9, 15],
      [11, -9],
    ]) {
      ctx.beginPath();
      ctx.arc(a, b, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (name === "swords" || name === "tools") {
    for (const a of [-0.7, 0.7]) {
      ctx.save();
      ctx.rotate(a);
      rect(-2.5, -19, 5, 27, color, 1);
      line(-8, 7, 8, 7, color, 3);
      line(0, 8, 0, 17, color, 4);
      ctx.restore();
    }
  } else if (name === "mage") {
    ctx.moveTo(0, -19);
    ctx.lineTo(-14, 11);
    ctx.lineTo(14, 11);
    ctx.closePath();
    ctx.fill();
    line(-18, 16, 18, 16, color, 4);
    ctx.fillStyle = C.panel;
    ctx.beginPath();
    ctx.arc(1, 3, 2.5, 0, 7);
    ctx.fill();
  } else if (name === "scroll") {
    round(-13, -16, 26, 32, 4);
    ctx.stroke();
    for (let i = -7; i <= 7; i += 7) line(-7, i, 7, i, color, 2);
  } else if (name === "hourglass") {
    line(-12, -17, 12, -17, color, 3);
    line(-12, 17, 12, 17, color, 3);
    ctx.moveTo(-10, -15);
    ctx.lineTo(10, 15);
    ctx.lineTo(-10, 15);
    ctx.lineTo(10, -15);
    ctx.closePath();
    ctx.stroke();
  } else if (name === "people") {
    for (const x of [-9, 9]) {
      ctx.beginPath();
      ctx.arc(x, -7, 5, 0, 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, 13, 10, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  } else if (name === "check") {
    ctx.moveTo(-12, 0);
    ctx.lineTo(-3, 10);
    ctx.lineTo(14, -11);
    ctx.stroke();
  } else if (name === "sound") {
    ctx.moveTo(-15, -5);
    ctx.lineTo(-7, -5);
    ctx.lineTo(2, -14);
    ctx.lineTo(2, 14);
    ctx.lineTo(-7, 5);
    ctx.lineTo(-15, 5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3, 0, 13, -0.8, 0.8);
    ctx.stroke();
  } else if (name === "expand") {
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(5, -15);
      ctx.lineTo(15, -15);
      ctx.lineTo(15, -5);
      ctx.stroke();
      ctx.restore();
    }
  } else if (name === "gem") {
    ctx.moveTo(0, -19);
    ctx.lineTo(14, 0);
    ctx.lineTo(0, 19);
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    text("?", 0, 0, 28, color, "center", 900);
  }
  ctx.restore();
}
function shield(x, y, size, color, mark = "crown") {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 60, size / 60);
  ctx.shadowColor = "#061322";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  ctx.beginPath();
  ctx.moveTo(-27, -29);
  ctx.lineTo(27, -29);
  ctx.lineTo(25, 5);
  ctx.quadraticCurveTo(20, 25, 0, 36);
  ctx.quadraticCurveTo(-20, 25, -25, 5);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -30, 0, 36);
  g.addColorStop(0, color);
  g.addColorStop(1, "#25384b");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = "#e8c68c";
  ctx.lineWidth = 3;
  ctx.stroke();
  icon(mark, 0, -1, 31, C.cream);
  ctx.restore();
}
function panel(x, y, w, h, title = null) {
  ctx.save();
  ctx.shadowColor = "#06132688";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 9;
  grad(x, y, w, h, "#29435a", "#14283d", 17, "#698090");
  ctx.restore();
  rect(x + 5, y + 5, w - 10, 3, "#ffffff0d", 2);
  if (title) {
    display(title, x + 24, y + 32, 26);
    line(x + 20, y + 58, x + w - 20, y + 58, "#6c83943b");
  }
}
function hit(id, x, y, w, h, label, fn, disabled = false) {
  controls.push({ id, x, y, w, h, label, fn, disabled });
  if ((focus === id || hover === id) && !disabled) {
    round(x - 3, y - 3, w + 6, h + 6, 13);
    ctx.strokeStyle = focus === id ? "#fff4c6" : "#ffe3a6aa";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
function button(
  id,
  x,
  y,
  w,
  h,
  label,
  fn,
  { kind = "gold", disabled = false, small = false, ico = null } = {},
) {
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.42;
  const active = (hover === id || focus === id) && !disabled;
  const y2 = y + (active ? -2 : 0);
  const palettes = {
    gold: ["#ffdc86", "#e6a945", "#80542c"],
    blue: ["#6ac5fc", "#2b87c8", "#16476f"],
    dark: ["#36516a", "#243b50", "#132639"],
    green: ["#a5eaba", "#5bba83", "#286343"],
    red: ["#ee9d89", "#c0645b", "#6a363d"],
  };
  const p = palettes[kind];
  rect(x, y2 + 5, w, h, p[2], 12, "#0b192a");
  grad(
    x,
    y2,
    w,
    h,
    p[0],
    p[1],
    12,
    kind === "dark" ? "#748ca066" : "#fff0c577",
  );
  line(x + 12, y2 + 3, x + w - 12, y2 + 3, "#ffffff55");
  text(
    label,
    x + w / 2 + (ico ? 10 : 0),
    y2 + h / 2,
    small ? 14 : 18,
    kind === "dark" ? C.cream : "#1e3547",
    "center",
    900,
  );
  if (ico)
    icon(ico, x + 26, y2 + h / 2, 23, kind === "dark" ? C.gold : "#234253");
  ctx.restore();
  hit(id, x, y, w, h, label, fn, disabled);
}
function pill(label, x, y, color = C.gold, w = null) {
  ctx.font = "800 12px Nunito";
  w = w || ctx.measureText(label).width + 28;
  rect(x, y, w, 28, "#0d2035d9", 14, color + "55");
  text(label, x + w / 2, y + 14, 12, color, "center", 900);
}
function notify(message, error = false) {
  toast = { message, error, until: performance.now() + 5000 };
  announcer.textContent = message;
  if (error) tone(false);
}
function tone(ok = true) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    audio.resume();
    const t = audio.currentTime;
    [ok ? 440 : 190, ok ? 660 : 150].forEach((hz, i) => {
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.type = "sine";
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.035, t + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2 + i * 0.08);
      o.connect(g);
      g.connect(audio.destination);
      o.start(t + i * 0.08);
      o.stop(t + 0.25 + i * 0.08);
    });
  } catch {}
}
function field(id, label, x, y, w, value, max = 22) {
  text(label, x, y, 14, C.muted);
  rect(x, y + 18, w, 50, "#102338", 9, editing === id ? C.gold : "#60798d");
  text(
    value || (id === "name" ? "Seu nome" : id === "code" ? "ABCDE" : ""),
    x + 16,
    y + 43,
    20,
    value ? C.cream : "#718da3",
  );
  if (editing === id && Math.floor(time / 500) % 2 === 0) {
    ctx.font = "700 20px Nunito";
    const length = ctx.measureText(String(value)).width;
    line(x + 17 + length, y + 30, x + 17 + length, y + 55, C.gold, 2);
  }
  hit(id, x, y + 18, w, 50, label, () => {
    editing = id;
    input.value = String(fields[id]);
    input.maxLength = max;
    input.inputMode = id === "code" ? "text" : "text";
    input.setAttribute("aria-label", label);
    input.focus({ preventScroll: true });
  });
}
input.addEventListener("input", () => {
  if (editing)
    fields[editing] =
      editing === "code"
        ? input.value
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 5)
        : input.value.slice(0, 22);
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === "Escape") {
    input.blur();
    editing = null;
    canvas.focus();
  }
});
input.addEventListener("blur", () => (editing = null));
function remember() {
  try {
    sessionStorage.setItem(
      "arena-session",
      JSON.stringify({ code: state.code, key, adminKey }),
    );
  } catch {}
}
async function api(path, body, credential = key) {
  const r = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(credential ? { Authorization: "Bearer " + credential } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await r.json();
  if (!r.ok)
    throw new Error(result.error || "Não foi possível completar a ação.");
  return result;
}
function apply(next) {
  const changed = state?.phase !== next.phase;
  const previous = viewTeam()?.score ?? 0;
  state = next;
  offset = next.serverTime - Date.now();
  screen =
    next.phase === "lobby"
      ? "lobby"
      : next.phase === "finished"
        ? "results"
        : "battle";
  if (changed) {
    selection = null;
    selectedSite = 0;
    modal = null;
    animation = time;
    announcer.textContent =
      next.phase === "playing"
        ? next.story.description
        : next.phase === "finished"
          ? "A partida terminou. Veja as guildas vencedoras."
          : "Escolha sua guilda.";
  }
  if ((viewTeam()?.score ?? 0) > previous) {
    world?.celebrate();
    tone(true);
  }
}
function subscribe() {
  connection?.close();
  connection = new EventSource(
    `/api/rooms/${state.code}/events?key=${encodeURIComponent(key)}`,
  );
  connection.onmessage = (e) => {
    connected = true;
    apply(JSON.parse(e.data));
  };
  connection.onerror = () => {
    connected = false;
  };
  connection.onopen = () => (connected = true);
}
async function create(practice = false) {
  await work(async () => {
    const result = await api(
      "/api/rooms",
      {
        participants: fields.participants,
        teamSize: fields.teamSize,
        duration: fields.duration,
        practice,
      },
      "",
    );
    key = result.key;
    adminKey = result.adminKey || "";
    apply(result.state);
    remember();
    subscribe();
    if (practice) await action("start");
  });
}
async function lookup(code = fields.code) {
  await work(async () => {
    const result = await api("/api/rooms/" + code.toUpperCase(), null, "");
    key = "";
    adminKey = "";
    apply(result.state);
    teamSelection = 0;
    page = 0;
    subscribe();
    history.replaceState({}, "", `?room=${state.code}`);
  });
}
async function join() {
  await work(async () => {
    const result = await api(`/api/rooms/${state.code}/join`, {
      name: fields.name,
      teamId: teamSelection,
    });
    key = result.key;
    apply(result.state);
    remember();
    subscribe();
    tone(true);
    notify("Você entrou na guilda " + state.teams[teamSelection].name + ".");
  });
}
async function action(name, body = {}) {
  const result = await api(
    `/api/rooms/${state.code}/action`,
    { action: name, ...body },
    adminKey || key,
  );
  if (adminKey) {
    const own = await api(`/api/rooms/${state.code}`, null, key);
    apply(own.state);
  } else apply(result.state);
}
async function work(fn) {
  if (busy) return;
  busy = true;
  try {
    await fn();
  } catch (e) {
    notify(e.message || "Sem conexão com a arena.", true);
  } finally {
    busy = false;
  }
}
function doAction(name, body) {
  work(() => action(name, body));
}
function leave() {
  connection?.close();
  connection = null;
  state = null;
  screen = "home";
  modal = null;
  key = "";
  adminKey = "";
  history.replaceState({}, "", "/");
}
function isHost() {
  return state?.isAdmin || Boolean(adminKey);
}
async function copyInvite() {
  const url = `${inviteBase}/?room=${state.code}`;
  try {
    await navigator.clipboard.writeText(url);
    notify("Link copiado. Envie para a turma.");
  } catch {
    notify(`Endereço: ${new URL(inviteBase).host} · sala ${state.code}`);
  }
}
function topbar() {
  const y = mobile ? 27 : 39;
  shield(mobile ? 31 : 52, y, mobile ? 25 : 31, C.blue, "crown");
  display("AGENT ARENA", mobile ? 54 : 79, y, mobile ? 22 : 25);
  if (state) {
    pill(
      state.practice ? "Treino" : `Sala ${state.code}`,
      mobile ? 238 : 295,
      y - 14,
      C.gold,
      mobile ? 111 : 130,
    );
    if (!mobile) {
      text(
        state.phase === "lobby"
          ? "A Cidadela dos Agentes"
          : "A reconstrução da Cidadela",
        W / 2,
        y,
        16,
        C.muted,
        "center",
      );
    }
  } else if (!mobile)
    text("A Cidadela dos Agentes", W / 2, y, 16, C.muted, "center");
  const tools = mobile
    ? [["help", "?", () => (modal = "rules")]]
    : [
        [
          "sound",
          sound ? "Som ligado" : "Som desligado",
          () => {
            sound = !sound;
            if (sound) tone();
          },
        ],
        [
          "expand",
          "Tela cheia",
          () => {
            if (document.fullscreenElement) document.exitFullscreen?.();
            else document.documentElement.requestFullscreen?.().catch(() => {});
          },
        ],
        ["help", "Como jogar", () => (modal = "rules")],
      ];
  tools.forEach(([ico, label, fn], i) => {
    const x = W - (tools.length - i) * 49 - 20;
    rect(x, y - 19, 38, 38, "#12263d88", 10, "#7896ab44");
    icon(ico, x + 19, y, 21, C.muted);
    if (ico === "sound" && !sound)
      line(x + 10, y + 10, x + 28, y - 10, C.muted, 2);
    hit("tool-" + ico, x, y - 19, 38, 38, label, fn);
  });
  line(24, mobile ? 59 : 77, W - 24, mobile ? 59 : 77, "#a7bed71c");
}
function portrait(name, x, y, w, h) {
  const img = world?.portraits[name];
  if (img?.complete && img.naturalWidth) {
    ctx.drawImage(img, x, y, w, h);
  } else
    icon(
      roleCards.find((r) => r[0] === name)?.[3] || "shield",
      x + w / 2,
      y + h * 0.48,
      Math.min(w, h) * 0.5,
      C.gold,
    );
}
function home() {
  if (mobile) {
    pill("UMA MISSÃO. VÁRIAS MENTES.", 112, 78, C.gold, 206);
    display("AGENT ARENA", W / 2, 135, 49, C.cream, "center");
    text(
      "Reconstrua a Cidadela dos Agentes.",
      W / 2,
      176,
      16,
      C.muted,
      "center",
    );
    pill("A Cidadela espera pela sua guilda", 99, 365, C.cream, 232);
    const y = Math.max(425, H - 340);
    button(
      "create",
      26,
      y,
      W - 52,
      57,
      "Criar uma arena",
      () => (modal = "setup"),
      { ico: "crown" },
    );
    button(
      "join",
      26,
      y + 76,
      W - 52,
      57,
      "Entrar com código",
      () => (modal = "join"),
      { kind: "blue", ico: "shield" },
    );
    button(
      "practice",
      95,
      y + 152,
      W - 190,
      43,
      "Treinar sozinho",
      () => create(true),
      { kind: "dark", small: true },
    );
    text(
      "Agentes em campo  •  contexto compartilhado  •  uma conquista",
      W / 2,
      H - 65,
      12,
      C.muted,
      "center",
    );
    text(
      "Inspirado em estratégia. Movido por conhecimento.",
      W / 2,
      H - 39,
      11,
      "#7996ab",
      "center",
    );
  } else {
    pill("ESTRATÉGIA EM EQUIPE", 77, 137, C.gold, 186);
    display("AGENT", 73, 223, 99);
    display("ARENA", 73, 314, 112, C.gold);
    text(
      "O reino precisa de boas decisões.",
      80,
      393,
      24,
      C.cream,
      "left",
      800,
    );
    wrap(
      "Reúna sua guilda. Comande os agentes. Reconstrua a Cidadela antes que o caos alcance os portões.",
      80,
      439,
      410,
      18,
      C.muted,
      27,
    );
    button(
      "create",
      80,
      551,
      360,
      61,
      "Criar uma arena",
      () => (modal = "setup"),
      { ico: "crown" },
    );
    button(
      "join",
      80,
      632,
      223,
      51,
      "Entrar com código",
      () => (modal = "join"),
      { kind: "blue", small: true },
    );
    button("practice", 316, 632, 124, 51, "Treinar", () => create(true), {
      kind: "dark",
      small: true,
    });
    pill("A CIDADELA DOS AGENTES", 888, 137, C.cream, 220);
    pill("DECISÕES CONSTROEM REINOS", 827, 638, C.gold, 262);
    const start = 530;
    roleCards.forEach(([name, title, desc, ico, color], i) => {
      const x = start + i * 211,
        y = 729;
      panel(x, y, 194, 117);
      rect(x + 7, y + 7, 180, 3, color, 2);
      portrait(name, x + 6, y + 13, 77, 90);
      text(title, x + 81, y + 46, 14, C.cream);
      wrap(desc, x + 81, y + 70, 104, 11, C.muted, 15);
    });
    text("Estratégia em tempo real", 80, 753, 17, C.gold);
    text("4–80 participantes", 80, 782, 16, C.muted);
    text("Uma guilda vencedora. Um brinde de verdade.", 80, 823, 13, C.muted);
    text("Modelos KayKit · CC0", W - 38, 879, 11, "#839eac", "right");
  }
}
function stepper(id, label, value, x, y, w, min, max, step = 1) {
  text(label, x, y, 16, C.muted);
  button(
    id + "-",
    x,
    y + 22,
    48,
    43,
    "−",
    () => (fields[id] = clamp(fields[id] - step, min, max)),
    { kind: "dark", disabled: value <= min },
  );
  display(String(value), x + w / 2, y + 44, 28);
  button(
    id + "+",
    x + w - 48,
    y + 22,
    48,
    43,
    "+",
    () => (fields[id] = clamp(fields[id] + step, min, max)),
    { kind: "dark", disabled: value >= max },
  );
}
function modalBox(title, w = 660, h = 600) {
  const x = (W - w) / 2,
    y = (H - h) / 2;
  rect(0, 0, W, H, "#051224cf", 0);
  panel(x, y, w, h, title);
  button(
    "close",
    x + w - 54,
    y + 14,
    36,
    32,
    "×",
    () => {
      modal = null;
      editing = null;
      input.blur();
    },
    { kind: "dark" },
  );
  return { x, y, w, h };
}
function drawModal() {
  if (!modal) return;
  controls = [];
  if (modal === "setup") {
    const { x, y, w, h } = modalBox(
      "Preparar a arena",
      mobile ? 398 : 650,
      mobile ? 617 : 606,
    );
    wrap(
      "Você será o orquestrador geral: abre a sala, acompanha as guildas e controla o tempo da partida.",
      x + 26,
      y + 91,
      w - 52,
      16,
      C.muted,
      24,
    );
    stepper(
      "participants",
      "Participantes",
      fields.participants,
      x + 27,
      y + 169,
      (w - 78) / 2,
      4,
      80,
    );
    stepper(
      "teamSize",
      "Pessoas por time",
      fields.teamSize,
      x + 51 + (w - 78) / 2,
      y + 169,
      (w - 78) / 2,
      2,
      8,
    );
    const count = Math.max(2, Math.ceil(fields.participants / fields.teamSize));
    rect(x + 25, y + 260, w - 50, 83, "#0d2336", 12, "#819baf33");
    shield(x + 59, y + 300, 37, C.blue, "people");
    display(`${count} guildas`, x + 91, y + 286, 27, C.gold);
    text(
      "Vagas distribuídas de forma equilibrada",
      x + 91,
      y + 317,
      mobile ? 11 : 14,
      C.muted,
    );
    text("Duração da partida", x + 27, y + 374, 15, C.muted);
    [180, 240, 300, 420].forEach((v, i) =>
      button(
        "duration-" + v,
        x + 27 + (i * (w - 54)) / 4,
        y + 396,
        (w - 70) / 4,
        42,
        v / 60 + " min",
        () => (fields.duration = v),
        { kind: fields.duration === v ? "gold" : "dark", small: true },
      ),
    );
    wrap(
      "3 construções · 3 níveis por construção · entregas revisadas valem 100 pontos",
      x + 27,
      y + 474,
      w - 54,
      14,
      C.muted,
      20,
    );
    button(
      "open-room",
      x + 26,
      y + h - 77,
      w - 52,
      51,
      busy ? "Abrindo…" : "Abrir sala para a turma",
      () => create(),
      { disabled: busy || count > 16, ico: "crown" },
    );
    if (count > 16)
      text(
        "Máximo de 16 guildas. Aumente pessoas por time.",
        x + w / 2,
        y + h - 92,
        12,
        C.red,
        "center",
      );
  } else if (modal === "join") {
    const { x, y, w } = modalBox(
      "Entre na sua guilda",
      mobile ? 398 : 540,
      375,
    );
    wrap(
      "Digite o código que aparece na arena do apresentador.",
      x + 26,
      y + 92,
      w - 52,
      17,
      C.muted,
      25,
    );
    field("code", "Código da sala", x + 26, y + 153, w - 52, fields.code, 5);
    button(
      "find-room",
      x + 26,
      y + 280,
      w - 52,
      54,
      busy ? "Procurando…" : "Ver as guildas",
      () => lookup(),
      { kind: "blue", disabled: fields.code.length !== 5 || busy },
    );
  } else if (modal === "rules") {
    const { x, y, w, h } = modalBox(
      "Como conquistar a Cidadela",
      mobile ? 398 : 740,
      mobile ? 690 : 620,
    );
    const rules = [
      [
        "crown",
        "1. Reúna sua guilda",
        "O admin define o tamanho da turma. Cada pessoa escolhe uma guilda com vagas antes do início.",
      ],
      [
        "tools",
        "2. Mobilize seus agentes",
        "Arraste Construtor até Portal, Forja ou Muralha. Ele caminha e trabalha por 12 segundos. Depois, envie Revisor.",
      ],
      [
        "shield",
        "3. Coordene as frentes",
        "Worktree separa os arquivos; Harness bloqueia ações sem permissão. O contexto é compartilhado e se regenera.",
      ],
      [
        "gem",
        "4. Entregue e conquiste",
        "Selecione a obra pronta e toque em Entregar. Revisada: 100 pontos. Sem revisão: 40. O maior placar ganha o brinde.",
      ],
    ];
    let yy = y + 96;
    for (const [ico, title, body] of rules) {
      icon(ico, x + 45, yy + 12, 29, C.gold);
      text(title, x + 77, yy, 17, C.cream);
      yy =
        wrap(
          body,
          x + 77,
          yy + 27,
          w - 106,
          mobile ? 14 : 16,
          C.muted,
          mobile ? 21 : 23,
        ) + 26;
    }
    wrap(
      "São 3 agentes e 12 de contexto por guilda, qualquer que seja o tamanho do time. Máximo: 900 pontos. Empate final: vitória compartilhada.",
      x + 27,
      yy,
      w - 54,
      13,
      C.gold,
      19,
    );
    button(
      "understood",
      x + 26,
      y + h - 72,
      w - 52,
      47,
      "Vamos à arena",
      () => (modal = null),
      { kind: "blue" },
    );
  } else if (modal === "roster") {
    const { x, y, w, h } = modalBox(
      "Guildas na arena",
      mobile ? 398 : 650,
      Math.min(H - 40, 700),
    );
    const people = state.players.slice(rosterPage * 8, rosterPage * 8 + 8);
    people.forEach((p, i) => {
      const yy = y + 93 + i * 55,
        t = state.teams[p.teamId];
      shield(x + 45, yy, 26, t.color, t.icon);
      text(p.name, x + 75, yy - 7, 16);
      text(t.name, x + 75, yy + 13, 12, t.color);
      if (isHost() && state.phase === "lobby")
        button(
          "remove-" + p.id,
          x + w - 112,
          yy - 18,
          87,
          32,
          "Remover",
          () => {
            confirm = {
              title: "Remover participante?",
              body: `${p.name} perderá sua vaga e poderá entrar novamente antes da partida.`,
              run: () => doAction("remove", { playerId: p.id }),
            };
            modal = "confirm";
          },
          { kind: "dark", small: true },
        );
    });
    if (!people.length)
      text(
        "Aguardando os primeiros participantes.",
        x + w / 2,
        y + 130,
        16,
        C.muted,
        "center",
      );
    if (state.players.length > 8) {
      button(
        "prev-roster",
        x + 26,
        y + h - 74,
        80,
        42,
        "←",
        () => (rosterPage = Math.max(0, rosterPage - 1)),
        { kind: "dark", disabled: rosterPage === 0 },
      );
      text(
        `${rosterPage + 1} / ${Math.ceil(state.players.length / 8)}`,
        x + w / 2,
        y + h - 52,
        16,
        C.muted,
        "center",
      );
      button(
        "next-roster",
        x + w - 106,
        y + h - 74,
        80,
        42,
        "→",
        () => rosterPage++,
        {
          kind: "dark",
          disabled: (rosterPage + 1) * 8 >= state.players.length,
        },
      );
    }
  } else if (modal === "report") {
    const { x, y, w, h } = modalBox(
        "O que sua guilda construiu",
        mobile ? 398 : 650,
        Math.min(H - 40, 610),
      ),
      team = viewTeam(),
      stats = team.stats;
    shield(x + 47, y + 95, 37, team.color, team.icon);
    display(
      `${team.name} · ${team.score} pontos`,
      x + 83,
      y + 96,
      mobile ? 23 : 31,
    );
    const rows = [
      [
        "Entregas revisadas",
        stats.safe,
        `${stats.safe * 100} pontos: trabalho validado antes de integrar.`,
      ],
      [
        "Entregas sem revisão",
        stats.unsafe,
        `${stats.unsafe * 40} pontos. A revisão poderia render mais ${stats.unsafe * 60}.`,
      ],
      [
        "Conflitos de arquivos",
        stats.conflicts,
        "Frentes no mesmo checkout ou agentes sobrepostos exigem retrabalho.",
      ],
      [
        "Bloqueios do harness",
        stats.blocked,
        "Ações barradas pelas permissões não viraram entregas inseguras.",
      ],
    ];
    let yy = y + 163;
    for (const [label, n, body] of rows) {
      text(`${n}  ${label}`, x + 25, yy, 17, n ? C.gold : C.muted);
      yy = wrap(body, x + 25, yy + 25, w - 50, 13, C.muted, 19) + 24;
    }
    button(
      "close-report",
      x + 25,
      y + h - 68,
      w - 50,
      43,
      "Voltar à conquista",
      () => (modal = null),
      { kind: "blue", small: true },
    );
  } else if (modal === "events") {
    const { x, y, w, h } = modalBox(
      "Diário da guilda",
      mobile ? 398 : 740,
      Math.min(H - 40, 710),
    );
    const entries = viewTeam().log.slice(0, mobile ? 4 : 5);
    let yy = y + 91;
    for (const entry of entries) {
      text(
        entry.title,
        x + 24,
        yy,
        mobile ? 14 : 18,
        entry.kind === "bad"
          ? C.red
          : entry.kind === "score"
            ? C.gold
            : C.green,
      );
      yy =
        wrap(
          entry.body,
          x + 24,
          yy + 27,
          w - 48,
          mobile ? 13 : 15,
          C.muted,
          mobile ? 19 : 22,
        ) + 25;
    }
  } else if (modal === "ranking") {
    const { x, y, w, h } = modalBox(
      "Placar das guildas",
      mobile ? 398 : 600,
      Math.min(H - 40, 710),
    );
    rankList(x + 25, y + 87, w - 50, Math.min(16, state.teams.length), 31);
  } else if (modal === "confirm") {
    const { x, y, w } = modalBox(confirm.title, mobile ? 398 : 570, 330);
    wrap(confirm.body, x + 27, y + 100, w - 54, 17, C.muted, 25);
    button(
      "cancel",
      x + 27,
      y + 239,
      (w - 67) / 2,
      49,
      "Voltar",
      () => (modal = null),
      { kind: "dark" },
    );
    button(
      "confirm-action",
      x + 40 + (w - 67) / 2,
      y + 239,
      (w - 67) / 2,
      49,
      "Confirmar",
      () => {
        modal = null;
        confirm.run();
      },
    );
  }
}
function lobby() {
  const host = isHost(),
    me = state.players.find((p) => p.id === state.me);
  const x = mobile ? 20 : 68;
  display(
    host
      ? "Reúna suas guildas"
      : me
        ? "Sua guilda está pronta"
        : "Escolha sua guilda",
    x,
    mobile ? 100 : 142,
    mobile ? 31 : 45,
  );
  if (mobile) {
    text(
      `${state.players.length}/${state.participants} pessoas · ${state.teams.length} guildas`,
      x,
      139,
      14,
      C.muted,
    );
  } else {
    text(
      "A tempestade se aproxima. Ninguém reconstrói a Cidadela sozinho.",
      x,
      190,
      19,
      C.muted,
    );
    pill(
      `${state.players.length} / ${state.participants} participantes`,
      x,
      222,
      C.green,
      202,
    );
    pill(`${state.teams.length} guildas`, x + 217, 222, C.blue, 123);
  }
  if (!host && !me) {
    field(
      "name",
      "Como você quer ser chamado?",
      x,
      mobile ? 170 : 280,
      mobile ? W - 40 : 620,
      fields.name,
    );
  } else if (!mobile) {
    text(
      host
        ? "Os participantes escolhem seus times antes da primeira missão."
        : `Você entrou como ${me.name}. Pode trocar de guilda antes da partida.`,
      x,
      285,
      16,
      C.muted,
    );
  }
  const cols = mobile ? 2 : 4,
    per = mobile ? 4 : 8,
    cw = mobile ? (W - 54) / 2 : 210,
    gap = mobile ? 14 : 17,
    startY = mobile ? (!host && !me ? 273 : 181) : !host && !me ? 373 : 330,
    ch = mobile ? 142 : 184;
  state.teams.slice(page * per, (page + 1) * per).forEach((t, i) => {
    const cx = x + (i % cols) * (cw + gap),
      cy = startY + Math.floor(i / cols) * (ch + 16);
    const members = state.players.filter((p) => p.teamId === t.id),
      selected = me ? me.teamId === t.id : teamSelection === t.id,
      full = members.length >= t.capacity;
    panel(cx, cy, cw, ch);
    if (selected && !host) {
      round(cx, cy, cw, ch, 17);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    rect(cx + 12, cy + 9, cw - 24, 3, t.color, 2);
    shield(
      cx + cw / 2,
      cy + (mobile ? 39 : 51),
      mobile ? 40 : 53,
      t.color,
      t.icon,
    );
    display(
      t.name,
      cx + cw / 2,
      cy + (mobile ? 82 : 106),
      mobile ? 23 : 27,
      C.cream,
      "center",
    );
    text(
      `${members.length} / ${t.capacity} pessoas`,
      cx + cw / 2,
      cy + (mobile ? 106 : 134),
      13,
      C.muted,
      "center",
    );
    text(
      selected && !host
        ? "Sua escolha"
        : full
          ? "Guilda completa"
          : members.length
            ? members
                .map((p) => p.name)
                .join(", ")
                .slice(0, 22)
            : "Esperando heróis",
      cx + cw / 2,
      cy + ch - 18,
      11,
      selected ? t.color : C.muted,
      "center",
    );
    hit(
      "team-" + t.id,
      cx,
      cy,
      cw,
      ch,
      `${t.name}, ${members.length} de ${t.capacity} vagas${selected ? ", seu time" : ""}`,
      () => {
        teamSelection = t.id;
        if (me) {
          fields.name = me.name;
          join();
        }
      },
      host || (full && (!me || me.teamId !== t.id)),
    );
  });
  const bottom = mobile ? Math.min(H - 143, startY + 2 * (ch + 16) + 15) : 759;
  if (state.teams.length > per) {
    button("team-prev", x, bottom - 2, 58, 37, "←", () => page--, {
      kind: "dark",
      disabled: page === 0,
    });
    text(
      `${page + 1} / ${Math.ceil(state.teams.length / per)}`,
      x + 110,
      bottom + 18,
      14,
      C.muted,
      "center",
    );
    button("team-next", x + 163, bottom - 2, 58, 37, "→", () => page++, {
      kind: "dark",
      disabled: (page + 1) * per >= state.teams.length,
    });
  }
  if (!mobile) {
    panel(1035, 221, 336, 404);
    shield(1203, 280, 57, C.gold, "crown");
    text("Convide a turma", 1203, 340, 20, C.cream, "center");
    display(state.code, 1203, 394, 57, C.gold, "center");
    text(new URL(inviteBase).host, 1203, 444, 15, C.muted, "center");
    text(
      "Abra o endereço e digite o código.",
      1203,
      473,
      13,
      C.muted,
      "center",
    );
    button("invite", 1060, 514, 286, 48, "Copiar link da sala", copyInvite, {
      kind: "blue",
      small: true,
    });
    text("Na mesma rede do apresentador", 1203, 590, 12, C.muted, "center");
  }
  if (host) {
    const ready = state.teams.every((t) =>
      state.players.some((p) => p.teamId === t.id),
    );
    button(
      "start",
      mobile ? 20 : 1035,
      mobile ? H - 126 : 657,
      mobile ? W - 40 : 336,
      55,
      "Iniciar a reconstrução",
      () => {
        if (state.players.length < state.participants) {
          confirm = {
            title: "Começar com a turma atual?",
            body: `Há ${state.players.length} de ${state.participants} participantes. A entrada e a troca de guilda serão encerradas.`,
            run: () => doAction("start"),
          };
          modal = "confirm";
        } else doAction("start");
      },
      { disabled: !ready || busy || !connected },
    );
    text(
      ready
        ? "Todos os times estão representados."
        : "Cada guilda precisa de pelo menos 1 pessoa.",
      mobile ? W / 2 : 1203,
      mobile ? H - 145 : 737,
      12,
      ready ? C.green : C.gold,
      "center",
    );
  } else if (!me) {
    button(
      "join-team",
      mobile ? 20 : 1035,
      mobile ? H - 126 : 657,
      mobile ? W - 40 : 336,
      55,
      busy
        ? "Entrando…"
        : "Entrar na guilda " + state.teams[teamSelection].name,
      join,
      {
        kind: "gold",
        disabled: fields.name.trim().length < 2 || busy || !connected,
      },
    );
  } else {
    pill(
      "Aguardando o orquestrador iniciar",
      mobile ? 80 : 1047,
      mobile ? H - 115 : 678,
      C.green,
      mobile ? 270 : 312,
    );
  }
  if (mobile) {
    button("copy-mobile", 20, H - 54, 190, 34, "Copiar convite", copyInvite, {
      kind: "dark",
      small: true,
    });
    button(
      "roster",
      224,
      H - 54,
      186,
      34,
      "Participantes",
      () => (modal = "roster"),
      { kind: "dark", small: true },
    );
  } else {
    button(
      "roster",
      1035,
      778,
      336,
      43,
      "Ver participantes",
      () => (modal = "roster"),
      { kind: "dark", small: true },
    );
    text(
      "3 frentes para reconstruir · até 900 pontos · o maior placar leva o prêmio",
      68,
      861,
      15,
      C.muted,
    );
  }
}
function rankList(x, y, w, count = 8, spacing = 50) {
  const teams = [...state.teams].sort(
    (a, b) => b.score - a.score || a.id - b.id,
  );
  teams.slice(0, count).forEach((t, i) => {
    const yy = y + i * spacing;
    const me = state.players.find((p) => p.id === state.me);
    if (me?.teamId === t.id)
      rect(x - 6, yy - 21, w + 12, spacing - 5, t.color + "18", 8);
    shield(x + 18, yy, spacing < 40 ? 21 : 29, t.color, t.icon);
    text(t.name, x + 43, yy, spacing < 40 ? 14 : 16);
    text(t.score, x + w - 4, yy, spacing < 40 ? 16 : 21, C.gold, "right", 900);
    if (state.phase === "playing" && !state.me)
      hit(
        "rank-watch-" + t.id,
        x,
        yy - spacing / 2,
        w,
        spacing,
        "Acompanhar " + t.name,
        () => {
          watchTeam = t.id;
          modal = null;
        },
      );
  });
}
function viewTeam() {
  if (!state) return null;
  const me = state.players.find((p) => p.id === state.me);
  return state.teams[me?.teamId ?? watchTeam] || state.teams[0];
}
function elapsed() {
  return state
    ? Math.min(
        state.duration,
        state.elapsed +
          (state.paused || state.phase !== "playing"
            ? 0
            : Math.max(0, Date.now() + offset - state.serverTime) / 1000),
      )
    : 0;
}
function currentEnergy(team) {
  return Math.min(
    state.story.maxEnergy,
    team.energy + (elapsed() - state.elapsed) * state.story.regen,
  );
}
async function command(name, body) {
  return work(async () => {
    const response = await api(
      `/api/rooms/${state.code}/action`,
      { action: name, ...body },
      key,
    );
    apply(response.state);
    selection = null;
    tone();
  });
}
async function playCard(cardId, siteId) {
  selectedSite = siteId;
  return command("play", { cardId, siteId });
}
function targetPositions() {
  const points = world?.targets?.();
  if (points?.length)
    return points.map((p) => ({
      ...p,
      x: (p.x - ox) / scale,
      y: (p.y - oy) / scale,
    }));
  const r = sceneRect();
  return [
    { id: 0, x: r.x + r.w * 0.35, y: r.y + r.h * 0.3 },
    { id: 1, x: r.x + r.w * 0.4, y: r.y + r.h * 0.75 },
    { id: 2, x: r.x + r.w * 0.7, y: r.y + r.h * 0.45 },
  ];
}
function battle() {
  const team = viewTeam(),
    me = state.players.find((p) => p.id === state.me),
    host = isHost(),
    canPlay = Boolean(me) && !state.paused && connected && !busy;
  const now = elapsed(),
    seconds = Math.max(0, Math.ceil(state.duration - now)),
    energy = currentEnergy(team),
    site = team.sites[selectedSite];
  const card = state.cards.find((c) => c.id === selection),
    jobs = team.jobs.filter((j) => j.siteId === site.id),
    built = site.built;
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  if (!mobile) {
    panel(26, 106, 239, 488);
    text("Guildas em campo", 47, 139, 19);
    text("Toque para acompanhar", 47, 165, 12, C.muted);
    [...state.teams]
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .slice(0, 7)
      .forEach((t, i) => {
        const y = 208 + i * 44;
        if (t.id === team.id) rect(39, y - 19, 211, 38, t.color + "22", 8);
        shield(58, y, 27, t.color, t.icon);
        text(t.name, 82, y, 15);
        text(t.score, 239, y, 20, C.gold, "right", 900);
        hit(
          "watch-" + t.id,
          39,
          y - 19,
          211,
          38,
          "Acompanhar " + t.name,
          () => {
            watchTeam = t.id;
            selectedSite = 0;
          },
          Boolean(me),
        );
      });
    button(
      "all-rank",
      47,
      533,
      195,
      34,
      "Placar completo",
      () => (modal = "ranking"),
      { kind: "dark", small: true },
    );
    display(team.name, 320, 121, 32, team.color);
    pill("EM TEMPO REAL", 320, 156, C.green, 150);
    display(
      state.paused ? "PAUSA" : clock,
      955,
      121,
      45,
      seconds <= 30 ? C.red : C.cream,
      "right",
    );
    text("até a tempestade fechar a arena", 956, 166, 13, C.muted, "right");
    panel(1050, 106, 365, 488);
    text("Contexto da guilda", 1074, 137, 18);
    text(`${Math.floor(energy)} / 12`, 1389, 137, 22, C.gold, "right", 900);
    for (let i = 0; i < 12; i++)
      rect(1075 + i * 26, 163, 21, 13, i < energy ? "#ad8bf0" : "#172c41", 4);
    text("+0,65/s · orçamento compartilhado", 1075, 199, 13, C.muted);
    line(1073, 226, 1392, 226, "#6b8ca444");
    text(`${team.jobs.length} / 3 agentes em campo`, 1075, 253, 17, C.cream);
    team.jobs.forEach((j, i) => {
      const y = 297 + i * 69,
        c = state.cards.find((c) => c.id === j.cardId);
      icon(c.icon, 1090, y, 26, c.color);
      text(`${c.name} → ${team.sites[j.siteId].name}`, 1113, y - 8, 15);
      text(
        `${j.playerName} · ${Math.max(0, Math.ceil(j.endsAt - now))}s`,
        1113,
        y + 15,
        12,
        j.conflict ? C.red : C.muted,
      );
    });
    if (!team.jobs.length)
      wrap(
        "Mobilize agentes arrastando as cartas para as construções da arena.",
        1075,
        304,
        306,
        16,
        C.muted,
        25,
      );
    button(
      "events",
      1075,
      530,
      314,
      35,
      "Diário da guilda",
      () => (modal = "events"),
      { kind: "dark", small: true },
    );
  } else {
    display(team.name, 20, 90, 28, team.color);
    display(
      state.paused ? "PAUSA" : clock,
      W - 20,
      90,
      31,
      seconds <= 30 ? C.red : C.cream,
      "right",
    );
    icon("gem", 29, 132, 22, "#c5a3ff");
    text(`${Math.floor(energy)}/12`, 48, 132, 18, C.cream);
    for (let i = 0; i < 12; i++)
      rect(109 + i * 16, 126, 12, 11, i < energy ? "#b48aec" : "#253d56", 3);
    text(`${team.jobs.length}/3 agentes`, W - 20, 132, 12, C.muted, "right");
    button(
      "mobile-rank",
      20,
      158,
      106,
      31,
      "Placar",
      () => (modal = "ranking"),
      { kind: "dark", small: true },
    );
    button("events", 136, 158, 106, 31, "Diário", () => (modal = "events"), {
      kind: "dark",
      small: true,
    });
  }
  // Hit regions are tied to the actual projected 3D buildings, including when a card is dragged.
  targetPositions().forEach((p) => {
    const target = team.sites[p.id],
      tw = mobile ? 90 : 126,
      th = mobile ? 44 : 54;
    if (!world) {
      shield(p.x, p.y - 52, mobile ? 52 : 78, team.color, target.icon);
    }
    const active = selectedSite === p.id,
      highlight = Boolean(selection) || active;
    if (highlight) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.ellipse(
        p.x,
        p.y - 6,
        mobile ? 48 : 70,
        mobile ? 19 : 25,
        0,
        0,
        Math.PI * 2,
      );
      ctx.strokeStyle = selection ? C.gold : team.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    grad(
      p.x - tw / 2,
      p.y + 10,
      tw,
      th,
      active ? "#365572" : "#193248",
      "#102436",
      10,
      highlight ? C.gold : "#8298aa66",
    );
    text(
      target.name,
      p.x,
      p.y + (mobile ? 23 : 28),
      mobile ? 13 : 17,
      C.cream,
      "center",
      900,
    );
    text(
      target.level === 3 ? "CONCLUÍDO" : `Nível ${target.level}/3`,
      p.x,
      p.y + (mobile ? 40 : 48),
      11,
      target.level === 3 ? C.green : C.muted,
      "center",
    );
    const buildJobs = team.jobs.filter(
      (j) => j.siteId === p.id && j.cardId === "builder",
    );
    const estimate = Math.min(
      100,
      target.built +
        buildJobs.reduce(
          (n, j) =>
            n +
            (j.conflict ? 75 : 100) *
              clamp((now - j.startedAt) / (j.endsAt - j.startedAt), 0, 1),
          0,
        ),
    );
    rect(p.x - tw / 2 + 6, p.y + th + 6, tw - 12, 4, "#0c1d30", 3);
    if (estimate > 0)
      rect(
        p.x - tw / 2 + 6,
        p.y + th + 6,
        ((tw - 12) * estimate) / 100,
        4,
        target.faults ? C.red : target.reviewed ? C.green : C.blue,
        3,
      );
    if (target.worktree)
      icon("branch", p.x - tw / 2 + 9, p.y - 15, 16, C.green);
    if (target.harness) icon("shield", p.x + tw / 2 - 9, p.y - 15, 16, C.blue);
    hit(
      "site-" + p.id,
      p.x - tw / 2 - 4,
      p.y - (mobile ? 64 : 96),
      tw + 8,
      th + (mobile ? 79 : 111),
      `${target.name}, nível ${target.level}, construção ${target.built} por cento${selection ? ", aplicar " + card.name : ""}`,
      () => {
        selectedSite = p.id;
        if (selection && canPlay) return playCard(selection, p.id);
      },
      false,
    );
  });
  const ix = mobile ? 18 : 307,
    iy = mobile ? H - 348 : 609,
    iw = mobile ? W - 36 : 715,
    ih = mobile ? 169 : 74;
  panel(ix, iy, iw, ih);
  text(
    `${site.name} · nível ${site.level}/3`,
    ix + 18,
    iy + 23,
    mobile ? 18 : 20,
    C.cream,
  );
  const task = jobs[0];
  let status =
    site.level === 3
      ? "Frente concluída. Escolha outro alvo."
      : task
        ? `${task.cardId === "builder" ? "Construindo" : "Revisando"} · ${Math.max(0, Math.ceil(task.endsAt - now))}s${task.conflict ? " · conflito!" : ""}`
        : site.reviewed
          ? "Revisado. Pronto para entregar."
          : built >= 100
            ? "Obra pronta. Envie um Revisor."
            : built
              ? "Conflito: falta completar a construção."
              : "Arraste um Construtor até esta frente.";
  if (card) status = card.name + ": " + card.description;
  wrap(
    status,
    ix + 18,
    iy + 50,
    mobile ? iw - 36 : 410,
    mobile ? 13 : 13,
    C.muted,
    18,
    mobile ? 2 : 1,
  );
  const deliverable = built >= 100 && !jobs.length && site.level < 3;
  const label =
    site.level === 3
      ? "Frente concluída"
      : site.reviewed
        ? "Entregar  +100"
        : site.harness
          ? "Entrega protegida"
          : "Entregar sem revisão  +40";
  button(
    "deliver",
    mobile ? ix + 14 : ix + 448,
    mobile ? iy + 110 : iy + 16,
    mobile ? iw - 28 : 251,
    40,
    label,
    () => command("deliver", { siteId: selectedSite }),
    {
      kind: site.reviewed ? "green" : site.harness ? "blue" : "gold",
      small: true,
      disabled: !canPlay || !deliverable,
    },
  );
  if (mobile) {
    text(
      `${site.worktree ? "✓" : "○"} Worktree    ${site.harness ? "✓" : "○"} Harness    ${site.faults} falhas`,
      ix + 18,
      iy + 87,
      12,
      site.faults ? C.red : C.muted,
    );
  }
  const deckY = mobile ? H - 157 : 710,
    cw = mobile ? 95 : 252,
    ch = mobile ? 113 : 142,
    dx = mobile ? 18 : 177,
    gap = mobile ? 5 : 24;
  state.cards.forEach((c, i) => {
    const x = dx + i * (cw + gap),
      y = deckY,
      selected = selection === c.id,
      disabled = !canPlay || energy < c.cost;
    ctx.save();
    if (disabled) ctx.globalAlpha = 0.48;
    panel(x, y, cw, ch);
    rect(x + 6, y + 5, cw - 12, 4, c.color, 2);
    if (selected) {
      round(x - 2, y - 3, cw + 4, ch + 6, 16);
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.gold;
      ctx.stroke();
    }
    portrait(
      c.model,
      x + (mobile ? 20 : 6),
      y + 8,
      mobile ? 55 : 84,
      mobile ? 64 : 106,
    );
    icon("gem", x + cw - 18, y + 25, 25, "#bd8ef1");
    text(c.cost, x + cw - 18, y + 25, 12, C.cream, "center", 900);
    text(
      c.name,
      mobile ? x + cw / 2 : x + 91,
      y + (mobile ? 84 : 35),
      mobile ? 12 : 21,
      C.cream,
      mobile ? "center" : "left",
      900,
    );
    if (mobile)
      text(
        ["12 s", "Isolar", "6 s+", "Proteger"][i],
        x + cw / 2,
        y + 102,
        10,
        c.color,
        "center",
      );
    else wrap(c.description, x + 92, y + 65, cw - 112, 12, C.muted, 18, 4);
    ctx.restore();
    hit(
      "card-" + c.id,
      x,
      y,
      cw,
      ch,
      `${i + 1}. ${c.name}, ${c.cost} contexto. ${c.description}`,
      () => {
        selection = selection === c.id ? null : c.id;
      },
      disabled,
    );
  });
  const event = team.log[0];
  if (!mobile && event) {
    const ex = 32,
      ey = 620;
    wrap(
      event.title,
      ex,
      ey,
      231,
      16,
      event.kind === "bad" ? C.red : C.gold,
      23,
      2,
    );
    wrap(event.body, ex, ey + 60, 231, 12, C.muted, 19, 7);
  }

  const hint = card
    ? `Arraste ${card.name} até um alvo iluminado`
    : "Toque numa carta e depois na construção · arrastar também funciona";
  text(hint, W / 2, mobile ? H - 20 : 881, mobile ? 10 : 14, C.gold, "center");
  if (host) {
    button(
      "pause",
      mobile ? 253 : 1075,
      mobile ? 158 : 619,
      mobile ? 74 : 147,
      34,
      state.paused ? "Retomar" : "Pausar",
      () => doAction("pause"),
      { kind: "dark", small: true, disabled: busy || !connected },
    );
    button(
      "finish",
      mobile ? 337 : 1237,
      mobile ? 158 : 619,
      mobile ? 75 : 151,
      34,
      "Encerrar",
      () => {
        confirm = {
          title: "Encerrar a arena?",
          body: "As entregas já concluídas definem o placar final. O trabalho em andamento não soma pontos.",
          run: () => doAction("finish"),
        };
        modal = "confirm";
      },
      { kind: "dark", small: true, disabled: busy || !connected },
    );
  }
  if (!me && !mobile)
    text(
      "Orquestrador: acompanhe as guildas pelo placar.",
      1230,
      685,
      12,
      C.muted,
      "center",
    );
  if (state.paused) {
    pill(
      "PAUSADO · agentes e contexto congelados",
      W / 2 - 172,
      mobile ? 206 : 198,
      C.gold,
      344,
    );
  }
  if (drag?.active) {
    const c = state.cards.find((c) => c.id === drag.cardId);
    ctx.save();
    ctx.globalAlpha = 0.85;
    panel(pointer.x - 44, pointer.y - 67, 88, 97);
    icon(c.icon, pointer.x, pointer.y - 28, 37, c.color);
    text(c.name, pointer.x, pointer.y + 7, 12, C.cream, "center");
    ctx.restore();
  }
}

function results() {
  const winners = state.teams.filter((t) => state.winners.includes(t.id));
  const tied = winners.length > 1;
  const order = [...state.teams].sort(
    (a, b) => b.score - a.score || a.id - b.id,
  );
  display(
    state.practice
      ? "Treino concluído!"
      : tied
        ? "Uma conquista compartilhada!"
        : "A conquista das guildas!",
    W / 2,
    mobile ? 115 : 152,
    mobile ? 31 : 57,
    C.gold,
    "center",
  );
  const title = state.practice
    ? "Sua guilda colocou os agentes em campo."
    : tied
      ? "As guildas empataram no maior placar."
      : `A guilda ${winners[0].name} conquistou a vitória.`;
  text(title, W / 2, mobile ? 163 : 217, mobile ? 14 : 23, C.cream, "center");
  if (mobile) {
    const t = order[0];
    shield(W / 2, 254, 105, t.color, t.icon);
    display(t.name, W / 2, 353, 39, C.cream, "center");
    display(`${t.score} pontos`, W / 2, 401, 36, C.gold, "center");
    panel(20, 451, W - 40, 137);
    wrap(
      tied
        ? winners.length > 4
          ? `${winners.length} guildas dividem a vitória. Veja todas na classificação.`
          : "A vitória pertence a: " +
            winners.map((t) => t.name).join(", ") +
            "."
        : "O prêmio é da guilda inteira. Cada decisão ajudou a reconstruir o reino.",
      42,
      479,
      W - 84,
      16,
      C.muted,
      24,
    );
    hit(
      "report",
      20,
      451,
      W - 40,
      137,
      "Ver resumo da guilda",
      () => (modal = "report"),
    );
    text(
      "Toque aqui para ver o resumo da guilda",
      W / 2,
      566,
      11,
      C.gold,
      "center",
    );
    button(
      "final-rank",
      20,
      H - 150,
      W - 40,
      44,
      "Ver classificação completa",
      () => (modal = "ranking"),
      { kind: "blue", small: true },
    );
  } else {
    const show = order.slice(0, 3),
      slots = show.length === 1 ? [0] : show.length === 2 ? [1, 0] : [1, 0, 2];
    slots.forEach((index, i) => {
      const t = show[index];
      const cx =
          show.length === 1
            ? W / 2
            : W / 2 + (i - (show.length === 2 ? 0.5 : 1)) * 291,
        top = index === 0 ? 451 : 507;
      const isWinner = state.winners.includes(t.id);
      shield(cx, top - 89, index === 0 ? 105 : 78, t.color, t.icon);
      display(t.name, cx, top - 13, index === 0 ? 37 : 28, C.cream, "center");
      grad(
        cx - 119,
        top + 35,
        238,
        650 - top,
        "#567083",
        "#253e54",
        12,
        "#9fb1b2",
      );
      rect(cx - 122, top + 30, 244, 18, isWinner ? "#d8b774" : "#8198a7", 5);
      display(String(t.score), cx, top + 94, 48, C.gold, "center");
      text("pontos de reconstrução", cx, top + 135, 13, C.muted, "center");
      if (isWinner) pill("GUILDA VENCEDORA", cx - 91, top - 177, C.gold, 182);
    });
    text(
      state.practice
        ? "Pronto para reunir sua turma na próxima arena?"
        : "O brinde é de toda a guilda. A conquista também.",
      W / 2,
      744,
      23,
      C.cream,
      "center",
    );
    text(
      "Escopo claro. Contexto durável. Ferramentas certas. Autonomia com limites.",
      W / 2,
      786,
      16,
      C.muted,
      "center",
    );
    button(
      "report",
      218,
      831,
      314,
      46,
      "Resumo da guilda",
      () => (modal = "report"),
      { kind: "dark", small: true },
    );
    button(
      "final-rank",
      563,
      831,
      314,
      46,
      "Classificação completa",
      () => (modal = "ranking"),
      { kind: "blue", small: true },
    );
  }
  button(
    "new-arena",
    mobile ? 20 : 908,
    mobile ? H - 86 : 831,
    mobile ? W - 40 : 314,
    46,
    "Voltar ao início",
    leave,
    { kind: "gold", small: true },
  );
  if (!reduced)
    for (let i = 0; i < 48; i++) {
      const t = (time - animation) * 0.00012 + i * 0.057;
      const x = ((i * 139) % W) + Math.sin(t * 4 + i) * 25,
        y = ((t * 430 + i * 31) % (H + 70)) - 35;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 3 + i);
      rect(-3, -5, 6, 10, [C.gold, C.blue, C.green, C.red][i % 4], 1);
      ctx.restore();
    }
}
function sceneRect() {
  if (mobile) {
    if (screen === "home") return { x: -25, y: 185, w: 480, h: 255 };
    if (screen === "battle")
      return { x: 0, y: 190, w: 430, h: Math.max(190, H - 578) };
    return { x: 190, y: 95, w: 290, h: 290 };
  }
  if (screen === "home") return { x: 475, y: 134, w: 944, h: 535 };
  if (screen === "battle") return { x: 255, y: 188, w: 810, h: 403 };
  if (screen === "lobby") return { x: 955, y: 365, w: 470, h: 410 };
  return { x: 0, y: 150, w: 1440, h: 570 };
}
let a11ySignature = "";
function accessibility() {
  const sig = controls
    .map((c) => c.id + ":" + c.label + ":" + c.disabled)
    .join("|");
  if (sig === a11ySignature) return;
  a11ySignature = sig;
  const container = document.querySelector("#accessible-controls");
  container.replaceChildren(
    ...controls.map((c) => {
      const b = document.createElement("button");
      b.textContent = c.label;
      b.tabIndex = -1;
      b.disabled = c.disabled;
      b.onclick = () => controls.find((a) => a.id === c.id)?.fn();
      return b;
    }),
  );
}
function draw(t) {
  time = t;
  frame++;
  const dpr = Math.min(devicePixelRatio, 2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  controls = [];
  const sr = sceneRect();
  if (world)
    world.draw(
      t,
      {
        x: sr.x * scale + ox,
        y: sr.y * scale + oy,
        w: sr.w * scale,
        h: sr.h * scale,
      },
      innerWidth,
      innerHeight,
      reduced,
      screen === "battle" ? viewTeam() : null,
      elapsed(),
      selectedSite,
      selection,
      state?.paused,
    );
  if (screen === "results") {
    rect(0, 0, W, H, "#0d233ac9", 0);
  }
  if (screen === "lobby") {
    rect(0, 82, mobile ? W : 1010, H - 82, "#10263b66", 0);
  }
  topbar();
  if (screen === "home") home();
  else if (screen === "lobby") lobby();
  else if (screen === "battle") battle();
  else results();
  drawModal();
  if (state && !connected) {
    rect(0, 60, W, 32, "#8e432c", 0);
    text(
      "Conexão perdida · tentando reconectar. Aguarde para mobilizar agentes.",
      W / 2,
      76,
      mobile ? 10 : 14,
      "#fff1dd",
      "center",
    );
  }
  if (world?.progress.failures.length || worldError) {
    text(
      "Modelos 3D indisponíveis · a arena continua funcionando.",
      W / 2,
      H - 9,
      10,
      C.red,
      "center",
    );
  } else if (world && world.progress.loaded < world.progress.total)
    text(
      `Preparando a Cidadela ${world.progress.loaded}/${world.progress.total}`,
      W - 26,
      H - 12,
      11,
      C.muted,
      "right",
    );
  if (toast && toast.until > time) {
    const tw = mobile ? W - 30 : Math.min(760, W - 80),
      ty = mobile ? 66 : H - 136;
    panel((W - tw) / 2, ty, tw, 69);
    wrap(
      toast.message,
      (W - tw) / 2 + 19,
      ty + 24,
      tw - 38,
      mobile ? 13 : 16,
      toast.error ? C.red : C.cream,
      21,
      2,
    );
  }
  if (busy) {
    pill("Conectando…", W / 2 - 65, modal ? H - 29 : 73, C.gold, 130);
  }
  if (frame % 12 === 0) accessibility();
  requestAnimationFrame(draw);
}
function position(e) {
  return { x: (e.clientX - ox) / scale, y: (e.clientY - oy) / scale };
}
function controlAt(p) {
  return [...controls]
    .reverse()
    .find(
      (c) =>
        !c.disabled &&
        p.x >= c.x &&
        p.x <= c.x + c.w &&
        p.y >= c.y &&
        p.y <= c.y + c.h,
    );
}
canvas.addEventListener("pointermove", (e) => {
  pointer = position(e);
  if (drag && Math.hypot(pointer.x - drag.x, pointer.y - drag.y) > 8)
    drag.active = true;
  hover = controlAt(pointer)?.id || "";
  canvas.style.cursor = drag?.active
    ? "grabbing"
    : hover
      ? "pointer"
      : "default";
});
canvas.addEventListener("pointerleave", () => (hover = ""));
canvas.addEventListener("pointerdown", (e) => {
  pointer = position(e);
  const c = controlAt(pointer);
  if (c) {
    focus = c.id;
    editing = null;
    input.blur();
    if (c.id.startsWith("card-")) {
      drag = {
        cardId: c.id.slice(5),
        x: pointer.x,
        y: pointer.y,
        active: false,
      };
      canvas.setPointerCapture?.(e.pointerId);
    }
    c.fn();
    if (drag) selection = drag.cardId;
    tone();
  } else {
    input.blur();
    editing = null;
  }
  e.preventDefault();
});
canvas.addEventListener("pointerup", (e) => {
  let pending;
  if (drag?.active) {
    const p = position(e),
      target = controls.find(
        (c) =>
          c.id.startsWith("site-") &&
          p.x >= c.x &&
          p.x <= c.x + c.w &&
          p.y >= c.y &&
          p.y <= c.y + c.h,
      );
    if (target && !modal)
      pending = playCard(drag.cardId, Number(target.id.slice(5)));
  }
  drag = null;
  return pending;
});
canvas.addEventListener("pointercancel", () => (drag = null));
addEventListener("keydown", (e) => {
  if (document.activeElement === input) return;
  if (e.key === "Tab") {
    e.preventDefault();
    const enabled = controls.filter((c) => !c.disabled);
    let i = enabled.findIndex((c) => c.id === focus);
    i = (i + (e.shiftKey ? -1 : 1) + enabled.length) % enabled.length;
    focus = enabled[i]?.id || "";
    if (enabled[i]) announcer.textContent = enabled[i].label;
    canvas.focus();
  } else if (e.key === "Enter" || e.key === " ") {
    const c = controls.find((c) => c.id === focus && !c.disabled);
    if (c) {
      e.preventDefault();
      c.fn();
      tone();
    }
  } else if (e.key === "Escape") {
    modal = null;
    selection = null;
    focus = "";
  } else if (
    ["1", "2", "3", "4"].includes(e.key) &&
    screen === "battle" &&
    !modal
  ) {
    const card = state.cards[Number(e.key) - 1];
    controls.find((c) => c.id === "card-" + card.id && !c.disabled)?.fn();
  }
});
await Promise.all([
  document.fonts.load("20px Lilita"),
  document.fonts.load("700 20px Nunito"),
]);
requestAnimationFrame(draw);
import("./scene.js")
  .then(async (module) => {
    world = await module.createWorld(document.querySelector("#world"));
  })
  .catch(() => (worldError = true));
api("/api/connection", null, "")
  .then((data) => {
    inviteBase = data.joinBase;
  })
  .catch(() => {});
const codeFromURL = new URLSearchParams(location.search)
  .get("room")
  ?.toUpperCase();
if (saved?.code && (!codeFromURL || codeFromURL === saved.code)) {
  work(async () => {
    key = saved.key;
    adminKey = saved.adminKey || "";
    try {
      const result = await api("/api/rooms/" + saved.code);
      apply(result.state);
      subscribe();
    } catch {
      key = "";
      adminKey = "";
      notify("A sala anterior foi encerrada. Crie uma nova arena.");
    }
  });
} else if (codeFromURL && /^[A-Z0-9]{5}$/.test(codeFromURL)) {
  fields.code = codeFromURL;
  lookup(codeFromURL);
}
