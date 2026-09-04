import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlanDocument } from "@/lib/electrical";
import {
  DEFAULT_RULES,
  calculateBudget,
  compareInventory,
  getAutomation,
  getInventory,
  getPrices,
  getRulesProfile,
  getSuppliers,
  setAutomation,
  setInventory,
  setPrices,
  setRulesProfile,
  setSuppliers,
  type AutomationItem,
  type RulesProfile,
} from "@/lib/platform";

type Props = { doc: PlanDocument; onChange: (updater: (doc: PlanDocument) => PlanDocument) => void };
type Tab = "fornecedores" | "estoque" | "orcamento" | "automacao" | "regras";

const uid = () => Math.random().toString(36).slice(2, 9);

export function PlatformPanel({ doc, onChange }: Props) {
  const [tab, setTab] = useState<Tab>("fornecedores");
  const suppliers = getSuppliers(doc);
  const prices = getPrices(doc);
  const inventory = getInventory(doc);
  const automation = getAutomation(doc);
  const profile = getRulesProfile(doc);
  const budget = useMemo(() => calculateBudget(doc), [doc]);
  const stock = useMemo(() => compareInventory(doc), [doc]);

  return <div className="border-t border-border bg-sidebar">
    <div className="flex flex-wrap gap-1 border-b border-border p-2">
      {(["fornecedores","estoque","orcamento","automacao","regras"] as Tab[]).map((key) => <Button key={key} size="sm" variant={tab === key ? "default" : "ghost"} onClick={() => setTab(key)}>{key === "fornecedores" ? "Fornecedores" : key === "estoque" ? "Estoque" : key === "orcamento" ? "Orçamento" : key === "automacao" ? "Automação" : "Regras"}</Button>)}
    </div>

    {tab === "fornecedores" && <div className="space-y-3 p-3"><Header title="Fornecedores e preços" subtitle="Tabela de preços persistida dentro do projeto" /><Button size="sm" variant="secondary" onClick={() => onChange((d) => setSuppliers(d, [...getSuppliers(d), { id: uid(), name: `Fornecedor ${getSuppliers(d).length + 1}` }]))}>+ Fornecedor</Button>{suppliers.map((supplier) => <div key={supplier.id} className="space-y-2 rounded border border-border bg-card/45 p-2"><Input value={supplier.name} onChange={(e) => onChange((d) => setSuppliers(d, getSuppliers(d).map((s) => s.id === supplier.id ? { ...s, name: e.target.value } : s)))} /><div className="grid grid-cols-2 gap-2"><Input placeholder="Telefone" value={supplier.phone ?? ""} onChange={(e) => onChange((d) => setSuppliers(d, getSuppliers(d).map((s) => s.id === supplier.id ? { ...s, phone: e.target.value } : s)))} /><Input placeholder="E-mail" value={supplier.email ?? ""} onChange={(e) => onChange((d) => setSuppliers(d, getSuppliers(d).map((s) => s.id === supplier.id ? { ...s, email: e.target.value } : s)))} /></div><div className="flex justify-end"><Button size="sm" variant="destructive" onClick={() => onChange((d) => setSuppliers(d, getSuppliers(d).filter((s) => s.id !== supplier.id)))}>Excluir</Button></div></div>)}<Button size="sm" variant="secondary" onClick={() => onChange((d) => setPrices(d, [...getPrices(d), { id: uid(), supplierId: getSuppliers(d)[0]?.id ?? "", materialName: "Cabo 2,5 mm²", unit: "m", unitPrice: 0 }]))}>+ Preço</Button>{prices.map((price) => <div key={price.id} className="grid grid-cols-4 gap-1 rounded border border-border bg-card/45 p-2"><Input value={price.materialName} onChange={(e) => onChange((d) => setPrices(d, getPrices(d).map((p) => p.id === price.id ? { ...p, materialName: e.target.value } : p)))} /><select className="rounded border border-input bg-background px-1 text-xs" value={price.supplierId} onChange={(e) => onChange((d) => setPrices(d, getPrices(d).map((p) => p.id === price.id ? { ...p, supplierId: e.target.value } : p)))}><option value="">Fornecedor</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><Input value={price.unit} onChange={(e) => onChange((d) => setPrices(d, getPrices(d).map((p) => p.id === price.id ? { ...p, unit: e.target.value } : p)))} /><Input type="number" step="0.01" value={price.unitPrice} onChange={(e) => onChange((d) => setPrices(d, getPrices(d).map((p) => p.id === price.id ? { ...p, unitPrice: Number(e.target.value) || 0 } : p)))} /></div>)}</div>}

    {tab === "estoque" && <div className="space-y-3 p-3"><Header title="Controle de estoque" subtitle="Cadastro e comparação com o quantitativo atual" /><Button size="sm" variant="secondary" onClick={() => onChange((d) => setInventory(d, [...getInventory(d), { id: uid(), materialName: `Material ${getInventory(d).length + 1}`, unit: "un", quantity: 0 }]))}>+ Item</Button>{inventory.map((item) => <div key={item.id} className="grid grid-cols-4 gap-1 rounded border border-border bg-card/45 p-2"><Input value={item.materialName} onChange={(e) => onChange((d) => setInventory(d, getInventory(d).map((x) => x.id === item.id ? { ...x, materialName: e.target.value } : x)))} /><Input value={item.unit} onChange={(e) => onChange((d) => setInventory(d, getInventory(d).map((x) => x.id === item.id ? { ...x, unit: e.target.value } : x)))} /><Input type="number" value={item.quantity} onChange={(e) => onChange((d) => setInventory(d, getInventory(d).map((x) => x.id === item.id ? { ...x, quantity: Number(e.target.value) || 0 } : x)))} /><Button size="sm" variant="destructive" onClick={() => onChange((d) => setInventory(d, getInventory(d).filter((x) => x.id !== item.id)))}>×</Button></div>)}<div className="space-y-1">{stock.map((row) => <div key={`${row.material}-${row.unit}`} className="flex justify-between rounded border border-border/60 bg-card/45 px-2 py-1.5 text-xs"><span>{row.enough ? "🟢" : "🔴"} {row.material}</span><span className="font-mono">{row.available.toLocaleString("pt-BR")} / {row.required.toLocaleString("pt-BR")} {row.unit}{!row.enough ? ` · faltam ${row.missing.toLocaleString("pt-BR")}` : ""}</span></div>)}</div></div>}

    {tab === "orcamento" && <div className="space-y-2 p-3"><Header title="Orçamento automático" subtitle="Usa o menor preço cadastrado por material/unidade" /><div className="rounded border border-border bg-card/45 p-2"><div className="flex justify-between text-sm"><span>Total precificado</span><span className="font-mono">R$ {budget.pricedTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div><div className="mt-1 text-[10px] text-muted-foreground">{budget.missingPrices} item(ns) ainda sem preço.</div></div>{budget.rows.map((row) => <div key={`${row.material}-${row.unit}`} className="flex justify-between gap-2 rounded border border-border/60 bg-card/45 px-2 py-1.5 text-xs"><span>{row.material} · {row.quantity.toLocaleString("pt-BR")} {row.unit}</span><span className="font-mono">{row.total == null ? "sem preço" : `R$ ${row.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span></div>)}</div>}

    {tab === "automacao" && <div className="space-y-3 p-3"><Header title="Automação residencial" subtitle="Módulos e sensores opcionais do projeto" /><Button size="sm" variant="secondary" onClick={() => onChange((d) => setAutomation(d, [...getAutomation(d), { id: uid(), kind: "smart-light", label: `Automação ${getAutomation(d).length + 1}` }]))}>+ Automação</Button>{automation.map((item) => <div key={item.id} className="space-y-2 rounded border border-border bg-card/45 p-2"><Input value={item.label} onChange={(e) => onChange((d) => setAutomation(d, getAutomation(d).map((x) => x.id === item.id ? { ...x, label: e.target.value } : x)))} /><div className="grid grid-cols-2 gap-2"><select className="h-9 rounded border border-input bg-background px-2 text-xs" value={item.kind} onChange={(e) => onChange((d) => setAutomation(d, getAutomation(d).map((x) => x.id === item.id ? { ...x, kind: e.target.value as AutomationItem["kind"] } : x)))}>{["smart-light","relay","presence","movement","luminosity","temperature","door-window","scene","timer"].map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select><Input placeholder="Protocolo (Wi‑Fi, Zigbee...)" value={item.protocol ?? ""} onChange={(e) => onChange((d) => setAutomation(d, getAutomation(d).map((x) => x.id === item.id ? { ...x, protocol: e.target.value } : x)))} /></div><Button size="sm" variant="destructive" onClick={() => onChange((d) => setAutomation(d, getAutomation(d).filter((x) => x.id !== item.id)))}>Excluir</Button></div>)}</div>}

    {tab === "regras" && <div className="space-y-3 p-3"><Header title="Perfis de engenharia" subtitle="Parâmetros configuráveis por jurisdição" /><select className="h-9 w-full rounded border border-input bg-background px-2 text-sm" value={profile.id} onChange={(e) => onChange((d) => setRulesProfile(d, { ...DEFAULT_RULES[e.target.value as RulesProfile["id"]] }))}><option value="BR">Brasil</option><option value="PT">Portugal</option><option value="CUSTOM">Personalizado</option></select><div className="grid grid-cols-2 gap-2"><NumberField label="Frequência (Hz)" value={profile.frequencyHz} onChange={(v) => onChange((d) => setRulesProfile(d, { ...getRulesProfile(d), frequencyHz: v }))} /><NumberField label="Queda máx. (%)" value={profile.voltageDropLimitPct} onChange={(v) => onChange((d) => setRulesProfile(d, { ...getRulesProfile(d), voltageDropLimitPct: v }))} /><NumberField label="Reserva quadro (%)" value={profile.reserveModulesPct} onChange={(v) => onChange((d) => setRulesProfile(d, { ...getRulesProfile(d), reserveModulesPct: v }))} /></div><Input value={profile.jurisdiction} onChange={(e) => onChange((d) => setRulesProfile(d, { ...getRulesProfile(d), jurisdiction: e.target.value }))} /><p className="text-[10px] text-muted-foreground">{profile.notes}</p></div>}
  </div>;
}

function Header({ title, subtitle }: { title: string; subtitle: string }) { return <div><p className="tech-label">{title}</p><p className="text-[11px] text-muted-foreground">{subtitle}</p></div>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="text-xs"><span className="text-[10px] text-muted-foreground">{label}</span><Input className="mt-1" type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} /></label>; }
