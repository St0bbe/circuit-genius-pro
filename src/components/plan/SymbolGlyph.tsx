import { CATALOG_BY_KIND, type ComponentKind } from "@/lib/electrical";

const LAYER_COLOR: Record<string, string> = {
  iluminacao: "var(--layer-light)",
  tomadas: "var(--layer-outlet)",
  interruptores: "var(--layer-switch)",
  equipamentos: "var(--layer-equipment)",
  eletrodutos: "var(--layer-conduit)",
};

export function kindColor(kind: ComponentKind) {
  const def = CATALOG_BY_KIND[kind];
  return LAYER_COLOR[def?.layer ?? "iluminacao"] ?? "var(--foreground)";
}

type GlyphProps = { kind: ComponentKind; size?: number; height?: number };

/**
 * Símbolos de planta baseados na convenção brasileira tradicional da NBR 5444:1989.
 * A origem (0,0) dos símbolos de parede é o ponto exato de fixação na parede.
 */
export function SymbolGlyph({ kind, size = 22, height }: GlyphProps) {
  const c = kindColor(kind);
  const s = size / 22;
  const stroke = 1.5 / s;
  const common = { stroke: c, fill: "none", strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const text = (value: string, y = 3) => <text y={y} textAnchor="middle" fill={c} fontSize="7.5" fontWeight="600" fontFamily="var(--font-mono)">{value}</text>;

  const outletHeight = height ?? CATALOG_BY_KIND[kind]?.height ?? 0.3;
  const outletLevel: "low" | "mid" | "high" = outletHeight >= 1.8 ? "high" : outletHeight >= 0.8 ? "mid" : "low";

  const outletTriangle = (count = 1, floor = false, suffix?: string) => {
    if (floor) {
      return <>
        <rect x="-10" y="-10" width="20" height="20" rx="1" {...common} />
        <path d="M -5 -5.5 L 5 0 L -5 5.5 Z" {...common} />
      </>;
    }

    const spacing = 7;
    const offsets = Array.from({ length: count }, (_, index) => (index - (count - 1) / 2) * spacing);

    const renderTriangle = (offsetY: number, index: number) => {
      const top = offsetY - 3.2;
      const bottom = offsetY + 3.2;
      const outline = `M 5 ${top} L 15 ${offsetY} L 5 ${bottom} Z`;
      const lowerHalf = `M 5 ${offsetY} L 15 ${offsetY} L 5 ${bottom} Z`;

      return <g key={index}>
        <line x1="0" y1={offsetY} x2="5" y2={offsetY} {...common} />
        <path d={outline} {...common} fill={outletLevel === "high" ? c : "none"} />
        {outletLevel === "mid" && <path d={lowerHalf} fill={c} stroke="none" />}
      </g>;
    };

    return <>
      {offsets.map(renderTriangle)}
      {suffix && <text x="18" y="3" fill={c} fontSize="5" fontWeight="700" fontFamily="var(--font-mono)">{suffix}</text>}
    </>;
  };

  const wall = <g opacity="0.95"><line x1="0" y1="-7" x2="0" y2="7" {...common} /></g>;
  const equipmentBox = (label: string) => <><rect x="-9" y="-8" width="18" height="16" {...common} />{text(label)}</>;

  let body: React.ReactNode;

  switch (kind) {
    case "ponto_luz": body = <circle r="8" {...common} />; break;
    case "luminaria": body = <><rect x="-10" y="-6" width="20" height="12" {...common} /><circle r="5" {...common} /></>; break;
    case "spot": body = <><circle r="8" fill={c} stroke={c} strokeWidth={stroke} /><circle r="3.3" fill="var(--background)" stroke="none" /></>; break;
    case "arandela": body = <>{wall}<circle cx="7" r="6.5" {...common} /></>; break;
    case "perfil_led": body = <><rect x="-10" y="-4" width="20" height="8" {...common} /><line x1="-7" y1="0" x2="7" y2="0" {...common} /></>; break;
    case "sensor_presenca": body = <><circle r="7.5" {...common} />{text("SP")}</>; break;
    case "fotocelula": body = <><circle r="7.5" {...common} />{text("FC")}</>; break;

    case "interruptor_simples": body = <><circle r="5.8" {...common} /><text x="7" y="-5" fill={c} fontSize="6.5" fontFamily="var(--font-mono)">a</text></>; break;
    case "interruptor_paralelo": body = <><circle r="5.8" fill={c} stroke={c} strokeWidth={stroke} /><text x="7" y="-5" fill={c} fontSize="6.5" fontFamily="var(--font-mono)">a</text></>; break;
    case "interruptor_intermediario": body = <><circle r="5.8" {...common} /><path d="M 0 -5.8 A 5.8 5.8 0 0 1 0 5.8 Z" fill={c} stroke="none" /><text x="7" y="-5" fill={c} fontSize="6.5" fontFamily="var(--font-mono)">a</text></>; break;
    case "dimmer": body = <><circle r="5.8" {...common} />{text("D", 2.6)}</>; break;
    case "rele": body = <><circle r="5.8" {...common} />{text("R", 2.6)}</>; break;
    case "comando_sensor": body = <><circle r="5.8" {...common} />{text("CS", 2.4)}</>; break;

    case "tug": body = outletTriangle(1); break;
    case "tug_dupla": body = outletTriangle(2); break;
    case "tug_tripla": body = outletTriangle(3); break;
    case "tug_usb": body = outletTriangle(1, false, "U"); break;
    case "tue": body = outletTriangle(1, false, "E"); break;
    case "tue_dupla": body = outletTriangle(2, false, "E"); break;
    case "tomada_equipamento": body = outletTriangle(1, false, "EQ"); break;
    case "tomada_piso": body = outletTriangle(1, true); break;
    case "tomada_externa": body = outletTriangle(1, false, "EXT"); break;

    case "chuveiro": body = equipmentBox("CH"); break;
    case "torneira_eletrica": body = equipmentBox("TQ"); break;
    case "forno": body = equipmentBox("FR"); break;
    case "cooktop": body = equipmentBox("CT"); break;
    case "microondas": body = equipmentBox("MO"); break;
    case "maquina_lavar": body = equipmentBox("ML"); break;
    case "maquina_secar": body = equipmentBox("MS"); break;
    case "ar_condicionado": body = equipmentBox("AC"); break;
    case "aquecedor": body = equipmentBox("AQ"); break;
    case "geladeira": body = equipmentBox("GE"); break;
    case "freezer": body = equipmentBox("FZ"); break;
    case "lava_loucas": body = equipmentBox("LL"); break;
    case "motor_portao": body = equipmentBox("MP"); break;
    case "motor": body = <><rect x="-9" y="-9" width="18" height="18" {...common} /><circle r="6" {...common} />{text("M", 2.7)}</>; break;
    case "bomba": body = <><rect x="-9" y="-7" width="18" height="14" {...common} /><line x1="0" y1="-7" x2="0" y2="7" {...common} /><line x1="-9" y1="0" x2="9" y2="0" {...common} /></>; break;

    case "caixa_passagem": body = <><rect x="-8" y="-8" width="16" height="16" {...common} />{text("P", 2.8)}</>; break;
    case "caixa_teto": body = <><circle r="8" {...common} />{text("P", 2.8)}</>; break;
    case "caixa_4x2": body = <><rect x="-9" y="-5" width="18" height="10" {...common} />{text("4×2", 2.2)}</>; break;
    case "caixa_4x4": body = <><rect x="-8" y="-8" width="16" height="16" {...common} />{text("4×4", 2.2)}</>; break;
    case "condulete": body = <><rect x="-7" y="-7" width="14" height="14" rx="2" {...common} /><line x1="7" y1="0" x2="11" y2="0" {...common} />{text("C", 2.4)}</>; break;
    default: body = <><rect x="-8" y="-8" width="16" height="16" {...common} />{text(CATALOG_BY_KIND[kind]?.short ?? "?")}</>;
  }

  return <g transform={`scale(${s})`}>{body}</g>;
}

export function SymbolPreview({ kind }: { kind: ComponentKind }) {
  return <svg width="32" height="32" viewBox="-16 -16 32 32" aria-hidden="true"><SymbolGlyph kind={kind} size={22} height={CATALOG_BY_KIND[kind]?.height} /></svg>;
}