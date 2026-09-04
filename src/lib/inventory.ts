import type { MaterialItem } from "@/lib/materials";

export type InventoryItem = { key: string; name: string; unit: "m" | "un"; quantity: number };
export type InventoryCheck = { key: string; name: string; unit: "m" | "un"; required: number; available: number; missing: number; status: "ok" | "missing" };

export function checkInventory(materials: MaterialItem[], inventory: InventoryItem[]): InventoryCheck[] {
  const stock = new Map(inventory.map((item) => [item.key.toLowerCase(), item]));
  return materials.map((material) => {
    const key = `${material.category}:${material.name}:${material.unit}`.toLowerCase();
    const available = Math.max(0, stock.get(key)?.quantity ?? 0);
    const required = Math.max(0, material.quantity);
    const missing = Math.max(0, required - available);
    return { key, name: material.name, unit: material.unit, required, available, missing, status: missing > 0 ? "missing" : "ok" };
  });
}
