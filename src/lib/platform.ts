import type { PlanDocument } from "@/lib/electrical";
import { calculateMaterials } from "@/lib/materials";

export type Supplier = { id: string; name: string; phone?: string; email?: string };
export type PriceItem = { id: string; supplierId: string; materialName: string; unit: string; unitPrice: number };
export type InventoryItem = { id: string; materialName: string; unit: string; quantity: number; minimum?: number };
export type AutomationItem = { id: string; kind: "smart-light" | "relay" | "presence" | "movement" | "luminosity" | "temperature" | "door-window" | "scene" | "timer"; label: string; protocol?: string; notes?: string };
export type RulesProfile = { id: "BR" | "PT" | "CUSTOM"; label: string; jurisdiction: string; frequencyHz: number; voltageDropLimitPct: number; reserveModulesPct: number; notes: string };

type PlatformDoc = PlanDocument & {
  suppliers?: Supplier[];
  prices?: PriceItem[];
  inventory?: InventoryItem[];
  automation?: AutomationItem[];
  rulesProfile?: RulesProfile;
};

export const DEFAULT_RULES: Record<RulesProfile["id"], RulesProfile> = {
  BR: { id: "BR", label: "Brasil", jurisdiction: "Brasil", frequencyHz: 60, voltageDropLimitPct: 4, reserveModulesPct: 20, notes: "Perfil inicial configurável. A validação final deve seguir as normas aplicáveis e profissional habilitado." },
  PT: { id: "PT", label: "Portugal", jurisdiction: "Portugal", frequencyHz: 50, voltageDropLimitPct: 3, reserveModulesPct: 20, notes: "Perfil inicial configurável; confirme RTIEBT/IEC e regras locais aplicáveis." },
  CUSTOM: { id: "CUSTOM", label: "Personalizado", jurisdiction: "Personalizada", frequencyHz: 60, voltageDropLimitPct: 4, reserveModulesPct: 20, notes: "Preencha os limites de acordo com a jurisdição do projeto." },
};

export function getSuppliers(doc: PlanDocument) { return (doc as PlatformDoc).suppliers ?? []; }
export function setSuppliers(doc: PlanDocument, value: Supplier[]): PlanDocument { return { ...doc, suppliers: value } as PlanDocument; }
export function getPrices(doc: PlanDocument) { return (doc as PlatformDoc).prices ?? []; }
export function setPrices(doc: PlanDocument, value: PriceItem[]): PlanDocument { return { ...doc, prices: value } as PlanDocument; }
export function getInventory(doc: PlanDocument) { return (doc as PlatformDoc).inventory ?? []; }
export function setInventory(doc: PlanDocument, value: InventoryItem[]): PlanDocument { return { ...doc, inventory: value } as PlanDocument; }
export function getAutomation(doc: PlanDocument) { return (doc as PlatformDoc).automation ?? []; }
export function setAutomation(doc: PlanDocument, value: AutomationItem[]): PlanDocument { return { ...doc, automation: value } as PlanDocument; }
export function getRulesProfile(doc: PlanDocument): RulesProfile { return (doc as PlatformDoc).rulesProfile ?? DEFAULT_RULES.BR; }
export function setRulesProfile(doc: PlanDocument, profile: RulesProfile): PlanDocument { return { ...doc, rulesProfile: profile } as PlanDocument; }

export function calculateBudget(doc: PlanDocument) {
  const materials = calculateMaterials(doc);
  const prices = getPrices(doc);
  const rows = materials.map((material) => {
    const matches = prices.filter((p) => p.materialName.toLowerCase() === material.name.toLowerCase() && p.unit === material.unit);
    const cheapest = matches.slice().sort((a, b) => a.unitPrice - b.unitPrice)[0];
    return { material: material.name, unit: material.unit, quantity: material.quantity, supplierId: cheapest?.supplierId ?? null, unitPrice: cheapest?.unitPrice ?? null, total: cheapest ? material.quantity * cheapest.unitPrice : null };
  });
  return { rows, pricedTotal: rows.reduce((sum, row) => sum + (row.total ?? 0), 0), missingPrices: rows.filter((row) => row.unitPrice == null).length };
}

export function compareInventory(doc: PlanDocument) {
  const materials = calculateMaterials(doc);
  const inventory = getInventory(doc);
  return materials.map((material) => {
    const stock = inventory.find((item) => item.materialName.toLowerCase() === material.name.toLowerCase() && item.unit === material.unit);
    const available = stock?.quantity ?? 0;
    return { material: material.name, unit: material.unit, required: material.quantity, available, missing: Math.max(0, material.quantity - available), enough: available >= material.quantity };
  });
}
