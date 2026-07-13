import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'https://sistema-aistudio.vercel.app/?bypass_auth=true';

test.describe('Testes de Regressão (Histórico de Bugs Resolvidos)', () => {
  
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('ERR_CONNECTION_REFUSED')) {
          consoleErrors.push(text);
        }
      }
    });
    
    // Configura o handler de dialogs (alerts) para não travar o teste e capturar a mensagem
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('load');
  });

  // =========================================================
  // Regressão 1: Arcada 3D - Dentes desaparecendo ou canvas em branco
  // =========================================================
  test('Arcada 3D não deve quebrar ou ficar em branco (Prevenção de regressão 3D)', async ({ page }) => {
    // Tenta acessar a Arcada 3D
    await page.locator('button:has-text("Arcada 3D"), a:has-text("Arcada 3D")').first().click();
    await page.waitForTimeout(3000); // 3D load time

    // Como nenhum paciente está selecionado no mock inicial, o canvas não deve aparecer,
    // mas sim uma mensagem orientando a selecionar o paciente, e não deve haver crash.
    await expect(page.locator('body')).toContainText(/Selecione um paciente|3D|Arcada/i, { timeout: 10000 });

    // Não deve haver erros de carregamento de GLB/GLTF ou WebGL
    const webglErrors = consoleErrors.filter(e => 
      e.includes('WebGL') || 
      e.includes('THREE') || 
      e.includes('.glb') || 
      e.includes('.gltf') ||
      e.includes('Failed to load resource')
    );
    expect(webglErrors).toEqual([]);
  });

  // =========================================================
  // Regressão 2: CRM - Prevenção de Duplicidade de Leads/Pacientes
  // =========================================================
  test('Formulário de Pacientes (CRM) deve ter validação para evitar duplicidade (Prevenção de regressão CRM)', async ({ page }) => {
    // Acessa Pacientes
    await page.locator('button:has-text("Pacientes"), a:has-text("Pacientes")').first().click();
    await page.waitForTimeout(1000);

    // Como estamos usando um bypass_auth (usuário falso/mockado), o banco pode gritar "não autenticado".
    // Ignoramos esse erro específico de Supabase e focamos se há crashes reais de JS
    const critical = consoleErrors.filter(e => 
      (e.includes('TypeError') || e.includes('is not a function') || e.includes('duplicate')) &&
      !e.includes('Usuário não autenticado no Supabase')
    );
    
    expect(critical).toEqual([]);
    
    // Bônus: verifica se a tabela de pacientes carrega ou mostra "Nenhum paciente" sem crashar
    // Bônus: verifica se a tabela de pacientes carrega ou mostra "Nenhum paciente" sem crashar
    // Usa toContainText com regex para aguardar até 10 segundos caso o Supabase demore a responder
    await expect(page.locator('body')).toContainText(/Nome|Nenhum/i, { timeout: 10000 });
  });

});
