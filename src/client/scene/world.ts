import * as THREE from "three";
import type { CardId, TeamView } from "../../shared/protocol.js";
import { AgentCrew, type AgentAnchor } from "./agentCrew.js";
import { AssetLibrary, type LoadProgress } from "./assets.js";
import { CameraRig, type Viewport } from "./cameraRig.js";
import { Island, SITE_COORDS } from "./island.js";
import { SiteZone } from "./siteZone.js";

/** Onde uma frente aparece na tela, para o cliente ancorar a placa 2D. */
export interface SiteAnchor {
  readonly id: number;
  /** Ponto no chão da frente. */
  readonly x: number;
  readonly y: number;
  /** Topo atual da construção: a placa se apoia nele, não numa altura fixa. */
  readonly top: number;
}

/** Tudo o que a cena precisa saber para desenhar um quadro. */
export interface FrameInput {
  readonly time: number;
  readonly rect: Viewport;
  readonly width: number;
  readonly height: number;
  readonly reduced: boolean;
  /** A guilda observada, ou null na vitrine da tela inicial. */
  readonly team: TeamView | null;
  readonly elapsed: number;
  /** Progresso de cada frente, calculado pelo cliente. */
  readonly progress: readonly number[] | null;
  readonly selectedSite: number;
  readonly selectedCard: CardId | null;
  /** Frente sob o cursor enquanto uma carta está na mão. */
  readonly targetSite: number | null;
  /** Se a carta pode ser jogada em cada frente. */
  readonly legal: readonly boolean[] | null;
  readonly paused: boolean;
}

/** Piso da altura de uma construção: no nível 0 ela precisa parecer uma obra. */
const MIN_BUILDING_SCALE = 0.46;

/**
 * O diorama.
 *
 * Esta é a única classe que o resto do cliente conhece: ela recebe um quadro
 * inteiro em `draw` e devolve, por `siteAnchors` e `agentAnchors`, onde as
 * coisas ficaram na tela para que a interface 2D pendure placas e rótulos nos
 * pontos certos.
 */
export class World {
  private readonly renderer: any;
  private readonly scene = new THREE.Scene();
  private readonly island = new Island();
  private readonly rig = new CameraRig();
  private readonly assets = new AssetLibrary();
  private readonly zones: SiteZone[];
  private readonly crew: AgentCrew;
  private readonly motes: any[] = [];
  private burst = 0;
  private previousTime = 0;
  private sites: SiteAnchor[] = [];
  private agents: AgentAnchor[] = [];

  private constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene.add(new THREE.HemisphereLight(0xc6e2e6, 0x4b5846, 1.9));
    const sun = new THREE.DirectionalLight(0xffe3b5, 3.1);
    sun.position.set(-15, 30, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -30,
      right: 30,
      top: 30,
      bottom: -30,
      near: 1,
      far: 85,
    });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x91cbd5, 1.0);
    rim.position.set(10, 5, -20);
    this.scene.add(rim);
    this.scene.add(this.island.group);

    this.zones = SITE_COORDS.map(
      ([x, z], id) => new SiteZone(id, x, z, this.island.group),
    );
    this.crew = new AgentCrew(this.island, this.assets.templates);

    const geometry = new THREE.OctahedronGeometry(0.12);
    for (let i = 0; i < 24; i++) {
      const mote = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0xffd783 : 0x8de8ff,
          transparent: true,
          opacity: 0.8,
        }),
      );
      this.scene.add(mote);
      this.motes.push(mote);
    }
  }

  /** Monta a cena e carrega os modelos. */
  static async create(canvas: HTMLCanvasElement): Promise<World> {
    const world = new World(canvas);
    await world.assets.loadInto(world.island.group);
    return world;
  }

  get portraits(): Record<string, HTMLImageElement> {
    return this.assets.portraits;
  }

  get progress(): LoadProgress {
    return this.assets.progress;
  }

  /** Solta partículas: uma entrega pontuou. */
  celebrate(): void {
    this.burst = 1;
  }

  /**
   * Onda de choque numa frente. O cliente chama isto no ato do toque, sem
   * esperar a resposta do servidor: é o retorno imediato que faz a carta
   * parecer aplicada ao mapa.
   */
  deploy(siteId: number, color = "#ffffff"): void {
    this.zones[siteId]?.deploy(this.previousTime, color);
  }

  siteAnchors(): readonly SiteAnchor[] {
    return this.sites;
  }

  agentAnchors(): readonly AgentAnchor[] {
    return this.agents;
  }

  draw(input: FrameInput): void {
    const dt = Math.min((input.time - this.previousTime) / 1000, 0.05);
    this.previousTime = input.time;
    const { rect, team } = input;

    this.resize(input.width, input.height);
    this.renderer.setScissorTest(false);
    this.renderer.clear();
    this.renderer.setViewport(rect.x, input.height - rect.y - rect.h, rect.w, rect.h);
    this.renderer.setScissor(rect.x, input.height - rect.y - rect.h, rect.w, rect.h);
    this.renderer.setScissorTest(true);

    this.island.group.position.y =
      input.reduced || team ? 0 : Math.sin(input.time * 0.0005) * 0.18;
    this.rig.measure(this.island.group, this.assets.progress.loaded);
    this.rig.frame(rect, Boolean(team));

    this.crew.follow(team ? team.id : null);
    this.updateBuildings(input, dt);
    this.updateZones(input);
    this.island.lightBeacons(
      team ? team.sites.map((site) => site.level) : null,
      input.time,
      input.reduced,
    );
    this.island.update(input.time, team ? team.color : null, input.reduced);

    for (const actor of this.assets.actors) {
      actor.object.visible = !team;
      if (!team) actor.mixer.update(input.reduced ? 0 : dt);
    }
    if (team)
      this.crew.update(
        team.jobs,
        input.elapsed,
        dt,
        input.time,
        team.color,
        input.reduced,
        input.paused,
      );

    this.updateMotes(input, dt);
    this.renderer.render(this.scene, this.rig.camera);
    this.captureAnchors(input);
  }

  private resize(width: number, height: number): void {
    const canvas = this.renderer.domElement;
    const ratio = this.renderer.getPixelRatio();
    // Three.js trunca o buffer: arredondar aqui repetia setSize a cada quadro.
    if (
      canvas.width !== Math.floor(width * ratio) ||
      canvas.height !== Math.floor(height * ratio)
    )
      this.renderer.setSize(width, height, false);
  }

  private progressOf(input: FrameInput, siteId: number): number {
    // O progresso vem pronto do cliente, que é quem já o desenha na placa.
    // Recalcular aqui seria a segunda cópia da mesma conta, e ela divergiria.
    const given = input.progress?.[siteId];
    return Number.isFinite(given)
      ? (given as number)
      : (input.team?.sites[siteId]?.built ?? 0);
  }

  private updateBuildings(input: FrameInput, dt: number): void {
    for (const building of this.assets.buildings) {
      building.object.visible = !input.team || building.siteId !== null;
      if (!input.team) {
        building.object.scale.y = building.scale;
        continue;
      }
      if (building.siteId === null) continue;
      const site = input.team.sites[building.siteId]!;
      const progress = this.progressOf(input, building.siteId);
      // Piso mais alto: no nível 0 a construção precisa parecer uma obra, não
      // um seixo. Cada nível entregue soma um degrau visível.
      const target =
        building.scale *
        (MIN_BUILDING_SCALE +
          ((1 - MIN_BUILDING_SCALE) * Math.min(3, site.level + progress / 100)) /
            3);
      building.object.scale.y +=
        (target - building.object.scale.y) *
        (input.reduced ? 1 : Math.min(1, dt * 4));
    }
  }

  private updateZones(input: FrameInput): void {
    this.zones.forEach((zone, index) => {
      if (!input.team) {
        zone.hide();
        return;
      }
      const site = input.team.sites[index]!;
      zone.update(
        {
          site,
          progress: this.progressOf(input, index),
          teamColor: input.team.color,
          targeting: input.selectedCard !== null,
          allowed: input.legal?.[index] !== false,
          aiming: input.targetSite === index,
          selected: input.selectedSite === index,
          building: input.team.jobs.some(
            (job) => job.cardId === "builder" && job.siteId === index,
          ),
        },
        input.time,
        input.reduced,
      );
    });
  }

  private updateMotes(input: FrameInput, dt: number): void {
    this.motes.forEach((mote, index) => {
      const t = input.time * 0.0003 + index * 2.4;
      mote.position.set(
        Math.sin(t * 0.8 + index) * 14,
        1 + (index % 6) + Math.sin(t) * 0.8,
        Math.cos(t + index) * 15,
      );
      mote.visible = !input.reduced && (this.burst > 0 || !input.team);
      mote.rotation.y = t;
    });
    this.burst = Math.max(0, this.burst - dt * 0.55);
  }

  private captureAnchors(input: FrameInput): void {
    if (!input.team) {
      this.sites = [];
      this.agents = [];
      return;
    }
    const project = (x: number, y: number, z: number) =>
      this.rig.project(this.island.group, input.rect, x, y, z);
    this.sites = SITE_COORDS.map(([x, z], id) => {
      // A placa se apoia no topo atual da construção: com altura fixa ela
      // flutuaria longe das frentes ainda baixas.
      const building = this.assets.buildings.find(
        (candidate) => candidate.siteId === id,
      );
      const tall = building
        ? (building.height * building.object.scale.y) / building.scale
        : 2.4;
      return {
        id,
        ...project(x, 0.65, z),
        top: project(x, tall + 0.7, z).y,
      };
    });
    this.agents = this.crew.anchors(project);
  }
}

export type { AgentAnchor } from "./agentCrew.js";
export type { Viewport } from "./cameraRig.js";
