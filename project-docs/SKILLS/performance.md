# Diretrizes de Performance e Otimização de Recursos

Para garantir que o prontuário odontológico e o visualizador 3D funcionem perfeitamente em computadores clínicos e tablets de entrada, siga as práticas recomendadas abaixo.

---

## 1. Otimização de Renderização no React
- **Evite Re-renderizações em Cadeia**: Utilize o hook `useMemo` para computar cálculos complexos de orçamentos e parcelamentos e `useCallback` para passar funções a componentes filhos puros (memorizados com `React.memo`).
- **Estados Compartilhados Locais**: Não suba para o Contexto global estados de formulários dinâmicos. Mantenha-os no componente do formulário e submeta os dados consolidados apenas ao finalizar.
- **Virtualização**: Ao listar grandes volumes de pacientes ou histórico de consultas, implemente técnicas de virtualização de listas (como `react-window` ou renderização sob demanda) para não sobrecarregar a DOM.

---

## 2. Otimização do Canvas 3D e WebGL
- **Redução do Número de Draw Calls**: Agrupe elementos que compartilham o mesmo material.
- **Geometrias Compartilhadas**: Se houver múltiplos implantes ou dentes idênticos, reutilize a mesma geometria básica em vez de instanciar novas instâncias completas.
- **Configuração de Sombras**: Evite sombras em tempo real muito detalhadas se o desempenho cair. Utilize sombras estáticas (baked shadows) ou desative-as completamente em dispositivos móveis.
- **Texture Compression**: Mantenha as texturas de dentes e gengiva em resoluções adequadas (máximo 1024x1024) e comprimidas no formato `.ktx2` ou `.basis`.

---

## 3. Gestão de Memória e Garbage Collection
- **Three.js Disposal**: Ao remover o visualizador 3D da tela (ex: trocar de aba de atendimento para a aba financeira), libere manualmente a memória do WebGL para evitar travamentos do navegador:
  ```typescript
  renderer.dispose();
  scene.clear();
  ```
- **Image Cache**: Em galerias de fotos de antes e depois dos pacientes, aplique Lazy Loading (`loading="lazy"`) e armazene miniaturas comprimidas no Firebase Storage em vez de carregar as imagens brutas em alta resolução diretamente na tela de listagem.
