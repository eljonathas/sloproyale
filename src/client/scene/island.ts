import * as THREE from "three";
import { MeshFactory } from "./geometry.js";
import { Terrain } from "./terrain.js";

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
  private readonly banners: any[] = [];
  private bannerColor: string | null | undefined;
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

    const terrain = new Terrain();
    this.group.add(terrain.group);

    // Uma única heráldica: a da guilda observada, inclusive com mais de 2 times.
    for (const [x, z] of [
      [-8, -11.4],
      [8, -11.4],
      [-4.4, 11.7],
    ]) {
      box(0.65, 0.24, 0.65, 0xa4ad97, x, 0.5, z);
      box(0.09, 2.9, 0.09, 0xc5ae79, x, 1.95, z);
      const banner = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 1.1, 0.045),
        new THREE.MeshStandardMaterial({ color: 0x527c83, roughness: 0.9 }),
      );
      banner.position.set(x + 0.46, 2.68, z);
      this.group.add(banner);
      this.banners.push(banner);
      box(0.87, 0.07, 0.06, 0xe1c891, x + 0.46, 2.15, z);
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
    if (teamColor !== this.bannerColor) {
      for (const banner of this.banners)
        banner.material.color.set(teamColor ?? "#527c83");
      this.bannerColor = teamColor;
    }
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
      const lit = levels === null || levels[index % 3]! > Math.floor(index / 3);
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
export function along(path: any[], t: number): { position: any; heading: any } {
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
