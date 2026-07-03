# Habilidade e Práticas de Three.js / WebGL

Esta habilidade orienta o agente sobre como interagir com renderização 3D nativa e Three.js, focando no gerenciamento eficiente do Canvas e do ciclo de vida dos recursos gráficos no navegador.

---

## 1. Carregamento de Modelos 3D (.glb / .gltf)
- **GLTFLoader**: Utilize sempre o loader de GLTF/GLB com carregamento assíncrono.
- **Draco Compression**: Se o modelo 3D contiver muitos polígonos, utilize decodificadores Draco (`DRACOLoader`) para acelerar a descompressão e download do modelo pela rede.
- **Cache de Assets**: Mantenha os modelos em cache global no frontend para evitar recarregamento ao alternar telas ou pacotes de dados.

---

## 2. Manipulação de Malhas (Meshes) e Materiais
- **Nomenclatura Clara**: No modelo GLB/GLTF, certifique-se de que os dentes, raízes e canais estão nomeados individualmente para manipulação via código (ex: `Tooth_11`, `Root_11`, `Canal_11`).
- **Materiais Realistas**: Use `MeshStandardMaterial` ou `MeshPhysicalMaterial` com propriedades de rugosidade (`roughness`) e brilho (`metalness`) bem balanceadas para simular o esmalte dentário, resina e metais dos implantes.
- **Legenda de Cores**:
  - `Vermelho (#EF4444)`: Diagnósticos/Procedimentos pendentes (como fraturas, cáries).
  - `Azul (#3B82F6)`: Tratamentos concluídos (restaurações adequadas).
  - `Metálico / Cinza`: Implantes e metais.
  - `Cerâmica Premium / Dourado`: Facetas e coroas.

---

## 3. Raycasting e Detecção de Cliques
- Configure um `Raycaster` e um vetor bidimensional da posição do mouse (`Vector2`).
- Intercepte os cliques e hovers de forma precisa, identificando qual mesh individual foi atingido.
- Otimize o Raycast disparando-o apenas nos elementos interativos (dentes), ignorando elementos de fundo como a gengiva ou o maxilar.

---

## 4. Otimização de Performance e Liberação de Memória
- **Garbage Collection**: Elementos no Three.js não são automaticamente coletados pelo coletor de lixo do navegador. Sempre que um componente 3D for desmontado, limpe geometrias, texturas e materiais explicitamente:
  ```javascript
  geometry.dispose();
  material.dispose();
  texture.dispose();
  renderer.dispose();
  ```
- **Taxa de Quadros (FPS)**: Monitore a taxa de quadros e evite recalcular matrizes de transformação a cada ciclo de renderização se as mesmas não sofreram alterações (`matrixAutoUpdate = false` quando estático).
