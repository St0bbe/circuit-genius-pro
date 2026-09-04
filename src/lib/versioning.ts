import type { PlanDocument } from "@/lib/electrical";

export type ProjectVersion = {
  id: string;
  label: string;
  createdAt: string;
  note: string;
  document: PlanDocument;
};

type DocWithVersions = PlanDocument & { versions?: ProjectVersion[] };

export function getProjectVersions(doc: PlanDocument): ProjectVersion[] {
  return Array.isArray((doc as DocWithVersions).versions) ? (doc as DocWithVersions).versions! : [];
}

export function createProjectVersion(doc: PlanDocument, label?: string, note = ""): PlanDocument {
  const versions = getProjectVersions(doc);
  const id = `v-${Date.now().toString(36)}`;
  const nextLabel = label?.trim() || `v${versions.length + 1}.0`;
  const snapshot: ProjectVersion = {
    id,
    label: nextLabel,
    createdAt: new Date().toISOString(),
    note,
    document: stripVersions(doc),
  };
  return { ...doc, versions: [...versions, snapshot] } as PlanDocument;
}

export function restoreProjectVersion(doc: PlanDocument, versionId: string): PlanDocument {
  const version = getProjectVersions(doc).find((v) => v.id === versionId);
  if (!version) return doc;
  return { ...version.document, versions: getProjectVersions(doc) } as PlanDocument;
}

function stripVersions(doc: PlanDocument): PlanDocument {
  const clone = structuredClone(doc) as DocWithVersions;
  delete clone.versions;
  return clone;
}
