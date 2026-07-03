# Prompt 08: Modo de Apresentação e Aceite Digital do Paciente

Você é um especialista em design de interação e UX de alto impacto. Seu objetivo é criar o Modo de Apresentação do tratamento para o paciente, otimizando a conversão e permitindo o aceite formal digital.

Siga as instruções de desenvolvimento do painel de apresentação abaixo:

---

## 1. Interface Minimalista de Apresentação (Presentation Mode)
- Crie uma tela limpa e focada no paciente, eliminando menus administrativos, barras de navegação do CRM e cadastros técnicos de prontuário.
- Apresente o modelo 3D da arcada em tela inteira (Full Screen) de forma imersiva.
- Inclua controles simplificados de comparação (ex: botão "Antes" mostrando dentes com cáries em vermelho e dentes ausentes, e botão "Depois" exibindo a boca reabilitada com dentes brancos e alinhados).

---

## 2. Aceite Formal e Assinatura Digital
- Exiba um painel flutuante resumindo a proposta de pagamento aprovada pelo paciente de forma clara.
- Adicione um componente de canvas de assinatura (`src/components/SignatureCanvas.tsx`) onde o paciente possa assinar com o dedo ou caneta stylus (como Apple Pencil) confirmando o aceite do plano de tratamento e orçamento.
- Salve a imagem da assinatura no Firebase Storage ou codificada em base64 no Supabase e atualize o status do orçamento para `ACCEPTED` (Aceito).

---

## 3. Entregável Esperado
Crie os componentes `src/components/PresentationMode.tsx` e `src/components/SignatureCanvas.tsx`, vinculando-os ao fluxo de atendimento para:
1. Exibir a simulação do plano de tratamento em tela cheia com alternância "Antes/Depois".
2. Capturar e salvar a assinatura digital do paciente direto no prontuário eletrônico.
3. Atualizar o status do orçamento e gerar o recibo final assinado em PDF.
