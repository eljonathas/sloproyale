import type { SiteView, TeamView } from "../../shared/protocol.js";
import type { AgentArena } from "../arena.js";
import type { NextMove, Preview } from "../rules.js";
import { COLORS, clamp } from "../theme.js";
import type { Rect } from "../viewport.js";

/** Onde a frente aparece na tela, vindo do diorama. */
export interface SitePoint {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  /** Topo atual da construção: a placa se apoia nele. */
  readonly top: number;
}

/** O que uma frente mostra neste quadro. */
export interface SiteState {
  readonly site: SiteView;
  readonly preview: Preview | null;
  readonly aiming: boolean;
  readonly progress: number;
  /** A placa mostra o texto completo, e não só nome e barra. */
  readonly open: boolean;
  /** Multiplicador que esta entrega vai receber. */
  readonly multiplier: number;
  /** Pontos que a entrega paga agora, já multiplicados. */
  readonly value: number;
  /** A carta que o Harness recomenda, quando a frente está protegida. */
  readonly nextMove: NextMove | null;
}

/** A caixa já resolvida de uma placa. */
interface Box {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  open: boolean;
}

/** Uma ação desenhada no chão da frente, que as placas precisam evitar. */
export interface GroundAction extends Rect {
  readonly id: number;
}

/** Aceleração conquistada, para a barra piscar. */
export interface Boost {
  siteId: number | null;
  at: number;
}

const BOOST_MS = 1500;

/**
 * Como cada próximo passo aparece no conselho da frente protegida. Os rótulos
 * são curtos de propósito: a placa é estreita, e o porquê inteiro já está no
 * diário da guilda quando a jogada acontece.
 */
const ADVICE: Record<NextMove, readonly [string, string, string]> = {
  builder: ["tools", "Harness sugere: Construtor", "#edba80"],
  worktree: ["branch", "Harness sugere: isolar antes", "#83dbb1"],
  reviewer: ["mage", "Harness sugere: Revisor", "#c9a2fa"],
  deliver: ["crown", "Harness liberou: entregar", COLORS.green],
};

/** Versões curtas do conselho, para a placa estreita do celular. */
const ADVICE_SHORT: Record<NextMove, string> = {
  builder: "Construtor",
  worktree: "Isole antes",
  reviewer: "Revisor",
  deliver: "Pode entregar",
};

/**
 * As placas das frentes.
 *
 * A placa fica pequena em repouso — nome, nível e uma barra fina, com as
 * insígnias reduzidas a ícones — e só abre com o texto completo quando há uma
 * carta na mão, quando a frente está escolhida ou sob o cursor. Três placas
 * grandes cobriam justamente o tabuleiro que elas descrevem.
 */
export class SiteBanners {
  constructor(private readonly app: AgentArena) {}

  /**
   * Resolve a posição de todas as placas antes de desenhar qualquer uma.
   *
   * As frentes são vizinhas na diagonal, então as placas colidem. Elas se
   * afastam primeiro na horizontal, o que mantém cada uma perto da própria
   * construção; quando não há largura — o caso do celular — sobem acima do
   * botão de entrega, que fica fixo no chão da própria frente.
   */
  layout(
    points: readonly SitePoint[],
    states: Map<number, SiteState>,
    actions: readonly GroundAction[],
  ): Map<number, Box> {
    const mobile = this.app.viewport.mobile;
    const top = this.app.viewport.sceneRect("battle").y + 4;
    const width = this.app.viewport.width;

    const boxes: Box[] = points.map((point) => {
      const state = states.get(point.id)!;
      const w = state.open ? (mobile ? 148 : 218) : mobile ? 124 : 158;
      // A frente protegida ganha uma linha a mais: é onde o Harness diz qual
      // é a próxima carta certa.
      const advice = state.site.harness && state.nextMove ? (mobile ? 15 : 17) : 0;
      const h = state.preview
        ? mobile
          ? 74
          : 98
        : state.open
          ? (mobile ? 56 : 78) + advice
          : mobile
            ? 38
            : 44;
      return {
        id: point.id,
        w,
        h,
        open: state.open,
        x: point.x - w / 2,
        y: Math.max(top, point.top - h - (mobile ? 8 : 12)),
      };
    });

    for (let pass = 0; pass < 3; pass++) {
      this.separate(boxes);
      // O botão de entrega não se move: são as placas das outras frentes que
      // saem da frente dele.
      for (const box of boxes)
        for (const action of actions) {
          if (action.id === box.id) continue;
          const gapX =
            Math.min(box.x + box.w, action.x + action.w) -
            Math.max(box.x, action.x) +
            10;
          const gapY =
            Math.min(box.y + box.h, action.y + action.h) -
            Math.max(box.y, action.y) +
            4;
          if (gapX <= 0 || gapY <= 0) continue;
          box.x += box.x + box.w / 2 < action.x + action.w / 2 ? -gapX : gapX;
        }
    }
    for (const box of boxes) box.x = clamp(box.x, 10, width - box.w - 10);

    for (const box of boxes)
      for (const action of actions) {
        if (action.id === box.id) continue;
        if (
          box.x < action.x + action.w + 4 &&
          action.x < box.x + box.w + 4 &&
          box.y < action.y + action.h + 4 &&
          action.y < box.y + box.h + 4
        )
          box.y = Math.max(top, action.y - box.h - 6);
      }
    this.separate(boxes);
    for (const box of boxes) box.x = clamp(box.x, 10, width - box.w - 10);
    return new Map(boxes.map((box) => [box.id, box]));
  }

  private separate(boxes: Box[]): void {
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const gapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + 12;
        const gapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + 6;
        if (gapX <= 0 || gapY <= 0) continue;
        const push = gapX / 2;
        a.x += a.x < b.x ? -push : push;
        b.x += a.x < b.x ? push : -push;
      }
  }

  draw(
    point: SitePoint,
    box: Box,
    state: SiteState,
    team: TeamView,
    boost: Boost,
  ): Box {
    const { painter, viewport } = this.app;
    const mobile = viewport.mobile;
    const { site, preview, progress } = state;
    const { x, y, w, h, open } = box;

    const edge = preview
      ? preview.ok
        ? preview.warn
          ? "#ffb27c"
          : COLORS.gold
        : COLORS.red
      : site.level === 3
        ? COLORS.green
        : state.aiming
          ? COLORS.gold
          : "#8298aa55";

    painter.save();
    painter.ctx.shadowColor = "#04101fbb";
    painter.ctx.shadowBlur = 18;
    painter.ctx.shadowOffsetY = 7;
    painter.gradient(
      x,
      y,
      w,
      h,
      state.aiming ? "#2f5170" : "#1b3149",
      "#0d2033",
      12,
      edge,
    );
    painter.restore();
    this.drawTail(point, box, edge);

    const nameY = y + (open ? (mobile ? 15 : 18) : mobile ? 13 : 16);
    painter.text(
      site.name,
      x + 11,
      nameY,
      open ? (mobile ? 14 : 17) : mobile ? 12 : 15,
      COLORS.cream,
      "left",
      900,
    );
    if (preview && site.level < this.app.state!.story.maxLevel) {
      painter.icon("gem", x + w - 36, nameY, mobile ? 15 : 18, "#c5a3ff");
      painter.text(
        preview.cost,
        x + w - 17,
        nameY,
        mobile ? 13 : 16,
        COLORS.cream,
        "center",
        900,
      );
    } else this.drawPips(x + w - 50, nameY, site.level);

    // Em repouso as insígnias viram ícones no fim da barra: o estado continua à
    // vista sem a placa crescer, e a cena 3D já mostra cerca, cúpula e falhas.
    const marks: [string, string][] = [];
    if (!open) {
      const crew = team.jobs.filter(
        (job) => job.cardId === "builder" && job.siteId === site.id,
      ).length;
      if (crew > 1) marks.push(["tools", COLORS.gold]);
      if (site.worktrees) marks.push(["branch", COLORS.green]);
      if (site.harness) marks.push(["shield", COLORS.blue]);
      if (site.faults) marks.push(["gem", COLORS.red]);
    }
    const step = mobile ? 13 : 15;
    const markWidth = marks.length * step;
    const barY = y + (open ? (mobile ? 26 : 33) : mobile ? 25 : 30);
    const barW = w - 22 - markWidth;
    const barH = open ? (mobile ? 7 : 9) : mobile ? 6 : 7;
    marks.forEach(([icon, color], index) =>
      painter.icon(
        icon,
        x + w - 11 - markWidth + index * step + step / 2,
        barY + barH / 2,
        mobile ? 11 : 13,
        color,
      ),
    );

    this.drawBar(x, barY, barW, barH, w, y, site, progress, boost);
    if (!open) return box;

    const line3 = y + (mobile ? 45 : 62);
    if (preview) {
      painter.wrap(
        preview.hint,
        x + 12,
        line3 - (mobile ? 4 : 6),
        barW,
        mobile ? 10 : 12,
        preview.ok ? (preview.warn ? "#ffb27c" : COLORS.gold) : COLORS.red,
        mobile ? 13 : 15,
        3,
      );
      return box;
    }
    this.drawBadges(x, line3, state, team, progress);
    if (site.harness && state.nextMove)
      this.drawAdvice(x, line3 + (mobile ? 15 : 17), w, state.nextMove);
    return box;
  }

  /**
   * O conselho da frente protegida.
   *
   * O Harness controla a operação, então é ele quem sabe qual é o próximo passo
   * legítimo: isolar antes de somar Construtores, revisar antes de entregar.
   * Quem pagou pela proteção joga com esse mapa à vista.
   */
  private drawAdvice(x: number, y: number, w: number, move: NextMove): void {
    const { painter, viewport } = this.app;
    const mobile = viewport.mobile;
    const [icon, label, color] = ADVICE[move];
    painter.rect(x + 8, y - (mobile ? 7 : 8), w - 16, mobile ? 14 : 16, "#12314c", 5);
    painter.icon(icon, x + 18, y, mobile ? 10 : 12, color);
    painter.text(
      mobile ? ADVICE_SHORT[move] : label,
      x + 27,
      y,
      mobile ? 9 : 11,
      color,
      "left",
      900,
    );
  }

  /**
   * Rabicho apontando a construção. Quanto mais longe a placa foi empurrada,
   * mais fino ele fica: um triângulo largo e comprido pesaria mais que a placa.
   */
  private drawTail(point: SitePoint, box: Box, edge: string): void {
    const ctx = this.app.painter.ctx;
    const tail = clamp(point.x, box.x + 18, box.x + box.w - 18);
    const reach = Math.max(0, point.top - 4 - (box.y + box.h));
    const base = clamp(9 - reach / 26, 3.5, 9);
    ctx.beginPath();
    ctx.moveTo(tail - base, box.y + box.h - 1);
    ctx.lineTo(tail + base, box.y + box.h - 1);
    ctx.lineTo(point.x, Math.max(box.y + box.h + 12, point.top - 4));
    ctx.closePath();
    ctx.fillStyle = "#0d2033";
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private drawPips(x: number, y: number, level: number): void {
    for (let i = 0; i < 3; i++)
      this.app.painter.rect(
        x + i * 13,
        y - 5,
        10,
        10,
        i < level ? COLORS.gold : "#0d1f3199",
        3,
        i < level ? "#ffffff55" : "#ffffff2e",
      );
  }

  private drawBar(
    x: number,
    barY: number,
    barW: number,
    barH: number,
    w: number,
    y: number,
    site: SiteView,
    progress: number,
    boost: Boost,
  ): void {
    const { painter, viewport, time } = this.app;
    const mobile = viewport.mobile;
    const phase =
      boost.siteId === site.id ? clamp((time - boost.at) / BOOST_MS, 0, 1) : 1;
    painter.rect(x + 11, barY, barW, barH, "#0a1a2b", 5);
    if (progress <= 0) return;

    const fill = (barW * progress) / 100;
    const base = site.faults
      ? COLORS.red
      : site.reviewed
        ? COLORS.green
        : COLORS.blue;
    if (phase >= 1) {
      painter.rect(x + 11, barY, fill, barH, base, 5);
      return;
    }

    // A barra vira dourada e volta à cor normal, com um brilho crescendo por
    // baixo: a leitura é "esta obra acabou de acelerar".
    const ctx = painter.ctx;
    ctx.save();
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 20 * (1 - phase);
    painter.rect(x + 11, barY, fill, barH, COLORS.gold, 5);
    ctx.restore();

    // Duas passagens de luz percorrem o trecho já construído.
    const sweep = (phase * 2) % 1;
    const sweepX = x + 11 + fill * sweep;
    ctx.save();
    painter.path(x + 11, barY, fill, barH, 5);
    ctx.clip();
    const glare = ctx.createLinearGradient(sweepX - 26, 0, sweepX + 26, 0);
    glare.addColorStop(0, "#ffffff00");
    glare.addColorStop(0.5, "#fffdf2cc");
    glare.addColorStop(1, "#ffffff00");
    ctx.fillStyle = glare;
    ctx.fillRect(x + 11, barY, fill, barH);
    ctx.restore();

    // Etiqueta subindo e apagando acima da placa, sem cobrir o nome da frente.
    ctx.save();
    ctx.globalAlpha = 1 - phase * phase;
    const speedup = this.app.state?.study.speedup ?? 0.5;
    const tag = `+${Math.round(speedup * 100)}% VELOCIDADE`;
    const tagW = painter.measure(tag, mobile ? 9 : 11, 900) + 20;
    const tagY = y - 12 - phase * 18;
    painter.rect(
      x + w / 2 - tagW / 2,
      tagY - 9,
      tagW,
      19,
      "#2e2107f2",
      9,
      COLORS.gold,
    );
    painter.text(
      tag,
      x + w / 2,
      tagY + 1,
      mobile ? 9 : 11,
      COLORS.gold,
      "center",
      900,
    );
    ctx.restore();
  }

  private drawBadges(
    x: number,
    line3: number,
    state: SiteState,
    team: TeamView,
    progress: number,
  ): void {
    const { painter, viewport } = this.app;
    const mobile = viewport.mobile;
    const site = state.site;
    let cursor = 12;
    const mark = (icon: string, color: string, label: string) => {
      painter.icon(icon, x + cursor + 6, line3, mobile ? 12 : 15, color);
      painter.text(
        label,
        x + cursor + 14,
        line3,
        mobile ? 9 : 11,
        color,
        "left",
        800,
      );
      cursor +=
        (mobile ? 18 : 20) + painter.measure(label, mobile ? 9 : 11, 800);
    };
    const crew = team.jobs.filter(
      (job) => job.cardId === "builder" && job.siteId === site.id,
    ).length;
    if (crew > 1)
      mark(
        "tools",
        COLORS.gold,
        mobile ? `${crew} frentes` : `${crew} frentes · ${crew}×`,
      );
    if (site.worktrees)
      mark(
        "branch",
        COLORS.green,
        `${site.worktrees} canteiro${site.worktrees > 1 ? "s" : ""}`,
      );
    // O multiplicador substitui o selo simples do harness: ele já diz que a
    // frente está protegida e quanto essa disciplina vale na entrega.
    if (state.multiplier > 1)
      mark(
        site.harness ? "shield" : "branch",
        COLORS.gold,
        `${state.multiplier.toLocaleString("pt-BR")}×`,
      );
    else if (site.harness)
      mark("shield", COLORS.blue, mobile ? "protegida" : "harness");
    if (site.conflicted)
      mark("cross", COLORS.red, mobile ? "sem bônus" : "conflito · sem bônus");
    if (site.faults)
      mark(
        "gem",
        COLORS.red,
        mobile ? `${site.faults} falha` : `${site.faults} falha(s)`,
      );
    if (cursor > 12) return;

    painter.text(
      site.level === 3
        ? "Concluída"
        : site.reviewed
          ? mobile
            ? "Pronta para entregar"
            : "Revisada · pronta para entregar"
          : progress >= 100
            ? mobile
              ? "Falta revisar"
              : "Obra pronta · falta revisar"
            : progress > 0
              ? `Construindo · ${Math.round(progress)}%`
              : mobile
                ? "Envie um Construtor"
                : "Aguardando um Construtor",
      x + 12,
      line3,
      mobile ? 10 : 12,
      site.reviewed ? COLORS.green : COLORS.muted,
      "left",
      800,
    );
  }
}
