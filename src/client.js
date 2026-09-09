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
  drag = null,
  aimedSite = null,
  aimLegality = null;
// Estudo em campo: só o tempo das animações mora aqui. O enunciado vem do
// snapshot e a resposta certa só chega na resposta da própria jogada.
let quizFx = {
  jobId: null,
  openedAt: 0,
  reveal: null,
  revealAt: 0,
  minimized: false,
};
// Aceleração conquistada: a frente que recebeu o corte de tempo pisca por um
// instante, para o acerto virar algo que se vê no mapa e não só no placar.
let boostFx = { siteId: null, at: -9999 };
const boosted = new Set();
const BOOST_MS = 1500;
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
// Conta as linhas que wrap() produziria. Serve para dimensionar um painel antes
// de desenhar o texto dentro dele.
function measureLines(str, w, size, max = 3) {
  ctx.font = `700 ${size}px Nunito`;
  let lines = 1,
    row = "";
  for (const word of String(str).split(" ")) {
    const test = row ? row + " " + word : word;
    if (ctx.measureText(test).width > w && row) {
      if (++lines >= max) return max;
      row = word;
    } else row = test;
  }
  return lines;
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
  } else if (name === "cross") {
    ctx.moveTo(-11, -11);
    ctx.lineTo(11, 11);
    ctx.moveTo(11, -11);
    ctx.lineTo(-11, 11);
    ctx.stroke();
  } else if (name === "brain") {
    ctx.arc(0, -2, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(0, 9);
    ctx.moveTo(-7, -5);
    ctx.lineTo(7, -5);
    ctx.moveTo(-7, 4);
    ctx.lineTo(7, 4);
    ctx.stroke();
    line(-5, 16, 5, 16, color, 3);
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
      mobile ? Math.min(H - 24, 700) : 620,
    );
    const rules = [
      [
        "tools",
        "1. Solte a carta na frente",
        "Toque na carta e depois na frente. A placa diz antes o que aconteceria ali.",
      ],
      [
        "brain",
        "2. Responda enquanto ele trabalha",
        `Cada Construtor ou Revisor abre uma pergunta da apresentação. Acertar corta metade do tempo e vale +${state?.study?.bonus ?? 20} pontos.`,
      ],
      [
        "branch",
        "3. Abra canteiros para paralelizar",
        "Cada Worktree é um diretório e cabe um agente. Com canteiro livre, dois Construtores constroem em metade do tempo; sem ele, rendem metade cada.",
      ],
      [
        "gem",
        "4. Revise, integre e entregue",
        "A revisão soma +5 s por frente extra para convergir. Harness barra entrega sem revisão: revisada vale 100, sem revisão 40.",
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
      "3 agentes e 12 de contexto para a guilda inteira. Paralelizar compra tempo pagando contexto e integração: decidam juntos onde vale a pena.",
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
// A obra é acumulada pelo servidor em site.built. Entre um snapshot e outro o
// cliente projeta pelo mesmo ritmo, em vez de somar uma barra por agente: aquela
// conta era do modelo antigo, contava o trabalho duas vezes e enchia a barra
// antes da hora — pior ainda depois de um acerto, que encurta o relógio da
// tarefa mas não move o startedAt.
function buildRate(team, site) {
  if (site.level >= state.story.maxLevel || site.built >= 100) return 0;
  const per = 100 / state.story.buildSeconds;
  return team.jobs.reduce(
    (rate, job) =>
      job.cardId === "builder" && job.siteId === site.id
        ? rate + per * (job.conflict ? state.story.conflictRate : 1)
        : rate,
    0,
  );
}
function buildProgress(team, site, now) {
  return Math.min(
    100,
    site.built + buildRate(team, site) * Math.max(0, now - state.elapsed),
  );
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
  // A onda de choque sai no ato do toque, sem esperar a resposta do servidor:
  // é o retorno imediato que faz a carta parecer aplicada ao mapa.
  world?.deploy?.(
    siteId,
    state.cards.find((c) => c.id === cardId)?.color || "#ffffff",
  );
  return command("play", { cardId, siteId });
}
function targetPositions() {
  const points = world?.targets?.();
  if (points?.length)
    return points.map((p) => ({
      id: p.id,
      x: (p.x - ox) / scale,
      y: (p.y - oy) / scale,
      top: (p.top - oy) / scale,
    }));
  const r = sceneRect();
  return [
    { id: 0, x: r.x + r.w * 0.38, y: r.y + r.h * 0.34, top: r.y + r.h * 0.12 },
    { id: 1, x: r.x + r.w * 0.52, y: r.y + r.h * 0.86, top: r.y + r.h * 0.64 },
    { id: 2, x: r.x + r.w * 0.66, y: r.y + r.h * 0.55, top: r.y + r.h * 0.33 },
  ];
}
function agentPositions() {
  return (world?.agents?.() || []).map((p) => ({
    ...p,
    x: (p.x - ox) / scale,
    y: (p.y - oy) / scale,
  }));
}
// Espelha as regras de game.mjs para antecipar a leitura na arena: a pessoa
// precisa saber o que a carta faz naquela frente antes de gastar o contexto.
// O servidor continua sendo quem aceita ou recusa a jogada.
function previewPlay(card, site, team, energy) {
  const story = state.story;
  if (site.level >= story.maxLevel)
    return { ok: false, hint: "Frente concluída. Escolha outra." };
  if (energy + 1e-8 < card.cost)
    return {
      ok: false,
      hint: `Faltam ${Math.ceil(card.cost - energy)} de contexto.`,
    };
  if (card.id === "worktree") {
    if (site.worktrees >= story.maxWorktrees)
      return {
        ok: false,
        hint: `Esta frente já tem ${story.maxWorktrees} canteiros.`,
      };
    const stuck = team.jobs.some(
      (j) => j.cardId === "builder" && j.siteId === site.id && j.conflict,
    );
    return {
      ok: true,
      hint: stuck
        ? "Tira um Construtor do checkout compartilhado e encerra o conflito."
        : `Abre o canteiro ${site.worktrees + 1}: mais um Construtor em paralelo aqui.`,
    };
  }
  if (card.id === "harness")
    return site.harness
      ? { ok: false, hint: "O harness já protege esta frente." }
      : { ok: true, hint: "Bloqueia entrega sem revisão e comandos do caos." };
  const here = team.jobs.filter((j) => j.siteId === site.id);
  if (card.id === "builder") {
    if (site.built >= 100)
      return { ok: false, hint: "Obra pronta. Falta revisar ou entregar." };
    if (here.some((j) => j.cardId === "reviewer"))
      return { ok: false, hint: "Revisão em andamento nesta frente." };
  } else {
    if (site.built < 100)
      return { ok: false, hint: "Construa até 100% antes de revisar." };
    if (site.reviewed)
      return { ok: false, hint: "Já revisada. Pode entregar." };
    if (here.length)
      return { ok: false, hint: "Espere os agentes desta frente terminarem." };
  }
  if (team.jobs.length >= 3)
    return { ok: false, hint: "Os 3 agentes da guilda estão ocupados." };
  if (card.id === "reviewer")
    return {
      ok: true,
      hint: `Valida a obra em ${story.reviewSeconds + site.faults * 3} s${
        site.faults ? ` · ${site.faults} falha(s) a corrigir` : ""
      }.`,
    };
  // Qual diretório sobra para este agente: um canteiro livre desta frente ou o
  // checkout principal, que é único para a guilda inteira.
  const busy = new Set(
    team.jobs.filter((j) => j.cardId === "builder").map((j) => j.workspace),
  );
  let slot = null;
  for (let i = 0; i < site.worktrees; i++)
    if (!busy.has(`wt:${site.id}:${i}`)) {
      slot = `wt:${site.id}:${i}`;
      break;
    }
  // O aviso de conflito é o ponto pedagógico da carta Worktree: aparece antes
  // da jogada, não só no diário depois do estrago.
  if (!slot && busy.has("main"))
    return {
      ok: true,
      warn: true,
      hint: "Sem canteiro livre: os dois dividem o checkout e rendem metade cada.",
    };
  const crew =
    team.jobs.filter((j) => j.cardId === "builder" && j.siteId === site.id)
      .length + 1;
  const seconds = Math.round(
    ((100 - site.built) / 100) * (story.buildSeconds / crew),
  );
  if (crew > 1)
    return {
      ok: true,
      hint: `${crew}ª frente nesta obra: fecha em ${seconds} s. A revisão soma +${(crew - 1) * story.integrationSeconds} s para convergir.`,
    };
  return {
    ok: true,
    hint: `Constrói ${Math.round(site.built)}% → 100% em ${seconds} s. Um canteiro libera um 2º Construtor.`,
  };
}
// Calculado antes do render 3D para que anel, brilho e escala da frente reajam
// no mesmo quadro em que a carta é apontada.
function aim() {
  aimedSite = null;
  aimLegality = null;
  if (screen !== "battle" || !state || !selection) return;
  const team = viewTeam();
  if (!team) return;
  const card = state.cards.find((c) => c.id === selection);
  if (!card) return;
  const energy = currentEnergy(team);
  aimLegality = team.sites.map(
    (s) => previewPlay(card, s, team, energy).ok !== false,
  );
  if (drag?.active) {
    let best = null,
      near = mobile ? 96 : 140;
    for (const p of targetPositions()) {
      const d = Math.hypot(pointer.x - p.x, pointer.y - p.y);
      if (d < near) {
        near = d;
        best = p.id;
      }
    }
    aimedSite = best;
  } else if (hover.startsWith("site-")) aimedSite = Number(hover.slice(5));
}
function levelPips(x, y, level, color) {
  for (let i = 0; i < 3; i++) {
    const filled = i < level;
    rect(
      x + i * 13,
      y - 5,
      10,
      10,
      filled ? color : "#0d1f3199",
      3,
      filled ? "#ffffff55" : "#ffffff2e",
    );
  }
}
// A placa fica acima da construção. Antes ela era desenhada sobre o prédio e
// escondia justamente o que a carta muda.
// As três frentes ficam próximas na diagonal do tabuleiro, então as placas
// colidem. Elas são posicionadas antes de desenhar e empurradas para cima na
// ordem de profundidade, como rótulos de mapa.
function bannerBoxes(points, previewing) {
  const bw = mobile ? 148 : 218,
    bh = previewing ? (mobile ? 74 : 98) : mobile ? 56 : 78,
    top = sceneRect().y + 4;
  const boxes = points.map((p) => ({
    id: p.id,
    bw,
    bh,
    bx: p.x - bw / 2,
    by: Math.max(top, p.top - bh - (mobile ? 10 : 16)),
  }));
  // Separação horizontal: as frentes são vizinhas na diagonal, então afastar em
  // x mantém cada placa perto da própria construção. O rabicho continua ligado
  // ao ponto real do prédio, mesmo depois do empurrão.
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i],
          b = boxes[j];
        const gapX =
          Math.min(a.bx + bw, b.bx + bw) - Math.max(a.bx, b.bx) + 12,
          gapY = Math.min(a.by + bh, b.by + bh) - Math.max(a.by, b.by) + 6;
        if (gapX <= 0 || gapY <= 0) continue;
        const push = gapX / 2;
        a.bx += a.bx < b.bx ? -push : push;
        b.bx += a.bx < b.bx ? push : -push;
      }
  for (const b of boxes) b.bx = clamp(b.bx, 10, W - bw - 10);
  return new Map(boxes.map((b) => [b.id, b]));
}
function siteBanner(p, box, target, team, preview, aiming, estimate) {
  const { bx, by, bw, bh } = box;
  const edge = preview
    ? preview.ok
      ? preview.warn
        ? "#ffb27c"
        : C.gold
      : C.red
    : target.level === 3
      ? C.green
      : aiming
        ? C.gold
        : "#8298aa55";
  ctx.save();
  ctx.shadowColor = "#04101fbb";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 7;
  grad(bx, by, bw, bh, aiming ? "#2f5170" : "#1b3149", "#0d2033", 12, edge);
  ctx.restore();
  // Rabicho apontando a construção: sem ele a placa parece solta no cenário.
  // A base acompanha o empurrão horizontal, e a ponta continua no prédio.
  const tail = clamp(p.x, bx + 18, bx + bw - 18);
  ctx.beginPath();
  ctx.moveTo(tail - 9, by + bh - 1);
  ctx.lineTo(tail + 9, by + bh - 1);
  ctx.lineTo(p.x, Math.max(by + bh + 12, p.top - 4));
  ctx.closePath();
  ctx.fillStyle = "#0d2033";
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(
    target.name,
    bx + 12,
    by + (mobile ? 15 : 18),
    mobile ? 14 : 17,
    C.cream,
    "left",
    900,
  );
  levelPips(bx + bw - 51, by + (mobile ? 15 : 18), target.level, C.gold);
  const barY = by + (mobile ? 26 : 33),
    barW = bw - 24,
    barH = mobile ? 7 : 9;
  const boost =
    boostFx.siteId === target.id
      ? clamp((time - boostFx.at) / BOOST_MS, 0, 1)
      : 1;
  rect(bx + 12, barY, barW, barH, "#0a1a2b", 5);
  if (estimate > 0) {
    const fill = (barW * estimate) / 100;
    const base = target.faults ? C.red : target.reviewed ? C.green : C.blue;
    if (boost < 1) {
      // A barra vira dourada e volta à cor normal, com um brilho crescendo por
      // baixo: a leitura é "esta obra acabou de acelerar".
      ctx.save();
      ctx.shadowColor = C.gold;
      ctx.shadowBlur = 20 * (1 - boost);
      rect(bx + 12, barY, fill, barH, C.gold, 5);
      ctx.restore();
      // Duas passagens de luz percorrem o trecho já construído.
      const sweep = (boost * 2) % 1;
      const sx = bx + 12 + fill * sweep;
      ctx.save();
      round(bx + 12, barY, fill, barH, 5);
      ctx.clip();
      const glare = ctx.createLinearGradient(sx - 26, 0, sx + 26, 0);
      glare.addColorStop(0, "#ffffff00");
      glare.addColorStop(0.5, "#fffdf2cc");
      glare.addColorStop(1, "#ffffff00");
      ctx.fillStyle = glare;
      ctx.fillRect(bx + 12, barY, fill, barH);
      ctx.restore();
      // Etiqueta subindo e apagando acima da placa, sem cobrir o nome da frente.
      ctx.save();
      ctx.globalAlpha = 1 - boost * boost;
      const tag = `+${Math.round(state.study.speedup * 100)}% VELOCIDADE`;
      ctx.font = `900 ${mobile ? 9 : 11}px Nunito`;
      const tw = ctx.measureText(tag).width + 20;
      const ty = by - 12 - boost * 18;
      rect(bx + bw / 2 - tw / 2, ty - 9, tw, 19, "#2e2107f2", 9, C.gold);
      text(
        tag,
        bx + bw / 2,
        ty + 1,
        mobile ? 9 : 11,
        C.gold,
        "center",
        900,
      );
      ctx.restore();
    } else rect(bx + 12, barY, fill, barH, base, 5);
  }
  const line3 = by + (mobile ? 45 : 62);
  if (preview)
    wrap(
      preview.hint,
      bx + 12,
      line3 - (mobile ? 4 : 6),
      barW,
      mobile ? 10 : 12,
      preview.ok ? (preview.warn ? "#ffb27c" : C.gold) : C.red,
      mobile ? 13 : 15,
      3,
    );
  else {
    let badge = 12;
    const mark = (ico, color, label) => {
      icon(ico, bx + badge + 6, line3, mobile ? 12 : 15, color);
      ctx.font = `800 ${mobile ? 9 : 11}px Nunito`;
      text(label, bx + badge + 14, line3, mobile ? 9 : 11, color, "left", 800);
      badge += (mobile ? 18 : 20) + ctx.measureText(label).width;
    };
    const crew = team.jobs.filter(
      (j) => j.cardId === "builder" && j.siteId === target.id,
    ).length;
    if (crew > 1)
      mark("tools", C.gold, mobile ? `${crew} frentes` : `${crew} frentes · ${crew}×`);
    if (target.worktrees)
      mark(
        "branch",
        C.green,
        mobile
          ? `${target.worktrees} canteiro${target.worktrees > 1 ? "s" : ""}`
          : `${target.worktrees} canteiro${target.worktrees > 1 ? "s" : ""}`,
      );
    if (target.harness)
      mark("shield", C.blue, mobile ? "protegida" : "harness");
    if (target.faults)
      mark("gem", C.red, mobile ? `${target.faults} falha` : `${target.faults} falha(s)`);
    if (badge === 12)
      text(
        target.level === 3
          ? "Concluída"
          : target.reviewed
            ? mobile
              ? "Pronta para entregar"
              : "Revisada · pronta para entregar"
            : estimate >= 100
              ? mobile
                ? "Falta revisar"
                : "Obra pronta · falta revisar"
              : estimate > 0
                ? `Construindo · ${Math.round(estimate)}%`
                : mobile
                  ? "Envie um Construtor"
                  : "Aguardando um Construtor",
        bx + 12,
        line3,
        mobile ? 10 : 12,
        target.reviewed ? C.green : C.muted,
        "left",
        800,
      );
  }
  return { bx, by, bw, bh };
}
// Cada agente em campo ganha nome e contagem sobre o mapa: é assim que o time
// enxerga quem já pegou qual frente.
function agentChips(team, now) {
  // Frentes paralelas colocam vários agentes quase no mesmo ponto projetado.
  // Os rótulos sobem em pilha para que cada nome continue legível.
  const placed = [];
  for (const a of agentPositions()) {
    const job = team.jobs.find((j) => j.id === a.id) || a.job;
    if (!job) continue;
    const c = state.cards.find((k) => k.id === job.cardId);
    // O time enxerga quem ainda deve a resposta daquele agente.
    const quiz = job.question;
    const badge = !quiz
      ? ""
      : quiz.chosen === null
        ? " · ?"
        : quiz.correct
          ? " · ✓"
          : " · ✗";
    const label = `${job.playerName} · ${Math.max(0, Math.ceil(job.endsAt - now))}s${badge}`;
    ctx.font = `800 ${mobile ? 10 : 12}px Nunito`;
    const w = ctx.measureText(label).width + (mobile ? 30 : 36),
      h = mobile ? 20 : 24;
    const x = a.x - w / 2;
    let y = a.y - h;
    for (let guard = 0; guard < 4; guard++) {
      const clash = placed.find(
        (p) => Math.abs(p.y - y) < h + 3 && x < p.x + p.w + 6 && p.x < x + w + 6,
      );
      if (!clash) break;
      y = clash.y - h - 5;
    }
    placed.push({ x, y, w, h });
    rect(x, y, w, h, "#0b1e30e8", h / 2, job.conflict ? C.red : team.color);
    icon(c.icon, x + h / 2, y + h / 2, mobile ? 12 : 14, c.color);
    text(
      label,
      x + h - 2,
      y + h / 2,
      mobile ? 10 : 12,
      job.conflict ? C.red : C.cream,
      "left",
      800,
    );
  }
}
// Barra de contexto no formato de elixir: as unidades que a carta selecionada
// vai consumir piscam antes do gasto.
function energyBar(x, y, w, h, energy, cost) {
  const max = state.story.maxEnergy,
    gap = mobile ? 3 : 5,
    cell = (w - gap * (max - 1)) / max;
  for (let i = 0; i < max; i++) {
    const cx = x + i * (cell + gap);
    const full = i + 1 <= energy;
    const partial = !full && i < energy;
    rect(cx, y, cell, h, "#132a41", 4, "#ffffff14");
    if (full || partial)
      rect(cx, y, partial ? cell * (energy - i) : cell, h, "#a97ff0", 4);
    const doomed = cost && i >= energy - cost && i < energy;
    if (doomed && Math.floor(time / 260) % 2 === 0)
      rect(cx, y, cell, h, "#ffd17c", 4);
  }
  text(
    `${Math.floor(energy)}/${max}`,
    x + w + 10,
    y + h / 2,
    mobile ? 13 : 16,
    C.gold,
    "left",
    900,
  );
}

// ── Estudo em campo ─────────────────────────────────────────────────────────
// A pergunta abre enquanto o agente trabalha e ocupa o lugar do baralho: é o
// que impede pontuar só na velocidade de alocar agentes.
function openQuiz(team) {
  if (!state.me) return null;
  return (
    team.jobs
      .filter(
        (j) =>
          j.question &&
          j.question.askedTo === state.me &&
          j.question.chosen === null,
      )
      .sort((a, b) => a.id - b.id)[0] || null
  );
}
async function answerQuiz(jobId, option) {
  return work(async () => {
    const response = await api(
      `/api/rooms/${state.code}/action`,
      { action: "answer", jobId, option },
      key,
    );
    apply(response.state);
    const result = response.result;
    if (result?.question) {
      quizFx.reveal = result.question;
      quizFx.revealAt = time;
      if (result.correct) {
        world?.deploy?.(result.siteId, C.gold);
        boosted.add(jobId);
        boostFx = { siteId: result.siteId, at: time };
      }
      announcer.textContent = result.correct
        ? `Resposta certa. ${result.question.why}`
        : `Resposta errada. ${result.question.why}`;
    }
    tone(Boolean(result?.correct));
  });
}
// Mesma construção de button(): sombra, gradiente, brilho no topo e elevação no
// foco. Só o texto quebra em linhas e o estado pinta certo, errado ou apagado.
function choice(id, x, y, w, h, index, label, fn, options = {}) {
  const { disabled = false, mark = null, shake = 0, size = 14 } = options;
  const active = (hover === id || focus === id) && !disabled && !mark;
  const dy = active ? -2 : 0;
  const palettes = {
    idle: ["#36516a", "#243b50", "#132639", "#748ca066", C.cream],
    correct: ["#a5eaba", "#5bba83", "#286343", "#e8fff0", "#123626"],
    wrong: ["#ee9d89", "#c0645b", "#6a363d", "#ffe4d9", "#4a1f22"],
    faded: ["#27394b", "#1a2b3b", "#0e1d2b", "#5f778a2e", "#7f97a8"],
  };
  const p = palettes[mark || (disabled ? "faded" : "idle")];
  ctx.save();
  ctx.translate(shake, dy);
  rect(x, y + 5, w, h, p[2], 12, "#0b192a");
  grad(x, y, w, h, p[0], p[1], 12, p[3]);
  line(x + 12, y + 3, x + w - 12, y + 3, "#ffffff44");
  // Só a alternativa certa e a escolhida recebem marca. As demais mantêm o
  // número, senão um "×" nelas leria como se tivessem sido respondidas.
  const marked = mark === "correct" || mark === "wrong";
  if (!marked) {
    rect(x + 12, y + h / 2 - 13, 26, 26, "#0d1f3199", 8, "#ffffff26");
    text(
      String(index + 1),
      x + 25,
      y + h / 2,
      14,
      mark === "faded" ? "#6d8698" : C.gold,
      "center",
      900,
    );
  } else {
    // O pop do ícone marca o instante da correção, sem trocar o layout da linha.
    const pop = clamp((time - quizFx.revealAt) / 260, 0, 1);
    ctx.save();
    ctx.translate(x + 25, y + h / 2);
    ctx.scale(0.4 + 0.6 * pop, 0.4 + 0.6 * pop);
    icon(mark === "correct" ? "check" : "cross", 0, 0, 26, p[4]);
    ctx.restore();
  }
  wrap(label, x + 48, y + h / 2 - (size > 13 ? 0 : 0), w - 62, size, p[4], 17, 2);
  ctx.restore();
  hit(id, x, y, w, h, `Alternativa ${index + 1}: ${label}`, fn, disabled);
}

// Chamada compacta: a pergunta continua aberta e cronometrada enquanto a pessoa
// volta a jogar cartas.
function quizCallback(job, now) {
  const left = Math.max(0, job.endsAt - now),
    urgent = left <= 4;
  const sx = mobile ? 18 : 180,
    sw = mobile ? W - 36 : 1080,
    sy = mobile ? sceneRect().y + sceneRect().h + 12 : 646,
    sh = mobile ? 44 : 42;
  panel(sx, sy, sw, sh);
  icon("brain", sx + 24, sy + sh / 2, 21, C.gold);
  pill(
    job.question.topic.toUpperCase(),
    sx + 42,
    sy + sh / 2 - 14,
    C.gold,
    mobile ? 92 : 124,
  );
  if (!mobile)
    text(
      job.question.prompt,
      sx + 180,
      sy + sh / 2,
      14,
      C.cream,
      "left",
      700,
    );
  text(
    `${Math.ceil(left)}s`,
    sx + sw - (mobile ? 118 : 150),
    sy + sh / 2,
    mobile ? 14 : 16,
    urgent ? C.red : C.muted,
    "right",
    900,
  );
  button(
    "quiz-open",
    sx + sw - (mobile ? 106 : 138),
    sy + (sh - 30) / 2,
    mobile ? 88 : 114,
    30,
    `Responder +${state.study.bonus}`,
    () => {
      quizFx.minimized = false;
      quizFx.openedAt = time;
    },
    { kind: urgent ? "gold" : "blue", small: true },
  );
}
function quizPanel(team, now) {
  const pending = openQuiz(team);
  if (pending && quizFx.jobId !== pending.id) {
    quizFx.jobId = pending.id;
    quizFx.openedAt = time;
    quizFx.reveal = null;
    quizFx.minimized = false;
  }
  const revealFor = state.study.revealSeconds * 1000;
  const revealing =
    !pending && quizFx.reveal && time - quizFx.revealAt < revealFor;
  if (!pending && !revealing) {
    if (!pending) quizFx.jobId = null;
    return false;
  }
  const question = pending ? pending.question : quizFx.reveal;
  if (pending && quizFx.minimized) {
    quizCallback(pending, now);
    return false;
  }
  const answered = Boolean(quizFx.reveal) && !pending;
  // Duas batidas: primeiro a linha escolhida é marcada, depois a explicação
  // toma o lugar das alternativas.
  const since = time - quizFx.revealAt;
  const explaining = answered && since >= 420;
  const shake =
    answered && !quizFx.reveal.correct && since < 420
      ? Math.sin(since / 26) * (1 - since / 420) * 9
      : 0;

  const map = sceneRect();
  const pad = mobile ? 14 : 24;
  const qx = mobile ? 18 : 180,
    qw = mobile ? W - 36 : 1080;
  const promptSize = mobile ? 14 : 19,
    promptLine = mobile ? 19 : 25,
    headH = mobile ? 56 : 64,
    gap = 6;
  // No computador a altura sai do conteúdo medido; no celular ela é o que sobra
  // abaixo do mapa, e são as alternativas que cedem espaço.
  const promptLines = measureLines(
    question.prompt,
    qw - pad * 2,
    promptSize,
    2,
  );
  const oh = mobile
    ? clamp((H - 14 - (map.y + map.h + 10) - headH - 40 - 30) / 3 - gap, 34, 50)
    : 44;
  const bodyH = headH + promptLines * promptLine + 10 + 3 * oh + 2 * gap;
  const qy = mobile
    ? map.y + map.h + 10
    : clamp(888 - (bodyH + 16), 604, 700);
  const qh = mobile ? H - 14 - qy : bodyH + 16;
  // Entrada: sobe e aparece. O deslocamento entra nas coordenadas, e não numa
  // transformação, para a área clicável nunca sair de baixo do desenho.
  const grow = clamp((time - quizFx.openedAt) / 220, 0, 1);
  const ease = 1 - Math.pow(1 - grow, 3);
  const lift = (1 - ease) * 26;
  const y0 = qy + lift;
  ctx.save();
  ctx.globalAlpha = 0.25 + 0.75 * ease;
  panel(qx, y0, qw, qh);

  const left = pending ? Math.max(0, pending.endsAt - now) : 0;
  const span = pending
    ? Math.max(0.001, pending.endsAt - pending.startedAt)
    : 1;
  const fraction = pending ? clamp(left / span, 0, 1) : 0;
  const urgent = pending && left <= 4;
  rect(qx + 8, y0 + 8, qw - 16, 5, "#0b1c2e", 3);
  if (pending)
    rect(
      qx + 8,
      y0 + 8,
      (qw - 16) * fraction,
      5,
      urgent && Math.floor(time / 260) % 2 === 0 ? C.red : C.gold,
      3,
    );

  // Cabeçalho montado da direita para a esquerda: relógio, saída para o baralho
  // e o contexto restante, que a janela esconde ao cobrir a barra.
  const head = y0 + (mobile ? 30 : 36);
  let edge = qx + qw - pad;
  if (pending) {
    text(
      `${Math.ceil(left)}s`,
      edge,
      head,
      mobile ? 17 : 21,
      urgent ? C.red : C.cream,
      "right",
      900,
    );
    ctx.font = `900 ${mobile ? 17 : 21}px Nunito`;
    edge -= ctx.measureText(`${Math.ceil(left)}s`).width + 16;
    // Sem esta saída a pergunta congelaria o baralho e o time perderia o
    // paralelismo entre frentes, que é justamente o que a partida ensina.
    const bw = mobile ? 76 : 96;
    button(
      "quiz-later",
      edge - bw,
      head - 15,
      bw,
      30,
      "Baralho",
      () => (quizFx.minimized = true),
      { kind: "dark", small: true },
    );
    edge -= bw + 16;
  }
  const energy = currentEnergy(team),
    fuel = `${Math.floor(energy)}/${state.story.maxEnergy}`;
  ctx.font = `800 ${mobile ? 12 : 13}px Nunito`;
  text(fuel, edge, head, mobile ? 12 : 13, C.muted, "right", 800);
  icon("gem", edge - ctx.measureText(fuel).width - 11, head, 17, "#c5a3ff");
  const capLeft = edge - ctx.measureText(fuel).width - 26;
  if (answered) {
    const won = quizFx.reveal.correct,
      label = won ? `CERTO · +${state.study.bonus} PONTOS` : "RESPOSTA ERRADA";
    ctx.font = "800 12px Nunito";
    pill(
      label,
      qx + pad,
      head - 14,
      won ? C.green : C.red,
      Math.min(ctx.measureText(label).width + 28, capLeft - qx - pad),
    );
  } else {
    icon("brain", qx + pad + 11, head, 22, C.gold);
    const label = question.topic.toUpperCase();
    ctx.font = "800 12px Nunito";
    pill(
      label,
      qx + pad + 28,
      head - 14,
      C.gold,
      Math.min(
        ctx.measureText(label).width + 28,
        Math.max(60, capLeft - qx - pad - 28),
      ),
    );
  }

  if (!explaining) {
    wrap(
      question.prompt,
      qx + pad,
      y0 + headH,
      qw - pad * 2,
      promptSize,
      C.cream,
      promptLine,
      2,
    );
    const oy = y0 + headH + promptLines * promptLine + 10;
    question.options.forEach((label, i) => {
      const my = oy + i * (oh + gap);
      const mark = answered
        ? i === quizFx.reveal.answer
          ? "correct"
          : i === quizFx.reveal.chosen
            ? "wrong"
            : "faded"
        : null;
      choice(
        "quiz-" + i,
        qx + pad,
        my,
        qw - pad * 2,
        oh,
        i,
        label,
        () => answerQuiz(quizFx.jobId, i),
        {
          disabled: answered || busy || !connected || grow < 1,
          mark,
          shake: mark === "wrong" ? shake : 0,
          size: mobile ? 12 : 15,
        },
      );
    });
  } else {
    // Revelação: fica a alternativa certa, a escolhida quando errou, e o porquê
    // ocupa o espaço das outras.
    const rows = [{ index: quizFx.reveal.answer, mark: "correct" }];
    if (!quizFx.reveal.correct)
      rows.push({ index: quizFx.reveal.chosen, mark: "wrong" });
    rows.forEach((row, i) => {
      choice(
        "quiz-reveal-" + i,
        qx + pad,
        y0 + headH + i * (oh + gap),
        qw - pad * 2,
        oh,
        row.index,
        question.options[row.index],
        () => {},
        { disabled: true, mark: row.mark, size: mobile ? 12 : 15 },
      );
    });
    const wy = y0 + headH + rows.length * (oh + gap) + 8;
    const fade = clamp((since - 420) / 320, 0, 1);
    ctx.save();
    ctx.globalAlpha *= fade;
    wrap(
      question.why,
      qx + pad,
      wy + 6,
      qw - pad * 2 - (mobile ? 0 : 150),
      mobile ? 12 : 14,
      C.muted,
      mobile ? 17 : 21,
      mobile ? 5 : 3,
    );
    ctx.restore();
    button(
      "quiz-continue",
      mobile ? qx + pad : qx + qw - pad - 136,
      mobile ? y0 + qh - 46 : y0 + qh - 54,
      mobile ? qw - pad * 2 : 136,
      mobile ? 34 : 40,
      "Continuar",
      () => {
        quizFx.reveal = null;
        quizFx.jobId = null;
      },
      { kind: "blue", small: true },
    );
  }
  ctx.restore();
  return true;
}

function battle() {
  const team = viewTeam(),
    me = state.players.find((p) => p.id === state.me),
    host = isHost(),
    canPlay = Boolean(me) && !state.paused && connected && !busy;
  const now = elapsed(),
    seconds = Math.max(0, Math.ceil(state.duration - now)),
    energy = currentEnergy(team),
    site = team.sites[selectedSite],
    card = state.cards.find((c) => c.id === selection);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const estimateFor = (target) => buildProgress(team, target, now);

  // O acerto de qualquer pessoa da guilda acende a frente: o time precisa ver
  // que a obra acelerou, mesmo quem não respondeu.
  for (const job of team.jobs)
    if (job.question?.correct && !boosted.has(job.id)) {
      boosted.add(job.id);
      boostFx = { siteId: job.siteId, at: time };
      world?.deploy?.(job.siteId, C.gold);
    }

  // ── Frentes no mapa ────────────────────────────────────────────────────────
  const points = targetPositions(),
    boxes = bannerBoxes(points, Boolean(card));
  points.forEach((p) => {
    const target = team.sites[p.id],
      aiming = aimedSite === p.id,
      preview = card ? previewPlay(card, target, team, energy) : null,
      estimate = estimateFor(target);
    if (!world) shield(p.x, p.y - 46, mobile ? 50 : 74, team.color, target.icon);
    const band = siteBanner(
      p,
      boxes.get(p.id),
      target,
      team,
      preview,
      aiming,
      estimate,
    );
    const ready = estimate >= 100 && !team.jobs.some((j) => j.siteId === p.id);
    const chosen = selectedSite === p.id;
    if (ready && target.level < 3 && !card) {
      const label = target.reviewed ? "Entregar +100" : "Entregar sem revisão";
      const bw = mobile ? 150 : 196;
      if (chosen)
        button(
          "deliver",
          p.x - bw / 2,
          p.y + (mobile ? 8 : 12),
          bw,
          mobile ? 34 : 40,
          label,
          () => command("deliver", { siteId: selectedSite }),
          {
            kind: target.reviewed ? "green" : "dark",
            small: true,
            disabled: !canPlay,
          },
        );
      else {
        // A largura acompanha o texto: com valor fixo o rótulo transbordava a
        // pílula e a primeira letra ficava ilegível sobre o terreno.
        const label = target.reviewed
          ? mobile
            ? "PRONTA"
            : "PRONTA · TOQUE AQUI"
          : "FALTA REVISAR";
        ctx.font = "800 12px Nunito";
        const pw = ctx.measureText(label).width + 28;
        pill(
          label,
          p.x - pw / 2,
          p.y + (mobile ? 10 : 14),
          target.reviewed ? C.green : C.gold,
          pw,
        );
      }
    }
    hit(
      "site-" + p.id,
      band.bx - 6,
      band.by - 6,
      band.bw + 12,
      p.y - band.by + (mobile ? 16 : 22),
      `${target.name}, nível ${target.level} de 3, construção ${Math.round(estimate)} por cento${
        preview ? `. ${card.name}: ${preview.hint}` : ""
      }`,
      () => {
        selectedSite = p.id;
        if (selection && canPlay) return playCard(selection, p.id);
      },
    );
  });
  agentChips(team, now);
  // O botão de entrega precisa existir sempre: o teclado e os testes o alcançam
  // mesmo quando a frente escolhida ainda não está pronta.
  if (!controls.some((c) => c.id === "deliver"))
    hit(
      "deliver",
      -400,
      -400,
      1,
      1,
      `Entregar ${site.name}`,
      () => command("deliver", { siteId: selectedSite }),
      true,
    );

  // ── Painéis nas sobras laterais ────────────────────────────────────────────
  if (!mobile) {
    const guild = state.players.filter((p) => p.teamId === team.id);
    // O painel acompanha o tamanho da guilda: com duas pessoas ele não pode
    // abrir um vão de 150 px antes do placar.
    const seats = Math.max(1, Math.min(5, guild.length)),
      rosterEnd = 214 + seats * 32 + (guild.length > 5 ? 24 : 0),
      rankTop = rosterEnd + 42,
      ranked = Math.min(4, state.teams.length);
    panel(24, 92, 272, rankTop + ranked * 34 + 52 - 92);
    shield(60, 128, 44, team.color, team.icon);
    display(team.name, 92, 120, 26, team.color);
    text(
      me ? "sua guilda" : "acompanhando",
      93,
      143,
      12,
      C.muted,
      "left",
      800,
    );
    text(team.score, 272, 124, 30, C.gold, "right", 900);
    line(44, 166, 276, 166, "#6b8ca444");
    // Quem está na guilda e o que cada pessoa comanda agora. O contexto e os
    // três agentes são do time inteiro: sem esta lista ninguém percebe que está
    // disputando o mesmo orçamento com os colegas.
    text(`Sua guilda · ${guild.length}`, 44, 188, 13, C.muted);
    guild.slice(0, 5).forEach((p, i) => {
      const y = 214 + i * 32,
        job = team.jobs.find((j) => j.playerName === p.name),
        card = job && state.cards.find((c) => c.id === job.cardId);
      if (p.id === state.me) rect(38, y - 15, 244, 30, team.color + "1f", 8);
      rect(48, y - 4, 8, 8, job ? C.green : "#54708733", 4);
      text(p.name, 66, y, 14, p.id === state.me ? C.cream : C.muted);
      if (card)
        text(
          `${card.name} → ${team.sites[job.siteId].name}`,
          276,
          y,
          11,
          card.color,
          "right",
          800,
        );
    });
    if (guild.length > 5)
      text(`+${guild.length - 5} na guilda`, 66, 214 + 5 * 32, 11, C.muted);
    if (!guild.length)
      text("Ninguém entrou nesta guilda.", 66, 214, 12, C.muted);
    line(44, rosterEnd + 8, 276, rosterEnd + 8, "#6b8ca444");
    text("Placar", 44, rosterEnd + 28, 13, C.muted);
    [...state.teams]
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .slice(0, 4)
      .forEach((t, i) => {
        const y = rankTop + 14 + i * 34;
        if (t.id === team.id) rect(38, y - 15, 244, 30, t.color + "22", 8);
        shield(58, y, 22, t.color, t.icon);
        text(t.name, 79, y, 14);
        text(t.score, 272, y, 17, C.gold, "right", 900);
        hit(
          "watch-" + t.id,
          38,
          y - 15,
          244,
          30,
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
      44,
      rankTop + ranked * 34 + 14,
      232,
      30,
      "Placar completo",
      () => (modal = "ranking"),
      { kind: "dark", small: true },
    );

    panel(1144, 92, 272, 356);
    display(
      state.paused ? "PAUSA" : clock,
      1280,
      130,
      42,
      seconds <= 30 ? C.red : C.cream,
      "center",
    );
    text(
      "até a tempestade fechar a arena",
      1280,
      160,
      11,
      C.muted,
      "center",
      800,
    );
    line(1164, 180, 1396, 180, "#6b8ca444");
    text(
      `Agentes em campo ${team.jobs.length}/3`,
      1164,
      202,
      15,
      C.cream,
      "left",
      900,
    );
    if (!team.jobs.length)
      wrap(
        "Nenhum agente mobilizado. Arraste uma carta até uma frente iluminada.",
        1164,
        228,
        232,
        13,
        C.muted,
        19,
        3,
      );
    team.jobs.forEach((j, i) => {
      const y = 230 + i * 46,
        c = state.cards.find((c) => c.id === j.cardId);
      icon(c.icon, 1178, y + 14, 22, c.color);
      text(
        `${c.name} → ${team.sites[j.siteId].name}`,
        1198,
        y + 7,
        13,
        C.cream,
        "left",
        800,
      );
      text(
        `${j.playerName} · ${Math.max(0, Math.ceil(j.endsAt - now))}s${j.conflict ? " · conflito" : ""}`,
        1198,
        y + 24,
        11,
        j.conflict ? C.red : C.muted,
      );
    });
    const event = team.log[0];
    if (event) {
      line(1164, 376, 1396, 376, "#6b8ca444");
      wrap(
        event.title,
        1164,
        394,
        232,
        13,
        event.kind === "bad" ? C.red : event.kind === "score" ? C.gold : C.green,
        18,
        2,
      );
    }
    button(
      "events",
      1164,
      420,
      232,
      32,
      "Diário da guilda",
      () => (modal = "events"),
      { kind: "dark", small: true },
    );
    if (host) {
      button(
        "pause",
        1164,
        462,
        112,
        32,
        state.paused ? "Retomar" : "Pausar",
        () => doAction("pause"),
        { kind: "dark", small: true, disabled: busy || !connected },
      );
      button("finish", 1284, 462, 112, 32, "Encerrar", () => {
        confirm = {
          title: "Encerrar a arena?",
          body: "As entregas já concluídas definem o placar final. O trabalho em andamento não soma pontos.",
          run: () => doAction("finish"),
        };
        modal = "confirm";
      }, { kind: "dark", small: true, disabled: busy || !connected });
    }
  } else {
    display(team.name, 20, 82, 24, team.color);
    text(team.score, 232, 82, 20, C.gold, "right", 900);
    display(
      state.paused ? "PAUSA" : clock,
      W - 20,
      82,
      28,
      seconds <= 30 ? C.red : C.cream,
      "right",
    );
    button("mobile-rank", 20, 96, 86, 26, "Placar", () => (modal = "ranking"), {
      kind: "dark",
      small: true,
    });
    button("events", 112, 96, 86, 26, "Diário", () => (modal = "events"), {
      kind: "dark",
      small: true,
    });
    text(
      `${team.jobs.length}/3 agentes`,
      W - 20,
      109,
      11,
      C.muted,
      "right",
      800,
    );
    // A sobra abaixo do mapa vira a lista da guilda: no celular é o único lugar
    // em que dá para ver que o contexto e os agentes são disputados com o time.
    const map = sceneRect(),
      stripY = map.y + map.h + 12,
      stripH = H - 196 - stripY;
    // A chamada da pergunta usa esta mesma faixa; uma de cada vez.
    if (stripH >= 52 && !openQuiz(team) && !quizFx.reveal) {
      const guild = state.players.filter((p) => p.teamId === team.id);
      panel(20, stripY, W - 40, stripH);
      text(`Sua guilda · ${guild.length}`, 36, stripY + 18, 12, C.muted);
      const seats = Math.max(1, Math.floor((stripH - 24) / 22));
      guild.slice(0, seats).forEach((p, i) => {
        const y = stripY + 38 + i * 22,
          job = team.jobs.find((j) => j.playerName === p.name),
          c = job && state.cards.find((k) => k.id === job.cardId);
        rect(36, y - 4, 7, 7, job ? C.green : "#54708733", 4);
        text(
          p.name,
          52,
          y,
          12,
          p.id === state.me ? C.cream : C.muted,
          "left",
          p.id === state.me ? 900 : 700,
        );
        text(
          c ? `${c.name} → ${team.sites[job.siteId].name}` : "sem agente",
          W - 36,
          y,
          10,
          c ? c.color : "#6d8698",
          "right",
          800,
        );
      });
      if (guild.length > seats)
        text(
          `+${guild.length - seats}`,
          W - 36,
          stripY + 18,
          11,
          C.muted,
          "right",
        );
    }
    if (host) {
      button(
        "pause",
        204,
        96,
        70,
        26,
        state.paused ? "Retomar" : "Pausar",
        () => doAction("pause"),
        { kind: "dark", small: true, disabled: busy || !connected },
      );
      button("finish", 280, 96, 70, 26, "Encerrar", () => {
        confirm = {
          title: "Encerrar a arena?",
          body: "As entregas já concluídas definem o placar final.",
          run: () => doAction("finish"),
        };
        modal = "confirm";
      }, { kind: "dark", small: true, disabled: busy || !connected });
    }
  }

  // ── Contexto e baralho ─────────────────────────────────────────────────────
  const barY = mobile ? H - 184 : 694,
    barX = mobile ? 20 : 320,
    barW = mobile ? W - 92 : 760;
  const studying = openQuiz(team) || quizFx.reveal;
  icon("gem", barX - 16, barY + (mobile ? 9 : 11), mobile ? 18 : 22, "#c5a3ff");
  energyBar(
    barX + 6,
    barY,
    barW,
    mobile ? 18 : 22,
    energy,
    card ? card.cost : 0,
  );
  if (!mobile)
    text(
      "contexto compartilhado da guilda · +0,65/s",
      barX + barW + 66,
      barY + 11,
      12,
      C.muted,
    );
  // A janela do estudo ocupa o lugar do baralho: enquanto ela está aberta, jogar
  // outra carta não é opção. É esse custo que faz a pergunta valer atenção.
  if (quizPanel(team, now)) return;
  const deckY = mobile ? H - 154 : 730,
    cw = mobile ? 95 : 252,
    ch = mobile ? 132 : 148,
    gap = mobile ? 6 : 24,
    dx = (W - (4 * cw + 3 * gap)) / 2;
  state.cards.forEach((c, i) => {
    const x = dx + i * (cw + gap),
      y = deckY,
      selected = selection === c.id,
      affordable = energy + 1e-8 >= c.cost,
      disabled = !canPlay || !affordable;
    ctx.save();
    if (disabled) ctx.globalAlpha = 0.46;
    panel(x, y, cw, ch);
    rect(x + 6, y + 5, cw - 12, 4, c.color, 2);
    if (selected) {
      round(x - 3, y - 4, cw + 6, ch + 8, 17);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = C.gold;
      ctx.stroke();
    }
    portrait(
      c.model,
      x + (mobile ? 20 : 8),
      y + 10,
      mobile ? 55 : 84,
      mobile ? 66 : 106,
    );
    icon("gem", x + cw - 19, y + 26, 26, "#bd8ef1");
    text(c.cost, x + cw - 19, y + 26, 12, C.cream, "center", 900);
    text(
      c.name,
      mobile ? x + cw / 2 : x + 96,
      y + (mobile ? 88 : 38),
      mobile ? 12 : 20,
      C.cream,
      mobile ? "center" : "left",
      900,
    );
    if (mobile) {
      text(
        ["Constrói", "Isola", "Valida", "Protege"][i],
        x + cw / 2,
        y + 98,
        10,
        c.color,
        "center",
        800,
      );
      text(
        [
          `${state.story.buildSeconds} s`,
          "permanente",
          `${state.story.reviewSeconds} s +`,
          "permanente",
        ][i],
        x + cw / 2,
        y + 113,
        9,
        C.muted,
        "center",
      );
    } else wrap(c.description, x + 96, y + 66, cw - 116, 12, C.muted, 18, 4);
    ctx.restore();
    hit(
      "card-" + c.id,
      x,
      y,
      cw,
      ch,
      `${i + 1}. ${c.name}, ${c.cost} de contexto. ${c.description}`,
      () => {
        selection = selection === c.id ? null : c.id;
      },
      disabled,
    );
  });
  const hint = card
    ? `Solte ${card.name} numa frente iluminada · dourado libera, vermelho recusa`
    : "Escolha uma carta e toque na frente · arrastar também funciona";
  text(
    hint,
    W / 2,
    mobile ? H - 16 : 892,
    mobile ? 10 : 13,
    C.gold,
    "center",
    800,
  );
  if (!me && !mobile)
    text(
      "Orquestrador: acompanhe as guildas pelo placar.",
      160,
      408,
      12,
      C.muted,
      "center",
    );
  if (state.paused)
    pill(
      "PAUSADO · agentes e contexto congelados",
      W / 2 - 172,
      mobile ? 130 : 100,
      C.gold,
      344,
    );
  if (drag?.active) {
    const c = state.cards.find((c) => c.id === drag.cardId);
    ctx.save();
    ctx.globalAlpha = 0.9;
    panel(pointer.x - 46, pointer.y - 70, 92, 100);
    icon(c.icon, pointer.x, pointer.y - 30, 38, c.color);
    text(c.name, pointer.x, pointer.y + 6, 12, C.cream, "center", 900);
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
// Na batalha o mapa é o palco: ocupa a largura inteira e os painéis passam a
// ocupar as sobras laterais, que a ilha na diagonal não alcança.
function sceneRect() {
  if (mobile) {
    if (screen === "home") return { x: -25, y: 185, w: 480, h: 255 };
    if (screen === "battle")
      // A altura reserva a faixa da guilda: no celular ver o time vale mais do
      // que os últimos 40 px de mapa.
      return { x: 0, y: 126, w: 430, h: clamp(H - 410, 230, 340) };
    return { x: 190, y: 95, w: 290, h: 290 };
  }
  if (screen === "home") return { x: 475, y: 134, w: 944, h: 535 };
  if (screen === "battle") return { x: 0, y: 78, w: 1440, h: 600 };
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
  aim();
  const sr = sceneRect();
  if (world)
    world.draw({
      time: t,
      rect: {
        x: sr.x * scale + ox,
        y: sr.y * scale + oy,
        w: sr.w * scale,
        h: sr.h * scale,
      },
      width: innerWidth,
      height: innerHeight,
      reduced,
      team: screen === "battle" ? viewTeam() : null,
      elapsed: elapsed(),
      progress:
        screen === "battle" && viewTeam()
          ? viewTeam().sites.map((site) =>
              buildProgress(viewTeam(), site, elapsed()),
            )
          : null,
      selectedSite,
      selectedCard: selection,
      targetSite: aimedSite,
      legal: aimLegality,
      paused: state?.paused,
    });
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
    // Com a pergunta aberta, os mesmos números escolhem a alternativa.
    const slot = Number(e.key) - 1;
    const option = controls.find((c) => c.id === "quiz-" + slot && !c.disabled);
    if (option) return option.fn();
    if (controls.some((c) => c.id.startsWith("quiz-"))) return;
    const card = state.cards[slot];
    if (card)
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
