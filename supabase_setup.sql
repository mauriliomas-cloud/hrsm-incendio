-- ============================================================
-- HRSM — Combate a Incêndio
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- TABELA: perfis de usuário (vinculada ao auth.users do Supabase)
CREATE TABLE IF NOT EXISTS public.perfis (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome      TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: extintores
CREATE TABLE IF NOT EXISTS public.extintores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  num           TEXT NOT NULL,
  cls           TEXT NOT NULL CHECK (cls IN ('AP','BC','ABC','CO₂')),
  cap           TEXT,
  mk            TEXT,
  loc           TEXT NOT NULL,
  descricao     TEXT,
  validade      TEXT,   -- YYYY-MM
  troca         TEXT,   -- YYYY-MM
  hdt           TEXT,   -- ano ex: '2024'
  hnum          TEXT,
  obs           TEXT,
  em_manut      BOOLEAN DEFAULT FALSE,
  manut_saida   TEXT,   -- YYYY-MM
  manut_motivo  TEXT,
  manut_hist    JSONB   DEFAULT '[]',
  upd_by        TEXT,
  upd_at        TIMESTAMPTZ DEFAULT NOW(),
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: hidrantes
CREATE TABLE IF NOT EXISTS public.hidrantes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  num        TEXT NOT NULL,
  tp         TEXT NOT NULL,
  mk         TEXT,
  dm         TEXT,
  loc        TEXT NOT NULL,
  descricao  TEXT,
  ui         TEXT,   -- YYYY-MM última inspeção
  pi         TEXT,   -- YYYY-MM próxima inspeção
  pt         TEXT,   -- YYYY-MM teste pressão
  pv         TEXT,   -- valor pressão bar
  obs        TEXT,
  upd_by     TEXT,
  upd_at     TIMESTAMPTZ DEFAULT NOW(),
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────

ALTER TABLE public.perfis    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extintores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hidrantes  ENABLE ROW LEVEL SECURITY;

-- Perfis: cada usuário lê/atualiza só o próprio
CREATE POLICY "Leitura próprio perfil"    ON public.perfis FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Atualização próprio perfil" ON public.perfis FOR UPDATE USING (auth.uid() = id);

-- Perfis: admin pode ver todos
CREATE POLICY "Admin vê todos os perfis"  ON public.perfis FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Extintores: qualquer usuário autenticado lê
CREATE POLICY "Leitura extintores"   ON public.extintores FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "Inserir extintores"   ON public.extintores FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Atualizar extintores" ON public.extintores FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "Deletar extintores"   ON public.extintores FOR DELETE  USING (auth.role() = 'authenticated');

-- Hidrantes: qualquer usuário autenticado lê
CREATE POLICY "Leitura hidrantes"    ON public.hidrantes FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "Inserir hidrantes"    ON public.hidrantes FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Atualizar hidrantes"  ON public.hidrantes FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "Deletar hidrantes"    ON public.hidrantes FOR DELETE  USING (auth.role() = 'authenticated');

-- ── TRIGGER: cria perfil automaticamente ao registrar usuário ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfis (id, nome, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── DADOS INICIAIS: crie o admin pelo Authentication do Supabase ──
-- Após criar o usuário admin pelo painel, execute:
-- UPDATE public.perfis SET role = 'admin', nome = 'Administrador' WHERE id = 'UUID_DO_SEU_ADMIN';
