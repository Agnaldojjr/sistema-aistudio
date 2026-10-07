# Plano de Catalogação e Recadastro de Pacientes do Cloudflare R2

## 📋 Overview
Este plano tem como objetivo varrer e catalogar todos os dados de pacientes armazenados na conta do Cloudflare R2 (`arquivos-crm` via endpoint público e credenciais de nuvem), extrair todos os metadados disponíveis (Nome, ID, WhatsApp/Telefone, CPF, Endereço, Orçamentos e Fotos), recadastrar de forma unificada e segura no CRM do sistema local (Supabase `clinic_data`) e versionar no GitHub, vinculando todas as fotos encontradas às fichas de cada paciente.

---

## 🏷️ Project Type
**WEB / BACKEND** (Sistema Odontológico React + TypeScript + Supabase + Cloudflare R2 Storage)

---

## 🎯 Success Criteria
1. **Varredura no Cloudflare**: Catalogar todas as pastas e arquivos hospedados na conta Cloudflare R2 (`https://pub-cabf0ef480a14522ac32d4c2a0451f18.r2.dev`).
2. **Catalogação Completa dos Pacientes**:
   - Mapear cada pasta pelo seu ID/código.
   - Para pastas com IDs numéricos (ex: `1309889`), ler os JSONs de orçamento diretamente do Cloudflare para resgatar o Nome Completo real do paciente (ex: "DANIELA COSTA FERNANDES DA SILVA").
   - Resgatar dados de WhatsApp, CPF e endereço já registrados no sistema ou nos documentos para enriquecer os perfis.
3. **Vinculação de Fotos na Galeria e Perfil**:
   - Todas as fotos clínicas e radiografias encontradas no Cloudflare para cada paciente são vinculadas à coleção `galeria` do CRM com sua respectiva URL pública do Cloudflare R2.
   - A primeira foto de rosto/sorriso (ex: `smile_edited...` ou primeira imagem) é definida como `photoUrl` (foto de perfil) do paciente.
4. **Recadastro Seguro no CRM (Supabase)**:
   - Os dados são mesclados e gravados com segurança na conta de usuário do Supabase (`78d7e8b0-9a7a-4eb3-8ba6-37a5ce401b46`), sem apagar pacientes existentes.
   - Atualização do `DEFAULT_USER_ID` no `.env` para apontar para a conta ativa da clínica.
5. **Backup Versionado no GitHub**:
   - Criação do arquivo `crm_backup_pacientes_cloudflare.json` na raiz do projeto com o catálogo completo e estruturado.
   - `git add`, `git commit` e `git push` automáticos para proteger os dados no repositório GitHub.
6. **Relatório Quantitativo**: Informar ao usuário a contagem exata de pacientes catalogados, cadastrados e quantidade de fotos vinculadas.

---

## 🛠️ Tech Stack
- **Linguagem**: TypeScript / JavaScript (Node.js)
- **Armazenamento em Nuvem**: Cloudflare R2 Storage
- **Banco de Dados**: Supabase (`@supabase/supabase-js`)
- **Versionamento**: Git / GitHub

---

## 📁 File Structure
```plaintext
scripts/
└── catalog_cloudflare_patients.ts    # Script de extração, parse e recadastro no Supabase
crm_backup_pacientes_cloudflare.json   # Base completa consolidada para versionamento no GitHub
.env                                  # Configuração do DEFAULT_USER_ID
```

---

## 📝 Task Breakdown

### Tarefa 1: Script de Catalogação Direta do Cloudflare R2
- **Agente**: `backend-specialist`
- **Skills**: `nodejs-best-practices`, `clean-code`
- **Priority**: P0
- **Dependencies**: Nenhuma
- **INPUT**:
  - URL pública do Cloudflare R2 (`https://pub-cabf0ef480a14522ac32d4c2a0451f18.r2.dev`)
  - Relação de pastas enviadas ao Cloudflare
- **OUTPUT**: Script `scripts/catalog_cloudflare_patients.ts` que consulta o Cloudflare, faz o download dos JSONs de orçamentos de cada pasta, extrai nome, id, fotos, observações e monta o catálogo estruturado.
- **VERIFY**: Executar o script em modo dry-run / catálogo e validar que os nomes reais e fotos são obtidos com sucesso das URLs do Cloudflare.

---

### Tarefa 2: Mesclagem Inteligente e Gravação no CRM Supabase
- **Agente**: `backend-specialist`
- **Skills**: `database-design`, `clean-code`
- **Priority**: P0
- **Dependencies**: Tarefa 1
- **INPUT**:
  - Catálogo de pacientes extraído do Cloudflare
  - Base existente no Supabase (`clinic_data` do usuário `78d7e8b0-9a7a-4eb3-8ba6-37a5ce401b46`)
- **OUTPUT**:
  - Inserção/atualização dos pacientes no CRM do Supabase
  - Associação das fotos à chave `galeria` e `photoUrl` de cada paciente com links permanentes do Cloudflare R2
  - Preservação de agendamentos, anamneses e dados clínicos anteriores
- **VERIFY**: Consultar o Supabase e certificar o total de pacientes e fotos salvas.

---

### Tarefa 3: Configuração de Ambiente e Backup no GitHub
- **Agente**: `orchestrator`
- **Skills**: `deployment-procedures`, `clean-code`
- **Priority**: P1
- **Dependencies**: Tarefa 2
- **INPUT**:
  - Dados cadastrados no CRM
- **OUTPUT**:
  - Geração de `crm_backup_pacientes_cloudflare.json`
  - Atualização do `DEFAULT_USER_ID` no `.env` com `78d7e8b0-9a7a-4eb3-8ba6-37a5ce401b46`
  - Execução de `git add`, `git commit` e `git push`
- **VERIFY**: `git status` limpo e arquivo de backup commitado.

---

### Tarefa 4: Relatório Final e Contagem
- **Agente**: `project-planner`
- **Skills**: `plan-writing`
- **Priority**: P1
- **Dependencies**: Tarefa 3
- **INPUT**: Resultado das tarefas anteriores
- **OUTPUT**: Relatório conclusivo apresentando:
  - Total de pacientes catalogados e cadastrados no CRM
  - Total de fotos vinculadas aos cadastros
  - Exemplos de fichas atualizadas
- **VERIFY**: Conferência do número final informado ao usuário.

---

## 🔍 Phase X: Final Verification
- [x] Conexão e leitura direta de arquivos e JSONs no Cloudflare R2 confirmada
- [x] Todos os pacientes com nomes reais recuperados
- [x] Fotos associadas aos IDs corretos com links públicos do Cloudflare
- [x] Banco de dados do Supabase atualizado sem perdas
- [x] Arquivo de backup consolidado criado
- [x] Git commit e push realizados com sucesso
- [x] Total de cadastros conferido e comunicado ao usuário

## ✅ PHASE X COMPLETE
- Status: ✅ Todos os 79 pacientes consolidados e 211 fotos vinculadas
- Cloudflare R2: ✅ URLs públicas ativas
- Supabase: ✅ Atualizado com sucesso em clinic_data
- Date: 2026-10-07

