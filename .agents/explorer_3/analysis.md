# Análise Detalhada — Requisito R6 & Infraestrutura de Build

**Agente**: `explorer_3`  
**Data**: 2026-07-29  
**Projeto**: Sistema Odontológico AI Studio (CRM, Orçamentos, Agenda) — React + TS + Supabase  

---

## 1. Mapeamento Completo dos Campos de Cadastro do Paciente & Locais de Armazenamento

### 1.1 Estritura de Dados do Paciente (`CRMPatient` / `PatientData`)
Definida em `src/types.ts` (linhas 61–110), a entidade do paciente engloba os seguintes campos de registro:

1. **Dados Demográficos & Identificação**:
   - `id`: `string` (UUID/GUID único imutável, ex: `pat-171...`)
   - `codigo_paciente`: `string` (Código interno/legado)
   - `name`: `string` (Nome completo)
   - `cpf`: `string` (Formato 000.000.000-00)
   - `rg`: `string` & `rgIssuer`: `string` (Órgão emissor/UF)
   - `birthDate`: `string` (Data de nascimento YYYY-MM-DD)
   - `gender`: `string` (Feminino / Masculino / Outro)
   - `status`: `string` (ATIVO / INATIVO)
   - `maritalStatus`: `string` (Estado civil)
   - `photoUrl`: `string` (Data URL ou URL de armazenamento da foto de perfil)
   - `medicalRecord`: `string` (Número do Prontuário)
   - `howKnewClinic`: `string` (Origem: Indicação, Redes Sociais, Google, etc.)
   - `phone`: `string` & `mobile`: `string` (Telefone fixo e celular/WhatsApp)
   - `email`: `string` (E-mail de contato)
   - `observations`: `string` (Observações cadastrais)

2. **Dados do Responsável Legal**:
   - `respName`, `respBirthDate`, `respPhone`, `respMobile`, `respMaritalStatus`, `respCpf`, `respRg`, `respRgIssuer`, `respProfession`

3. **Endereço**:
   - `cep`, `street`, `number`, `complement`, `neighborhood`, `city`, `state`

4. **Convênio**:
   - `healthInsurance`, `healthInsuranceCard`, `healthInsuranceValidity`

5. **Histórico Médico / Clínico & Fichas**:
   - `anamneseList` (`anamnese`): Histórico médico, alergias, doenças prévias
   - `clinicalHistory` (`clinical_history`): Evolução clínica e procedimentos realizados

6. **Sub-módulos Vinculados por `patientId`**:
   - `appointments` (consultas), `communications` (mensagens), `avisos` (alertas), `documentos` (atestados/laudos), `galeria` (fotos clínicas), `pagamentos` (recebimentos/financeiro), `tratamentos` (propostas de orçamento), `odontograma` (mapeamentos 2D/3D).

---

### 1.2 Locais de Carregamento e Salvamento de Dados

| Camada | Arquivo / Local | Chave / Tabela | Descrição da Operação |
|---|---|---|---|
| **Estado React** | `src/context/PatientContext.tsx` | `selectedPatient` | Estado centralizado do paciente selecionado no CRM |
| **LocalStorage (Seções)** | `src/context/PatientContext.tsx:244` | `agnaldo_dent_sections_${patientId}` | JSON das 4 seções (panorâmica, superior, inferior, sorriso) |
| **LocalStorage (Proposta)** | `src/context/PatientContext.tsx:253` | `agnaldo_dent_proposal_${patientId}` | JSON com desconto, parcelamento e observações do orçamento |
| **Database Supabase** | `src/lib/supabaseCrm.ts` | Tabela `clinic_data`, Coluna `crm_data` | JSON global contendo arrays `patients`, `tratamentos`, `galeria`, etc. |
| **Storage Supabase** | `src/lib/supabaseStorage.ts` | Bucket `patient_files` | Arquivos/fotos em `${userId}/${patientFolder}/${filename}` |

---

## 2. Limites de Mutação & Análise do Requisito R6 (Preservação de Dados do CRM)

### Requisito R6:
> Garantir que os dados cadastrais do paciente (nome, CPF, telefone, e-mail, histórico médico, etc.) NUNCA sejam deletados, sobrescritos ou alterados durante a criação de orçamentos, troca de abas ou upload de fotos.

### 2.1 Cenário 1: Criação e Edição de Orçamentos (`BudgetPanel3D.tsx`, `PatientContext.tsx`, `DentalCRMView.tsx`)
- **Fluxo Atual**:
  Ao salvar o contexto no Supabase (`saveContextToSupabase` em `PatientContext.tsx:260-331`), o código executa:
  ```typescript
  // Linhas 267-274 em PatientContext.tsx
  if (crmData.patients) {
    const pIndex = crmData.patients.findIndex((p: any) => p.id === pId);
    if (pIndex !== -1) {
      crmData.patients[pIndex] = { ...crmData.patients[pIndex], ...selectedPatient };
    } else {
      crmData.patients.push(selectedPatient);
    }
  }
  ```
- **Vulnerabilidades Identificadas**:
  1. **Risco de Sobrescrita Demográfica**: Durante a criação de um orçamento, se o objeto `selectedPatient` em memória estiver parcialmente instanciado ou com propriedades não carregadas, o `spread` `{ ...crmData.patients[pIndex], ...selectedPatient }` pode sobrescrever dados demográficos consolidados no Supabase por valores `undefined` ou vazios.
  2. **Violação de Isolamento**: Criar/editar um orçamento (`tratamentos` e `odontograma`) não exige mutação no array `crmData.patients`.
- **Recomendação de Segurança (Ponytail Full)**:
  Isolar a mutação de orçamentos. A gravação de um orçamento deve realizar apenas `append/upsert` no array `crmData.tratamentos` e `crmData.odontograma` indexado por `patientId`, sem tocar no array `crmData.patients`.

---

### 2.2 Cenário 2: Alternância de Abas (`DentalCRMView.tsx`, `PatientScreen.tsx`)
- **Fluxo Atual**:
  - As abas do prontuário (`info`, `appointments`, `anamnesis`, `clinical`, `financial`, `docs_gallery`, `plan_editor`, `plan_negotiation`) são alternadas alterando o estado local `activeDetailTab` em `DentalCRMView.tsx`.
  - A troca de abas não desmonta o `PatientContext`.
- **Vulnerabilidades Identificadas**:
  1. **Perda de Rascunhos Cadastrais**: Se o usuário editar um campo na aba `PatientRegistrationTab` (ex: alterar CPF) e alternar para a aba de Orçamentos sem clicar em "Salvar no Supabase", os dados demográficos permanecem apenas em memória. Se a página for recarregada ou se a função `refreshPatientSubModules` for disparada (ex: por mensagens do BroadcastChannel), as edições não salvas são descartadas.
- **Recomendação de Segurança (Ponytail Full)**:
  1. Manter sincronização reativa/draft no LocalStorage sob a chave `agnaldo_dent_draft_patient_${patientId}` ao editar campos cadastrais.
  2. Impedir que a troca de abas redefina ou recarregue `selectedPatient` a menos que o `patientId` tenha mudado explicitamente.

---

### 2.3 Cenário 3: Upload e Edição de Fotos (`PatientGallery.tsx`, `lib/supabaseStorage.ts`)
- **Fluxo Atual**:
  - O upload de fotos salva os arquivos no bucket `patient_files` no caminho `${userId}/${patientFolder}/${filename}`.
  - A inclusão da foto atualiza `crmData.galeria` via `onSyncDrive()`.
- **Vulnerabilidades Identificadas**:
  1. **Uso de Nome do Paciente no Caminho de Storage**: `getSafePatientPath(patientName)` em `src/lib/supabaseStorage.ts:8-10` utiliza o nome do paciente em vez do `patientId` imutável. Se o nome do paciente for alterado no cadastro, as fotos anteriores ficam desassociadas no Storage.
  2. **Re-gravação Involuntária de Pacientes**: A função `onSyncDrive()` re-salva todo o objeto `crmData`. Se essa função for chamada durante o upload de foto e `crmData.patients` for regravado com o estado de memória local, há risco residual de propagação de estado obsoleto.
- **Recomendação de Segurança (Ponytail Full)**:
  1. Alterar a estrutura de pastas do Storage para usar `patientId` (`${userId}/${patientId}/${filename}`).
  2. Garantir que uploads de foto executem operações estritamente `append` na lista `crmData.galeria`, sem reescrever o array `crmData.patients`.

---

## 3. Infraestrutura de Build e Estado do Repositório

### 3.1 Verificação dos Comandos em `package.json`

| Comando | Executável | Resultado | Observações |
|---|---|---|---|
| `npm run dev` | `tsx server.ts` | Não executado (somente leitura) | Servidor de desenvolvimento |
| `npm run build` | `vite build && esbuild server.ts ...` | **SUCESSO** | Vite gera bundle estático em `dist/` e esbuild gera `dist/server.cjs` |
| `npm run lint` | `tsc --noEmit` | **FALHA (Exit Code 1)** | Erro TS2322 em `src/components/DentalCRMView.tsx(318,29)` |
| `npm run test` | `playwright test` | Não executado | Testes E2E |

### 3.2 Detalhamento do Erro de Linter (`npm run lint`)
- **Arquivo**: `src/components/DentalCRMView.tsx`, linha 318, coluna 29
- **Código**:
  ```typescript
  318: updatedSections = [{ id: 'geral', title: 'Geral', subtitle: 'Procedimentos sem dente associado', image: null, markers: [] }];
  ```
- **Causa**: O tipo `PhotoSection.id` (definido em `src/types.ts:45`) é a união literal `'upper' | 'lower' | 'smile' | 'panoramic'`. A atribuição da string `'geral'` viola a tipagem do TypeScript.

### 3.3 Estado do Repositório (`git status` e `git log`)
- **Branch**: `main` (sincronizada com `origin/main`).
- **Modificações não commitadas**: Apenas arquivos de metadados em `.agents/*`.
- **Commits Recentes**:
  - `80e20c5`: `feat: adicionar seleção de fotos da galeria no envio em lote`
  - `9738fae`: `feat: adicionar procedimento avulso, edicao inline e persistencia de orcamento`
  - `e58c238`: `feat: add date picker to 'Hoje' button in dashboard agenda`
