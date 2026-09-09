import * as THREE from "three";
import { MeshFactory } from "./geometry.js";

/** Onde cada frente fica no tabuleiro. Combina com SITES em content/story. */
export const SITE_COORDS: readonly (readonly [number, number])[] = [
  [-5.6, -8.4],
  [0, 10.4],
  [5.6, -8.4],
];

/** O acampamento da guilda: de onde os agentes saem e para onde voltam. */
const CAMP = new THREE.Vector3(6.6, 0.55, 7.4);

/**
 * A ilha: terreno, rio, pontes, estradas, muralha, árvores, bandeiras, faróis
 * e o acampamento.
 *
 * É geometria estática — construída uma vez e só reconfigurada por cor ou
 * visibilidade depois. A rocha de baixo é marcada como decoração para que o
 * enquadramento da câmera não a considere ao medir o tabuleiro.
 */
export class Island {
  readonly group = new THREE.Group();
  readonly beacons: any[] = [];
  private readonly camp = new THREE.Group();
  private readonly campFlag: any;
  private readonly campGlow: any;
  private campFlashAt = -99;
  private readonly factory = new MeshFactory();

  constructor() {
    const box = (
      w: number,
      h: number,
      d: number,
      color: number,
      x: number,
      y: number,
      z: number,
      parent: any = this.group,
    ) => this.factory.box(w, h, d, color, x, y, z, parent);

    box(23, 2.2, 28, 0x667e86, 0, -1.5, 0);
    box(22.5, 0.55, 27.5, 0xa7b3a1, 0, -0.25, 0);
    box(21.6, 0.35, 26.6, 0x70a44d, 0, 0.12, 0);
    for (let x = -10; x <= 10; x += 2)
      for (let z = -12; z <= 12; z += 2)
        if (Math.abs(z) > 1)
          box(1.97, 0.08, 1.97, (x + z) % 4 === 0 ? 0x81b757 : 0x76ac50, x, 0.34, z);

    // A base facetada faz o tabuleiro flutuar. Ela fica fora da área de jogo,
    // então é excluída quando a câmera mede o que precisa caber na tela.
    const rock = new THREE.Mesh(
      new THREE.CylinderGeometry(15, 8, 6, 7),
      this.factory.material(0x344f65),
    );
    rock.scale.set(1, 1, 1.12);
    rock.position.set(0, -5, 0);
    rock.rotation.y = 0.2;
    rock.userData.decor = true;
    this.group.add(rock);

    const river = box(22, 0.16, 3.2, 0x3ebde3, 0, 0.38, 0);
    river.material = new THREE.MeshStandardMaterial({
      color: 0x38bada,
      roughness: 0.25,
      metalness: 0.18,
    });
    for (let x = -10; x < 11; x += 2.5)
      box(1.2, 0.02, 0.08, 0x9be8ed, x, 0.48, (x % 3) * 0.35);

    // Duas pontes, uma em cada estrada.
    for (const x of [-5.6, 5.6]) {
      box(3.4, 0.25, 4.5, 0x624a38, x, 0.52, 0);
      for (let z = -2; z <= 2; z += 0.42)
        box(3.35, 0.16, 0.34, 0xc29762, x, 0.72, z);
      for (const dx of [-1.8, 1.8]) {
        box(0.14, 0.14, 4.7, 0xc9b184, x + dx, 1.3, 0);
        for (const z of [-2, 2]) box(0.22, 1.2, 0.22, 0x9a714e, x + dx, 0.95, z);
      }
    }
    for (const x of [-5.6, 5.6])
      for (let z = -11; z <= 11; z += 1.25)
        if (Math.abs(z) > 2.5)
          box(
            2.7,
            0.12,
            1.12,
            Math.round(z * 4) % 2 === 0 ? 0xbac4b2 : 0xaab7a6,
            x,
            0.47,
            z,
          );

    // Muralha de contorno.
    for (let z = -13; z <= 13; z += 1.65)
      for (const x of [-11.2, 11.2]) {
        box(0.9, 0.75, 1.45, 0xb4c4c4, x, 0.3, z);
        box(1, 0.13, 1.5, 0xd1d8ce, x, 0.74, z);
      }
    for (let x = -10; x <= 10; x += 1.7)
      for (const z of [-13.5, 13.5]) box(1.5, 0.7, 0.8, 0xa8b7b5, x, 0.26, z);

    const positions: readonly (readonly [number, number])[] = [
      [-9, -10],
      [-9, 8],
      [9, -9],
      [9, 10],
      [-9, 4],
      [9, -5],
      [-8, 12],
      [8, -12],
    ];
    positions.forEach(([x, z], index) =>
      this.tree(x, z, 0.8 + (index % 3) * 0.18),
    );

    // As bandeiras repetem o azul e o coral da heráldica dos modelos.
    for (const z of [-10, 10])
      for (const x of [-8, 8]) {
        box(0.08, 3.5, 0.08, 0xe1cda2, x, 1.9, z);
        box(1.1, 0.75, 0.06, z < 0 ? 0x529ff2 : 0xf77767, x + 0.58, 3.1, z);
      }

    // Faróis: acendem conforme os níveis entregues em cada frente.
    for (let i = 0; i < 6; i++) {
      const x = i < 3 ? -9 : 9;
      const z = ((i % 3) - 1) * 4;
      box(0.8, 0.35, 0.8, 0x9aa6aa, x, 0.7, z);
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.38),
        new THREE.MeshStandardMaterial({
          color: 0x567687,
          emissive: 0x000000,
          roughness: 0.2,
          metalness: 0.2,
        }),
      );
      gem.position.set(x, 1.4, z);
      this.group.add(gem);
      this.beacons.push(gem);
    }

    // Acampamento da guilda: os agentes precisam sair de algum lugar. Sem ele a
    // unidade aparecia e sumia no meio do campo, o que lia como falha de render.
    this.camp.position.set(CAMP.x, 0, CAMP.z);
    this.group.add(this.camp);
    box(4.2, 0.32, 4.2, 0x9c8a6d, 0, 0.46, 0, this.camp);
    box(3.7, 0.1, 3.7, 0xb9a27e, 0, 0.66, 0, this.camp);
    for (const [tx, tz] of [
      [-1.05, -0.95],
      [1.05, -0.95],
    ] as const) {
      const tent = new THREE.Mesh(
        new THREE.ConeGeometry(0.86, 1.5, 4),
        this.factory.material(0xe6d3ab),
      );
      tent.position.set(tx, 1.45, tz);
      tent.rotation.y = Math.PI / 4;
      tent.castShadow = true;
      this.camp.add(tent);
    }
    box(0.12, 3.2, 0.12, 0xdccaa4, 1.5, 2.3, 1.4, this.camp);
    this.campFlag = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.78, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x54baff, roughness: 0.8 }),
    );
    this.campFlag.position.set(2.08, 3.42, 1.4);
    this.camp.add(this.campFlag);
    this.campGlow = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 2.15, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffe6a8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.campGlow.rotation.x = -Math.PI / 2;
    this.campGlow.position.y = 0.68;
    this.camp.add(this.campGlow);
  }

  private tree(x: number, z: number, scale: number): void {
    const trunk = new THREE.Group();
    trunk.position.set(x, 0.3, z);
    trunk.scale.setScalar(scale);
    this.factory.box(0.35, 1.5, 0.35, 0x765941, 0, 0.7, 0, trunk);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(1.3 - i * 0.28, 1.9, 5),
        this.factory.material([0x2e735b, 0x37876a, 0x55a274][i]!),
      );
      leaf.position.y = 1.7 + i * 0.75;
      trunk.add(leaf);
    }
    this.group.add(trunk);
  }

  add(object: any): void {
    this.group.add(object);
  }

  remove(...objects: any[]): void {
    this.group.remove(...objects);
  }

  /** Converte um ponto do tabuleiro para o espaço do mundo. */
  toWorld(x: number, y: number, z: number): any {
    return this.group.localToWorld(new THREE.Vector3(x, y, z));
  }

  /** Faz o acampamento brilhar: um agente saiu ou voltou. */
  flashCamp(now: number): void {
    this.campFlashAt = now;
  }

  /**
   * Rota até a frente. Quem atravessa o rio passa pela ponte: o trajeto conta
   * que o agente saiu da base e foi até o território.
   */
  route(siteId: number): any[] {
    const [x, z] = SITE_COORDS[siteId]!;
    const target = new THREE.Vector3(x, 0.55, z);
    if (z < 0)
      return [
        CAMP.clone(),
        new THREE.Vector3(x < 0 ? -5.6 : 5.6, 0.55, 3.1),
        new THREE.Vector3(x < 0 ? -5.6 : 5.6, 0.55, -3.1),
        target,
      ];
    return [CAMP.clone(), new THREE.Vector3(x * 0.5 + 3, 0.55, 9.2), target];
  }

  /** Estado por quadro: bandeira na cor da guilda e brilho do acampamento. */
  update(time: number, teamColor: string | null, reduced: boolean): void {
    this.camp.visible = teamColor !== null;
    if (teamColor === null) return;
    this.campFlag.material.color.set(teamColor);
    const flash = (time - this.campFlashAt) / 700;
    const active = flash >= 0 && flash <= 1;
    this.campGlow.material.opacity = active ? (1 - flash) * 0.75 : 0;
    this.campGlow.scale.setScalar(active ? 0.7 + flash * 0.5 : 1);
    void reduced;
  }

  /** Acende os faróis conforme os níveis já entregues. */
  lightBeacons(
    levels: readonly number[] | null,
    time: number,
    reduced: boolean,
  ): void {
    this.beacons.forEach((gem, index) => {
      const lit =
        levels === null || levels[index % 3]! > Math.floor(index / 3);
      gem.material.color.setHex(lit ? 0x82e9ee : 0x567687);
      gem.material.emissive.setHex(lit ? 0x248eac : 0x000000);
      gem.material.emissiveIntensity = lit ? 1.5 : 0;
      gem.rotation.y = reduced ? 0 : time * 0.0006 + index;
    });
  }
}

/**
 * Percurso com velocidade constante ao longo de uma rota. Sem pesar pelo
 * comprimento, o agente acelera e freia entre trechos de tamanhos diferentes.
 */
export function along(
  path: any[],
  t: number,
): { position: any; heading: any } {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const distance = path[i].distanceTo(path[i + 1]);
    lengths.push(distance);
    total += distance;
  }
  let travelled = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (travelled <= lengths[i]! || i === lengths.length - 1) {
      const fraction = lengths[i] ? Math.min(1, travelled / lengths[i]!) : 1;
      return {
        position: path[i].clone().lerp(path[i + 1], fraction),
        heading: path[i + 1].clone().sub(path[i]),
      };
    }
    travelled -= lengths[i]!;
  }
  return { position: path[0].clone(), heading: new THREE.Vector3(0, 0, 1) };
}
