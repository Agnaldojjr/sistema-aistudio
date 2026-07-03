# Prompt 02: Desenho Detalhado da Arquitetura do Módulo 3D

Você é o arquiteto de software encarregado de projetar a ponte entre o motor 3D (React Three Fiber) e o restante do sistema (React, Supabase, Tailwind). Seu objetivo é criar a estrutura de componentes e fluxo de dados.

Siga as instruções de modelagem de arquitetura abaixo:

---

## 1. Planejamento das Dependências 3D
- Identifique os pacotes necessários: `three`, `@types/three`, `@react-three/fiber` e `@react-three/drei`.
- Formule o comando de instalação exato, garantindo a compatibilidade de versões com o React 19 instalado no projeto.

---

## 2. Desenho do Fluxo de Dados e Estado
- Detalhe como o evento de clique no dente 3D (disparado na CPU pela biblioteca ThreeJS usando Raycasting) se traduz em alterações de estado dentro do `PatientContext`.
- Defina o ciclo de vida do dente no odontograma:
  - *Estado Inicial (Default)* -> *Seleção pelo Dentista* -> *Associação de Procedimento* -> *Atualização Visual da Cor da Superfície*.
- Modele a lógica de descarte (cleanup) de texturas e geometrias 3D para evitar vazamentos de memória na alternância de abas do CRM.

---

## 3. Entregável Esperado
Atualize ou crie o documento `docs/ARCHITECTURE_DETAIL.md` detalhando:
1. **Lista de Dependências e Comando de Instalação**: Pacotes e versões.
2. **Diagrama de Componentes 3D**: Relação entre o `Canvas`, `OrbitControls`, `DentalViewer`, `ToothMesh` e `SidebarPanel`.
3. **Contrato de API e Hooks**: Definição das funções que farão a atualização de estado (ex: `selectTooth(id)`, `updateSurfaceCondition(toothId, surface, condition)`).
