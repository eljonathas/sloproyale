/** A paleta do jogo. Um só lugar para mexer nas cores. */
export const COLORS = {
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
} as const;

/** Cores dos botões, na ordem: topo, base, sombra, borda. */
export const BUTTON_PALETTES = {
  gold: ["#ffdc86", "#e6a945", "#80542c", "#fff0c577"],
  blue: ["#6ac5fc", "#2b87c8", "#16476f", "#fff0c577"],
  dark: ["#36516a", "#243b50", "#132639", "#748ca066"],
  green: ["#a5eaba", "#5bba83", "#286343", "#fff0c577"],
  red: ["#ee9d89", "#c0645b", "#6a363d", "#fff0c577"],
} as const;

export type ButtonKind = keyof typeof BUTTON_PALETTES;

/** Estados de uma alternativa da pergunta. Topo, base, sombra, borda, texto. */
export const CHOICE_PALETTES = {
  idle: ["#36516a", "#243b50", "#132639", "#748ca066", COLORS.cream],
  correct: ["#a5eaba", "#5bba83", "#286343", "#e8fff0", "#123626"],
  wrong: ["#ee9d89", "#c0645b", "#6a363d", "#ffe4d9", "#4a1f22"],
  faded: ["#27394b", "#1a2b3b", "#0e1d2b", "#5f778a2e", "#7f97a8"],
} as const;

export type ChoiceMark = "correct" | "wrong" | "faded";

/** Os quatro arquétipos mostrados na tela inicial. */
export const ROLE_CARDS: readonly {
  readonly model: string;
  readonly title: string;
  readonly blurb: string;
  readonly icon: string;
  readonly color: string;
}[] = [
  { model: "Knight", title: "Orquestrador", blurb: "Divide e consolida", icon: "crown", color: "#70b8f2" },
  { model: "Barbarian", title: "Construtor", blurb: "Implementa a missão", icon: "tools", color: "#f5b779" },
  { model: "Rogue_Hooded", title: "Explorador", blurb: "Investiga o contexto", icon: "branch", color: "#8cddb6" },
  { model: "Mage", title: "Sentinela", blurb: "Revisa e protege", icon: "shield", color: "#c4a2ff" },
];

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
