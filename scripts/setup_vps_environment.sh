#!/bin/bash
# setup_vps_environment.sh - Configuração do Agente Sentinela 24/7 na VPS Oracle
# Executado como usuário ubuntu na VPS Linux.

set -e

echo "=== [1/5] Atualizando pacotes de sistema ==="
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git python3 python3-pip python3-venv build-essential ufw

echo "=== [2/5] Instalando Node.js (LTS v20) ==="
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
sudo corepack enable

echo "=== [3/5] Instalando navegadores e dependências do Playwright ==="
# Instala as dependências necessárias para rodar o chromium headless no Ubuntu
npm install -g playwright
sudo npx playwright install-deps chromium
npx playwright install chromium

echo "=== [4/5] Configurando Regras de Firewall do Servidor ==="
# Bloquear acesso externo à porta 3000 (servidor dev) por segurança, liberando apenas local
if command -v ufw &> /dev/null; then
    sudo ufw allow ssh
    sudo ufw deny 3000/tcp
    sudo ufw --force enable
    echo "Firewall UFW habilitado: SSH liberado, Porta 3000 bloqueada externamente."
fi

echo "=== [5/5] Instalando Serviço Systemd para execução periódica ==="
# Criar diretório do systemd do usuário caso não exista
mkdir -p ~/.config/systemd/user

# Criar a definição do serviço systemd
cat << 'EOF' > ~/.config/systemd/user/sentinel-agent.service
[Unit]
Description=Agente Sentinela UX e Qualidade 24/7
After=network.target

[Service]
Type=oneshot
WorkingDirectory=%h/sistema-aistudio
ExecStart=/usr/bin/python3 scripts/vps_agent_loop.py
EnvironmentFile=%h/sistema-aistudio/.env

[Install]
WantedBy=default.target
EOF

# Criar a definição do timer do systemd (roda a cada 3 horas)
cat << 'EOF' > ~/.config/systemd/user/sentinel-agent.timer
[Unit]
Description=Timer para rodar o Agente Sentinela a cada 3 horas

[Timer]
OnBootSec=10min
OnUnitActiveSec=3h
Unit=sentinel-agent.service

[Install]
WantedBy=timers.target
EOF

# Recarrega os daemons do systemd de usuário
systemctl --user daemon-reload
systemctl --user enable sentinel-agent.timer
systemctl --user start sentinel-agent.timer

echo "================================================================="
echo " Configuração básica do ambiente VPS finalizada com sucesso!    "
echo "================================================================="
echo " ATENÇÃO: É obrigatório configurar o arquivo .env no servidor!  "
echo " Acesse a pasta do projeto na VPS e crie um arquivo '.env' com: "
echo ""
echo " GEMINI_API_KEY=\"sua_chave_do_gemini\""
echo " GITHUB_TOKEN=\"seu_github_token_com_escopo_repo\""
echo " VITE_ENABLE_AUTH_BYPASS=\"true\""
echo ""
echo " Para verificar se o timer está ativo, execute na VPS:"
echo "   systemctl --user list-timers --all"
echo " Para ver logs da execução do agente:"
echo "   journalctl --user -u sentinel-agent.service -f"
echo "================================================================="
