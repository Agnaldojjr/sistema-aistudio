#!/bin/bash
# scripts/backup_cron.sh
# Faz backup dos dados do CRM usando a API REST do Supabase
# Mantém os últimos 14 backups (7 dias rodando de 12 em 12h)

# Entrar no diretório do projeto
cd "$(dirname "$0")/.." || exit 1

# Carregar variáveis do .env na raiz do projeto (ignorando erros de sintaxe no env)
set -a
source .env 2>/dev/null
set +a

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "ERRO: VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao definidos no .env"
    exit 1
fi

BACKUP_DIR="$HOME/.crm-backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/crm_backup_$TIMESTAMP.json"

echo "Iniciando backup em $TIMESTAMP..."

# Remover aspas extras caso existam nas variáveis
CLEAN_URL=$(echo "$VITE_SUPABASE_URL" | tr -d '"')
CLEAN_KEY=$(echo "$SUPABASE_SERVICE_ROLE_KEY" | tr -d '"')

curl -s -X GET "${CLEAN_URL}/rest/v1/clinic_data?select=*" \
  -H "apikey: ${CLEAN_KEY}" \
  -H "Authorization: Bearer ${CLEAN_KEY}" \
  -o "$BACKUP_FILE"

# Verifica se o arquivo foi gerado e tem mais que 10 bytes (tamanho minimo para JSON vazio ou invalido)
if [ -s "$BACKUP_FILE" ] && [ $(wc -c < "$BACKUP_FILE") -gt 10 ]; then
    echo "Backup salvo com sucesso em $BACKUP_FILE"
    
    # Mantém apenas os últimos 14 backups (7 dias)
    ls -t "$BACKUP_DIR"/crm_backup_*.json | tail -n +15 | xargs -r rm --
    echo "Limpeza de backups antigos concluida."
else
    echo "ERRO: Falha ao fazer o download do backup ou o arquivo esta vazio/invalido."
    rm -f "$BACKUP_FILE" # Remove o arquivo defeituoso para nao contar no limite
    exit 1
fi
