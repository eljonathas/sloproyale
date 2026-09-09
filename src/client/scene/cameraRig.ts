import * as THREE from "three";

/**
 * Ângulo do diorama. A vista de batalha usa o mesmo ângulo da vitrine para que
 * o tabuleiro fique na diagonal: assim as três frentes se afastam na
 * horizontal, que é o eixo com sobra numa tela de computador.
 */
const AZIMUTH = Math.PI / 4;
const HEIGHT = 30;
const RADIUS = 32;

/**
 * Eixos de tela da câmera ortográfica. A direção é fixa, então dá para medir o
 * tabuleiro contra eles uma única vez, sem depender do estado da câmera.
 */
const LENGTH = Math.hypot(RADIUS, HEIGHT);
const FLATTEN = HEIGHT / LENGTH;
const RISE = RADIUS / LENGTH;
const RIGHT = new THREE.Vector3(Math.cos(AZIMUTH), 0, -Math.sin(AZIMUTH));
const UP = new THREE.Vector3(
  -FLATTEN * Math.sin(AZIMUTH),
  RISE,
  -FLATTEN * Math.cos(AZIMUTH),
);

/** Retângulo da tela onde o diorama é desenhado, em pixels do dispositivo. */
export interface Viewport {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A extensão do tabuleiro medida contra os eixos de tela da câmera. */
class Extent {
  horizontal: [number, number] = [Infinity, -Infinity];
  vertical: [number, number] = [Infinity, -Infinity];

  reset(): void {
    this.horizontal = [Infinity, -Infinity];
    this.vertical = [Infinity, -Infinity];
  }

  widen(h: number, v: number): void {
    if (h < this.horizontal[0]) this.horizontal[0] = h;
    if (h > this.horizontal[1]) this.horizontal[1] = h;
    if (v < this.vertical[0]) this.vertical[0] = v;
    if (v > this.vertical[1]) this.vertical[1] = v;
  }

  get measured(): boolean {
    return Number.isFinite(this.horizontal[0]);
  }
}

/**
 * A câmera e o enquadramento.
 *
 * O retângulo recebido é preenchido pelo eixo mais apertado, e não só pela
 * altura: era isso que fazia o mapa aparecer pequeno num painel largo. A
 * extensão é medida malha a malha, não pela caixa envolvente do conjunto —
 * somar a altura do castelo à diagonal do terreno inflaria o eixo vertical em
 * torno de 20% e encolheria o tabuleiro na mesma proporção.
 */
export class CameraRig {
  readonly camera = new THREE.OrthographicCamera(-19, 19, 19, -19, 0.1, 180);
  /** A área de jogo, sem a rocha decorativa: é o que a batalha enquadra. */
  private readonly play = new Extent();
  /** Tudo, inclusive a rocha: é o que a vitrine enquadra. */
  private readonly full = new Extent();
  private measuredAt = -1;

  /** Mede o tabuleiro quando novos modelos terminam de carregar. */
  measure(island: any, loaded: number): void {
    if (this.measuredAt === loaded) return;
    this.measuredAt = loaded;
    const bob = island.position.y;
    island.position.y = 0;
    island.updateMatrixWorld(true);
    this.play.reset();
    this.full.reset();
    const bounds = new THREE.Box3();
    const corner = new THREE.Vector3();
    island.traverse((node: any) => {
      if (!node.isMesh) return;
      bounds.setFromObject(node);
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) {
            corner.set(x, y, z);
            const h = corner.dot(RIGHT);
            const v = corner.dot(UP);
            this.full.widen(h, v);
            if (!node.userData.decor) this.play.widen(h, v);
          }
    });
    island.position.y = bob;
  }

  /**
   * Aponta a câmera para o retângulo dado. Ela desliza pelos próprios eixos de
   * tela para centralizar o tabuleiro: sem isso a borda inferior da ilha
   * decidiria o zoom sozinha.
   */
  frame(rect: Viewport, battle: boolean): void {
    const bounds = battle ? this.play : this.full;
    const aspect = rect.w / rect.h;
    let half = 18;
    const shift = new THREE.Vector3();
    if (bounds.measured) {
      const hc = (bounds.horizontal[0] + bounds.horizontal[1]) / 2;
      const vc = (bounds.vertical[0] + bounds.vertical[1]) / 2;
      half =
        Math.max(
          (bounds.vertical[1] - bounds.vertical[0]) / 2,
          (bounds.horizontal[1] - bounds.horizontal[0]) / 2 / aspect,
        ) * 1.04;
      shift.copy(RIGHT).multiplyScalar(hc).addScaledVector(UP, vc);
    }
    this.camera.position.set(
      Math.sin(AZIMUTH) * RADIUS + shift.x,
      HEIGHT + shift.y,
      Math.cos(AZIMUTH) * RADIUS + shift.z,
    );
    this.camera.lookAt(shift.x, shift.y, shift.z);
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
  }

  /** Converte um ponto do tabuleiro em coordenadas de tela dentro do retângulo. */
  project(
    island: any,
    rect: Viewport,
    x: number,
    y: number,
    z: number,
  ): { x: number; y: number } {
    const point = island
      .localToWorld(new THREE.Vector3(x, y, z))
      .project(this.camera);
    return {
      x: rect.x + ((point.x + 1) * rect.w) / 2,
      y: rect.y + ((1 - point.y) * rect.h) / 2,
    };
  }
}
