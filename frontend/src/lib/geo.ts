export const LUNAR_RADIUS_M = 1_737_400;
export const KM_PER_DEGREE = ((LUNAR_RADIUS_M / 1000) * Math.PI) / 180;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function lunarToUnitVector(latitude: number, longitude: number): [number, number, number] {
  const lat = toRad(latitude);
  const lon = toRad(longitude);
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
}

export function unitVectorToLunar(x: number, y: number, z: number): { latitude: number; longitude: number } {
  const length = Math.hypot(x, y, z) || 1;
  return {
    latitude: toDeg(Math.asin(clamp(y / length, -1, 1))),
    longitude: toDeg(Math.atan2(z, x)),
  };
}

export function southPolarProject(latitude: number, longitude: number): [number, number] {
  const rho = LUNAR_RADIUS_M * toRad(latitude + 90);
  const lon = toRad(longitude);
  return [rho * Math.sin(lon), rho * Math.cos(lon)];
}
