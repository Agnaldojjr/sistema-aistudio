# PRD - Documento de Requisitos do Produto (Product Requirements Document)

## 1. Visão Geral do Produto
O **Sistema AI Studio - Módulo Odontológico 3D** é uma extensão da plataforma de gestão de clínicas odontológicas (Dental CRM) existente. Este módulo visa transformar a forma como dentistas planejam tratamentos, comunicam-se com os pacientes e geram orçamentos, integrando um **Visualizador 3D Interativo do Odontograma** (Arcada Dentária) diretamente no fluxo clínico.

## 2. Objetivos Principais
- **Aprimorar a Comunicação com o Paciente**: Facilitar o entendimento do tratamento proposto através de representações 3D realistas dos dentes e dos procedimentos.
- **Automatizar a Criação de Orçamentos**: Vincular a seleção de dentes e superfícies no visualizador 3D diretamente ao motor de cálculo de orçamentos (Budget Engine).
- **Eficiência Clínica**: Oferecer uma interface rápida e intuitiva para o dentista registrar diagnósticos (ex: cárie, implante, tratamento de canal) usando seleção por clique direto (Raycasting) nos dentes.
- **Apresentação de Alto Impacto (Presentation Mode)**: Modo de tela cheia otimizado para o dentista mostrar o plano de tratamento ao paciente, com simulações antes/depois.

## 3. Funcionalidades Principais (Key Features)

### 3.1. Visualizador 3D da Arcada Dentária (Tooth 3D Viewer)
- Renderização interativa de uma arcada dentária completa (32 dentes permanentes e suporte para dentes decíduos).
- Navegação espacial completa (Rotação, Pan, Zoom).
- Modelo 3D com materiais realistas representando esmalte, dentina, gengiva e materiais de restauração (ouro, amálgama, resina).

### 3.2. Seleção de Dentes e Superfícies (Tooth Selection Engine)
- Seleção individual de dentes pelo código internacional (FDI - ex: 11, 21, 46).
- Seleção de superfícies específicas do dente (Mesial, Distal, Oclusal, Vestibular, Lingual/Palatina).
- Destaque visual (Highlighting) dos dentes e superfícies selecionadas com cores indicativas do estado clínico (ex: Vermelho para cárie pendente, Azul para restaurado, Cinza para dente ausente).

### 3.3. Planejamento de Tratamento (Treatment Planning)
- Vinculação de diagnósticos e procedimentos a dentes/superfícies específicos.
- Linha do tempo ou fases do plano de tratamento (ex: Fase 1 - Endodontia, Fase 2 - Reabilitação).
- Histórico clínico visual mostrando a evolução do tratamento do paciente.

### 3.4. Motor de Orçamentos Dinâmico (Budget Engine)
- Geração automática de propostas comerciais com base no plano de tratamento desenhado no 3D.
- Tabela de preços dinâmica integrada com suporte a descontos, formas de pagamento (Pix, Crédito, Parcelamento) e aprovação em tempo real.
- Exportação de PDFs profissionais com papel timbrado da clínica e o odontograma 3D renderizado na proposta.

### 3.5. Modo de Apresentação (Presentation Mode)
- Interface limpa e minimalista ("modo TV" ou "modo tablet") focada no paciente.
- Comparativo visual "Antes vs. Depois" (simulação 3D).
- Assinatura digital ou aceite formal do orçamento integrado diretamente no tablet/tela.

## 4. Requisitos Não Funcionais
- **Performance**: O visualizador 3D deve carregar em menos de 2 segundos e rodar de forma fluida (60 FPS) em dispositivos móveis e desktops.
- **Responsividade**: Adaptação perfeita em telas de tablets (iPad) e desktops clínicos.
- **Segurança**: Conformidade com a LGPD (Lei Geral de Proteção de Dados) para o armazenamento do prontuário e imagens dos pacientes no Supabase/Firebase.
- **Offline Cache**: Capacidade de visualização de modelos 3D mesmo com oscilações de rede.

## 5. Critérios de Sucesso
- Adoção de pelo menos 80% dos dentistas usuários da clínica piloto.
- Aumento de 25% na taxa de conversão de orçamentos complexos (implantes, reabilitações).
- Redução do tempo de preenchimento do prontuário em 30% se comparado ao odontograma tradicional 2D de papel ou formulário de texto.
