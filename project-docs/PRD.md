# PRD - Documento de Requisitos do Produto (Product Requirements Document)

## 1. Identificação do Produto
* **Nome**: Treatment Planning 3D
* **Status**: Em Planejamento

## 2. Objetivo
Permitir ao dentista apresentar o plano de tratamento utilizando um modelo anatômico 3D totalmente interativo.

## 3. O Problema
Atualmente, os pacientes têm extrema dificuldade de compreender termos técnicos e a necessidade real de determinados procedimentos recomendados pelo dentista. Em particular, é difícil para os pacientes entenderem diagnósticos e tratamentos complexos tais como:
* **Canal (Endodontia)**: O processo interno de remoção da polpa e preenchimento da raiz.
* **Implante**: A instalação do pino de titânio no osso e a posterior coroa protética.
* **Fratura**: Danos na estrutura da coroa ou raiz que exigem restaurações complexas ou coroas.
* **Perda Óssea**: A redução do suporte ósseo do dente devido a problemas periodontais.
* **Faceta**: A aplicação de lâminas de resina/porcelana para fins estéticos e funcionais.

## 4. A Solução
Criar um **módulo 3D integrado diretamente ao prontuário clínico** do paciente dentro da plataforma. Esse módulo permitirá que o cirurgião-dentista visualize a arcada dentária em 3D, selecione dentes e superfícies, aplique diagnósticos e exiba visualmente a evolução e as fases do tratamento para o paciente.

## 5. Requisitos Funcionais Centrais
1. **Visualizador 3D Interativo**: Renderização responsiva e fluida (60 FPS) da boca/arcada dentária com controles de órbita (rotação, aproximação e pan).
2. **Seleção Inteligente**: Possibilidade de clicar em dentes específicos (notação FDI) e selecionar suas faces/superfícies.
3. **Mapeamento Clínico Visual**: Colorir e aplicar texturas aos dentes de acordo com a condição (ex: vermelho para fratura/cárie, metálico para implantes, coroa de cerâmica para facetas).
4. **Modo de Apresentação (Antes/Depois)**: Alternância simples entre o estado atual da boca do paciente e o estado projetado após a conclusão de todos os tratamentos recomendados.

## 6. Critérios de Sucesso
* Redução no tempo necessário para explicar os procedimentos aos pacientes.
* Aumento da taxa de aceitação de planos de tratamento complexos (como canais, implantes e facetas).
* Maior engajamento e satisfação dos pacientes com a clareza visual dos orçamentos propostos.
