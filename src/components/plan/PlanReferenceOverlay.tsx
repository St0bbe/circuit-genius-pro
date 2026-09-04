import type { PlanDocument } from "@/lib/electrical";
import { getImportBase } from "@/lib/plan-import";

export function PlanReferenceOverlay({ doc }: { doc: PlanDocument }) {
  const base = getImportBase(doc);
  if (!base) return null;
  const transform = `translate(-50%, -50%) scale(${base.scale})`;
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {base.kind === "image" ? (
        <img
          src={base.dataUrl}
          alt={base.name}
          className="absolute left-1/2 top-1/2 max-h-[90%] max-w-[90%] object-contain"
          style={{ opacity: base.opacity, transform, transformOrigin: "center" }}
        />
      ) : (
        <iframe
          title={base.name}
          src={base.dataUrl}
          className="absolute left-1/2 top-1/2 h-[85%] w-[85%] border-0 bg-white"
          style={{ opacity: base.opacity, transform, transformOrigin: "center" }}
        />
      )}
    </div>
  );
}
