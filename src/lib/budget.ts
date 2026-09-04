import { calculateMaterials, type MaterialItem } from "@/lib/materials";
import type { PlanDocument } from "@/lib/electrical";

export type PriceEntry = { key: string; unitPrice: number };
export type BudgetLine = MaterialItem & { key: string; unitPrice: number; total: number };
export type BudgetResult = { lines: BudgetLine[]; materialsTotal: number; labor: number; projectFee: number; total: number };

export function materialKey(item: MaterialItem) {
  return `${item.category}:${item.name}:${item.unit}`.toLowerCase();
}

export function calculateBudget(doc: PlanDocument, prices: PriceEntry[] = [], labor = 0, projectFee = 0): BudgetResult {
  const priceMap = new Map(prices.map((entry) => [entry.key.toLowerCase(), Math.max(0, entry.unitPrice || 0)]));
  const lines = calculateMaterials(doc).map((item) => {
    const key = materialKey(item);
    const unitPrice = priceMap.get(key) ?? 0;
    return { ...item, key, unitPrice, total: Math.round(item.quantity * unitPrice * 100) / 100 };
  });
  const materialsTotal = Math.round(lines.reduce((sum, line) => sum + line.total, 0) * 100) / 100;
  const total = Math.round((materialsTotal + Math.max(0, labor) + Math.max(0, projectFee)) * 100) / 100;
  return { lines, materialsTotal, labor: Math.max(0, labor), projectFee: Math.max(0, projectFee), total };
}
