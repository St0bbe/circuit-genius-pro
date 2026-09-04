import { Eye, EyeOff, Layers3, Library } from "lucide-react";
import { CATALOG, LAYERS, type ComponentKind, type LayerId } from "@/lib/electrical";
import { SymbolPreview } from "./SymbolGlyph";
import { cn } from "@/lib/utils";

const GROUPS = ["Iluminação", "Comandos", "Tomadas", "Equipamentos", "Caixas"] as const;

type Props = {
  activeKind: ComponentKind;
  onPick: (kind: ComponentKind) => void;
  visible: Record<LayerId, boolean>;
  onToggleLayer: (layer: LayerId) => void;
};

export function LibraryPanel({ activeKind, onPick, visible, onToggleLayer }: Props) {
  return (
    <div className="flex h-full flex-col overflow-y-auto border-r border-border bg-sidebar">
      <div className="border-b border-border p-3">
        <p className="tech-label mb-2 flex items-center gap-1.5"><Layers3 className="h-3.5 w-3.5" />Camadas</p>
        <div className="space-y-1">
          {LAYERS.map((l) => (
            <button key={l.id} type="button" onClick={() => onToggleLayer(l.id)} title={`${visible[l.id] ? "Ocultar" : "Mostrar"} ${l.label}`} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-sidebar-accent", !visible[l.id] && "opacity-40")}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: l.colorVar }} />
              <span className="flex-1">{l.label}</span>
              {visible[l.id] ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3">
        <p className="tech-label mb-2 flex items-center gap-1.5"><Library className="h-3.5 w-3.5" />Biblioteca de componentes</p>
        {GROUPS.map((g) => (
          <div key={g} className="mb-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{g}</p>
            <div className="space-y-1">
              {CATALOG.filter((c) => c.group === g).map((c) => (
                <button key={c.kind} type="button" onClick={() => onPick(c.kind)} className={cn("flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent", activeKind === c.kind && "border-primary bg-sidebar-accent")}>
                  <SymbolPreview kind={c.kind} />
                  <span className="flex-1 text-sm leading-tight">{c.label}</span>
                  <span className="tech-label">{c.power ? `${c.power}W` : "—"}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
