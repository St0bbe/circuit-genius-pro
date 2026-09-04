import { uid, type PlanDocument } from "@/lib/electrical";

type DocumentWithImport = PlanDocument & {
  importBase?: {
    kind: "image" | "pdf";
    name: string;
    dataUrl: string;
    opacity: number;
    scale: number;
  } | null;
};

export function getImportBase(doc: PlanDocument) {
  return (doc as DocumentWithImport).importBase ?? null;
}

export function setImportBase(doc: PlanDocument, base: DocumentWithImport["importBase"]): PlanDocument {
  return { ...doc, importBase: base } as PlanDocument;
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function pairwiseDxf(lines: string[]) {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([lines[i].trim(), lines[i + 1].trim()]);
  return pairs;
}

export function importDxfLines(doc: PlanDocument, text: string): { doc: PlanDocument; count: number } {
  const pairs = pairwiseDxf(text.replace(/\r/g, "").split("\n"));
  const architecture = [...doc.architecture];
  let count = 0;

  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i][0] !== "0" || pairs[i][1].toUpperCase() !== "LINE") continue;
    let x1: number | null = null, y1: number | null = null, x2: number | null = null, y2: number | null = null;
    for (let j = i + 1; j < pairs.length; j++) {
      const [code, value] = pairs[j];
      if (code === "0") break;
      if (code === "10") x1 = Number(value);
      if (code === "20") y1 = Number(value);
      if (code === "11") x2 = Number(value);
      if (code === "21") y2 = Number(value);
    }
    if ([x1, y1, x2, y2].every((v) => typeof v === "number" && Number.isFinite(v))) {
      architecture.push({ id: uid(), kind: "wall", x1: x1!, y1: -y1!, x2: x2!, y2: -y2!, thickness: 0.15 });
      count++;
    }
  }

  return { doc: { ...doc, architecture }, count };
}
