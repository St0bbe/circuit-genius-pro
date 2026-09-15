import { useMemo, useState } from "react";
import {
  Box,
  Cable,
  CheckCircle2,
  DoorOpen,
  Rotate3D,
  Sparkles,
  Trash2,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlanDocument } from "@/lib/electrical";
import {
  addDevice,
  autoBuildPanel,
  DEVICE_PRESETS,
  getPanelAssembly,
  setPanelAssembly,
  validateAssembly,
  type PanelAssembly,
  type PanelDevice,
  type PanelDeviceKind,
  type WireColor,
} from "@/lib/panel-assembly";

type Props = {
  doc: PlanDocument;
  onChange: (updater: (doc: PlanDocument) => PlanDocument) => void;
  initialPanelId?: string;
};
const COLORS: Record<WireColor, string> = {
  red: "#ef4444",
  black: "#18181b",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#eab308",
};

export function PanelBuilder3D({ doc, onChange, initialPanelId }: Props) {
  const [panelId, setPanelId] = useState(
    initialPanelId ??
      doc.panels.find((panel) => (panel.kind ?? "distribution") === "distribution")?.id ??
      doc.panels[0]?.id ??
      "",
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [rotate, setRotate] = useState(-7);
  const [tilt, setTilt] = useState(4);
  const [zoom, setZoom] = useState(1);
  const assembly = panelId ? getPanelAssembly(doc, panelId) : null;
  const issues = useMemo(() => (assembly ? validateAssembly(doc, assembly) : []), [doc, assembly]);
  const selectedDevice = assembly?.devices.find((d) => d.id === selected) ?? null;
  const updateAssembly = (fn: (current: PanelAssembly) => PanelAssembly) =>
    onChange((currentDoc) =>
      setPanelAssembly(currentDoc, fn(getPanelAssembly(currentDoc, panelId))),
    );

  if (!doc.panels.length)
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Posicione um QD na planta para começar a montagem 3D.
      </div>
    );
  if (!assembly) return null;
  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="tech-label">Montagem prática do quadro 3D</p>
          <p className="text-[11px] text-muted-foreground">
            Instale os componentes no trilho DIN, organize proteções e confira as ligações.
          </p>
        </div>
        <select
          className="h-9 rounded border border-input bg-background px-2 text-xs"
          value={panelId}
          onChange={(e) => {
            setPanelId(e.target.value);
            setSelected(null);
          }}
        >
          {doc.panels.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 xl:grid-cols-[190px_minmax(460px,1fr)_220px]">
        <aside className="space-y-2 rounded border border-border bg-card/45 p-2">
          <p className="text-xs font-semibold">Componentes</p>
          {(Object.keys(DEVICE_PRESETS) as PanelDeviceKind[]).map((kind) => (
            <button
              key={kind}
              onClick={() => updateAssembly((a) => addDevice(a, kind))}
              className="flex w-full items-center justify-between rounded border border-border/70 bg-background/70 px-2 py-2 text-left text-xs hover:border-primary"
            >
              <span>{DEVICE_PRESETS[kind].label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {DEVICE_PRESETS[kind].modules}M
              </span>
            </button>
          ))}
          <Button
            className="w-full"
            size="sm"
            onClick={() => onChange((d) => setPanelAssembly(d, autoBuildPanel(d, panelId)))}
          >
            <Sparkles className="mr-1 size-3.5" />
            Montar automático
          </Button>
        </aside>
        <section className="min-w-0 overflow-hidden rounded border border-border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-3">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-300">
            <span className="flex items-center gap-1">
              <Rotate3D className="size-3" /> rotação
            </span>
            <input
              aria-label="Rotação"
              type="range"
              min="-25"
              max="25"
              value={rotate}
              onChange={(e) => setRotate(Number(e.target.value))}
            />
            <span>inclinação</span>
            <input
              aria-label="Inclinação"
              type="range"
              min="-12"
              max="18"
              value={tilt}
              onChange={(e) => setTilt(Number(e.target.value))}
            />
            <span className="flex items-center gap-1">
              <ZoomIn className="size-3" /> zoom
            </span>
            <input
              aria-label="Zoom"
              type="range"
              min="0.7"
              max="1.35"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
            <button
              className="ml-auto rounded bg-white/10 px-2 py-1 hover:bg-white/20"
              onClick={() => updateAssembly((a) => ({ ...a, doorOpen: !a.doorOpen }))}
            >
              <DoorOpen className="mr-1 inline size-3" />
              {assembly.doorOpen ? "Fechar porta" : "Abrir porta"}
            </button>
          </div>
          <div className="flex min-h-[430px] items-center justify-center [perspective:1100px]">
            <div
              className="relative transition-transform duration-300"
              style={{
                transform: `scale(${zoom}) rotateX(${tilt}deg) rotateY(${rotate}deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              <div
                className="relative w-[520px] max-w-[76vw] rounded-xl border-[14px] border-slate-300 bg-slate-100 p-7 shadow-2xl shadow-black/70"
                style={{
                  minHeight: assembly.rows * 112 + 92,
                  boxShadow: "inset 0 0 28px #64748b, 20px 25px 35px #0009",
                }}
              >
                <div className="absolute inset-x-6 top-2 flex justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  <span>{doc.panels.find((p) => p.id === panelId)?.name}</span>
                  <span>
                    {assembly.rows}×{assembly.modulesPerRow} módulos
                  </span>
                </div>
                {Array.from({ length: assembly.rows }, (_, rail) => (
                  <Rail
                    key={rail}
                    rail={rail}
                    assembly={assembly}
                    selected={selected}
                    onSelect={setSelected}
                    onMove={(id, slot) =>
                      updateAssembly((a) => ({
                        ...a,
                        devices: a.devices.map((d) =>
                          d.id === id
                            ? { ...d, rail, slot: Math.min(slot, a.modulesPerRow - d.modules) }
                            : d,
                        ),
                      }))
                    }
                  />
                ))}
                <div className="mt-5 grid grid-cols-2 gap-7">
                  <Busbar id="bar-neutral" label="N · NEUTRO" color="bg-blue-600" />
                  <Busbar id="bar-earth" label="PE · TERRA" color="bg-emerald-600" />
                </div>
                {assembly.wires.slice(0, 18).map((wire, i) => (
                  <div
                    key={wire.id}
                    title={`${wire.label} · ${wire.section} mm²`}
                    className="pointer-events-none absolute left-[18%] h-[2px] origin-left opacity-70"
                    style={{
                      top: 83 + (i % Math.max(1, assembly.rows)) * 111 + (i % 7) * 5,
                      width: `${36 + (i % 5) * 7}%`,
                      background: COLORS[wire.color],
                      transform: `rotate(${8 + (i % 4) * 7}deg) translateZ(12px)`,
                    }}
                  />
                ))}
              </div>
              <div
                className={`absolute inset-y-0 left-0 w-full origin-left rounded-xl border-[12px] border-slate-400 bg-slate-300/25 shadow-xl backdrop-blur-[1px] transition-transform duration-700 ${assembly.doorOpen ? "[transform:rotateY(-105deg)]" : "[transform:rotateY(0deg)]"}`}
                style={{ transformStyle: "preserve-3d" }}
              >
                <div className="absolute right-3 top-1/2 h-16 w-3 -translate-y-1/2 rounded bg-slate-500" />
              </div>
            </div>
          </div>
        </section>
        <aside className="space-y-3 rounded border border-border bg-card/45 p-2">
          <div>
            <p className="text-xs font-semibold">Configuração</p>
            <p className="text-[10px] text-muted-foreground">
              Clique em um componente para editar.
            </p>
          </div>
          <label className="block text-[10px] text-muted-foreground">
            Linhas DIN
            <input
              className="mt-1 h-8 w-full rounded border border-input bg-background px-2 text-xs"
              type="number"
              min="1"
              max="5"
              value={assembly.rows}
              onChange={(e) =>
                updateAssembly((a) => ({
                  ...a,
                  rows: Math.max(1, Math.min(5, Number(e.target.value))),
                }))
              }
            />
          </label>
          <label className="block text-[10px] text-muted-foreground">
            Módulos por linha
            <select
              className="mt-1 h-8 w-full rounded border border-input bg-background px-2 text-xs"
              value={assembly.modulesPerRow}
              onChange={(e) =>
                updateAssembly((a) => ({ ...a, modulesPerRow: Number(e.target.value) }))
              }
            >
              <option>8</option>
              <option>12</option>
              <option>18</option>
              <option>24</option>
            </select>
          </label>
          {selectedDevice && (
            <DeviceEditor
              device={selectedDevice}
              onChange={(patch) =>
                updateAssembly((a) => ({
                  ...a,
                  devices: a.devices.map((d) =>
                    d.id === selectedDevice.id ? { ...d, ...patch } : d,
                  ),
                }))
              }
              onDelete={() => {
                updateAssembly((a) => ({
                  ...a,
                  devices: a.devices.filter((d) => d.id !== selectedDevice.id),
                  wires: a.wires.filter(
                    (w) => w.from !== selectedDevice.id && w.to !== selectedDevice.id,
                  ),
                }));
                setSelected(null);
              }}
            />
          )}
          <div className="rounded border border-border bg-background/60 p-2">
            <div className="mb-1 flex items-center gap-1 text-xs font-semibold">
              <Cable className="size-3.5" />
              Ligações
            </div>
            <p className="text-[10px] text-muted-foreground">
              {assembly.wires.length} condutores organizados · fase, neutro e proteção.
            </p>
          </div>
          <div
            className={`rounded border p-2 ${issues.length ? "border-amber-500/50 bg-amber-500/10" : "border-emerald-500/50 bg-emerald-500/10"}`}
          >
            <div className="flex items-center gap-1 text-xs font-semibold">
              <CheckCircle2 className="size-3.5" />
              Conferência
            </div>
            {issues.length ? (
              <ul className="mt-1 space-y-1 text-[10px] text-amber-500">
                {issues.map((x) => (
                  <li key={x}>• {x}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[10px] text-emerald-500">
                Montagem básica completa e sem conflitos.
              </p>
            )}
          </div>
          <p className="text-[9px] leading-relaxed text-muted-foreground">
            Simulação didática. A montagem, o dimensionamento e a energização reais devem ser
            executados e conferidos por profissional habilitado, conforme normas aplicáveis.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Rail({
  rail,
  assembly,
  selected,
  onSelect,
  onMove,
}: {
  rail: number;
  assembly: PanelAssembly;
  selected: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, slot: number) => void;
}) {
  const width = 100 / assembly.modulesPerRow;
  return (
    <div
      className="relative mb-5 h-[92px] border-y-4 border-slate-400 bg-slate-200 shadow-inner"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) =>
        onMove(
          e.dataTransfer.getData("device"),
          Math.floor(
            (e.nativeEvent.offsetX / e.currentTarget.clientWidth) * assembly.modulesPerRow,
          ),
        )
      }
    >
      <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 bg-gradient-to-b from-slate-300 via-slate-500 to-slate-300 shadow" />
      {Array.from({ length: assembly.modulesPerRow }, (_, i) => (
        <div
          key={i}
          className="absolute inset-y-0 border-l border-dashed border-slate-400/40"
          style={{ left: `${i * width}%` }}
        >
          <span className="absolute bottom-0.5 left-0.5 text-[7px] text-slate-500">
            {rail * assembly.modulesPerRow + i + 1}
          </span>
        </div>
      ))}
      {assembly.devices
        .filter((d) => d.rail === rail)
        .map((d) => (
          <Device3D
            key={d.id}
            device={d}
            width={width}
            selected={selected === d.id}
            onSelect={() => onSelect(d.id)}
          />
        ))}
    </div>
  );
}
function Device3D({
  device,
  width,
  selected,
  onSelect,
}: {
  device: PanelDevice;
  width: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone =
    device.kind === "dps"
      ? "from-rose-50 to-rose-200"
      : device.kind === "dr"
        ? "from-blue-50 to-blue-200"
        : device.kind === "reserve"
          ? "from-slate-200 to-slate-300"
          : "from-white to-slate-200";
  return (
    <button
      draggable
      onDragStart={(e) => e.dataTransfer.setData("device", device.id)}
      onClick={onSelect}
      className={`absolute top-2 z-10 h-[72px] overflow-hidden rounded-sm border-2 bg-gradient-to-br ${tone} p-1 text-left text-slate-900 shadow-[4px_5px_7px_#0006] transition ${selected ? "border-cyan-500 ring-2 ring-cyan-400" : "border-slate-500"}`}
      style={{
        left: `${device.slot * width}%`,
        width: `${device.modules * width}%`,
        transform: "translateZ(18px)",
      }}
    >
      <span className="block truncate text-[8px] font-black">{device.label}</span>
      <span className="block text-[7px]">
        {device.poles}P · {device.rating ?? "—"}A
      </span>
      <span className="mx-auto mt-2 block h-7 w-3 rounded-sm bg-slate-700 shadow-inner" />
    </button>
  );
}
function Busbar({ id, label, color }: { id: string; label: string; color: string }) {
  return (
    <div id={id} className="relative h-7 rounded bg-slate-300 p-1 shadow-inner">
      <div className={`h-2 rounded ${color}`} />
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className="absolute top-1 size-2 rounded-full border border-slate-700 bg-amber-300"
          style={{ left: `${7 + i * 10}%` }}
        />
      ))}
      <span className="absolute bottom-0.5 left-2 text-[7px] font-black text-slate-600">
        {label}
      </span>
    </div>
  );
}
function DeviceEditor({
  device,
  onChange,
  onDelete,
}: {
  device: PanelDevice;
  onChange: (patch: Partial<PanelDevice>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-2 rounded border border-primary/40 bg-primary/5 p-2">
      <div className="flex items-center gap-1 text-xs font-semibold">
        <Box className="size-3.5" />
        {device.label}
      </div>
      <label className="block text-[10px] text-muted-foreground">
        Identificação
        <input
          className="mt-1 h-8 w-full rounded border border-input bg-background px-2 text-xs"
          value={device.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-muted-foreground">
          Corrente (A)
          <input
            className="mt-1 h-8 w-full rounded border border-input bg-background px-2 text-xs"
            type="number"
            value={device.rating ?? ""}
            onChange={(e) => onChange({ rating: Number(e.target.value) || undefined })}
          />
        </label>
        <label className="text-[10px] text-muted-foreground">
          Polos
          <select
            className="mt-1 h-8 w-full rounded border border-input bg-background px-2 text-xs"
            value={device.poles}
            onChange={(e) =>
              onChange({
                poles: Number(e.target.value),
                modules: Math.max(device.modules, Number(e.target.value)),
              })
            }
          >
            <option>1</option>
            <option>2</option>
            <option>3</option>
            <option>4</option>
          </select>
        </label>
      </div>
      <Button variant="destructive" size="sm" className="w-full" onClick={onDelete}>
        <Trash2 className="mr-1 size-3" />
        Remover
      </Button>
    </div>
  );
}
