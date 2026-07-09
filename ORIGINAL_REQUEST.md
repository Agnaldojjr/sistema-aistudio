# Original User Request

## Initial Request — 2026-07-09T18:18:05-03:00

# Teamwork Project Prompt — Draft

Adicionar uma aba "Financeiro" no menu lateral para registrar pagamentos de pacientes e orçamentos fechados. Incluir fluxo onde, no módulo de orçamento existente, o usuário informa a forma de pagamento (Dinheiro, PIX, Cartão de Crédito, Cartão de Débito) e, após o pagamento, os dados integram com o Financeiro usando o backend já existente.

Working directory: c:/Users/Agnaldo/OneDrive/Área de Trabalho/sistema-aistudio-main
Integrity mode: development

## Requirements

### R1. Adicionar Forma de Pagamento ao Orçamento
Modificar o módulo de orçamento existente para incluir a seleção da forma de pagamento (Dinheiro, PIX, Cartão de Crédito, Cartão de Débito).

### R2. Integração com o Financeiro
Quando um orçamento for fechado/pago, registrar automaticamente essa entrada no módulo Financeiro, aproveitando a estrutura de banco de dados/backend já existente no projeto.

### R3. Aba Financeiro no Menu Lateral
Criar e adicionar uma nova aba "Financeiro" no menu lateral (sidebar) que liste os pagamentos e orçamentos fechados.

## Acceptance Criteria

### Modificação do Orçamento
- [ ] A interface de orçamento possui um campo selecionável para a forma de pagamento.
- [ ] A submissão de um orçamento pago salva corretamente a forma de pagamento no banco de dados existente.

### Aba Financeiro
- [ ] O menu lateral possui um link/botão visível e funcional para a seção "Financeiro".
- [ ] A página/seção "Financeiro" renderiza corretamente e busca os dados de orçamentos pagos do backend.
- [ ] A listagem do financeiro exibe o valor e a forma de pagamento de cada orçamento fechado.
