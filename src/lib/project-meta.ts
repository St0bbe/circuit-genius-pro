import type { PlanDocument } from "@/lib/electrical";

export type ProfessionalMetadata = {
  designer: string;
  company: string;
  professionalCouncil: string;
  registration: string;
  client: string;
  siteAddress: string;
  revision: string;
  revisionDate: string;
  signatureName: string;
  signatureDate: string;
  signatureReference: string;
  responsibilityNote: string;
};

type DocWithMeta = PlanDocument & { professional?: ProfessionalMetadata };

export const DEFAULT_PROFESSIONAL_METADATA: ProfessionalMetadata = {
  designer: "",
  company: "",
  professionalCouncil: "CREA",
  registration: "",
  client: "",
  siteAddress: "",
  revision: "R00",
  revisionDate: "",
  signatureName: "",
  signatureDate: "",
  signatureReference: "",
  responsibilityNote: "Os cálculos e verificações do software são ferramentas de apoio. A validação final e a responsabilidade técnica são do profissional habilitado.",
};

export function getProfessionalMetadata(doc: PlanDocument): ProfessionalMetadata {
  return { ...DEFAULT_PROFESSIONAL_METADATA, ...((doc as DocWithMeta).professional ?? {}) };
}

export function setProfessionalMetadata(doc: PlanDocument, patch: Partial<ProfessionalMetadata>): PlanDocument {
  return { ...doc, professional: { ...getProfessionalMetadata(doc), ...patch } } as PlanDocument;
}
