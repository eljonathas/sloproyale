import { clamp } from "./theme.js";

/** Um retângulo em coordenadas de projeto. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** As telas do jogo. */
export type ScreenName = "home" | "lobby" | "battle" | "results";

/**
 * O sistema de coordenadas da interface.
 *
 * Tudo é desenhado num espaço de projeto fixo — 1440×900 no computador, 430 de
 * largura no celular — e a viewport cuida da escala e da margem até os pixels
 * reais. Assim nenhum componente precisa saber o tamanho da janela.
 */
export class Viewport {
  width = 1440;
  height = 900;
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  mobile = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.measure();
  }

  measure(): void {
    this.mobile = innerWidth < 800;
    this.width = this.mobile ? 430 : 1440;
    this.scale = this.mobile
      ? innerWidth / this.width
      : Math.min(innerWidth / 1440, innerHeight / 900);
    this.height = this.mobile
      ? Math.max(730, innerHeight / this.scale)
      : 900;
    this.offsetX = (innerWidth - this.width * this.scale) / 2;
    this.offsetY = this.mobile
      ? 0
      : (innerHeight - this.height * this.scale) / 2;

    const ratio = Math.min(devicePixelRatio, 2);
    this.canvas.width = innerWidth * ratio;
    this.canvas.height = innerHeight * ratio;
    this.canvas.style.width = innerWidth + "px";
    this.canvas.style.height = innerHeight + "px";
  }

  /** Converte um ponto do evento do mouse para coordenadas de projeto. */
  toDesign(clientX: number, clientY: number): { x: number; y: number } {
    return {
      x: (clientX - this.offsetX) / this.scale,
      y: (clientY - this.offsetY) / this.scale,
    };
  }

  /** Converte coordenadas de projeto para pixels reais da tela. */
  toDevice(rect: Rect): Rect {
    return {
      x: rect.x * this.scale + this.offsetX,
      y: rect.y * this.scale + this.offsetY,
      w: rect.w * this.scale,
      h: rect.h * this.scale,
    };
  }

  /**
   * Onde o diorama é desenhado em cada tela.
   *
   * Na batalha o mapa é o palco: ocupa a largura inteira e os painéis passam a
   * ocupar as sobras laterais, que a ilha na diagonal não alcança. No celular a
   * altura reserva a faixa da guilda — ver o time vale mais do que os últimos
   * 40 px de mapa.
   */
  sceneRect(screen: ScreenName): Rect {
    if (this.mobile) {
      if (screen === "home") return { x: -25, y: 185, w: 480, h: 255 };
      if (screen === "battle")
        return { x: 0, y: 126, w: 430, h: clamp(this.height - 410, 230, 340) };
      return { x: 190, y: 95, w: 290, h: 290 };
    }
    if (screen === "home") return { x: 475, y: 134, w: 944, h: 535 };
    if (screen === "battle") return { x: 0, y: 78, w: 1440, h: 600 };
    if (screen === "lobby") return { x: 955, y: 365, w: 470, h: 410 };
    return { x: 0, y: 150, w: 1440, h: 570 };
  }
}
