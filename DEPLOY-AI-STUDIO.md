# Deploy no Google AI Studio — Sistema Odontológico Dr. Agnaldo Ferreira

Este app já está no formato correto do Google AI Studio (Vite + React + Express + Gemini SDK).
Siga os passos abaixo para publicá-lo.

---

## ✅ Pré-requisitos

1. Conta Google
2. Acesso ao [Google AI Studio](https://ai.google.dev) (ou https://aistudio.google.com)
3. Uma **Gemini API Key** (gratuita) — veja o Passo 1
4. (Opcional) Conta no [Firebase Console](https://console.firebase.google.com) — só se quiser login Google + Google Drive + Google Calendar

---

## Passo 1 — Obter a Gemini API Key (gratuita)

1. Acesse **https://aistudio.google.com/apikey**
2. Clique em **Create API key**
3. Selecione um projeto do Google Cloud (ou crie um novo)
4. Copie a chave (`AIza...`)

> Essa chave será usada pela IA que gera prescrições automáticas no receituário.

---

## Passo 2 — Publicar o app no AI Studio

### Opção A — Criar um novo app e colar o código (mais rápido)

1. Acesse **https://ai.google.dev** (ou https://aistudio.google.com/apps)
2. Clique em **Create New App** → **New App**
3. No editor, substitua todo o conteúdo pelos arquivos deste projeto:
   - Substitua `index.html`, `package.json`, `metadata.json`, `server.ts`, `vite.config.ts`
   - Crie a pasta `src/` e cole todos os arquivos (`App.tsx`, `components/`, `lib/`, `types.ts`, `constants.ts`, `firebase.ts`, `index.css`, `main.tsx`)
4. Clique em **Save**

### Opção B — Importar do GitHub

1. Faça upload deste projeto para um repositório GitHub (público ou privado)
2. No AI Studio, clique em **Create New App** → **Import from GitHub**
3. Cole a URL do repositório e confirme

---

## Passo 3 — Configurar a Gemini API Key (Secret)

O `metadata.json` já declara `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`, então o AI Studio injeta a chave automaticamente.

1. No AI Studio, abra seu app
2. No painel direito (lateral), localize **Secrets** / **User Secrets**
3. Adicione um secret chamado **`GEMINI_API_KEY`** e cole a chave obtida no Passo 1
4. Salve

> Não coloque a chave no código nem no `package.json`. O AI Studio injeta via variável de ambiente em runtime, lida por `server.ts` (`process.env.GEMINI_API_KEY`).

---

## Passo 4 — (Opcional) Configurar Firebase para Login + Drive + Agenda

O login "Entrar com Google" e a sincronização com Google Drive/Calendar usam o Firebase. Se você quer usar esses recursos, precisa do seu próprio projeto Firebase.

### 4.1 Criar projeto Firebase
1. Acesse **https://console.firebase.google.com**
2. **Add project** → crie um novo projeto
3. No menu **Build → Authentication → Sign-in method**, ative o provedor **Google**

### 4.2 Criar app web e pegar as chaves
1. Em **Configurações do projeto → Seus apps**, clique em **`</>`** (adicionar app web)
2. Registre o app e **copie o `firebaseConfig`** (apiKey, authDomain, projectId, etc.)
3. Substitua o conteúdo de `firebase-applet-config.json` pelas suas chaves

### 4.3 Ativar Firestore
1. Em **Build → Firestore Database**, clique em **Create database**
2. Região: `southamerica-east1` (São Paulo) recomendado

### 4.4 Habilitar Google Drive API e Calendar API
1. Acesse **https://console.cloud.google.com** (mesmo projeto do Firebase)
2. **APIs e serviços → Biblioteca**
3. Pesquise e **Ative**:
   - **Google Drive API**
   - **Google Calendar API**

### 4.5 Autorizar domínios
1. No Firebase: **Authentication → Settings → Authorized domains**
2. Adicione o domínio final onde o app será publicado (ex.: o URL do Cloud Run gerado pelo AI Studio)

---

## Passo 5 — Deploy (publicar online)

1. No AI Studio, clique em **Deploy** (botão no topo)
2. Selecione **Cloud Run** (opção padrão e gratuita para começar)
3. Escolha a região (ex.: `southamerica-east1`)
4. Clique em **Deploy**
5. Aguarde ~2-3 minutos até o status ficar **Ready**
6. O AI Studio fornecerá a URL pública (ex.: `https://sistema-xxxx-uc.a.run.app`)

> Depois do deploy, volte no Firebase (Passo 4.5) e adicione essa URL em **Authorized domains** para o login funcionar.

---

## Estrutura do projeto

```
sistema-aistudio/
├── index.html              # Entry HTML do Vite
├── package.json            # Dependências (Vite, React, Firebase, Gemini SDK)
├── metadata.json           # Metadados do AI Studio (declara Gemini API server-side)
├── server.ts               # Servidor Express + endpoint /api/suggest-prescription (Gemini)
├── vite.config.ts          # Config do Vite (React + Tailwind)
├── .env.example            # Modelo de variáveis de ambiente
├── firebase-applet-config.json  # Chaves do Firebase (troque pelas suas)
├── firebase-blueprint.json # Schema do Firestore
├── firestore.rules         # Regras de segurança do Firestore
└── src/
    ├── main.tsx            # Entry React
    ├── App.tsx             # App principal (login, sidebar, navegação)
    ├── index.css           # Estilos (cores bordô/dourado, sidebar, etc.)
    ├── firebase.ts         # Auth Google + token de acesso
    ├── types.ts            # Tipos TypeScript
    ├── constants.ts        # Procedimentos odontológicos + SVGs demo
    ├── lib/
    │   ├── drive.ts        # Integração Google Drive (planos, imagens, PDFs)
    │   ├── driveCrm.ts     # CRM no Drive
    │   └── calendar.ts     # Integração Google Calendar
    └── components/         # 15 componentes (Dashboard, CRM, Agenda, etc.)
```

---

## Variáveis de ambiente

| Variável | Onde obter | Para que serve |
|---|---|---|
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | IA de prescrições |
| `APP_URL` | Gerada após deploy (Cloud Run) | Links auto-referenciais |
| `PORT` | Auto (Cloud Run = 8080) | Porta do servidor |

> `GEMINI_API_KEY` e `APP_URL` são **injetadas automaticamente** pelo AI Studio em runtime.

---

## Comandos locais (para testar antes do deploy)

```bash
# Instalar dependências
bun install        # ou: npm install

# Rodar em desenvolvimento (Vite + Express na porta 3000)
bun run dev        # ou: npm run dev

# Build de produção
bun run build      # gera dist/ (frontend + server.cjs)

# Rodar produção
bun run start      # ou: node dist/server.cjs
```

> Para testar localmente com a IA funcionando, crie um arquivo `.env` com:
> ```
> GEMINI_API_KEY=sua_chave_aqui
> ```

---

## Verificação feita neste ambiente

- ✅ `bun install` — dependências instaladas
- ✅ `bun run build` — build do Vite + esbuild do servidor (sem erros)
- ✅ Servidor de produção sobe e serve o frontend (HTTP 200)
- ✅ Corrigido: porta agora lê `process.env.PORT` (compatível com Cloud Run)
- ✅ Corrigido: modelo Gemini atualizado para `gemini-2.5-flash`

---

## Problemas comuns

| Problema | Solução |
|---|---|
| Login Google não funciona | Adicione o domínio do app em Firebase → Authentication → Authorized domains |
| "Créditos da API esgotados" | Plano gratuito do Gemini excedido — ative faturamento no Google Cloud |
| Erro ao salvar no Drive | Habilite Google Drive API no Google Cloud Console |
| Agenda não carrega | Habilite Google Calendar API no Google Cloud Console |
| `gemini-3.5-flash` não encontrado | Já corrigido para `gemini-2.5-flash` neste pacote |
