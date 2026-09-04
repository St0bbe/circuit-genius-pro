-- Voltplan normalized domain model. The projects.document JSONB remains supported
-- during the gradual migration of the editor to relational persistence.

CREATE OR REPLACE FUNCTION public.owns_project(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = p_project_id AND p.user_id = auth.uid());
$$;

CREATE TABLE IF NOT EXISTS public.project_settings (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  jurisdiction TEXT NOT NULL DEFAULT 'Brasil',
  rules_profile TEXT NOT NULL DEFAULT 'BR',
  frequency_hz NUMERIC NOT NULL DEFAULT 60,
  voltage_drop_limit_pct NUMERIC NOT NULL DEFAULT 4,
  reserve_modules_pct NUMERIC NOT NULL DEFAULT 20,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.circuits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT,
  description TEXT,
  circuit_type TEXT NOT NULL DEFAULT 'mixed',
  voltage INTEGER NOT NULL DEFAULT 127,
  phase TEXT NOT NULL DEFAULT 'auto',
  demand_factor NUMERIC NOT NULL DEFAULT 1,
  panel_code TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  engineering JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(project_id, code)
);

CREATE TABLE IF NOT EXISTS public.electrical_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  circuit_id UUID REFERENCES public.circuits(id) ON DELETE SET NULL,
  point_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  x NUMERIC NOT NULL,
  y NUMERIC NOT NULL,
  height_m NUMERIC,
  power_va NUMERIC NOT NULL DEFAULT 0,
  voltage INTEGER,
  rotation NUMERIC NOT NULL DEFAULT 0,
  mirrored BOOLEAN NOT NULL DEFAULT FALSE,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(project_id, point_key)
);

CREATE TABLE IF NOT EXISTS public.panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  panel_key TEXT NOT NULL,
  name TEXT NOT NULL,
  x NUMERIC NOT NULL,
  y NUMERIC NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(project_id, panel_key)
);

CREATE TABLE IF NOT EXISTS public.conduits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  conduit_key TEXT NOT NULL,
  from_key TEXT NOT NULL,
  to_key TEXT NOT NULL,
  diameter_mm NUMERIC NOT NULL,
  length_m NUMERIC,
  fill_pct NUMERIC,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(project_id, conduit_key)
);

CREATE TABLE IF NOT EXISTS public.wire_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  circuit_id UUID REFERENCES public.circuits(id) ON DELETE CASCADE,
  conduit_id UUID REFERENCES public.conduits(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  marker TEXT,
  section_mm2 NUMERIC NOT NULL,
  length_m NUMERIC NOT NULL DEFAULT 0,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.protections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  circuit_id UUID REFERENCES public.circuits(id) ON DELETE CASCADE,
  protection_type TEXT NOT NULL,
  nominal_current_a NUMERIC,
  sensitivity_ma NUMERIC,
  poles INTEGER,
  voltage INTEGER,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(owner_id, name, unit)
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.material_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  minimum_quantity NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, material_id)
);

CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Orçamento',
  labor_total NUMERIC NOT NULL DEFAULT 0,
  design_total NUMERIC NOT NULL DEFAULT 0,
  material_total NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  note TEXT,
  document JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_members (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS circuits_project_idx ON public.circuits(project_id);
CREATE INDEX IF NOT EXISTS electrical_points_project_idx ON public.electrical_points(project_id);
CREATE INDEX IF NOT EXISTS panels_project_idx ON public.panels(project_id);
CREATE INDEX IF NOT EXISTS conduits_project_idx ON public.conduits(project_id);
CREATE INDEX IF NOT EXISTS wire_segments_project_idx ON public.wire_segments(project_id);
CREATE INDEX IF NOT EXISTS protections_project_idx ON public.protections(project_id);
CREATE INDEX IF NOT EXISTS project_versions_project_idx ON public.project_versions(project_id);

ALTER TABLE public.project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electrical_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conduits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wire_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_settings_own ON public.project_settings FOR ALL TO authenticated USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE POLICY circuits_own ON public.circuits FOR ALL TO authenticated USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE POLICY electrical_points_own ON public.electrical_points FOR ALL TO authenticated USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE POLICY panels_own ON public.panels FOR ALL TO authenticated USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE POLICY conduits_own ON public.conduits FOR ALL TO authenticated USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE POLICY wire_segments_own ON public.wire_segments FOR ALL TO authenticated USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE POLICY protections_own ON public.protections FOR ALL TO authenticated USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE POLICY materials_own ON public.materials FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY suppliers_own ON public.suppliers FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY material_prices_own ON public.material_prices FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY inventory_own ON public.inventory FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY budgets_own ON public.budgets FOR ALL TO authenticated USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE POLICY budget_items_own ON public.budget_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND public.owns_project(b.project_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND public.owns_project(b.project_id)));
CREATE POLICY project_versions_own ON public.project_versions FOR ALL TO authenticated USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE POLICY project_members_owner_manage ON public.project_members FOR ALL TO authenticated USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_settings, public.circuits, public.electrical_points, public.panels, public.conduits, public.wire_segments, public.protections, public.materials, public.suppliers, public.material_prices, public.inventory, public.budgets, public.budget_items, public.project_versions, public.project_members TO authenticated;
GRANT ALL ON public.project_settings, public.circuits, public.electrical_points, public.panels, public.conduits, public.wire_segments, public.protections, public.materials, public.suppliers, public.material_prices, public.inventory, public.budgets, public.budget_items, public.project_versions, public.project_members TO service_role;
