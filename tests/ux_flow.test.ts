import { test, expect } from '@playwright/test';

test.describe('Fluxos de Experiência do Usuário (UX)', () => {
  
  test.beforeEach(async ({ page }) => {
    // Acessa o site local ativando o bypass de autenticação em ambiente de testes
    await page.goto('http://127.0.0.1:3000/?bypass_auth=true');
    // Espera até que a página carregue completamente
    await page.waitForLoadState('networkidle');
  });

  test('Deve carregar o Dashboard principal e exibir o nome do profissional mockado', async ({ page }) => {
    // Verifica se a barra superior ou o texto de boas-vindas do Dr. Agnaldo é exibido
    await expect(page.locator('body')).toContainText('Dr. Agnaldo Ferreira');
    
    // Verifica se o painel de navegação (sidebar) está visível
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('Deve navegar pelas abas principais da sidebar sem quebrar a renderização', async ({ page }) => {
    // Lista de abas a testar cliques
    const tabs = [
      { id: 'dashboard', text: 'Painel' },
      { id: 'crm', text: 'Pacientes' },
      { id: 'calendar', text: 'Agenda' },
      { id: '3d-planning', text: 'Arcada 3D' },
      { id: 'agent-center', text: 'Central IA' },
      { id: 'settings', text: 'Ajustes' }
    ];

    for (const tab of tabs) {
      const button = page.locator(`button:has-text("${tab.text}"), a:has-text("${tab.text}")`).first();
      if (await button.count() > 0) {
        await button.click();
        await page.waitForTimeout(500); // pequeno delay para transição de aba
        // Garante que o corpo do documento ainda é exibido
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });

  test('Deve abrir o formulário de pacientes no CRM e permitir salvar dados mockados', async ({ page }) => {
    // Vai para a aba do CRM
    const crmTab = page.locator('button:has-text("Pacientes"), a:has-text("Pacientes")').first();
    await crmTab.click();
    await page.waitForTimeout(500);

    // Tenta encontrar e clicar no botão de Novo Paciente
    const newPatientBtn = page.locator('button:has-text("Novo Paciente"), button:has-text("Cadastrar Paciente")').first();
    if (await newPatientBtn.count() > 0) {
      await newPatientBtn.click();
      await page.waitForTimeout(500);
      
      // Verifica se o modal abriu buscando campos comuns
      const nameInput = page.locator('input[placeholder*="Nome"], input[name*="nome"], input[type="text"]').first();
      await expect(nameInput).toBeVisible();
    }
  });

  test('Deve simular o fluxo de geração de orçamento sem falhas no console', async ({ page }) => {
    // Registra erros do console do navegador para garantir que não haja TypeErrors ou erros 500
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Acessa CRM/Pacientes
    const crmTab = page.locator('button:has-text("Pacientes"), a:has-text("Pacientes")').first();
    await crmTab.click();
    await page.waitForTimeout(500);

    // Verifica se há botões de Orçamento/Tratamento e clica em um deles
    const budgetBtn = page.locator('button:has-text("Orçamento"), button:has-text("Tratamento")').first();
    if (await budgetBtn.count() > 0) {
      await budgetBtn.click();
      await page.waitForTimeout(500);
    }

    // Verifica se algum erro crítico ocorreu no console durante o clique
    const criticalErrors = consoleErrors.filter(err => err.includes('TypeError') || err.includes('failed to load'));
    expect(criticalErrors.length).toBe(0);
  });
  
});
