# Padrões e Diretrizes de Codificação (Coding Standards)

Este guia estabelece os padrões de desenvolvimento em TypeScript e React para o projeto, garantindo legibilidade, manutenibilidade e robustez.

---

## 1. Regras Gerais de Código
- **TypeScript Estrito**: Evite o uso de `any`. Prefira a tipagem explícita ou interfaces bem definidas em `src/types.ts`.
- **Nomes Autoexplicativos**: Funções e variáveis devem expressar claramente sua intenção.
  - *Ruim*: `const fn = (d: any) => { ... }`
  - *Bom*: `const formatToothCode = (toothNumber: number): string => { ... }`
- **Funções Pequenas e Focadas**: Cada função deve fazer apenas uma coisa. Se uma função passar de 40 linhas, avalie dividi-la.
- **Estruturas Imutáveis**: Prefira métodos que retornem novos arrays/objetos (ex: `map`, `filter`, spread operator) em vez de modificar dados existentes diretamente.

---

## 2. Padrões de React e TypeScript

### Declaração de Componentes
Sempre utilize funções normais ou arrow functions com tipagem para as Props:
```tsx
interface ToothSelectorProps {
  selectedTooth: number | null;
  onSelectTooth: (toothNumber: number) => void;
}

export function ToothSelector({ selectedTooth, onSelectTooth }: ToothSelectorProps) {
  return (
    <div className="flex gap-2">
      {/* Conteúdo */}
    </div>
  );
}
```

### Componentes Controlados
- Formulários devem utilizar o estado do React ou bibliotecas de formulário integradas.
- Sempre sanitize a entrada de dados (especialmente números de telefone, CPFs e valores monetários).

---

## 3. Tratamento de Erros e Logs
- Envolva chamadas de API, requisições de banco de dados e processamento de arquivos em blocos `try/catch`.
- Exiba toasts ou mensagens amigáveis na tela em vez de apenas falhar silenciosamente ou cuspir o erro do sistema diretamente na cara do usuário.
- Utilize mensagens de log claras no ambiente de desenvolvimento:
  ```typescript
  console.error('[DentalCRM:fetchPatients] Falha ao recuperar lista do Supabase:', error);
  ```

---

## 4. Estilização com TailwindCSS
- Evite estilizações inline (`style={{ ... }}`). Use classes do Tailwind.
- Agrupe classes Tailwind de forma consistente (layout, depois tamanho, depois cores/bordas, depois interações/estados).
- Utilize a biblioteca `clsx` ou `tailwind-merge` para lidar com classes condicionais de forma limpa.
