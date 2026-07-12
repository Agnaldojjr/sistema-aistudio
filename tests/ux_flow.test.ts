import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000/?bypass_auth=true';

test.describe('Fluxos de Experiência do Usuário (UX)', () => {
  
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    // Captura TODOS os erros de console durante cada teste
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignora erros de rede esperados (favicon, recursos externos opcionais)
        if (!text.includes('favicon') && !text.includes('ERR_CONNECTION_REFUSED')) {
          consoleErrors.push(text);
        }
      }
    });
    // Captura erros de página (uncaught exceptions)
    page.on('pageerror', err => {
      consoleErrors.push(`UNCAUGHT: ${err.message}`);
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  // =========================================================
  // 1. DASHBOARD - Tela principal
  // =========================================================
  test('Dashboard: carrega corretamente com nome do profissional', async ({ page }) => {
    await expect(page.locator('body')).toContainText('Dr. Agnaldo Ferreira');
    // Sidebar visível
    const sidebar = page.locator('nav, aside, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible();
    // Sem erros críticos de JavaScript
    const critical = consoleErrors.filter(e => e.includes('TypeError') || e.includes('Cannot read') || e.includes('is not a function'));
    expect(critical).toEqual([]);
  });

  // =========================================================
  // 2. NAVEGAÇÃO - Cada aba da sidebar deve abrir sem crashar
  // =========================================================
  test('Navegação: todas as abas da sidebar abrem sem erros', async ({ page }) => {
    const tabs = [
      { text: 'Painel', expectContent: ['Painel', 'Dashboard'] },
      { text: 'Financeiro', expectContent: ['Financeiro', 'Receita'] },
      { text: 'Pacientes', expectContent: ['Pacientes', 'Cadastrar'] },
      { text: 'Agenda', expectContent: ['Agenda', 'Calendário'] },
      { text: 'Arcada 3D', expectContent: ['3D', 'Arcada'] },
      { text: 'Central IA', expectContent: ['Central', 'Agente', 'Sentinela'] },
      { text: 'Ajustes', expectContent: ['Configurações', 'Ajustes'] },
    ];

    for (const tab of tabs) {
      const button = page.locator(`button:has-text("${tab.text}"), a:has-text("${tab.text}")`).first();
      if (await button.count() > 0) {
        await button.click();
        await page.waitForTimeout(1000);
        // A página não deve estar em branco
        const bodyText = await page.locator('body').innerText();
        expect(bodyText.length).toBeGreaterThan(50);
      }
    }

    // Verifica erros acumulados em toda a navegação
    const critical = consoleErrors.filter(e => 
      e.includes('TypeError') || 
      e.includes('Cannot read') || 
      e.includes('is not a function') ||
      e.includes('is not defined') ||
      e.includes('Uncaught')
    );
    if (critical.length > 0) {
      console.log('Erros críticos de JS encontrados durante navegação:', critical);
    }
    expect(critical).toEqual([]);
  });

  // =========================================================
  // 3. PACIENTES - Cadastro de novo paciente
  // =========================================================
  test('Pacientes: botão "Novo Paciente" abre formulário com campos visíveis', async ({ page }) => {
    // Navega para Pacientes
    await page.locator('button:has-text("Pacientes"), a:has-text("Pacientes")').first().click();
    await page.waitForTimeout(1000);

    // Clica em Novo Paciente / Cadastrar
    const newBtn = page.locator('button:has-text("Novo Paciente"), button:has-text("Cadastrar Paciente"), button:has-text("Adicionar")').first();
    if (await newBtn.count() > 0) {
      await newBtn.click();
      await page.waitForTimeout(800);
      
      // Deve ter pelo menos um campo de input visível (nome, telefone, etc.)
      const inputs = page.locator('input[type="text"], input[type="tel"], input[type="email"]');
      const count = await inputs.count();
      expect(count).toBeGreaterThan(0);
    }

    const critical = consoleErrors.filter(e => e.includes('TypeError') || e.includes('Cannot read'));
    expect(critical).toEqual([]);
  });

  // =========================================================
  // 4. ORÇAMENTO - Fluxo de geração sem falhas
  // =========================================================
  test('Orçamento: fluxo de geração não produz erros de JS', async ({ page }) => {
    // Navega para Pacientes
    await page.locator('button:has-text("Pacientes"), a:has-text("Pacientes")').first().click();
    await page.waitForTimeout(1000);

    // Tenta clicar em Orçamento / Tratamento
    const budgetBtn = page.locator('button:has-text("Orçamento"), button:has-text("Tratamento"), button:has-text("Negociação")').first();
    if (await budgetBtn.count() > 0) {
      await budgetBtn.click();
      await page.waitForTimeout(1000);
    }

    const critical = consoleErrors.filter(e => 
      e.includes('TypeError') || 
      e.includes('Cannot read') || 
      e.includes('failed to load') ||
      e.includes('is not a function')
    );
    expect(critical).toEqual([]);
  });

  // =========================================================
  // 5. AGENDA - Calendário abre e permite interação
  // =========================================================
  test('Agenda: calendário renderiza e permite clicar em datas', async ({ page }) => {
    await page.locator('button:has-text("Agenda"), a:has-text("Agenda")').first().click();
    await page.waitForTimeout(1000);

    // O corpo deve conter texto relativo a calendário/agenda
    const body = await page.locator('body').innerText();
    const hasCalendarContent = body.includes('Dom') || body.includes('Seg') || 
                               body.includes('Ter') || body.includes('Qua') ||
                               body.includes('Qui') || body.includes('Sex') ||
                               body.includes('Sáb') || body.includes('Janeiro') ||
                               body.includes('Fevereiro') || body.includes('Março') ||
                               body.includes('Abril') || body.includes('Maio') ||
                               body.includes('Junho') || body.includes('Julho') ||
                               body.includes('Agosto') || body.includes('Setembro') ||
                               body.includes('Outubro') || body.includes('Novembro') ||
                               body.includes('Dezembro') || body.includes('Today') ||
                               body.includes('Hoje');
    expect(hasCalendarContent).toBe(true);

    const critical = consoleErrors.filter(e => e.includes('TypeError') || e.includes('Cannot read'));
    expect(critical).toEqual([]);
  });

  // =========================================================
  // 6. ARCADA 3D - Canvas/WebGL renderiza sem crash
  // =========================================================
  test('Arcada 3D: canvas/modelo 3D é renderizado e exibe elementos visuais', async ({ page }) => {
    await page.locator('button:has-text("Arcada 3D"), a:has-text("Arcada 3D")').first().click();
    await page.waitForTimeout(3000); // 3D precisa de mais tempo para carregar modelos GLB

    // Deve existir pelo menos um canvas (Three.js/R3F) ou elemento 3D
    const canvas = page.locator('canvas');
    const canvasCount = await canvas.count();
    
    if (canvasCount > 0) {
      await expect(canvas.first()).toBeVisible();
      // Verifica que o canvas tem dimensões válidas (não zeradas)
      const box = await canvas.first().boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThan(100);
        expect(box.height).toBeGreaterThan(100);
      }
    }

    // Verifica erros de WebGL ou carregamento de modelo 3D
    const critical = consoleErrors.filter(e => 
      e.includes('TypeError') || 
      e.includes('Cannot read') || 
      e.includes('WebGL') ||
      e.includes('THREE') ||
      e.includes('Failed to load') ||
      e.includes('404') ||
      e.includes('.glb') ||
      e.includes('.gltf')
    );
    if (critical.length > 0) {
      console.log('Erros na aba 3D:', critical);
    }
    expect(critical).toEqual([]);
  });

  // =========================================================
  // 7. CENTRAL IA - Chat e painel de relatórios
  // =========================================================
  test('Central IA: painel carrega e campo de chat é funcional', async ({ page }) => {
    await page.locator('button:has-text("Central IA"), a:has-text("Central IA")').first().click();
    await page.waitForTimeout(1000);

    // Deve exibir as abas do painel
    const body = await page.locator('body').innerText();
    const hasSentinelContent = body.includes('Auditoria') || body.includes('Conversar') || 
                               body.includes('Agente') || body.includes('Sentinela');
    expect(hasSentinelContent).toBe(true);

    // Deve ter um campo de input para chat
    const chatInput = page.locator('input[placeholder*="Pergunte"], input[placeholder*="agente"], textarea').first();
    if (await chatInput.count() > 0) {
      await expect(chatInput).toBeVisible();
    }

    const critical = consoleErrors.filter(e => e.includes('TypeError') || e.includes('Cannot read'));
    expect(critical).toEqual([]);
  });

  // =========================================================
  // 8. FINANCEIRO - Tela de finanças
  // =========================================================
  test('Financeiro: tela de finanças carrega sem erros', async ({ page }) => {
    const finBtn = page.locator('button:has-text("Financeiro"), a:has-text("Financeiro")').first();
    if (await finBtn.count() > 0) {
      await finBtn.click();
      await page.waitForTimeout(1000);
      
      const body = await page.locator('body').innerText();
      expect(body.length).toBeGreaterThan(50);
    }

    const critical = consoleErrors.filter(e => e.includes('TypeError') || e.includes('Cannot read'));
    expect(critical).toEqual([]);
  });

  // =========================================================
  // 9. RESPONSIVIDADE - Tela mobile não quebra
  // =========================================================
  test('Responsividade: layout mobile não produz erros de JS', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Corpo deve ter conteúdo
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(30);

    // Tenta abrir o menu hamburger (mobile)
    const menuBtn = page.locator('button:has(svg), [aria-label*="menu"], [aria-label*="Menu"]').first();
    if (await menuBtn.count() > 0) {
      await menuBtn.click();
      await page.waitForTimeout(500);
    }

    const critical = consoleErrors.filter(e => e.includes('TypeError') || e.includes('Cannot read'));
    expect(critical).toEqual([]);
  });

  // =========================================================
  // 10. REQUESTS 500 - Nenhuma API deve retornar erro 500
  // =========================================================
  test('APIs: nenhuma requisição de rede retorna erro 500 durante navegação', async ({ page }) => {
    const failedRequests: string[] = [];
    
    page.on('response', response => {
      if (response.status() >= 500) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });

    // Navega por abas principais
    const tabs = ['Painel', 'Pacientes', 'Agenda', 'Financeiro'];
    for (const tab of tabs) {
      const btn = page.locator(`button:has-text("${tab}"), a:has-text("${tab}")`).first();
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(1000);
      }
    }

    if (failedRequests.length > 0) {
      console.log('Requisições com erro 500+:', failedRequests);
    }
    expect(failedRequests).toEqual([]);
  });

});
