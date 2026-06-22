-- Script de inicialização do Banco de Dados Relacional e Storage
-- Execute isso no SQL Editor do painel do Supabase

-- Habilitar extensão de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela global do CRM (Substitui o crm_database.json do Drive)
CREATE TABLE IF NOT EXISTS public.clinic_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users UNIQUE NOT NULL,
  crm_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Pacientes (Opcional para futura migração)
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Orçamentos (Opcional para futura migração)
CREATE TABLE IF NOT EXISTS public.proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'Aberto (paciente não pagou)',
  total NUMERIC DEFAULT 0,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Anamnese Pública
CREATE TABLE IF NOT EXISTS public.public_anamnesis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id TEXT NOT NULL,
  questions JSONB NOT NULL,
  signature TEXT,
  date TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Regras de Segurança (RLS - Row Level Security)
ALTER TABLE public.clinic_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_anamnesis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own clinic data" 
  ON public.clinic_data FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can insert anamnesis" 
  ON public.public_anamnesis FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can read and delete anamnesis" 
  ON public.public_anamnesis FOR ALL USING (auth.uid() IS NOT NULL);

-- O usuário só pode ver, editar ou deletar os próprios pacientes e orçamentos
CREATE POLICY "Users can manage their own patients" 
  ON public.patients FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own proposals" 
  ON public.proposals FOR ALL USING (auth.uid() = user_id);

-- Storage: Criar o Bucket para as imagens/PDFs (se ainda não existir)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('patient_files', 'patient_files', false)
ON CONFLICT (id) DO NOTHING;

-- Regras de Segurança para o Storage
CREATE POLICY "Users can manage their own files" 
  ON storage.objects FOR ALL 
  USING (bucket_id = 'patient_files' AND auth.uid()::text = (storage.foldername(name))[1]);
