# Controle de Tarefas - TreatmentPlanning3D (TASKS)

Este documento gerencia o andamento das tarefas individuais de desenvolvimento para a implementação do módulo 3D, divididas por marcos operacionais.

---

## checklist de Tarefas

### Sprint 1: Modelo 3D (Fundação)
- `[ ]` **Task 001: Criar componente DentalViewer**
  - Configurar a estrutura básica do Canvas R3F isolada.
  - Implementar iluminação tridimensional básica no espaço de renderização.
- `[ ]` **Task 002: Carregar modelo GLB**
  - Implementar o carregamento assíncrono do arquivo `.glb` que representa a arcada dentária.
  - Configurar um fallback visual de loading utilizando React `Suspense`.
- `[ ]` **Task 003: Adicionar OrbitControls**
  - Habilitar controles de rotação, aproximação (zoom) e pan usando `@react-three/drei`.
  - Definir restrições de ângulos de câmera para evitar desorientação do usuário.

### Sprint 2: Seleção e Interação
- `[ ]` **Task 004: Selecionar Mesh**
  - Implementar detecção de clique (Raycasting) nos dentes (Meshes) individuais da arcada.
  - Conectar o clique ao estado do dente selecionado.
- `[ ]` **Task 005: Destacar dente**
  - Implementar detecção de passar o mouse (hover) para realce visual imediato do dente sob o cursor.
  - Modificar o material da malha selecionada para indicar visualmente as condições clínicas ativas (ex: restaurado, com cárie, etc.).
