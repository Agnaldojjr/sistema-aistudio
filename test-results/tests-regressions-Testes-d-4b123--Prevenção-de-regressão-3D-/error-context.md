# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\regressions.test.ts >> Testes de Regressão (Histórico de Bugs Resolvidos) >> Arcada 3D não deve quebrar ou ficar em branco (Prevenção de regressão 3D)
- Location: tests\regressions.test.ts:32:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('canvas').first()
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 20000ms
  - waiting for locator('canvas').first()

```

```yaml
- complementary "Navegação principal":
  - img
  - paragraph: Dr. Agnaldo Ferreira
  - paragraph: Odontologia Restauradora
  - button "Recolher"
  - navigation:
    - paragraph: Módulos
    - button "Painel"
    - button "Financeiro"
    - button "Pacientes"
    - button "Agenda"
    - button "Arcada 3D"
    - button "Central IA"
    - button "Ajustes"
  - paragraph: Conectado como
  - paragraph: Dr. Agnaldo Ferreira
  - paragraph: CROMG 58714
  - button "Sentinela de Bugs"
  - button "Sair"
- banner:
  - heading "Planejamento 3D" [level=2]
  - button "Celular"
- main:
  - heading "Nenhum Paciente Selecionado" [level=2]
  - paragraph: Busque e selecione um paciente abaixo para iniciar o planejamento clínico e financeiro 3D.
  - textbox "Buscar paciente por nome, CPF ou telefone..."
  - button "Recarregar pacientes"
  - paragraph: Nenhum paciente cadastrado.
- contentinfo:
  - img
  - paragraph: Dr. Agnaldo Ferreira
  - paragraph: ODONTOLOGIA RESTAURADORA
  - paragraph: 13 de julho de 2026
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const BASE_URL = process.env.TEST_BASE_URL || 'https://sistema-aistudio.vercel.app/?bypass_auth=true';
  4  | 
  5  | test.describe('Testes de Regressão (Histórico de Bugs Resolvidos)', () => {
  6  |   
  7  |   let consoleErrors: string[] = [];
  8  | 
  9  |   test.beforeEach(async ({ page }) => {
  10 |     consoleErrors = [];
  11 |     page.on('console', msg => {
  12 |       if (msg.type() === 'error') {
  13 |         const text = msg.text();
  14 |         if (!text.includes('favicon') && !text.includes('ERR_CONNECTION_REFUSED')) {
  15 |           consoleErrors.push(text);
  16 |         }
  17 |       }
  18 |     });
  19 |     
  20 |     // Configura o handler de dialogs (alerts) para não travar o teste e capturar a mensagem
  21 |     page.on('dialog', async dialog => {
  22 |       await dialog.accept();
  23 |     });
  24 | 
  25 |     await page.goto(BASE_URL);
  26 |     await page.waitForLoadState('load');
  27 |   });
  28 | 
  29 |   // =========================================================
  30 |   // Regressão 1: Arcada 3D - Dentes desaparecendo ou canvas em branco
  31 |   // =========================================================
  32 |   test('Arcada 3D não deve quebrar ou ficar em branco (Prevenção de regressão 3D)', async ({ page }) => {
  33 |     // Tenta acessar a Arcada 3D
  34 |     await page.locator('button:has-text("Arcada 3D"), a:has-text("Arcada 3D")').first().click();
  35 |     await page.waitForTimeout(3000); // 3D load time
  36 | 
  37 |     // Verifica se o canvas do Three.js/R3F está presente e visível
  38 |     const canvas = page.locator('canvas').first();
> 39 |     await expect(canvas).toBeVisible({ timeout: 20000 });
     |                          ^ Error: expect(locator).toBeVisible() failed
  40 |     
  41 |     const box = await canvas.boundingBox();
  42 |     expect(box).not.toBeNull();
  43 |     if (box) {
  44 |       expect(box.width).toBeGreaterThan(200); // Garante que o canvas não está encolhido
  45 |       expect(box.height).toBeGreaterThan(200);
  46 |     }
  47 | 
  48 |     // Não deve haver erros de carregamento de GLB/GLTF ou WebGL
  49 |     const webglErrors = consoleErrors.filter(e => 
  50 |       e.includes('WebGL') || 
  51 |       e.includes('THREE') || 
  52 |       e.includes('.glb') || 
  53 |       e.includes('.gltf') ||
  54 |       e.includes('Failed to load resource')
  55 |     );
  56 |     expect(webglErrors).toEqual([]);
  57 |   });
  58 | 
  59 |   // =========================================================
  60 |   // Regressão 2: CRM - Prevenção de Duplicidade de Leads/Pacientes
  61 |   // =========================================================
  62 |   test('Formulário de Pacientes (CRM) deve ter validação para evitar duplicidade (Prevenção de regressão CRM)', async ({ page }) => {
  63 |     // Acessa Pacientes
  64 |     await page.locator('button:has-text("Pacientes"), a:has-text("Pacientes")').first().click();
  65 |     await page.waitForTimeout(1000);
  66 | 
  67 |     // Como estamos usando um bypass_auth (usuário falso/mockado), o banco pode gritar "não autenticado".
  68 |     // Ignoramos esse erro específico de Supabase e focamos se há crashes reais de JS
  69 |     const critical = consoleErrors.filter(e => 
  70 |       (e.includes('TypeError') || e.includes('is not a function') || e.includes('duplicate')) &&
  71 |       !e.includes('Usuário não autenticado no Supabase')
  72 |     );
  73 |     
  74 |     expect(critical).toEqual([]);
  75 |     
  76 |     // Bônus: verifica se a tabela de pacientes carrega ou mostra "Nenhum paciente" sem crashar
  77 |     const bodyText = await page.locator('body').innerText();
  78 |     const hasPatientsTableOrEmptyState = bodyText.includes('Nome') || bodyText.includes('Nenhum paciente');
  79 |     expect(hasPatientsTableOrEmptyState).toBe(true);
  80 |   });
  81 | 
  82 | });
  83 | 
```