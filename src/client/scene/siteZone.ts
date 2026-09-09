import * as THREE from "three";
import type { SiteView } from "../../shared/protocol.js";
import { MeshFactory } from "./geometry.js";

/** Como a frente deve ser pintada neste quadro. */
export interface ZoneState {
  readonly site: SiteView;
  /** Progresso da obra, calculado pelo cliente e usado também na placa 2D. */
  readonly progress: number;
  readonly teamColor: string;
  /** Uma carta está na mão e esta frente é um alvo possível. */
  readonly targeting: boolean;
  /** A carta pode ser jogada aqui. */
  readonly allowed: boolean;
  /** O cursor está sobre esta frente. */
  readonly aiming: boolean;
  readonly selected: boolean;
  /** Há Construtores trabalhando nela. */
  readonly building: boolean;
}

const SEGMENTS = 28;
const FENCE_RADII = [3.12, 3.62] as const;

/**
 * O terreno de uma frente.
 *
 * Cada estado do jogo tem uma forma no chão: anel de progresso segmentado,
 * cerca por canteiro aberto, cúpula do harness, cristais de falha, andaime que
 * cresce com a obra e a onda de choque do lançamento da carta. É esse conjunto
 * que faz o efeito de uma carta aparecer no mapa, e não apenas no painel.
 */
export class SiteZone {
  readonly group = new THREE.Group();
  private readonly ring: any;
  private readonly segments: any[] = [];
  private readonly glow: any;
  private readonly dome: any;
  private readonly domeLines: any;
  private readonly fences: any[];
  private readonly scaffold = new THREE.Group();
  private readonly faults: any[] = [];
  private readonly pulse: any;
  private pulseAt = -99;
  private readonly pulseColor = new THREE.Color(0xffffff);

  constructor(
    readonly id: number,
    x: number,
    z: number,
    parent: any,
    private readonly factory = new MeshFactory(),
  ) {
    this.group.position.set(x, 0.6, z);
    parent.add(this.group);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(2.62, 2.86, 48),
      new THREE.MeshBasicMaterial({
        color: 0x74c5ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.group.add(this.ring);

    // Anel segmentado: cada bloco aceso é um passo da obra. Substitui a barra
    // de 4 px que antes ficava escondida atrás da placa da construção.
    for (let i = 0; i < SEGMENTS; i++) {
      const angle = (i / SEGMENTS) * Math.PI * 2;
      const segment = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.09, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x8be3ac, transparent: true }),
      );
      segment.position.set(Math.cos(angle) * 2.3, 0.02, Math.sin(angle) * 2.3);
      segment.rotation.y = -angle;
      this.group.add(segment);
      this.segments.push(segment);
    }

    this.glow = new THREE.Mesh(
      new THREE.CircleGeometry(2.55, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = -0.01;
    this.group.add(this.glow);

    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(2.9, 26, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x79bfff,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.group.add(this.dome);
    this.domeLines = new THREE.Mesh(
      new THREE.SphereGeometry(2.92, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xbfe4ff,
        wireframe: true,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    this.group.add(this.domeLines);

    // Cada canteiro isolado é uma cerca. Duas cercas concêntricas dizem, sem
    // texto, que a frente comporta dois agentes em paralelo.
    this.fences = FENCE_RADII.map((radius) => {
      const fence = new THREE.Group();
      this.group.add(fence);
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const post = this.factory.box(
          0.2,
          0.95,
          0.2,
          0x83dbb1,
          Math.cos(angle) * radius,
          0.45,
          Math.sin(angle) * radius,
          fence,
        );
        post.rotation.y = -angle;
      }
      const outline = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.1, radius + 0.1, 44),
        new THREE.MeshBasicMaterial({
          color: 0x83dbb1,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.55,
        }),
      );
      outline.rotation.x = -Math.PI / 2;
      outline.position.y = 0.01;
      fence.add(outline);
      return fence;
    });

    // Andaime: aparece enquanto a obra não fecha o nível.
    this.group.add(this.scaffold);
    for (const [sx, sz] of [
      [-1.5, -1.5],
      [1.5, -1.5],
      [-1.5, 1.5],
      [1.5, 1.5],
    ] as const)
      this.factory.box(0.16, 3.1, 0.16, 0xd8b06a, sx, 1.5, sz, this.scaffold);
    for (const y of [1.2, 2.5])
      for (const [ax, az, w, d] of [
        [0, -1.5, 3.16, 0.14],
        [0, 1.5, 3.16, 0.14],
        [-1.5, 0, 0.14, 3.16],
        [1.5, 0, 0.14, 3.16],
      ] as const)
        this.factory.box(w, 0.14, d, 0xe0bd80, ax, y, az, this.scaffold);

    // Falhas acumuladas: cristais vermelhos girando sobre a obra.
    for (let i = 0; i < 3; i++) {
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.34),
        new THREE.MeshStandardMaterial({
          color: 0xff7d63,
          emissive: 0x99271a,
          emissiveIntensity: 1.4,
          roughness: 0.25,
        }),
      );
      shard.position.set((i - 1) * 0.95, 3.5, 0);
      this.group.add(shard);
      this.faults.push(shard);
    }

    // Onda de choque do lançamento da carta.
    this.pulse = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 1.05, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.pulse.rotation.x = -Math.PI / 2;
    this.pulse.position.y = 0.03;
    this.group.add(this.pulse);
  }

  /** Dispara a onda de choque no ponto exato em que a carta foi solta. */
  deploy(now: number, color: string): void {
    this.pulseAt = now;
    this.pulseColor.set(color);
  }

  hide(): void {
    this.group.visible = false;
  }

  update(state: ZoneState, time: number, reduced: boolean): void {
    const { site, progress } = state;
    this.group.visible = true;
    const done = site.level >= 3;

    // A cor do anel conta a leitura da carta em jogo: dourado libera, vermelho
    // recusa, branco é a frente escolhida.
    const tint = done
      ? "#8be3ac"
      : state.targeting
        ? state.allowed
          ? state.aiming
            ? "#ffffff"
            : "#ffdb8a"
          : "#ff7d63"
        : site.faults
          ? "#ff896d"
          : state.selected
            ? "#ffffff"
            : state.teamColor;
    this.ring.material.color.set(tint);
    const beat = reduced ? 1 : 0.72 + Math.sin(time * 0.006 + this.id) * 0.28;
    this.ring.material.opacity = state.targeting
      ? state.allowed
        ? state.aiming
          ? 1
          : beat
        : 0.5
      : state.selected
        ? 1
        : 0.5;

    const highlighted = state.aiming && state.allowed;
    this.group.scale.setScalar(highlighted ? 1.06 : 1);
    this.glow.material.color.set(tint);
    this.glow.material.opacity = highlighted ? 0.16 : 0;

    const lit = Math.round((progress / 100) * this.segments.length);
    this.segments.forEach((segment, index) => {
      segment.visible = !done && index < lit;
      segment.material.color.set(
        site.faults ? "#ff9a80" : site.reviewed ? "#8be3ac" : "#7fd0ff",
      );
    });

    this.dome.visible = this.domeLines.visible = site.harness;
    if (site.harness && !reduced) this.domeLines.rotation.y = time * 0.00035;

    this.fences.forEach((fence, index) => {
      fence.visible = site.worktrees > index;
    });

    this.scaffold.visible = !done && (progress > 0 || state.building);
    this.scaffold.scale.y = 0.35 + 0.65 * (progress / 100);

    this.faults.forEach((shard, index) => {
      shard.visible = index < site.faults;
      if (!reduced) {
        shard.rotation.y = time * 0.002 + index;
        shard.position.y = 3.5 + Math.sin(time * 0.003 + index * 2) * 0.16;
      }
    });

    const age = (time - this.pulseAt) / 620;
    if (age >= 0 && age <= 1) {
      this.pulse.visible = true;
      this.pulse.scale.setScalar(0.5 + age * 2.6);
      this.pulse.material.color.copy(this.pulseColor);
      this.pulse.material.opacity = (1 - age) * 0.9;
    } else this.pulse.visible = false;
  }
}
