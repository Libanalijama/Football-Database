import type { GraphicDocument } from "@/lib/graphics";
import { preloadGraphic as preload } from "@/lib/graphics/preload";
export async function preloadGraphic(graphic: GraphicDocument | null) {
  if (graphic) await preload(graphic);
}
export function shouldApplyVersion(current: number, incoming: number) {
  return incoming > current;
}
