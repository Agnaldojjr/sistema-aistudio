# Plano de Implementação: Apresentação ao Paciente via Pop-up com Sincronização em Tempo Real (BroadcastChannel)

Este plano detalha a reestruturação do módulo **Treatment Planning 3D** para permitir que a tela de apresentação ao paciente seja aberta em uma nova aba/janela independente (pop-up nativo) com sincronização em tempo real dos estados visual, clínico, financeiro, de camadas do modelo 3D e de assinatura digital, mantendo a janela do dentista no modo de edição ativa.

---

## 🎯 Objetivo

Garantir uma experiência interativa fluida entre duas telas distintas (Dentista e Paciente) executando no mesmo navegador/origem:
1. A tela do **Dentista** permanece em modo de edição (podendo rotacionar o 3D, alterar visibilidade de camadas, ativar transparência e editar procedimentos).
2. A tela do **Paciente** (pop-up em tela cheia) acompanha passivamente todas as alterações em tempo real (incluindo câmera, simulações antes/depois, orçamento) e permite a assinatura do plano.
3. Ao assinar no pop-up, o aceite do plano e a assinatura digital são transmitidos de volta para a tela do dentista, que se encarrega de atualizar a proposta para aprovado e consolidar a persistência local e no Supabase.

---

## 📁 Arquivos Impactados

1. `src/App.tsx` (Roteamento de URL para a apresentação)
2. `src/context/PatientContext.tsx` (Sincronização dos dados do paciente e orçamento)
3. `src/TreatmentPlanning3D/context/Planning3DContext.tsx` (Sincronização do estado 3D, visualizações e controle de aceite)
4. `src/TreatmentPlanning3D/hooks/usePlanning3D.ts` (Exposição dos novos estados do plano)
5. `src/TreatmentPlanning3D/components/PresentationPanel3D.tsx` (Comunicação do aceite e fechamento da janela)
6. `src/TreatmentPlanning3D/index.tsx` (Abertura do pop-up)

---

## 🛠️ Detalhamento das Etapas e Tarefas

### 1. Roteamento de Tela Cheia no Ponto de Entrada (`src/App.tsx`)
- **Ação**: Interceptar o parâmetro `view` na URL (ex: `/?view=presentation`).
- **Implementação**:
  - Adicionar a leitura de `viewParam`: `const viewParam = new URLSearchParams(window.location.search).get('view');`
  - Se `viewParam === 'presentation'`, renderizar exclusivamente o `TreatmentPlanning3D` dentro do `PatientProvider` em tela cheia ocupando toda a viewport (`w-screen h-screen overflow-hidden bg-slate-950`), sem sidebar, cabeçalho ou rodapé padrão.
  - Carregar os procedimentos cadastrados no `localStorage` para consistência de valores e termos.
- **Critério de Aceitação**: Acessar `http://localhost:5173/?view=presentation` diretamente deve exibir a tela de planejamento em tela cheia na cor preta e sem menus do dentista.

### 2. Abertura do Pop-up Independente (`src/TreatmentPlanning3D/index.tsx`)
- **Ação**: Alterar a ação do botão "Apresentar ao Paciente".
- **Implementação**:
  - Substituir a chamada local `setPresentationMode(true)` por:
    ```typescript
    window.open('/?view=presentation', 'patient_presentation', 'width=1200,height=800,menubar=no,status=no,toolbar=no');
    ```
  - Isso garante que a janela do dentista não entra em modo de apresentação localmente (permanecendo com o menu de edição, drawer e abas ativas).
- **Critério de Aceitação**: Clicar em "Apresentar ao Paciente" deve abrir um pop-up nativo no endereço correto e a tela principal do dentista deve continuar em modo de edição.

### 3. Sincronização do Contexto do Paciente (`src/context/PatientContext.tsx`)
- **Ação**: Criar um canal de transmissão em tempo real para sincronizar o paciente selecionado, o orçamento e o odontograma 2D.
- **Implementação**:
  - Definir `const isPresentation = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'presentation';`
  - Instanciar o `BroadcastChannel`:
    ```typescript
    const channel = new BroadcastChannel('presentation_sync');
    ```
  - Implementar um `useEffect` para gerenciar a sincronização unidirecional do Dentista para o Paciente:
    - **Dentista (`!isPresentation`)**:
      - Envia o payload `{ selectedPatient, activeSections, activeProposal }` sempre que algum desses estados mudar.
      - Responde a requisições de estado inicial (`'REQUEST_INITIAL_STATE'`) enviando o estado atual de imediato.
    - **Paciente (`isPresentation`)**:
      - Escuta as mensagens `'PATIENT_CONTEXT_SYNC'` e aplica diretamente nos setters locais do Context (`setSelectedPatient`, `setActiveSections`, `setActiveProposal`).
      - No carregamento inicial, envia a mensagem `'REQUEST_INITIAL_STATE'` para garantir que puxa o paciente que já estava selecionado no momento da abertura do pop-up.
- **Critério de Aceitação**: Mudar de paciente ou alterar os procedimentos/valores na tela do dentista deve atualizar instantaneamente os dados e textos exibidos no painel do paciente.

### 4. Sincronização do Estado 3D e Aceite de Plano (`src/TreatmentPlanning3D/context/Planning3DContext.tsx`)
- **Ação**: Integrar status do plano, assinatura digital e estados da viewport 3D no fluxo do canal de comunicação.
- **Implementação**:
  - Adicionar as variáveis reativas `planStatus` (`'DRAFT' | 'ACCEPTED'`) e `signatureData` (`string | null`) ao estado interno e expô-las no contexto.
  - No `useState` do `viewerState`, inicializar `presentationMode: isPresentation` para que o pop-up carregue diretamente com as restrições e controles de apresentação.
  - Instanciar um canal específico `'planning_3d_sync'` para a modelagem:
    - **Paciente (`isPresentation`)**:
      - Escuta o estado da viewport do dentista, sincronizando câmera, transparência, simulação e camadas (`setViewerState`), mantendo `presentationMode: true` fixo.
      - Recebe e atualiza o `planStatus` e a assinatura.
      - Solicita o estado 3D atual no início (`'REQUEST_3D_INITIAL_STATE'`).
    - **Dentista (`!isPresentation`)**:
      - Envia as atualizações do `viewerState`, `planStatus` e `signatureData` sempre que mudarem.
      - Escuta requisições de estado inicial.
      - **CRÍTICO - Escuta o evento `'accept_plan'` enviado pelo paciente**:
        - Chama a função `acceptPlan(signatureData)`.
        - Atualiza a proposta em `PatientContext` (`activeProposal`) definindo a propriedade `status` como `'Aprovado (paciente pagou)'`.
        - Aciona um estado temporário `pendingSave` para realizar de forma segura e sincronizada a chamada para `saveContextToSupabase()` na renderização subsequente, salvando o odontograma, o status da proposta e a assinatura digital no Supabase e `localStorage`.
- **Critério de Aceitação**: Rotacionar a arcada 3D, ligar a transparência, ou mudar o modo para "Resultado Esperado" na tela do dentista deve movimentar e alterar em sincronia perfeita o modelo 3D exibido na tela do paciente.

### 5. Atualização dos Ganchos e Exposição dos Estados (`src/TreatmentPlanning3D/hooks/usePlanning3D.ts`)
- Expor `planStatus`, `signatureData`, `setPlanStatus`, `setSignatureData` no retorno do hook para que sejam acessados pelos painéis.
- Ajustar a assinatura de `acceptPlan` para receber opcionalmente a string base64 da assinatura: `acceptPlan: (signature?: string) => void`.

### 6. Fluxo de Assinatura e Fechamento na Tela do Paciente (`src/TreatmentPlanning3D/components/PresentationPanel3D.tsx`)
- **Ação**: Adaptar a interface para ler o estado de sincronização e comunicar a assinatura de volta à tela do dentista.
- **Implementação**:
  - Obter `planStatus` e `signatureData` de `usePlanning3D()` de forma reativa, removendo o `useState` local duplicado de assinatura.
  - Derivar `isAccepted = planStatus === 'ACCEPTED'`.
  - No `handleSaveSignature(base64)`:
    - Instanciar o `BroadcastChannel('planning_3d_sync')` e enviar a mensagem:
      ```typescript
      channel.postMessage({ type: 'accept_plan', payload: { signatureData: base64 } });
      ```
    - Chamar `acceptPlan(base64)` localmente para resposta visual instantânea.
  - No botão "Sair da Apresentação", substituir a chamada antiga por `window.close()`.
- **Critério de Aceitação**: 
  - Assinar o plano no painel do paciente deve atualizar a tela de ambos os lados exibindo o selo de "Tratamento Aprovado" e a imagem da assinatura.
  - Verificar no console do dentista o log de salvamento com sucesso no Supabase.
  - Clicar em "Sair da Apresentação" deve fechar o pop-up do paciente.

---

## ⚠️ Tratamento de Casos de Borda e Segurança

1. **Garantia de Não-Interferência Mútua (Loop de Mensagens)**: As transmissões de dados são feitas em formato unidirecional (Dentista -> Paciente). O Paciente apenas envia a mensagem de `'accept_plan'`. Isso previne loops infinitos de re-renderização cruzada de estados.
2. **Fechamento do Canal**: Sempre fechar as instâncias do `BroadcastChannel` no retorno de limpeza do `useEffect` para evitar vazamentos de memória (Memory Leaks).
3. **Consistência de Dados**: O salvamento físico no Supabase/Drive ocorre apenas na janela principal do Dentista. Caso a aba do paciente perca a conexão ou seja fechada acidentalmente no meio do processo, nenhum dado corrompido é gravado no banco.

---

## 🧪 Estratégia de Teste Manual

1. Abrir a aplicação em `http://localhost:5173`.
2. Fazer login e selecionar um paciente de teste (ex: "Valdermon da Silva Lopes").
3. Navegar até a aba **Arcada 3D**.
4. Clicar no botão **Apresentar ao Paciente**. Confirmar a abertura do pop-up.
5. Lado a lado (Dentista e Paciente), realizar os seguintes testes:
   - Rotacionar o dente/arcada na tela do dentista -> Verificar sincronia na tela do paciente.
   - Alternar para "Resultado Esperado" -> Verificar alteração da cor/estética do dente na tela do paciente.
   - Adicionar um procedimento extra -> Verificar atualização do painel de orçamento no pop-up do paciente.
   - Clicar em "Aprovar Tratamento" na tela do paciente, desenhar uma assinatura e salvar -> Verificar se a tela do paciente exibe a confirmação e a assinatura, se a tela do dentista atualiza para aprovado exibindo a assinatura, e se os logs mostram a sincronização no Supabase.
   - Clicar em "Sair da Apresentação" na tela do paciente -> Verificar se o pop-up fecha normalmente.
