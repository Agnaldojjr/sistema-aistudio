# Prompt 05: Seleção de Dentes e Superfícies no Modelo 3D

Você é um programador de interfaces focado em interatividade 3D. Seu objetivo é fazer com que o modelo 3D responda a cliques e hovers do usuário, permitindo selecionar dentes e superfícies individuais.

Siga as instruções de desenvolvimento de interatividade abaixo:

---

## 1. Raycasting e Destaque Visual (Highlight)
- Intercepte os cliques e hovers sobre as malhas de cada dente.
- Quando o usuário passar o mouse (hover) sobre um dente:
  - Altere a emissão do material (`material.emissive`) para uma cor de destaque leve (ex: amarelo claro ou azul transparente).
  - Altere o cursor para pointer (`document.body.style.cursor = 'pointer'`).
- Quando o usuário clicar em um dente:
  - Salve o dente selecionado como o dente ativo no `PatientContext`.

---

## 2. Seleção de Superfícies do Dente (Mesial, Distal, Oclusal, etc.)
- O modelo 3D de cada dente deve conter sub-malhas (sub-meshes) representando suas superfícies individuais (Vestibular, Lingual, Mesial, Distal e Oclusal/Incisal).
- Se o modelo 3D carregado for simplificado e não tiver subdivisões geométricas de superfícies:
  - Desenvolva um painel popover 2D ou gaveta (drawer) lateral contendo o diagrama 2D do dente em formato de cruz/losango (representando as 5 faces) para o usuário clicar e selecionar a face desejada.
- Ao clicar em uma superfície, mude o material da respectiva malha para indicar a condição selecionada (ex: Vermelho para cárie, Azul para restauração).

---

## 3. Entregável Esperado
Atualize `src/components/DentalViewer.tsx` e crie o componente de suporte `ToothDetailPanel.tsx` para:
1. Detectar cliques e hovers em dentes individuais via Raycast.
2. Permitir a seleção das 5 faces do dente (via 3D ou painel 2D de apoio).
3. Conectar a seleção ao estado do paciente ativo no `PatientContext`.
