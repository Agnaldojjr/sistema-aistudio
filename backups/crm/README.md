# 🛡️ Diretório de Backups Imutáveis do CRM

Este diretório contém os pontos de restauração históricos do CRM da clínica.

## 🔒 Regras de Proteção e Imutabilidade
1. **Nenhum arquivo neste diretório é sobreposto ou excluído**.
2. Cada snapshot possui carimbo de data único (`crm_backup_YYYY-MM-DD.json`).
3. O índice de todos os backups é mantido em `backup_index.json`.
4. Os backups são executados automaticamente semanalmente pelo **GitHub Actions** (todo domingo às 03:00 UTC) e também podem ser gerados manualmente a qualquer momento.

---

## 🚀 Como gerar um novo backup manual imediatamente
No terminal, execute:
```bash
npm run backup:crm
```
Isso vai:
- Ler a base atual do Supabase.
- Validar a integridade (impedindo salvar se a base estiver vazia).
- Gerar um novo arquivo imutável `crm_backup_YYYY-MM-DD.json`.
- Commitar e enviar automaticamente para o GitHub.

---

## 🔄 Como restaurar qualquer backup anterior
Para restaurar o snapshot mais recente:
```bash
npm run restore:crm
```

Para restaurar um snapshot específico:
```bash
npx tsx scripts/restore_from_backup.ts crm_backup_2026-10-07.json
```
Isso carrega os dados e sincroniza diretamente no Supabase em ambas as contas de forma segura.
