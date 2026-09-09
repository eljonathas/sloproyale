import { COLORS } from "./theme.js";

/**
 * O conjunto de ícones do jogo, desenhado em caminhos de canvas.
 *
 * Todos os símbolos são traçados numa grade de 40×40 centrada na origem e
 * depois escalados, o que mantém a espessura de traço coerente entre um ícone
 * de 11 px na placa e um de 38 px na carta arrastada.
 */
export type IconName =
  | "shield"
  | "crown"
  | "branch"
  | "swords"
  | "tools"
  | "mage"
  | "scroll"
  | "hourglass"
  | "people"
  | "check"
  | "cross"
  | "brain"
  | "sound"
  | "expand"
  | "gem";

const GRID = 40;

export function drawIcon(
  ctx: CanvasRenderingContext2D,
  name: IconName | string,
  x: number,
  y: number,
  size = 32,
  color: string = COLORS.gold,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / GRID, size / GRID);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  const line = (ax: number, ay: number, bx: number, by: number, width = 1) => {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };

  switch (name) {
    case "shield":
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
      break;
    case "crown":
      ctx.moveTo(-17, -9);
      ctx.lineTo(-13, 12);
      ctx.lineTo(13, 12);
      ctx.lineTo(17, -9);
      ctx.lineTo(7, -2);
      ctx.lineTo(0, -16);
      ctx.lineTo(-7, -2);
      ctx.closePath();
      ctx.fill();
      line(-11, 17, 11, 17, 3);
      break;
    case "branch":
      line(-9, -14, -9, 14, 3);
      line(-9, 7, 11, -5, 3);
      for (const [a, b] of [
        [-9, -15],
        [-9, 15],
        [11, -9],
      ] as const) {
        ctx.beginPath();
        ctx.arc(a, b, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "swords":
    case "tools":
      for (const angle of [-0.7, 0.7]) {
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.roundRect(-2.5, -19, 5, 27, 1);
        ctx.fillStyle = color;
        ctx.fill();
        line(-8, 7, 8, 7, 3);
        line(0, 8, 0, 17, 4);
        ctx.restore();
      }
      break;
    case "mage":
      ctx.moveTo(0, -19);
      ctx.lineTo(-14, 11);
      ctx.lineTo(14, 11);
      ctx.closePath();
      ctx.fill();
      line(-18, 16, 18, 16, 4);
      ctx.fillStyle = COLORS.panel;
      ctx.beginPath();
      ctx.arc(1, 3, 2.5, 0, 7);
      ctx.fill();
      break;
    case "scroll":
      ctx.beginPath();
      ctx.roundRect(-13, -16, 26, 32, 4);
      ctx.stroke();
      for (let i = -7; i <= 7; i += 7) line(-7, i, 7, i, 2);
      break;
    case "hourglass":
      line(-12, -17, 12, -17, 3);
      line(-12, 17, 12, 17, 3);
      ctx.beginPath();
      ctx.moveTo(-10, -15);
      ctx.lineTo(10, 15);
      ctx.lineTo(-10, 15);
      ctx.lineTo(10, -15);
      ctx.closePath();
      ctx.stroke();
      break;
    case "people":
      for (const px of [-9, 9]) {
        ctx.beginPath();
        ctx.arc(px, -7, 5, 0, 7);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, 13, 10, Math.PI, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case "check":
      ctx.moveTo(-12, 0);
      ctx.lineTo(-3, 10);
      ctx.lineTo(14, -11);
      ctx.stroke();
      break;
    case "cross":
      ctx.moveTo(-11, -11);
      ctx.lineTo(11, 11);
      ctx.moveTo(11, -11);
      ctx.lineTo(-11, 11);
      ctx.stroke();
      break;
    case "brain":
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
      line(-5, 16, 5, 16, 3);
      break;
    case "sound":
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
      break;
    case "expand":
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(5, -15);
        ctx.lineTo(15, -15);
        ctx.lineTo(15, -5);
        ctx.stroke();
        ctx.restore();
      }
      break;
    case "gem":
      ctx.moveTo(0, -19);
      ctx.lineTo(14, 0);
      ctx.lineTo(0, 19);
      ctx.lineTo(-14, 0);
      ctx.closePath();
      ctx.fill();
      break;
    default:
      ctx.font = "900 28px Nunito";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", 0, 0);
  }
  ctx.restore();
}
