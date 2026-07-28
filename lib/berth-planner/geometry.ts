/**
 * Vessel polygon geometry helpers for the Berth Planner canvas.
 *
 * Coordinate system: X = berth position, Y = time (top = earlier).
 * The bow (pointed end) projects LEFT or RIGHT at the vertical midpoint.
 *
 * Matches the shape used in schedule-grid-client.tsx (v1 reference):
 *   getPentagonPointsFromHeadTail(xHead, xTail, yTop, yBottom)
 *
 * @param xHead  X pixel of the bow tip (pointed end — left or right).
 * @param xTail  X pixel of the stern (flat/square end).
 * @param yTop   Top Y pixel of the vessel bounding box.
 * @param yBottom Bottom Y pixel of the vessel bounding box.
 * @returns Array of [x, y] vertices forming the vessel pentagon.
 */
export function getVesselPolygon(
  xHead: number,
  xTail: number,
  yTop: number,
  yBottom: number,
): [number, number][] {
  const height = Math.max(14, yBottom - yTop);
  const shoulderDepth = Math.max(8, Math.min(18, height * 0.12));
  // direction: +1 when head is to the right, -1 when head is to the left
  const direction = xHead >= xTail ? 1 : -1;
  // shoulder is pulled back from the bow tip toward the stern
  const shoulderX = xHead - shoulderDepth * direction;
  const midY = (yTop + yBottom) / 2;

  return [
    [xTail, yTop],      // stern — top
    [shoulderX, yTop],  // bow shoulder — top
    [xHead, midY],      // bow tip (pointed end, at vertical midpoint)
    [shoulderX, yBottom], // bow shoulder — bottom
    [xTail, yBottom],   // stern — bottom
  ];
}

/**
 * Test whether a point (px, py) lies inside a polygon defined by vertices.
 * Uses the ray-casting algorithm.
 */
export function isPointInsidePolygon(
  px: number,
  py: number,
  polygon: [number, number][],
): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Return the axis-aligned bounding box of a polygon.
 */
export function getPolygonBounds(polygon: [number, number][]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of polygon) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
