export const config = { runtime: 'edge' };
import { createClient } from "@supabase/supabase-js";

export default async (req: Request) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const { reportId } = await req.json();
    if (!reportId) {
      return new Response(JSON.stringify({ error: "reportId é obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const userId = process.env.DEFAULT_USER_ID || "";
    const githubToken = process.env.GITHUB_TOKEN || "";

    if (!supabaseUrl || !supabaseKey || !userId) {
      return new Response(JSON.stringify({ error: "Credenciais do Supabase não configuradas." }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Read current CRM data
    const { data, error } = await supabase
      .from("clinic_data")
      .select("crm_data")
      .eq("user_id", userId)
      .single();

    if (error) throw error;

    const crmData = data?.crm_data || {};
    const reports = crmData.sentinelReports || [];
    const rIdx = reports.findIndex((r: any) => r.id === reportId);

    if (rIdx === -1) {
      return new Response(JSON.stringify({ error: "Relatório não localizado" }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const report = reports[rIdx];

    if (!report.file || !report.proposedFix) {
      return new Response(JSON.stringify({ error: "Caminho do arquivo ou correção proposta ausentes" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Create PR on GitHub using the GitHub API
    if (githubToken) {
      const owner = "Agnaldojjr";
      const repo = "sistema-aistudio";
      const branchName = `fix/sentinel-${reportId.slice(0, 8)}-${Date.now()}`;
      const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
      const headers = {
        "Authorization": `Bearer ${githubToken}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      };

      // 1. Get main branch SHA
      const mainRef = await fetch(`${apiBase}/git/refs/heads/main`, { headers });
      const mainRefData = await mainRef.json();
      const mainSha = mainRefData.object?.sha;

      if (!mainSha) {
        return new Response(JSON.stringify({ error: "Não foi possível obter a referência da branch main." }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      // 2. Create new branch
      await fetch(`${apiBase}/git/refs`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainSha }),
      });

      // 3. Get current file to obtain its SHA
      const filePath = report.file.replace(/^\//, "").replace(/\\/g, "/");
      const fileRes = await fetch(`${apiBase}/contents/${filePath}?ref=main`, { headers });
      const fileData = await fileRes.json();

      // 4. Update file on the new branch
      const encodedContent = btoa(unescape(encodeURIComponent(report.proposedFix)));
      await fetch(`${apiBase}/contents/${filePath}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `fix(sentinel): correção automática - ${report.message || reportId}`,
          content: encodedContent,
          branch: branchName,
          sha: fileData.sha,
        }),
      });

      // 5. Create Pull Request
      const prRes = await fetch(`${apiBase}/pulls`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: `🤖 Sentinel Fix: ${report.message || reportId}`,
          body: `## Correção Automática do Agente Sentinela\n\n**Erro detectado:** ${report.message}\n**Arquivo:** \`${report.file}\`\n**Linha:** ${report.line || 'N/A'}\n**Timestamp:** ${report.timestamp}\n\n---\n*Pull Request criado automaticamente pelo Agente Sentinela de UX.*`,
          head: branchName,
          base: "main",
        }),
      });
      const prData = await prRes.json();

      // 6. Update report status in Supabase
      reports[rIdx].status = "applied";
      reports[rIdx].prUrl = prData.html_url || "";
      crmData.sentinelReports = reports;

      await supabase
        .from("clinic_data")
        .update({ crm_data: crmData, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      return new Response(JSON.stringify({
        success: true,
        message: "Correção enviada como Pull Request no GitHub!",
        prUrl: prData.html_url || "",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({ error: "GITHUB_TOKEN não configurado." }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error: any) {
    console.error("Apply Fix Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno ao aplicar correção." }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
};
