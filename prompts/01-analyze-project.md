# Prompt 01: Análise e Mapeamento do Projeto Existente

Você é um engenheiro de software sênior encarregado de analisar a base de código do **Sistema AI Studio - CRM Odontológico**. Seu objetivo nesta fase é entender a fundo a arquitetura atual para preparar o terreno para a integração do visualizador 3D e motor de orçamentos.

Siga as instruções abaixo para realizar a análise completa:

---

## 1. Pesquisa e Mapeamento de Arquivos
- Localize e examine os seguintes arquivos centrais do projeto:
  - `package.json`: Quais dependências visuais, de animação e de banco de dados estão instaladas? (React Three Fiber ou ThreeJS já estão instalados?)
  - `src/App.tsx`: Como é gerenciado o roteamento principal ou a alternância de telas e abas?
  - `src/components/ClinicalAttendanceManager.tsx` e `src/components/DentalCRMView.tsx`: Como os dados do paciente e o prontuário são exibidos hoje?
  - `src/context/PatientContext.tsx`: Qual é a estrutura de dados compartilhada do paciente?

---

## 2. Perguntas de Análise Crítica
Analise a base de código e responda às seguintes questões estruturais:
- Onde a interface do visualizador 3D (Odontograma 3D) deve ser encaixada para oferecer a melhor experiência ao dentista?
- Como o estado do dente selecionado é atualmente modelado? Existe suporte para dentes individuais ou apenas observações textuais?
- Qual é a biblioteca de UI/estilização dominante? Como o CSS global está estruturado (`index.css`)?

---

## 3. Entregável Esperado
Crie um relatório de análise técnica sob o diretório `docs/` chamado `ANALYSIS_REPORT.md` contendo:
1. **Mapa Mental de Dependências**: Principais pacotes instalados.
2. **Pontos de Inserção da Lógica 3D**: Quais arquivos precisam ser criados ou modificados.
3. **Erros Clínicos Potenciais**: Diagnóstico de possíveis problemas de consistência de estado no prontuário atual.
4. **Próximos Passos Recomendados**: Plano de ação detalhado para a fase de arquitetura.
