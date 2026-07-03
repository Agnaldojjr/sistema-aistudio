# Diretrizes de Interface e Experiência do Usuário (UI/UX Guidelines)

Este documento define as regras visuais, paletas de cores, tipografia, estados de componentes e boas práticas de UX para manter a consistência estética e de uso em todo o **Sistema AI Studio - Módulo Odontológico**.

---

## 1. Princípios de Design (Design Principles)
- **Visual Premium e Clean**: Uso de paletas balanceadas e minimalistas, evitando sobrecarga visual. O foco deve estar nos dados clínicos e nos modelos 3D dos pacientes.
- **Micro-interações Fluídas**: Efeitos de hover e transições suaves nos botões, cards e interações do 3D para criar um produto dinâmico e de alta qualidade.
- **Acessibilidade e Legibilidade**: Fontes limpas de alta legibilidade, contraste em conformidade com as diretrizes WCAG e facilidade de clique em telas touch de tablets clínicos.
- **Clareza de Estado Clínico**: Cores de diagnóstico claramente distinguíveis no odontograma para evitar erros médicos.

---

## 2. Paleta de Cores e Tokens Visuais

### Cores de Marca & UI Principal
- **Cor Primária (Burgundy)**: `#8B0000` (Vermelho Bordô) - Usado em logos, botões de ação principal, e destaques de cabeçalhos.
- **Secundária / Acerto**: `#10B981` (Verde Esmeralda) - Aprovações de orçamentos, procedimentos concluídos.
- **Fundo Principal (Light Mode)**: `#FAF8F5` (Off-white / Creme Suave) - Fundo de tela relaxante e limpo.
- **Fundo de Cartões / Tabs**: `#FFFFFF` - Branco puro para destacar painéis de dados.
- **Texto Principal**: `#1F2937` (Grafite escuro) - Excelente contraste sem a agressividade do preto puro.
- **Texto Secundário**: `#6B7280` (Cinza médio) - Legendas, datas e observações.

### Cores de Legenda do Odontograma (Padrão Clínico)
- **Vermelho (Cárie/Pendente)**: `#EF4444` - Indica patologia ativa ou procedimento planejado pendente.
- **Azul (Restaurado/Concluído)**: `#3B82F6` - Indica dente/superfície já tratado.
- **Cinza Escuro (Dente Ausente)**: `#6B7280` - Extraído ou não erupcionado.
- **Verde (Em Execução)**: `#10B981` - Procedimento sendo realizado na consulta de hoje.
- **Dourado/Amarelo (Prótese/Tratamento Especial)**: `#F59E0B` - Coroas, facetas e blocos cerâmicos.

---

## 3. Tipografia
- **Família de Fontes**: Utilizar **Inter** ou **Outfit** (via Google Fonts) como fonte principal do sistema.
- **Hierarchy**:
  - `h1`: 2.25rem (36px) - Semibold, cor Grafite.
  - `h2`: 1.5rem (24px) - Medium, títulos de seções.
  - `h3`: 1.25rem (20px) - Medium, títulos de cartões e drawers.
  - `Body`: 0.875rem (14px) ou 1rem (16px) - Regular, para textos e tabelas.
  - `Caption`: 0.75rem (12px) - Regular, para metadados e legendas de gráficos.

---

## 4. Diretrizes para o Visualizador 3D

### Configurações de Câmera e Iluminação
- **Câmera Orbital (`OrbitControls`)**: Limitada em zoom máximo e mínimo para evitar que o usuário perca o modelo de vista. Rotação vertical (`maxPolarAngle`) travada a 120 graus para impedir que a câmera fique completamente de cabeça para baixo sob a arcada.
- **Iluminação Tridimensional**:
  - `ambientLight` com intensidade `0.6` para preenchimento de sombras.
  - `directionalLight` (intensidade `0.8`) vinda do canto superior frontal do modelo com sombras suaves ativadas.
  - `pointLight` focada de trás com intensidade `0.3` para destacar a silhueta tridimensional dos dentes (Rim light).
- **Fundo do Visualizador**: Cinza neutro muito claro (`#F3F4F6`) ou azul cirúrgico sutil para garantir excelente legibilidade dos dentes brancos e gengiva rosa.

---

## 5. Estados e Componentes Interativos

### Botões e Links
- **Hover**: Escurecimento sutil da cor de fundo (ex: `hover:bg-red-800`) e transição de `duration-200`.
- **Active / Press**: Sutil redução de escala utilizando transformações CSS (ex: `active:scale-95`).
- **Focus**: Anel de contorno duplo (ex: `focus:ring-2 focus:ring-red-500 focus:ring-offset-2`).

### Gaveta de Detalhes do Dente (Tooth Detail Drawer)
- Desliza suavemente a partir do lado direito da tela (`motion.div` com Framer Motion).
- Apresenta o diagrama 2D expandido do dente selecionado para clique nas superfícies e a lista de procedimentos comuns para inserção rápida.
- Botão flutuante de salvar ação com feedback visual de carregamento (spinner).
