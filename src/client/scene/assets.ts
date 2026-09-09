import * as THREE from "three";
import { GLTFLoader } from "../../../assets/vendor/GLTFLoader.js";
import { clone } from "../../../assets/utils/SkeletonUtils.js";
import { fitToHeight } from "./geometry.js";
import type { CharacterTemplate } from "./agentCrew.js";

/** Uma construção do tabuleiro, ligada ou não a uma frente do jogo. */
export interface Building {
  readonly object: any;
  /** Escala original, base do crescimento por nível. */
  readonly scale: number;
  /** Altura à qual o modelo foi ajustado, para ancorar a placa 2D. */
  readonly height: number;
  /** A frente que esta construção representa, ou null se é cenário. */
  readonly siteId: number | null;
}

/** Um ator da vitrine da tela inicial. */
export interface ShowcaseActor {
  readonly object: any;
  readonly mixer: any;
}

/** O que ainda falta carregar, mostrado como "Preparando a Cidadela". */
export interface LoadProgress {
  readonly loaded: number;
  readonly total: number;
  readonly failures: readonly string[];
}

const CHARACTERS = ["Knight", "Barbarian", "Rogue_Hooded", "Mage"] as const;
const SHOWCASE_X = [-3, -5.6, 5.6, 2.7] as const;
const SHOWCASE_Z = [-6.6, -4.3, 4.3, 6.2] as const;

/**
 * Carrega modelos e produz os retratos das cartas.
 *
 * Os retratos são renderizados uma vez, numa cena própria de 256×300, e viram
 * imagens: desenhar um modelo 3D dentro de cada carta a cada quadro custaria
 * caro para um retrato que nunca muda.
 */
export class AssetLibrary {
  readonly buildings: Building[] = [];
  readonly templates: Record<string, CharacterTemplate> = {};
  readonly actors: ShowcaseActor[] = [];
  readonly portraits: Record<string, HTMLImageElement> = {};
  private readonly failures: string[] = [];
  private loadedCount = 0;
  private readonly total = 10;

  get progress(): LoadProgress {
    return {
      loaded: this.loadedCount,
      total: this.total,
      failures: this.failures,
    };
  }

  async loadInto(island: any): Promise<void> {
    const loader = new GLTFLoader();
    const thumbnails = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    thumbnails.setSize(256, 300);
    thumbnails.setPixelRatio(1);
    thumbnails.outputColorSpace = THREE.SRGBColorSpace;
    thumbnails.toneMapping = THREE.ACESFilmicToneMapping;
    thumbnails.toneMappingExposure = 1.35;

    const jobs: Promise<unknown>[] = [];

    for (const team of ["blue", "red"] as const)
      for (const [type, x] of [
        ["castle", 0],
        ["tower_A", -5.6],
        ["tower_B", 5.6],
      ] as const)
        jobs.push(
          loader
            .loadAsync(`./assets/models/${team}/building_${type}_${team}.gltf`)
            .then((gltf: any) => {
              const height = type === "castle" ? 5.1 : 3.3;
              const object = fitToHeight(gltf.scene, height);
              object.position.x = x;
              object.position.z =
                (team === "blue" ? -1 : 1) * (type === "castle" ? 10.4 : 8.4);
              object.rotation.y = team === "blue" ? 0 : Math.PI;
              island.add(object);
              this.buildings.push({
                object,
                scale: object.scale.y,
                height,
                siteId: siteIdFor(team, type),
              });
            })
            .catch(() => this.failures.push("Castelo " + team))
            .finally(() => this.loadedCount++),
        );

    CHARACTERS.forEach((name, index) =>
      jobs.push(
        loader
          .loadAsync(`./assets/models/${name}.glb`)
          .then((gltf: any) => {
            const object = fitToHeight(gltf.scene, 2.1);
            this.portraits[name] = renderPortrait(
              thumbnails,
              object,
              gltf.animations,
              name,
            );
            this.templates[name] = { object, clips: gltf.animations };
            object.position.set(SHOWCASE_X[index]!, 0.55, SHOWCASE_Z[index]!);
            object.rotation.y = index < 2 ? 0.4 : Math.PI + 0.3;
            island.add(object);
            const mixer = new THREE.AnimationMixer(object);
            const idle = gltf.animations.find((clip: any) =>
              /idle/i.test(clip.name),
            );
            if (idle) {
              mixer.clipAction(idle).play();
              mixer.update(0);
            }
            this.actors.push({ object, mixer });
          })
          .catch(() => this.failures.push(name))
          .finally(() => this.loadedCount++),
      ),
    );

    await Promise.allSettled(jobs);
    thumbnails.dispose();
  }
}

/**
 * Três construções do tabuleiro representam as frentes do jogo; as outras três
 * são cenário e ficam escondidas durante a batalha.
 */
function siteIdFor(team: "blue" | "red", type: string): number | null {
  if (team === "blue" && type === "tower_A") return 0;
  if (team === "red" && type === "castle") return 1;
  if (team === "blue" && type === "tower_B") return 2;
  return null;
}

function renderPortrait(
  renderer: any,
  template: any,
  clips: any[],
  name: string,
): HTMLImageElement {
  // Posa uma cópia do esqueleto; o retrato não altera o ator nem os agentes.
  const object = clone(template);
  const poses: Record<string, readonly [string, number]> = {
    Barbarian: ["Interact", 0.45],
    Rogue_Hooded: ["Idle", 0.3],
    Mage: ["Spellcasting", 0.3],
    Knight: ["Blocking", 0.25],
  };
  const [pose, at] = poses[name]!;
  const mixer = new THREE.AnimationMixer(object);
  const clip = clips.find((candidate) => candidate.name === pose);
  if (clip) {
    mixer.clipAction(clip).play();
    mixer.setTime(at);
  }
  object.updateMatrixWorld(true);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xcdeaff, 0x596c87, 2.8));
  const light = new THREE.DirectionalLight(0xffe8c5, 3.5);
  light.position.set(-3, 5, 6);
  scene.add(light);
  scene.add(object);
  const camera = new THREE.OrthographicCamera(
    -1.05,
    1.05,
    1.23,
    -1.23,
    0.1,
    30,
  );
  camera.position.set(2.1, 1.8, 6);
  camera.lookAt(0, 1.08, 0);
  renderer.render(scene, camera);
  const image = new Image();
  image.src = renderer.domElement.toDataURL();
  scene.remove(object);
  mixer.stopAllAction();
  mixer.uncacheRoot(object);
  return image;
}
