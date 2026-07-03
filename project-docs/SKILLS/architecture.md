# Guia de Arquitetura e Estruturação de Código

Este guia fornece orientações para manter a consistência da arquitetura à medida que o sistema é expandido.

---

## 1. Princípios Gerais da Arquitetura
- **Separação de Preocupações (SoC)**: Mantenha a renderização 3D, a lógica de negócio clínica e a gestão financeira isoladas em módulos específicos.
- **Fluxo Uni-direcional**: O estado do odontograma deve fluir do contexto global (`PatientContext`) para os componentes filhos, e as alterações devem ser despachadas por meio de ações explícitas (ex: funções do hook de contexto).
- **Consistência nos SDKs**: A sincronização remota deve utilizar os adapters de Supabase ou Firebase já configurados, sem misturar chamadas de banco de dados diretamente nos componentes visuais.

---

## 2. Padrão de Componentes React
Os componentes no sistema devem seguir o modelo funcional:
1. **Tipos e Interfaces**: Declarados no topo do arquivo ou importados de `src/types.ts`.
2. **Componente Principal**: Com declaração de tipagem explícita para as Props.
3. **Hooks de Estado e Efeitos**: Ordem padrão: `useContext`, `useRef`, `useState`, `useMemo`, `useCallback`, `useEffect`.
4. **Sub-componentes Privados**: Definidos no mesmo arquivo apenas se forem simples e não compartilhados. Caso contrário, devem ser criados em arquivos dedicados na pasta `src/components`.

---

## 3. Gestão de Estado Global (Context API)
Ao expandir a lógica do paciente ou prontuário, siga estas regras no `PatientContext`:
- Não coloque estados de animação ou UI local no contexto.
- Implemente seletores ou lógica de memoização no retorno do provider para evitar re-renderizações desnecessárias de toda a árvore de componentes.
- Mantenha funções de atualização assíncronas com tratamento de erro (`try/catch`) e atualização otimista (optimistic updates) na interface.

---

## 4. Integração com Banco de Dados (Supabase / Firebase)
- **Firebase**: Utilizado primariamente para Autenticação rápida (`firebase.ts`), armazenamento de arquivos anexos e logs em tempo real.
- **Supabase**: Utilizado para o banco de dados clínico transacional (prontuário, anamnese, tabelas financeiras) devido ao suporte a chaves estrangeiras, transações ACID e integridade referencial.
- Evite criar novas conexões diretas. Sempre reutilize as instâncias exportadas em `src/firebase.ts` ou nos módulos lib do Supabase.
