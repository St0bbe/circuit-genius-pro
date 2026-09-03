import { CATALOG_BY_KIND, type ComponentKind } from "@/lib/electrical";

const LAYER_COLOR: Record<string, string> = {
  iluminacao: "var(--layer-light)",
  tomadas: "var(--layer-outlet)",
  interruptores: "var(--layer-switch)",
  equipamentos: "var(--layer-equipment)",
};

export function kindColor(kind: ComponentKind) {
  const def = CATALOG_BY_KIND[kind];
  return LAYER_COLOR[def?.layer ?? "iluminacao"] ?? "var(--foreground)";
}

/** Símbolo elétrico desenhado em SVG, centrado em (0,0), raio ~11px. */
export function SymbolGlyph({ kind, size = 22 }: { kind: ComponentKind; size?: number }) {
  const c = kindColor(kind);
  const s = size / 22;
  const stroke = 1.6 / s;

  const common = { stroke: c, fill: "none", strokeWidth: stroke, strokeLinecap: "round" as const };

  let body: React.ReactNode;
  switch (kind) {
    case "ponto_luz":
    case "luminaria":
      body = (
        <>
          <circle r="8" {...common} />
          <line x1="-5.7" y1="-5.7" x2="5.7" y2="5.7" {...common} />
          <line x1="5.7" y1="-5.7" x2="-5.7" y2="5.7" {...common} />
        </>
      );
      break;
    case "spot":
      body = (
        <>
          <circle r="7" {...common} />
          <circle r="2.5" fill={c} stroke="none" />
        </>
      );
      break;
    case "arandela":
      body = (
        <>
          <path d="M -8 6 A 8 8 0 0 1 8 6 Z" {...common} />
          <line x1="-9" y1="6" x2="9" y2="6" {...common} />
        </>
      );
      break;
    case "sensor_presenca":
      body = (
        <>
          <circle r="7" {...common} />
          <path d="M -3.5 2 A 5 5 0 0 1 3.5 2" {...common} />
          <circle cy="-1" r="1.4" fill={c} stroke="none" />
        </>
      );
      break;
    case "interruptor_simples":
    case "interruptor_paralelo":
    case "interruptor_intermediario":
    case "dimmer":
      body = (
        <>
          <circle r="7.5" {...common} />
          <line x1="-4" y1="4" x2="4" y2="-4" {...common} />
          {kind !== "interruptor_simples" && (
            <text
              y="-9"
              textAnchor="middle"
              fill={c}
              fontSize="8"
              fontFamily="var(--font-mono)"
            >
              {kind === "dimmer" ? "d" : kind === "interruptor_paralelo" ? "3" : "4"}
            </text>
          )}
        </>
      );
      break;
    case "tug":
    case "tug_dupla":
    case "tug_tripla":
    case "tomada_externa":
    case "tomada_piso":
      body = (
        <>
          <path d="M -8 0 A 8 8 0 0 1 8 0 Z" {...common} />
          <line x1="-9" y1="0" x2="9" y2="0" {...common} />
          {kind === "tug_dupla" && <line x1="0" y1="-8" x2="0" y2="0" {...common} />}
          {kind === "tug_tripla" && (
            <>
              <line x1="-3" y1="-7.4" x2="-3" y2="0" {...common} />
              <line x1="3" y1="-7.4" x2="3" y2="0" {...common} />
            </>
          )}
          {kind === "tomada_piso" && <rect x="-9.5" y="-9.5" width="19" height="19" {...common} />}
        </>
      );
      break;
    case "tue":
      body = (
        <>
          <path d="M -8 0 A 8 8 0 0 1 8 0 Z" fill={c} stroke={c} strokeWidth={stroke} />
          <line x1="-9" y1="0" x2="9" y2="0" {...common} />
        </>
      );
      break;
    default:
      body = (
        <>
          <rect x="-8" y="-8" width="16" height="16" rx="2" {...common} />
          <text
            y="3.2"
            textAnchor="middle"
            fill={c}
            fontSize="8.5"
            fontFamily="var(--font-mono)"
          >
            {CATALOG_BY_KIND[kind]?.short ?? "?"}
          </text>
        </>
      );
  }

  return <g transform={`scale(${s})`}>{body}</g>;
}

export function SymbolPreview({ kind }: { kind: ComponentKind }) {
  return (
    <svg width="28" height="28" viewBox="-14 -14 28 28" aria-hidden="true">
      <SymbolGlyph kind={kind} size={22} />
    </svg>
  );
}
