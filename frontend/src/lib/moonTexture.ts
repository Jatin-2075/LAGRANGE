function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const smoothstep = (a: number, b: number, x: number) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));

function createNoise3(rand: () => number) {
  const table = new Float32Array(65536);
  for (let i = 0; i < table.length; i++) table[i] = rand();
  const at = (x: number, y: number, z: number) =>
    table[(Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & 65535]!;

  return (x: number, y: number, z: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    const fx = smooth(x - ix);
    const fy = smooth(y - iy);
    const fz = smooth(z - iz);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const x00 = lerp(at(ix, iy, iz), at(ix + 1, iy, iz), fx);
    const x10 = lerp(at(ix, iy + 1, iz), at(ix + 1, iy + 1, iz), fx);
    const x01 = lerp(at(ix, iy, iz + 1), at(ix + 1, iy, iz + 1), fx);
    const x11 = lerp(at(ix, iy + 1, iz + 1), at(ix + 1, iy + 1, iz + 1), fx);
    return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
  };
}

export function renderMoonCanvas(width = 2048, seed = 11): HTMLCanvasElement {
  const height = width / 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const rand = mulberry32(seed);
  const noise = createNoise3(rand);

  const fbm = (x: number, y: number, z: number, octaves: number, frequency: number) => {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    let f = frequency;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * f + o * 17.3, y * f - o * 9.1, z * f + o * 5.7);
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  };

  const lowW = width / 2;
  const lowH = height / 2;
  const low = document.createElement("canvas");
  low.width = lowW;
  low.height = lowH;
  const lowCtx = low.getContext("2d");
  if (!lowCtx) return canvas;
  const image = lowCtx.createImageData(lowW, lowH);
  const data = image.data;

  for (let py = 0; py < lowH; py++) {
    const lat = (0.5 - (py + 0.5) / lowH) * Math.PI;
    const cosLat = Math.cos(lat);
    const y = Math.sin(lat);
    for (let px = 0; px < lowW; px++) {
      const lon = ((px + 0.5) / lowW - 0.5) * 2 * Math.PI;
      const x = cosLat * Math.cos(lon);
      const z = cosLat * Math.sin(lon);

      const albedo = fbm(x, y, z, 5, 2.4);
      let b = 0.34 + (albedo - 0.5) * 0.78;

      const nearSide = Math.exp(-((lon * lon) / 1.0 + ((lat - 0.3) * (lat - 0.3)) / 0.5));
      const plains = smoothstep(0.48, 0.6, fbm(x + 3.1, y + 1.7, z - 2.3, 3, 1.3)) * nearSide;
      b *= 1 - 0.35 * plains;

      const i = (py * lowW + px) * 4;
      data[i] = Math.min(255, b * 255 * 0.9);
      data[i + 1] = Math.min(255, b * 255 * 0.94);
      data[i + 2] = Math.min(255, b * 255 * 1.02);
      data[i + 3] = 255;
    }
  }
  lowCtx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(low, 0, 0, width, height);

  const drawCrater = (x: number, y: number, r: number, stretch: number, strength: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(stretch, 1);
    const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.12);
    g.addColorStop(0, `rgba(3,5,9,${0.24 * strength})`);
    g.addColorStop(0.58, `rgba(3,5,9,${0.28 * strength})`);
    g.addColorStop(0.8, `rgba(245,248,255,${0.28 * strength})`);
    g.addColorStop(1, "rgba(226,233,246,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const craterCount = Math.round(width * 1.1);
  for (let n = 0; n < craterCount; n++) {
    let r = 1.5 + 22 * Math.pow(rand(), 3.8);
    const lat = Math.asin(2 * rand() - 1);
    if (Math.abs(lat) > 1.25) r = Math.min(r, 4);
    const x = rand() * width;
    const y = (0.5 - lat / Math.PI) * height;
    const stretch = 1 / Math.max(Math.cos(lat), 0.2);
    const strength = 0.6 + rand() * 0.6;
    drawCrater(x, y, r, stretch, strength);
    const reach = r * 1.12 * stretch;
    if (x < reach) drawCrater(x + width, y, r, stretch, strength);
    if (x > width - reach) drawCrater(x - width, y, r, stretch, strength);
  }

  return canvas;
}
