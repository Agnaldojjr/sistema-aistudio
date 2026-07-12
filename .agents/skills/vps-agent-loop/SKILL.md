---
name: vps-agent-loop
description: Automatiza o ciclo de vida do agente executor de testes UX e reparos contínuos na VPS Oracle.
---

# Skill: vps-agent-loop

Esta Skill gerencia o ciclo contínuo do agente executor e reparador automático de testes funcionais e de experiência do usuário (UX) no servidor Oracle VPS.

## Fluxo de Execução da Skill

1. **Sincronização:** Atualiza a base de código a partir do repositório remoto na branch correta.
2. **Servidor Local de Pré-Visualização:** Inicia o servidor Node.js/Vite localmente (`npm run dev`) vinculado estritamente à porta `127.0.0.1:3000`.
3. **Varredura E2E (Playwright):** Dispara a execução da suíte de testes de experiência do usuário (`npx playwright test tests/ux_flow.test.ts`).
4. **Captura e Diagnóstico:** Em caso de falha de teste (ex.: modal de orçamento que não abre, erros de console ou rotas quebradas):
   - Salva a pilha de erro (stack trace) e a captura de tela (screenshot).
   - Envia a falha à API do Gemini para analisar a causa raiz e reescrever o código do arquivo afetado.
5. **Validação do Patch:** Aplica a alteração sugerida em uma branch temporária isolada (`fix/ux-bug-*`) e executa o validador do projeto (`verify_all.py`).
6. **Entrega de Correção:** Se a verificação for bem-sucedida, envia a branch (`git push`) e abre um Pull Request via API do GitHub para revisão humana.
7. **Limpeza:** Para o servidor local e limpa recursos de runtime.
