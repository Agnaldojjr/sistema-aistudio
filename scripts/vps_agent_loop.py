#!/usr/bin/env python3
import os
import sys
import json
import time
import subprocess
import urllib.request
import urllib.parse
from datetime import datetime

# Configurações do Repositório e Servidor
PORT = 3000
HOST = "127.0.0.1"
DEV_URL = "https://sistema-aistudio.vercel.app"
REPORTS_FILE = "sentinel_reports.json"

# Garantir codificação UTF-8
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass

def log(msg):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}")

def check_server_up():
    """Tenta conectar ao servidor de desenvolvimento local"""
    for _ in range(15):
        try:
            with urllib.request.urlopen(f"{DEV_URL}/?bypass_auth=true", timeout=2) as response:
                if response.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(2)
    return False

def call_gemini_api(prompt):
    """Chama a API do Gemini via REST puro para evitar dependência de pacotes"""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        log("ERRO: Variável de ambiente GEMINI_API_KEY ausente.")
        return None
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    payload = {
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    try:
        req = urllib.request.Request(
            url, 
            data=json.dumps(payload).encode("utf-8"), 
            headers=headers, 
            method="POST"
        )
        with urllib.request.urlopen(req) as res:
            res_data = json.loads(res.read().decode("utf-8"))
            text_response = res_data["candidates"][0]["content"]["parts"][0]["text"]
            return text_response
    except Exception as e:
        log(f"Falha ao chamar API do Gemini: {e}")
        return None

def open_github_pull_request(branch_name, title, body):
    """Cria um Pull Request no GitHub usando a API REST oficial"""
    github_token = os.environ.get("GITHUB_TOKEN")
    if not github_token:
        log("AVISO: GITHUB_TOKEN ausente. Pulando a criação automática do PR.")
        return False
        
    # Obtém o dono/repositório a partir do git remote
    try:
        remote_url = subprocess.check_output(["git", "config", "--get", "remote.origin.url"], text=True).strip()
        # Ex: https://github.com/Agnaldojjr/sistema-aistudio.git ou git@github.com:Agnaldojjr/sistema-aistudio.git
        if "github.com" in remote_url:
            repo_path = remote_url.split("github.com/")[-1].replace(".git", "")
            if ":" in repo_path:
                repo_path = repo_path.split(":")[-1]
        else:
            log("Erro: Não foi possível inferir o dono/repositório a partir do git remote.")
            return False
    except Exception as e:
        log(f"Erro ao obter URL do repositório: {e}")
        return False

    url = f"https://api.github.com/repos/{repo_path}/pulls"
    headers = {
        "Authorization": f"token {github_token}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
    }
    
    payload = {
        "title": title,
        "head": branch_name,
        "base": "main",
        "body": body
    }
    
    try:
        req = urllib.request.Request(
            url, 
            data=json.dumps(payload).encode("utf-8"), 
            headers=headers, 
            method="POST"
        )
        with urllib.request.urlopen(req) as res:
            res_data = json.loads(res.read().decode("utf-8"))
            log(f"Pull Request criado com sucesso: {res_data.get('html_url')}")
            return True
    except Exception as e:
        log(f"Erro ao abrir Pull Request na API do GitHub: {e}")
        return False

def save_report(message, stack, file_path, line):
    """Salva a falha no sentinel_reports.json do projeto"""
    new_report = {
        "id": f"vps_{int(time.time())}",
        "timestamp": datetime.now().isoformat(),
        "message": message,
        "stack": stack,
        "url": DEV_URL,
        "userAgent": "Playwright Headless Chrome (VPS)",
        "file": file_path,
        "line": line,
        "status": "pending",
        "diagnosis": "",
        "proposedFix": ""
    }
    
    reports = []
    if os.path.exists(REPORTS_FILE):
        try:
            with open(REPORTS_FILE, "r", encoding="utf-8") as f:
                reports = json.load(f)
        except Exception:
            pass
            
    reports.insert(0, new_report)
    with open(REPORTS_FILE, "w", encoding="utf-8") as f:
        json.dump(reports[:100], f, indent=2, ensure_ascii=False)
    
    # Sync to Supabase so reports are visible on the Vercel production site
    sync_reports_to_supabase(reports[:100])
        
    return new_report

def sync_reports_to_supabase(reports):
    """Sincroniza os relatórios do Sentinel com o Supabase para exibição na Central IA em produção"""
    supabase_url = os.environ.get("VITE_SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    user_id = os.environ.get("DEFAULT_USER_ID", "")
    
    if not supabase_url or not supabase_key or not user_id:
        log("AVISO: Credenciais do Supabase ausentes. Relatórios não sincronizados com a nuvem.")
        return
    
    try:
        # 1. Read current crm_data
        read_url = f"{supabase_url}/rest/v1/clinic_data?user_id=eq.{user_id}&select=crm_data"
        read_headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json"
        }
        req = urllib.request.Request(read_url, headers=read_headers)
        with urllib.request.urlopen(req) as res:
            rows = json.loads(res.read().decode("utf-8"))
        
        crm_data = rows[0]["crm_data"] if rows else {}
        crm_data["sentinelReports"] = reports
        
        # 2. Upsert back to Supabase
        write_url = f"{supabase_url}/rest/v1/clinic_data?user_id=eq.{user_id}"
        write_headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        payload = json.dumps({"crm_data": crm_data, "updated_at": datetime.now().isoformat()}).encode("utf-8")
        req = urllib.request.Request(write_url, data=payload, headers=write_headers, method="PATCH")
        urllib.request.urlopen(req)
        
        log("Relatórios sincronizados com o Supabase (produção).")
    except Exception as e:
        log(f"AVISO: Falha ao sincronizar relatórios com o Supabase: {e}")

def main():
    log("Iniciando auditoria 24/7 de experiência do usuário...")
    
    # 1. Git pull na branch corrente
    try:
        log("Sincronizando repositório com o GitHub...")
        subprocess.run(["git", "pull"], check=True)
    except Exception as e:
        log(f"Erro ao sincronizar repositório: {e}")
        # Prossegue com o código local existente
        
    # 2. Configura ambiente para testar a Vercel
    dev_process = None
    try:
        log(f"Testando ambiente de produção na Vercel: {DEV_URL}...")
        env = os.environ.copy()
        env["TEST_BASE_URL"] = f"{DEV_URL}/?bypass_auth=true"

        # 3. Executa testes E2E Playwright
        log("Executando suíte de testes UX...")
        # Gera relatório em JSON
        report_json_path = "playwright-report.json"
        
        # Remove relatório anterior se houver
        if os.path.exists(report_json_path):
            os.remove(report_json_path)
            
        test_res = subprocess.run([
            "npx", "playwright", "test", "tests/ux_flow.test.ts", 
            "--reporter=json"
        ], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        if test_res.returncode == 0:
            log("Sucesso! Todos os testes de UX passaram. O site está estável.")
            sys.exit(0)
            
        log("Alerta! Falha de UX detectada pela suíte Playwright.")
        
        # 4. Lê o relatório de erro
        if not os.path.exists(report_json_path):
            # Tenta sem o JSON caso Playwright falhe antes de gerar o relatório
            log("Erro: Relatório do Playwright não gerado.")
            sys.exit(1)
            
        with open(report_json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # Pega a primeira falha relevante
        failure = None
        for suite in data.get("suites", []):
            for spec in suite.get("specs", []):
                for test_item in spec.get("tests", []):
                    for result in test_item.get("results", []):
                        if result.get("status") == "failed":
                            error = result.get("errors", [{}])[0]
                            failure = {
                                "title": spec.get("title"),
                                "message": error.get("message"),
                                "stack": error.get("stack"),
                                "location": error.get("location", {})
                            }
                            break
                    if failure: break
                if failure: break
            if failure: break
            
        if not failure:
            log("Nenhum erro estruturado encontrado no JSON do relatório.")
            sys.exit(1)
            
        error_msg = failure["message"]
        error_stack = failure["stack"]
        # Encontra o arquivo e linha a partir da stack trace
        file_path = ""
        line_no = 0
        
        import re
        src_match = re.search(r"src/[a-zA-Z0-9_\/.-]+:\d+", error_stack or "")
        if src_match:
            parts = src_match.group(0).split(":")
            file_path = parts[0]
            line_no = int(parts[1])
        else:
            # Fallback para o arquivo do teste
            file_path = failure["location"].get("file", "")
            line_no = failure["location"].get("line", 0)
            # Remove caminho absoluto se houver
            file_path = file_path.split("sistema-aistudio/")[-1]
            
        log(f"Falha localizada no arquivo: {file_path}:{line_no}")
        log(f"Erro: {error_msg}")
        
        # Salva o relatório de erro no sentinel_reports.json
        report_data = save_report(error_msg, error_stack, file_path, line_no)
        
        # 5. Aciona o Gemini para propor e aplicar correção
        if not file_path or not os.path.exists(file_path):
            log("Erro: Arquivo do erro não existe ou não pôde ser localizado localmente.")
            sys.exit(1)
            
        with open(file_path, "r", encoding="utf-8") as file_f:
            file_content = file_f.read()
            
        prompt = f"""Analise este erro de execução capturado em testes E2E na aplicação React/Vite.
Mensagem do erro: {error_msg}
Stack trace: {error_stack}
Arquivo alvo: {file_path} (linha {line_no})

Aqui está o conteúdo atual do arquivo:
```typescript
{file_content}
```

Escreva a correção completa para resolver esse bug. Responda em português simples e fácil no campo "explanation" e forneça o código completo do arquivo corrigido no campo "filePatch".
Você DEVE responder rigorosamente no formato JSON com esta estrutura:
{{
  "explanation": "Explicação simples em português de leigo sobre o erro e o que foi feito para corrigir",
  "rootCause": "Causa raiz técnica simplificada",
  "filePatch": "Código completo corrigido do arquivo, sem omissões"
}}"""
        
        log("Consultando o Gemini AI para diagnóstico e patch de correção...")
        gemini_res = call_gemini_api(prompt)
        if not gemini_res:
            log("Não foi possível obter resposta de correção da IA.")
            sys.exit(1)
            
        try:
            parsed = json.loads(gemini_res)
            explanation = parsed.get("explanation", "")
            proposed_fix = parsed.get("filePatch", "")
            
            # Atualiza o diagnóstico e a correção no sentinel_reports
            with open(REPORTS_FILE, "r", encoding="utf-8") as f:
                all_reports = json.load(f)
            if all_reports and all_reports[0]["id"] == report_data["id"]:
                all_reports[0]["diagnosis"] = explanation
                all_reports[0]["proposedFix"] = proposed_fix
                with open(REPORTS_FILE, "w", encoding="utf-8") as f:
                    json.dump(all_reports, f, indent=2, ensure_ascii=False)
                # Sync updated reports to Supabase
                sync_reports_to_supabase(all_reports)
                    
            log(f"Diagnóstico da IA: {explanation}")
            
            # 6. Criar nova branch e aplicar o patch para validar
            bug_id = report_data["id"]
            branch_name = f"fix/ux-bug-{bug_id}"
            
            log(f"Criando branch de trabalho temporária {branch_name}...")
            subprocess.run(["git", "checkout", "-b", branch_name], check=True)
            
            # Backup do arquivo original
            backup_path = f"{file_path}.bak"
            with open(backup_path, "w", encoding="utf-8") as f:
                f.write(file_content)
                
            # Aplica o patch
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(proposed_fix)
                
            log("Código corrigido. Executando testes locais de integridade...")
            
            # Inicia servidor local para validação
            log(f"Iniciando o servidor local em http://{HOST}:{PORT} para validar a correção...")
            env_val = os.environ.copy()
            env_val["PORT"] = str(PORT)
            env_val["HOST"] = HOST
            env_val["VITE_ENABLE_AUTH_BYPASS"] = "true"
            # Assegura que o teste de validação rodará contra o localhost, e não Vercel
            env_val["TEST_BASE_URL"] = f"http://{HOST}:{PORT}/?bypass_auth=true"
            
            val_process = subprocess.Popen(
                ["npm", "run", "dev"], 
                env=env_val, 
                stdout=subprocess.DEVNULL, 
                stderr=subprocess.DEVNULL
            )
            
            # Pequeno delay para servidor iniciar
            time.sleep(5)
            
            # Executa verify_all.py com a url local
            verify_res = subprocess.run([sys.executable, ".agents/scripts/verify_all.py", ".", "--url", f"http://{HOST}:{PORT}"], text=True, env=env_val)
            
            # Encerra o servidor de validação
            val_process.terminate()
            val_process.wait()

            if verify_res.returncode == 0:
                log("Sucesso! O patch de correção foi validado localmente pelo verify_all.")
                
                # Envia para o repositório remoto
                log("Enviando correção ao GitHub...")
                subprocess.run(["git", "add", file_path, REPORTS_FILE], check=True)
                subprocess.run(["git", "commit", "-m", f"sentinel: correção automatizada {bug_id}"], check=True)
                subprocess.run(["git", "push", "origin", branch_name], check=True)
                
                # Abre o Pull Request
                title = f"fix(sentinel): correção automática do erro de UX ({bug_id})"
                body = f"""### 🤖 Pull Request Automático - Agente Sentinela VPS

O agente de testes UX 24/7 detectou a seguinte falha de execução:
> **Erro:** `{error_msg}`
> **Arquivo:** `{file_path}:{line_no}`

#### 📝 Diagnóstico e Ações do Agente:
{explanation}

#### 🧪 Validação:
- Executado testes locais no servidor Oracle VPS contra instância dev.
- Validação por `verify_all.py` retornou sucesso."""
                
                open_github_pull_request(branch_name, title, body)
                
            else:
                log("Falha! O código corrigido não passou na integridade local. Revertendo alterações.")
                # Restaura backup
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(file_content)
                if os.path.exists(backup_path):
                    os.remove(backup_path)
                    
            # Volta para a branch original
            subprocess.run(["git", "checkout", "-"], check=True)
            subprocess.run(["git", "branch", "-D", branch_name], check=True)
            
        except Exception as e:
            log(f"Falha ao processar correção sugerida pelo Gemini: {e}")
            
    finally:
        # Garante que o servidor Node/Vite seja encerrado mesmo sob falha catastrófica
        if dev_process:
            log("Encerrando servidor local de desenvolvimento (limpeza)...")
            dev_process.terminate()
            dev_process.wait()
            log("Limpeza concluída.")

if __name__ == "__main__":
    main()
