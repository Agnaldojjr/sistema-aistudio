# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\regressions.test.ts >> Testes de Regressão (Histórico de Bugs Resolvidos) >> Formulário de Pacientes (CRM) deve ter validação para evitar duplicidade (Prevenção de regressão CRM)
- Location: tests\regressions.test.ts:62:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary "Navegação principal" [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - img [ref=e8]
        - generic [ref=e12]:
          - paragraph [ref=e13]: Dr. Agnaldo Ferreira
          - paragraph [ref=e14]: Odontologia Restauradora
      - button "Recolher" [ref=e15]:
        - img [ref=e16]
        - generic [ref=e18]: Recolher
    - navigation [ref=e19]:
      - paragraph [ref=e20]: Módulos
      - button "Painel" [ref=e21] [cursor=pointer]:
        - img [ref=e22]
        - generic [ref=e27]: Painel
      - button "Financeiro" [ref=e28] [cursor=pointer]:
        - img [ref=e29]
        - generic [ref=e34]: Financeiro
      - button "Pacientes" [active] [ref=e35] [cursor=pointer]:
        - img [ref=e36]
        - generic [ref=e41]: Pacientes
      - button "Agenda" [ref=e42] [cursor=pointer]:
        - img [ref=e43]
        - generic [ref=e45]: Agenda
      - button "Arcada 3D" [ref=e46] [cursor=pointer]:
        - img [ref=e47]
        - generic [ref=e51]: Arcada 3D
      - button "Central IA" [ref=e52] [cursor=pointer]:
        - img [ref=e53]
        - generic [ref=e56]: Central IA
      - button "Ajustes" [ref=e57] [cursor=pointer]:
        - img [ref=e58]
        - generic [ref=e61]: Ajustes
    - generic [ref=e62]:
      - generic [ref=e63]:
        - paragraph [ref=e64]: Conectado como
        - paragraph [ref=e65]: Dr. Agnaldo Ferreira
        - paragraph [ref=e66]: CROMG 58714
      - button "Sentinela de Bugs" [ref=e67] [cursor=pointer]:
        - img [ref=e68]
        - generic [ref=e70]: Sentinela de Bugs
      - button "Sair" [ref=e71] [cursor=pointer]:
        - img [ref=e72]
        - generic [ref=e75]: Sair
  - generic [ref=e76]:
    - banner [ref=e77]:
      - heading "Gestão de Pacientes" [level=2] [ref=e79]
      - button "Celular" [ref=e81]:
        - img [ref=e82]
        - text: Celular
    - main [ref=e84]:
      - generic [ref=e85]:
        - generic [ref=e86]:
          - generic [ref=e87]:
            - heading "Gestão de Pacientes" [level=2] [ref=e88]:
              - img [ref=e90]
              - text: Gestão de Pacientes
            - paragraph [ref=e93]: 0 pacientes cadastrados · Sincronizado com Supabase
          - generic [ref=e94]:
            - button "Importar Dados" [ref=e95]:
              - img [ref=e96]
              - text: Importar Dados
            - button "Novo Paciente" [ref=e99]:
              - img [ref=e100]
              - text: Novo Paciente
        - generic [ref=e101]:
          - generic [ref=e103]:
            - generic [ref=e104] [cursor=pointer]:
              - img [ref=e105]
              - generic [ref=e108]: Clique para buscar paciente...
            - button "Novo Cadastro" [ref=e109] [cursor=pointer]:
              - img [ref=e110]
              - generic [ref=e111]: Novo Cadastro
          - generic [ref=e113]: Selecione um paciente na lista de CRM à esquerda para carregar o prontuário completo, detalhes cadastrais e as abas de evolução históricas consolidadas.
    - contentinfo [ref=e114]:
      - generic [ref=e115]:
        - generic [ref=e116]:
          - img [ref=e117]
          - generic [ref=e121]:
            - paragraph [ref=e122]: Dr. Agnaldo Ferreira
            - paragraph [ref=e123]: ODONTOLOGIA RESTAURADORA
        - paragraph [ref=e124]: 13 de julho de 2026
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
  39 |     await expect(canvas).toBeVisible({ timeout: 20000 });
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
> 79 |     expect(hasPatientsTableOrEmptyState).toBe(true);
     |                                          ^ Error: expect(received).toBe(expected) // Object.is equality
  80 |   });
  81 | 
  82 | });
  83 | 
```