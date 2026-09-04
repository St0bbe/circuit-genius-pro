import type { PlanDocument } from "@/lib/electrical";

export type ProjectVersion = {
  id: string;
  label: string;
  createdAt: string;
  note: string;
  document: PlanDocument;
};

export type VersionDiff = {
  from: string;
  to: string;
  added: Record<string, number>;
  removed: Record<string, number>;
  changed: string[];
};

type DocWithVersions = PlanDocument & { versions?: ProjectVersion[] };

export function getProjectVersions(doc: PlanDocument): ProjectVersion[] {
  return Array.isArray((doc as DocWithVersions).versions) ? (doc as DocWithVersions).versions! : [];
}

export function createProjectVersion(doc: PlanDocument, label?: string, note = ""): PlanDocument {
  const versions = getProjectVersions(doc);
  const id = `v-${Date.now().toString(36)}`;
  const nextLabel = label?.trim() || `v${versions.length + 1}.0`;
  const snapshot: ProjectVersion = { id, label: nextLabel, createdAt: new Date().toISOString(), note, document: stripVersions(doc) };
  return { ...doc, versions: [...versions, snapshot] } as PlanDocument;
}

export function restoreProjectVersion(doc: PlanDocument, versionId: string): PlanDocument {
  const version = getProjectVersions(doc).find((v) => v.id === versionId);
  if (!version) return doc;
  return { ...version.document, versions: getProjectVersions(doc) } as PlanDocument;
}

export function compareProjectVersions(doc: PlanDocument, fromId: string, toId: string): VersionDiff | null {
  const versions = getProjectVersions(doc);
  const from = versions.find((v) => v.id === fromId);
  const to = versions.find((v) => v.id === toId);
  if (!from || !to) return null;
  const groups: Array<keyof Pick<PlanDocument, "rooms" | "points" | "panels" | "conduits" | "architecture">> = ["rooms", "points", "panels", "conduits", "architecture"];
  const added: Record<string, number> = {};
  const removed: Record<string, number> = {};
  const changed: string[] = [];
  for (const group of groups) {
    const a = from.document[group] as Array<{ id: string }>;
    const b = to.document[group] as Array<{ id: string }>;
    const aIds = new Set(a.map((x) => x.id));
    const bIds = new Set(b.map((x) => x.id));
    added[group] = b.filter((x) => !aIds.has(x.id)).length;
    removed[group] = a.filter((x) => !bIds.has(x.id)).length;
    const common = a.filter((x) => bIds.has(x.id));
    const byB = new Map(b.map((x) => [x.id, x]));
    const modified = common.filter((x) => JSON.stringify(x) !== JSON.stringify(byB.get(x.id))).length;
    if (modified) changed.push(`${group}: ${modified} alterado(s)`);
  }
  return { from: from.label, to: to.label, added, removed, changed };
}

function stripVersions(doc: PlanDocument): PlanDocument {
  const clone = structuredClone(doc) as DocWithVersions;
  delete clone.versions;
  return clone;
}
