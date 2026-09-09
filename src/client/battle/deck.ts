import type { CardId, CardView } from "../../shared/protocol.js";
import type { AgentArena } from "../app.js";
import { PlayPreview } from "../rules.js";
import { COLORS, clamp } from "../theme.js";

const ROLES: Record<CardId, string> = {
  builder: "Constrói",
  worktree: "Isola",
  reviewer: "Valida",
  harness: "Protege",
};

interface CardMotion {
  from: number;
  to: number;
  at: number;
  value: number;
}

/** A mão de cartas: a seleção vem à frente e abre espaço entre as vizinhas. */
export class Deck {
  private readonly motion = new Map<CardId, CardMotion>();

  constructor(private readonly app: AgentArena) {}

  reset(): void {
    this.motion.clear();
  }

  quote(
    card: CardView,
    siteId: number | null = null,
  ): { minimum: number; label: string } {
    const { session, state } = this.app;
    const sites =
      session.team?.sites.filter(
        (site) =>
          site.level < (state?.story.maxLevel ?? 3) &&
          (siteId === null || site.id === siteId),
      ) ?? [];
    const prices = sites.length
      ? sites.map((site) => PlayPreview.cost(card, site.level))
      : [card.costs[0]];
    const minimum = Math.min(...prices);
    const maximum = Math.max(...prices);
    return {
      minimum,
      label: minimum === maximum ? String(minimum) : `${minimum}–${maximum}`,
    };
  }

  private emphasis(id: CardId, target: number): number {
    const { time, reduced } = this.app;
    let motion = this.motion.get(id);
    if (!motion) {
      motion = { from: 0, to: target, at: time, value: 0 };
      this.motion.set(id, motion);
    }
    if (motion.to !== target) {
      motion.from = motion.value;
      motion.to = target;
      motion.at = time;
    }
    const t = reduced ? 1 : clamp((time - motion.at) / 340, 0, 1);
    // Um pequeno retorno ao encaixar, sem oscilação contínua durante a leitura.
    const u = t - 1;
    const ease =
      target > motion.from ? 1 + 2.4 * u ** 3 + 1.4 * u ** 2 : 1 + u ** 3;
    motion.value = motion.from + (target - motion.from) * ease;
    return motion.value;
  }

  draw(
    y: number,
    energy: number,
    selection: CardId | null,
    onPick: (card: CardView) => void,
    dragging: CardId | null = null,
    targetSite: number | null = null,
  ): void {
    const { painter, controls, viewport, state, time, reduced } = this.app;
    if (!state) return;
    const mobile = viewport.mobile;
    const width = mobile ? 91 : 174;
    const height = mobile ? 152 : 180;
    const gap = mobile ? 9 : 26;
    const handWidth =
      state.cards.length * width + (state.cards.length - 1) * gap;
    const start = (viewport.width - handWidth) / 2;

    if (!mobile) {
      const inspected =
        state.cards.find((card) => card.id === selection) ??
        state.cards.find(
          (card) =>
            controls.hover === "card-" + card.id ||
            controls.focus === "card-" + card.id,
        );
      painter.text(
        inspected?.name ?? "Seu baralho",
        48,
        y + 38,
        23,
        inspected?.color ?? COLORS.cream,
        "left",
        900,
      );
      painter.wrap(
        inspected?.description ??
          "Selecione uma carta e escolha a frente. Os recursos são compartilhados com sua guilda.",
        48,
        y + 72,
        240,
        13,
        COLORS.muted,
        20,
        5,
      );
    }

    const cards = state.cards.map((card, index) => {
      const selected = card.id === selection;
      const price = this.quote(card, targetSite);
      const disabled =
        !this.app.canPlay || energy + 1e-8 < this.quote(card).minimum;
      const hover =
        controls.hover === "card-" + card.id ||
        controls.focus === "card-" + card.id;
      const emphasis = this.emphasis(
        card.id,
        disabled ? 0 : selected ? 1 : hover ? 0.32 : 0,
      );
      const entrance = reduced
        ? 1
        : clamp((time - this.app.phaseAt - index * 55) / 420, 0, 1);
      const deal = 1 - (1 - entrance) ** 3;
      const scale = 1 + emphasis * 0.055;
      const fan = index - (state.cards.length - 1) / 2;
      const cx = start + index * (width + gap) + width / 2;
      const cy =
        y +
        height / 2 +
        Math.abs(fan) * (mobile ? 2 : 4) -
        emphasis * (mobile ? 18 : 22) +
        (1 - deal) * 36;
      const rotation = reduced
        ? 0
        : fan * (mobile ? 0.024 : 0.034) * (1 - emphasis);
      return {
        card,
        price,
        index,
        selected,
        disabled,
        emphasis,
        scale,
        cx,
        cy,
        rotation,
        deal,
      };
    });

    for (const item of cards)
      item.cx += cards.reduce(
        (shift, other) =>
          shift +
          Math.sign(item.index - other.index) *
            other.emphasis *
            (mobile ? 4 : 10),
        0,
      );

    // Desenho e cliques seguem a mesma ordem: a carta elevada fica por cima.
    const firstControl = controls.all.length;
    cards.sort((a, b) => a.emphasis - b.emphasis || a.index - b.index);
    for (const item of cards) {
      const {
        card,
        price,
        index,
        selected,
        disabled,
        emphasis,
        scale,
        cx,
        cy,
        rotation,
        deal,
      } = item;
      painter.save();
      painter.ctx.translate(cx, cy);
      painter.ctx.rotate(rotation);
      painter.ctx.scale(scale, scale);
      painter.alpha = deal * (disabled ? 0.5 : dragging === card.id ? 0.4 : 1);
      this.face(card, index, width, height, selected, emphasis, price.label);
      painter.restore();
      controls.hit(
        "card-" + card.id,
        cx - (width * scale) / 2,
        cy - (height * scale) / 2,
        width * scale,
        height * scale,
        `${index + 1}. ${card.name}, ${price.label} de contexto, conforme o nível da frente. ${card.description}`,
        () => onPick(card),
        disabled,
        rotation,
        firstControl + index,
      );
    }
  }

  private face(
    card: CardView,
    index: number,
    width: number,
    height: number,
    selected: boolean,
    emphasis: number,
    price: string,
  ): void {
    const { painter, state, time, reduced } = this.app;
    const ctx = painter.ctx;
    const compact = width < 120;
    const x = -width / 2;
    const y = -height / 2;
    const stageH = height * 0.66;

    // Espessura da carta e brilho na borda dão leitura de objeto na mão.
    painter.rect(x + 2, y + 8, width - 4, height, "#081525", 12, "#506172");
    painter.rect(x + 1, y + 4, width - 2, height, "#2b3d50", 12, "#9b9984");
    painter.save();
    ctx.shadowColor = selected ? "#ffcf7780" : "#030d1dbb";
    ctx.shadowBlur = selected ? 20 : 12;
    ctx.shadowOffsetY = selected ? 8 : 4;
    painter.gradient(
      x,
      y,
      width,
      height,
      selected ? "#ffedbd" : "#c9c7b5",
      selected ? "#b67a36" : "#65798a",
      12,
      selected ? "#fff0c6" : "#d1d3ca",
    );
    painter.restore();
    painter.gradient(
      x + 4,
      y + 4,
      width - 8,
      height - 8,
      "#263c52",
      "#0e2135",
      9,
    );

    painter.save();
    painter.path(x + 6, y + 6, width - 12, stageH, 7);
    ctx.clip();
    painter.gradient(
      x + 6,
      y + 6,
      width - 12,
      stageH,
      card.color + "bc",
      "#193448",
      7,
    );
    const glow = ctx.createRadialGradient(
      0,
      y + stageH * 0.52,
      0,
      0,
      y + stageH * 0.52,
      width * 0.72,
    );
    glow.addColorStop(0, "#fff2d078");
    glow.addColorStop(1, "#ffffff00");
    painter.rect(x + 6, y + 6, width - 12, stageH, glow, 0);
    painter.save();
    painter.alpha *= 0.13;
    painter.icon(
      card.icon,
      width * 0.23,
      y + stageH * 0.43,
      width * 0.64,
      "#ffffff",
    );
    painter.restore();
    const portraitW = compact ? width * 1.03 : width * 0.86;
    const portraitH = (portraitW * 300) / 256;
    this.app.portrait(
      card.model,
      -portraitW / 2,
      y + (compact ? 6 : -8) - emphasis * 3,
      portraitW,
      portraitH,
    );
    // O rodapé do retrato se mistura à faixa do nome.
    painter.gradient(
      x + 6,
      y + stageH - 22,
      width - 12,
      34,
      "#10223500",
      "#102235",
      0,
    );
    const motion = this.motion.get(card.id);
    const shimmer = motion ? (time - motion.at) / 650 : 2;
    if (selected && !reduced && shimmer >= 0 && shimmer <= 1) {
      const sweep = x - width + shimmer * width * 3;
      ctx.translate(sweep, 0);
      ctx.rotate(-0.28);
      painter.rect(-10, y - height, 16, height * 3, "#fff8db2b", 0);
    }
    painter.restore();

    // Custo sempre no mesmo canto; o número continua visível sobre o retrato.
    const badge = compact ? 27 : 35;
    const bx = x + (compact ? 17 : 23);
    const by = y + (compact ? 17 : 22);
    painter.icon("gem", bx, by + 2, badge + 6, "#442665");
    painter.icon("gem", bx, by, badge, "#c48af5");
    painter.display(
      price,
      bx,
      by - 1,
      price.length > 1 ? (compact ? 11 : 15) : compact ? 19 : 24,
      "#fff3e1",
      "center",
    );
    if (!compact) {
      painter.rect(width / 2 - 26, y + 12, 16, 19, "#10233788", 4, "#ffffff33");
      painter.text(
        index + 1,
        width / 2 - 18,
        y + 21,
        11,
        "#ffffff",
        "center",
        900,
      );
    }
    painter.display(
      card.name,
      0,
      y + stageH + 14,
      compact ? 13 : 22,
      COLORS.cream,
      "center",
    );
    painter.text(
      ROLES[card.id],
      0,
      y + stageH + (compact ? 31 : 35),
      compact ? 10 : 12,
      card.color,
      "center",
      900,
    );
    const duration =
      card.id === "builder"
        ? `${state?.story.buildSeconds ?? 24} s`
        : card.id === "reviewer"
          ? `${state?.story.reviewSeconds ?? 8} s +`
          : "permanente";
    if (compact)
      painter.text(duration, 0, y + height - 8, 9, COLORS.muted, "center");
    else
      painter.text(
        duration,
        width / 2 - 11,
        y + height - 11,
        10,
        COLORS.muted,
        "right",
      );
    if (selected) {
      painter.line(
        x + 14,
        y + height - 5,
        width / 2 - 14,
        y + height - 5,
        "#ffe4a1",
        2,
      );
    }
  }

  /** A carta arrastada conserva retrato, moldura e custo da carta na mão. */
  ghost(card: CardView, x: number, y: number, targetSite: number | null): void {
    const { painter, state } = this.app;
    painter.save();
    painter.alpha = 0.94;
    painter.ctx.translate(x, y - 72);
    this.face(
      card,
      state?.cards.findIndex((c) => c.id === card.id) ?? 0,
      91,
      152,
      true,
      0,
      this.quote(card, targetSite).label,
    );
    painter.restore();
  }
}
