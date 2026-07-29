export const TOUCH_VESSEL_HIT_SLOP_PX = 14;
export const TOUCH_RESIZE_HIT_AREA_PX = 22;

/** Grid taps on touch screens need an explicit mode so scrolling is never mistaken for planning. */
export function canCreateFromPointer(pointerType: string, createMode: boolean) {
  return pointerType === "mouse" || createMode;
}

export function hitSlopForPointer(pointerType: string) {
  return pointerType === "mouse" ? 0 : TOUCH_VESSEL_HIT_SLOP_PX;
}

export function resizeHitAreaForPointer(pointerType: string) {
  return pointerType === "mouse" ? 8 : TOUCH_RESIZE_HIT_AREA_PX;
}
