# Cronograma e Roadmap de Desenvolvimento (ROADMAP)

Este documento detalha o planejamento das sprints para a implementação do módulo **TreatmentPlanning3D**, baseado em entregas incrementais.

---

## Divisão de Sprints

### Sprint 1: Modelo 3D (Fundação)
- **Foco**: Renderizar a arcada dentária básica em 3D de forma fluida.
- **Entregáveis**:
  - Configuração do Canvas React Three Fiber (R3F) isolado.
  - Carregamento do arquivo `.glb` representando a arcada dentária com gengiva e dentes.
  - Configurações básicas de luzes e câmera orbital.

### Sprint 2: Seleção de Dentes e Interatividade
- **Foco**: Detecção de cliques e feedback visual de interação.
- **Entregáveis**:
  - Implementação de Raycasting para cliques nos dentes individuais.
  - Efeitos de Hover para destacar o dente sob o cursor.
  - Alteração de materiais/cores das malhas de acordo com a seleção ativa.

### Sprint 3: Painel Lateral (Drawer)
- **Foco**: Interface de controle clínico integrada ao visualizador.
- **Entregáveis**:
  - Componente lateral (Drawer/Sidebar) acionado pela seleção de um dente.
  - Interface para preencher a condição clínica (fratura, canal, faceta, implante) e notas.
  - Conexão com o `TreatmentPlanning3DContext` próprio.

### Sprint 4: Motor de Orçamentos (Budget Engine)
- **Foco**: Precificação automática de procedimentos clínicos associados aos dentes.
- **Entregáveis**:
  - Integração da tabela de procedimentos e valores.
  - Cálculo automático de subtotais e regras de desconto.
  - Salvamento dos orçamentos no banco de dados.

### Sprint 5: Modo Consulta (Apresentação)
- **Foco**: Apresentação visual limpa para o paciente na sala de consulta.
- **Entregáveis**:
  - Modo tela cheia sem menus administrativos ("Presentation Mode").
  - Comparativo visual "Antes vs. Depois".
  - Campo de assinatura digital para aceite do tratamento.

### Sprint 6: Integração de IA (Inteligência Artificial)
- **Foco**: Assistente inteligente para sugestão de tratamentos e análise de dados.
- **Entregáveis**:
  - Sugestões inteligentes de procedimentos com base no histórico e diagnósticos selecionados.
  - Autopreenchimento de orçamentos e otimizações geradas por modelos de linguagem (Gemini).
