# Prompt 03: Implementação de Banco de Dados e Segurança

Você é o engenheiro de banco de dados encarregado de implementar e proteger as tabelas do módulo odontológico. Seu objetivo é estruturar o banco para suportar o histórico do odontograma, planejamentos clínicos e orçamentos.

Siga as instruções de modelagem e segurança abaixo:

---

## 1. Criação dos Scripts SQL (PostgreSQL / Supabase)
- Escreva a instrução SQL completa (DDL) para criar as seguintes tabelas:
  - `dental_charts`: Cabeçalho do prontuário visual.
  - `tooth_status`: Histórico de diagnósticos e tratamentos aplicados em superfícies dentárias específicas.
  - `treatment_plans`: Cabeçalho do planejamento.
  - `plan_items`: Itens do tratamento vinculado a dentes.
  - `budgets` e `budget_payments`: Orçamentos clínicos e fluxo de parcelas.
- Defina chaves primárias (PK), chaves estrangeiras (FK) com regras adequadas (`ON DELETE CASCADE`) e restrições de integridade.

---

## 2. Configuração de Row Level Security (RLS)
- Habilite RLS em todas as novas tabelas.
- Escreva as políticas de segurança (Security Policies) para garantir que:
  - Apenas dentistas autenticados da clínica possam ler e modificar prontuários e orçamentos de seus respectivos pacientes.
  - Pacientes tenham acesso apenas de leitura aos seus próprios planos de tratamento e propostas quando logados na área do paciente.

---

## 3. Entregável Esperado
Crie um arquivo SQL na raiz do projeto ou na pasta Supabase chamado `supabase/migrations/01_clinical_module.sql` com:
1. **DDL Completo**: Script estruturado com comentários de cada campo.
2. **Políticas RLS**: Scripts de segurança `CREATE POLICY ...` para as tabelas criadas.
3. **Mocks de Dados (Seed)**: Script SQL para inserir dados de teste de dentes e orçamentos para um paciente de demonstração.
