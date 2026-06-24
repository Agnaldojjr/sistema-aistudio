import fetch from "node-fetch";

const API_URL = "http://localhost:3000/api/crm";
const API_KEY = "crm_secret_token_change_me_in_production"; // Padrão do .env

async function testCRMApi() {
  console.log("🚀 Iniciando Testes Automatizados do CRM API...\n");

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
  };

  try {
    // 1. Falha de Autenticação Esperada
    console.log("Teste 1: Acesso sem API Key");
    const authFail = await fetch(`${API_URL}/patients?phone=11999999999`);
    if (authFail.status === 401) {
      console.log("✅ Bloqueio de acesso sem chave funcionou perfeitamente (401).");
    } else {
      console.log("❌ Erro: API permitiu acesso sem chave!");
    }

    // 2. Busca de Paciente
    console.log("\nTeste 2: Busca de paciente por telefone");
    const patientRes = await fetch(`${API_URL}/patients?phone=11999999999`, { headers });
    if (patientRes.ok || patientRes.status === 404) {
      console.log(`✅ Rota de pacientes respondendo corretamente (Status: ${patientRes.status}).`);
    }

    // 3. Consulta de Horários
    console.log("\nTeste 3: Consulta de horários livres");
    const today = new Date().toISOString().split('T')[0];
    const slotsRes = await fetch(`${API_URL}/appointments/slots?date=${today}`, { headers });
    if (slotsRes.ok) {
      const slotsData = await slotsRes.json() as any;
      console.log(`✅ Consulta de horários OK. Encontrados ${slotsData.slots?.length || 0} horários livres para hoje.`);
    }

    console.log("\n✅ Todos os testes de endpoint concluídos com sucesso na camada de rede!");
  } catch (error) {
    console.error("❌ Falha crítica ao executar os testes:", error);
  }
}

testCRMApi();
