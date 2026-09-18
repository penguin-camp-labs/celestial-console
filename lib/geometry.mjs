/** @returns {[number, number, number]} */
export function spherePoint(longitude, latitude = 0, radius = 218) {
  const lon = (longitude * Math.PI) / 180;
  const lat = (latitude * Math.PI) / 180;
  return [
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  ];
}
export function morphPoint(longitude, latitude, amount) {
  const m = Math.max(0, Math.min(1, amount));
  return spherePoint(longitude, latitude * (1 - m), 218 - m * 27);
}
