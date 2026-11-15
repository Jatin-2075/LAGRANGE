import {
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Quaternion,
  RepeatWrapping,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { SiteResult } from "../api/types";
import { clamp, lunarToUnitVector, unitVectorToLunar } from "./geo";
import { renderMoonCanvas } from "./moonTexture";

export interface MoonSceneCallbacks {
  onSelectSite: (siteId: string) => void;
  onPickPoint: (latitude: number, longitude: number) => void;
}

type MarkerKind = "site" | "site-selected" | "target";

interface Flight {
  from: Vector3;
  fromLength: number;
  toDir: Vector3;
  toLength: number;
  elapsed: number;
  duration: number;
}

const BASE_FOV = 40;
const DEFAULT_DISTANCE = 4.2;
const MIN_DISTANCE = 1.12;
const MAX_DISTANCE = 7;
const MAX_VIEW_LATITUDE = 85;
const ACCENT = "#c6f26a";

export class MoonScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly moon: Mesh;
  private readonly markers = new Group();
  private readonly raycaster = new Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private readonly markerTextures = new Map<string, CanvasTexture>();
  private readonly reducedMotion: boolean;

  private siteSprites: Sprite[] = [];
  private targetSprite: Sprite | null = null;
  private flight: Flight | null = null;
  private frame = 0;
  private dirty = true;
  private disposed = false;
  private pointerDown: { x: number; y: number; time: number } | null = null;
  private moonTexture: CanvasTexture | null = null;
  private textureTimer = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: MoonSceneCallbacks,
    initialView: { latitude: number; longitude: number } | null,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.setAttribute("aria-hidden", "true");
    container.append(canvas);

    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.camera = new PerspectiveCamera(BASE_FOV, 1, 0.05, 200);
    this.scene.add(this.camera);

    this.scene.add(new AmbientLight(0x9fb0d4, 0.6));
    const key = new DirectionalLight(0xf4f7ff, 2.1);
    key.position.set(-2.2, 1.6, 2.6);
    this.camera.add(key);

    this.moon = new Mesh(
      new SphereGeometry(1, 96, 64),
      new MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 }),
    );
    this.scene.add(this.moon);
    this.scene.add(this.createGraticule());
    this.scene.add(this.createStars());
    this.scene.add(this.markers);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = MIN_DISTANCE;
    this.controls.maxDistance = MAX_DISTANCE;
    this.controls.zoomSpeed = 0.7;
    this.controls.rotateSpeed = 0.6;
    this.controls.addEventListener("start", () => {
      this.flight = null;
    });
    this.controls.addEventListener("change", () => {
      this.dirty = true;
    });

    this.placeCamera(initialView ?? { latitude: -89.5, longitude: 0 }, DEFAULT_DISTANCE);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.textureTimer = window.setTimeout(() => this.applySurfaceTexture(), 30);

    this.frame = requestAnimationFrame(this.tick);
  }

  setSites(sites: SiteResult[], selectedId: string | null) {
    this.clearSprites(this.siteSprites);
    this.siteSprites = sites.map((site) => {
      const selected = site.site_id === selectedId;
      const sprite = this.createSprite(
        selected ? "site-selected" : "site",
        String(site.rank),
        site.latitude,
        site.longitude,
        selected ? 0.062 : 0.048,
      );
      sprite.userData.siteId = site.site_id;
      sprite.renderOrder = selected ? 3 : 2;
      return sprite;
    });
    this.dirty = true;
  }

  setTarget(target: { latitude: number; longitude: number } | null) {
    if (this.targetSprite) this.clearSprites([this.targetSprite]);
    this.targetSprite = target ? this.createSprite("target", "", target.latitude, target.longitude, 0.058) : null;
    if (this.targetSprite) this.targetSprite.renderOrder = 1;
    this.dirty = true;
  }

  flyTo(latitude: number, longitude: number, distance = 3.9) {
    const to = this.directionFor(latitude, longitude);
    const from = this.camera.position.clone();
    if (this.reducedMotion) {
      this.camera.position.copy(to.multiplyScalar(distance));
      this.camera.lookAt(0, 0, 0);
      this.dirty = true;
      return;
    }
    this.flight = {
      from: from.clone().normalize(),
      fromLength: from.length(),
      toDir: to,
      toLength: clamp(distance, MIN_DISTANCE, MAX_DISTANCE),
      elapsed: 0,
      duration: 0.9,
    };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.textureTimer);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("webglcontextlost", this.onContextLost);
    canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.controls.dispose();

    this.scene.traverse((object) => {
      const item = object as Mesh;
      item.geometry?.dispose();
      const material = item.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    this.markerTextures.forEach((texture) => texture.dispose());
    this.markerTextures.clear();
    this.moonTexture?.dispose();
    this.renderer.dispose();
    canvas.remove();
  }

  private directionFor(latitude: number, longitude: number): Vector3 {
    const [x, y, z] = lunarToUnitVector(clamp(latitude, -MAX_VIEW_LATITUDE, MAX_VIEW_LATITUDE), longitude);
    return new Vector3(x, y, z);
  }

  private placeCamera(view: { latitude: number; longitude: number }, distance: number) {
    this.camera.position.copy(this.directionFor(view.latitude, view.longitude).multiplyScalar(distance));
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
  }

  private applySurfaceTexture() {
    if (this.disposed) return;
    const texture = new CanvasTexture(renderMoonCanvas(2048));
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    texture.wrapS = RepeatWrapping;
    texture.repeat.x = -1;
    texture.offset.x = 1;
    this.moonTexture = texture;
    const material = this.moon.material as MeshStandardMaterial;
    material.color = new Color(0xffffff);
    material.map = texture;
    material.bumpMap = texture;
    material.bumpScale = 1.5;
    material.needsUpdate = true;
    this.dirty = true;
  }

  private createGraticule(): LineSegments {
    const positions: number[] = [];
    const radius = 1.0015;
    const push = (lat: number, lon: number) => {
      const [x, y, z] = lunarToUnitVector(lat, lon);
      positions.push(x * radius, y * radius, z * radius);
    };
    for (let lon = -180; lon < 180; lon += 15) {
      for (let lat = -90; lat < 90; lat += 3) {
        push(lat, lon);
        push(lat + 3, lon);
      }
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      for (let lon = -180; lon < 180; lon += 3) {
        push(lat, lon);
        push(lat, lon + 3);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return new LineSegments(
      geometry,
      new LineBasicMaterial({ color: 0xaec4ea, transparent: true, opacity: 0.16, depthWrite: false }),
    );
  }

  private createStars(): Points {
    const count = 700;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      positions.set([s * Math.cos(phi) * 80, u * 80, s * Math.sin(phi) * 80], i * 3);
      const brightness = 0.35 + rand() * 0.65;
      colors.set([brightness * 0.9, brightness * 0.95, brightness], i * 3);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return new Points(
      geometry,
      new PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }),
    );
  }

  private markerTexture(kind: MarkerKind, label: string): CanvasTexture {
    const key = `${kind}:${label}`;
    const cached = this.markerTextures.get(key);
    if (cached) return cached;

    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const c = size / 2;

    if (kind === "target") {
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(c, c, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 4;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        ctx.beginPath();
        ctx.moveTo(c + dx * 38, c + dy * 38);
        ctx.lineTo(c + dx * 56, c + dy * 56);
        ctx.stroke();
      }
    } else {
      const selected = kind === "site-selected";
      ctx.fillStyle = selected ? ACCENT : "rgba(6,12,24,0.88)";
      ctx.beginPath();
      ctx.arc(c, c, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = selected ? 8 : 6;
      ctx.stroke();
      ctx.fillStyle = selected ? "#0c1405" : ACCENT;
      ctx.font = "700 46px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, c, c + 3);
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    this.markerTextures.set(key, texture);
    return texture;
  }

  private createSprite(kind: MarkerKind, label: string, latitude: number, longitude: number, scale: number): Sprite {
    const sprite = new Sprite(
      new SpriteMaterial({
        map: this.markerTexture(kind, label),
        sizeAttenuation: false,
        transparent: true,
        depthWrite: false,
      }),
    );
    const [x, y, z] = lunarToUnitVector(latitude, longitude);
    const surfacePoint = new Vector3(x * 1.004, y * 1.004, z * 1.004);
    this.moon.localToWorld(surfacePoint);
    sprite.position.copy(surfacePoint);
    sprite.scale.set(scale, scale, 1);
    this.markers.add(sprite);
    return sprite;
  }

  private clearSprites(sprites: Sprite[]) {
    for (const sprite of sprites) {
      this.markers.remove(sprite);
      sprite.material.dispose();
    }
  }

  private resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.aspect = aspect;
    const baseHalf = Math.tan(MathUtils.degToRad(BASE_FOV / 2));
    this.camera.fov = aspect < 1 ? MathUtils.radToDeg(2 * Math.atan(baseHalf / aspect)) : BASE_FOV;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  private tick = (now: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);

    const dt = Math.min(0.05, (now - (this.lastTick || now)) / 1000);
    this.lastTick = now;

    if (this.flight) this.stepFlight(dt);
    const moved = this.controls.update();
    if (moved || this.dirty || this.flight) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  };
  private lastTick = 0;

  private stepFlight(dt: number) {
    const flight = this.flight;
    if (!flight) return;
    flight.elapsed += dt;
    const t = MathUtils.smootherstep(Math.min(1, flight.elapsed / flight.duration), 0, 1);

    const full = new Quaternion().setFromUnitVectors(flight.from, flight.toDir);
    const partial = new Quaternion().slerp(full, t);
    const direction = flight.from.clone().applyQuaternion(partial);
    const length = MathUtils.lerp(flight.fromLength, flight.toLength, t);
    this.camera.position.copy(direction.multiplyScalar(length));
    this.camera.lookAt(0, 0, 0);
    this.dirty = true;
    if (flight.elapsed >= flight.duration) this.flight = null;
  }

  private pointerToNdc(event: PointerEvent): Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  }

  private pickSite(event: PointerEvent): Sprite | null {
    if (this.siteSprites.length === 0) return null;
    this.raycaster.setFromCamera(this.pointerToNdc(event), this.camera);
    const hit = this.raycaster.intersectObjects(this.siteSprites, false)[0];
    if (!hit) return null;
    const surface = this.raycaster.intersectObject(this.moon, false)[0];
    if (surface && surface.distance < hit.distance - 0.01) return null;
    return hit.object as Sprite;
  }

  private onPointerDown = (event: PointerEvent) => {
    this.pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
  };

  private onPointerUp = (event: PointerEvent) => {
    const down = this.pointerDown;
    this.pointerDown = null;
    if (!down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    if (moved > 5 || performance.now() - down.time > 600) return;

    const site = this.pickSite(event);
    if (site) {
      this.callbacks.onSelectSite(String(site.userData.siteId));
      return;
    }
    this.raycaster.setFromCamera(this.pointerToNdc(event), this.camera);
    const surface = this.raycaster.intersectObject(this.moon, false)[0];
    if (surface) {
      const localPoint = this.moon.worldToLocal(surface.point.clone());
      const { latitude, longitude } = unitVectorToLunar(localPoint.x, localPoint.y, localPoint.z);
      this.callbacks.onPickPoint(latitude, longitude);
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    if (event.buttons !== 0) return;
    this.renderer.domElement.style.cursor = this.pickSite(event) ? "pointer" : "grab";
  };

  private onContextLost = (event: Event) => {
    event.preventDefault();
  };

  private onContextRestored = () => {
    this.dirty = true;
  };
}
