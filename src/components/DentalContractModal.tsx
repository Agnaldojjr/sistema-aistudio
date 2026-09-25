import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Smartphone, 
  Download, 
  Loader2, 
  Check, 
  Edit3, 
  Eye, 
  Printer
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { PatientData, ClinicSettings, TreatmentProposal } from '../types';
import { fetchAddressByCep, formatCep } from '../lib/cep';

export interface DentalContractData {
  id: string;
  patientId?: string;
  patientName: string;
  cpf: string;
  rg: string;
  birthDate: string;
  profession: string;
  nationality: string;
  address: string;
  cep: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  
  // Responsável legal
  hasGuardian: boolean;
  guardianName: string;
  guardianKinship: string;
  guardianCpf: string;
  guardianRg: string;
  guardianPhone: string;
  guardianEmail: string;

  // Honorários
  totalAmount: number;
  totalAmountText: string;
  paymentConditions: string;

  // Local e data
  cityDate: string;
  contractDate: string;

  // Status
  status?: 'impresso' | 'assinado' | 'pendente' | 'aguardando_gov';
  signedFileUrl?: string;
  signedFileName?: string;
  signedAt?: string;
}

interface DentalContractModalProps {
  patientName: string;
  patientData?: PatientData;
  clinicSettings: ClinicSettings;
  proposal?: TreatmentProposal;
  suggestedValue?: number;
  onClose: () => void;
  onContractGenerated?: (contract: DentalContractData) => void;
}

// Utilitário para conversão de valores em reais por extenso
function numberToWordsBRL(num: number): string {
  if (!num || num <= 0) return '';
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  const converterCentena = (n: number) => {
    if (n === 100) return 'cem';
    let res = '';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;
    if (c > 0) res += centenas[c];
    if (d === 1) {
      if (res) res += ' e ';
      res += especiais[u];
      return res;
    }
    if (d > 1) {
      if (res) res += ' e ';
      res += dezenas[d];
    }
    if (u > 0) {
      if (res) res += ' e ';
      res += unidades[u];
    }
    return res;
  };

  const inteiro = Math.floor(num);
  const centavos = Math.round((num - inteiro) * 100);

  const milhares = Math.floor(inteiro / 1000);
  const resto = inteiro % 1000;

  const partes: string[] = [];

  if (milhares > 0) {
    if (milhares === 1) {
      partes.push('um mil');
    } else {
      partes.push(`${converterCentena(milhares)} mil`);
    }
  }

  if (resto > 0) {
    partes.push(converterCentena(resto));
  }

  let extenso = partes.join(resto > 0 && resto < 100 ? ' e ' : ' ');
  if (inteiro === 1) extenso += ' real';
  else if (inteiro > 1) extenso += ' reais';

  if (centavos > 0) {
    const centavosExtenso = converterCentena(centavos);
    extenso += (inteiro > 0 ? ' e ' : '') + `${centavosExtenso} ${centavos === 1 ? 'centavo' : 'centavos'}`;
  }

  return extenso;
}

export default function DentalContractModal({
  patientName,
  patientData,
  clinicSettings,
  proposal,
  suggestedValue = 0,
  onClose,
  onContractGenerated
}: DentalContractModalProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeDentistSignature, setIncludeDentistSignature] = useState(true);
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  const handleCepLookup = async (cepInput: string) => {
    const formatted = formatCep(cepInput);
    setFormData(prev => ({ ...prev, cep: formatted }));

    const clean = cepInput.replace(/\D/g, '');
    if (clean.length === 8) {
      setIsLoadingCep(true);
      try {
        const addr = await fetchAddressByCep(clean);
        if (addr) {
          setFormData(prev => ({
            ...prev,
            cep: addr.cep || formatted,
            address: addr.street ? `${addr.street}${addr.neighborhood ? ` - ${addr.neighborhood}` : ''}` : prev.address,
            city: addr.city || prev.city || 'Belo Horizonte',
            state: addr.state || prev.state || 'MG'
          }));
        }
      } catch (err) {
        console.warn('Erro ao buscar CEP:', err);
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  // Formata valor inicial
  const initialValue = suggestedValue > 0 ? suggestedValue : (proposal?.customDiscountAmount || 0);

  // Estados dos campos do contrato
  const [formData, setFormData] = useState<DentalContractData>(() => {
    const pd = patientData || {};
    const hasGuardian = Boolean(pd.respName || pd.respCpf);
    const today = new Date();
    const formattedDate = today.toLocaleDateString('pt-BR');

    const addressFull = [
      pd.street ? `${pd.street}${pd.number ? `, ${pd.number}` : ''}` : '',
      pd.complement,
      pd.neighborhood
    ].filter(Boolean).join(' - ') || '';

    const initialExtenso = initialValue > 0 ? ` (${numberToWordsBRL(initialValue)})` : '';

    return {
      id: `contrato_${Date.now()}`,
      patientId: (pd as any)?.id || '',
      patientName: patientName || (pd as any).name || '',
      cpf: pd.cpf || '',
      rg: pd.rg ? `${pd.rg}${pd.rgIssuer ? ` - ${pd.rgIssuer}` : ''}` : '',
      birthDate: pd.birthDate || '',
      profession: (pd as any).profession || 'Profissional Liberal',
      nationality: 'Brasileiro(a)',
      address: addressFull,
      cep: pd.cep || '',
      city: pd.city || 'Belo Horizonte',
      state: pd.state || 'MG',
      phone: pd.mobile || pd.phone || '',
      email: pd.email || '',

      hasGuardian,
      guardianName: pd.respName || '',
      guardianKinship: (pd as any).respKinship || 'Responsável Legal',
      guardianCpf: pd.respCpf || '',
      guardianRg: pd.respRg || '',
      guardianPhone: pd.respMobile || pd.respPhone || '',
      guardianEmail: (pd as any).respEmail || '',

      totalAmount: initialValue,
      totalAmountText: initialValue > 0 ? `R$ ${initialValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${initialExtenso}` : 'A combinar',
      paymentConditions: 'conforme datas e valores indicados no orçamento apresentado e aprovado que passa a fazer parte deste contrato como anexo',

      cityDate: `Belo Horizonte, ${formattedDate}`,
      contractDate: today.toISOString(),
      status: 'impresso'
    };
  });

  // Nome e documento de quem assinará (Paciente ou Responsável)
  const signerName = formData.hasGuardian && formData.guardianName ? formData.guardianName : formData.patientName;
  const signerCpf = formData.hasGuardian && formData.guardianCpf ? formData.guardianCpf : formData.cpf;
  const signerRole = formData.hasGuardian ? `Responsável Legal (${formData.guardianKinship || 'Grau de Parentesco'}) de ${formData.patientName}` : 'Paciente / Contratante';

  // Gerador de PDF Profissional Ultra-Compacto e Contínuo
  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 13; // Margem compacta (largura útil: 184mm) para evitar desperdício de papel
      const contentWidth = pageWidth - (margin * 2);

      const addHeader = (pageNum: number) => {
        doc.setFillColor(139, 0, 0); // Burgundy
        doc.rect(margin, 8, contentWidth, 0.6, 'F');

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(139, 0, 0);
        doc.text('CONSULTÓRIO ODONTOLÓGICO DR. AGNALDO FERREIRA', margin, 6.5);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(110, 110, 110);
        doc.text('CRO-MG 58714 • Belo Horizonte/MG', pageWidth - margin, 6.5, { align: 'right' });
      };

      const addFooter = (pageNum: number, totalPages: number) => {
        doc.setFillColor(210, 210, 210);
        doc.rect(margin, pageHeight - 11, contentWidth, 0.3, 'F');

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text('Rua dos Goitacazes, 375, Sala 1001, Centro - Belo Horizonte/MG • Tel: (31) 97568-5420 • dragnaldof@gmail.com', margin, pageHeight - 7);
        doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
      };

      let currentY = 15;

      // Função de quebra de página contínua e dinâmica (só quebra quando o espaço esgotar)
      const ensureSpace = (neededHeight: number) => {
        if (currentY + neededHeight > pageHeight - 14) {
          doc.addPage();
          currentY = 15;
        }
      };

      // TÍTULO DO CONTRATO
      doc.setFontSize(12.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(25, 25, 25);
      doc.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS', pageWidth / 2, currentY, { align: 'center' });
      currentY += 6;

      // QUALIFICAÇÃO DAS PARTES
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(139, 0, 0);
      doc.text('QUALIFICAÇÃO DAS PARTES', margin, currentY);
      currentY += 4;

      doc.setFontSize(7.8);
      doc.setTextColor(25, 25, 25);

      // CONTRATADO
      doc.setFont('helvetica', 'normal');
      const contratadoText = 'CONTRATADO: Agnaldo Luiz Ferreira Junior, Cirurgião-Dentista, Brasileiro, RG: 20068243, CRO-MG Nº: 58714, com consultório localizado à Rua dos Goitacazes, 375, Sala 1001, CEP: 30190-050, Cidade: Belo Horizonte, UF: MG, Telefone: (31) 97568-5420, E-mail: dragnaldof@gmail.com, doravante denominado simplesmente CONTRATADO.';
      const splitContratado = doc.splitTextToSize(contratadoText, contentWidth);
      ensureSpace((splitContratado.length * 3.25) + 2);
      doc.text(splitContratado, margin, currentY);
      currentY += (splitContratado.length * 3.25) + 2.5;

      // CONTRATANTE
      const contratanteText = `CONTRATANTE: ${formData.patientName || '__________________________________'}, Profissão: ${formData.profession || '_______________'}, Nacionalidade: ${formData.nationality || 'Brasileiro(a)'}, Data de Nascimento: ${formData.birthDate || '__________'}, CPF: ${formData.cpf || '_________________'}, RG: ${formData.rg || '_______________'}, residente e domiciliado(a) à ${formData.address || '__________________________________________________'}, CEP: ${formData.cep || '__________'}, Cidade: ${formData.city || 'Belo Horizonte'}, UF: ${formData.state || 'MG'}, Telefone: ${formData.phone || '_______________'}, E-mail: ${formData.email || '__________________________________'}, doravante denominado(a) simplesmente CONTRATANTE ou PACIENTE.`;
      const splitContratante = doc.splitTextToSize(contratanteText, contentWidth);
      ensureSpace((splitContratante.length * 3.25) + 2);
      doc.text(splitContratante, margin, currentY);
      currentY += (splitContratante.length * 3.25) + 2.5;

      // Responsável Legal (se aplicável)
      if (formData.hasGuardian && formData.guardianName) {
        const respText = `RESPONSÁVEL LEGAL: ${formData.guardianName}, Grau de Parentesco: ${formData.guardianKinship || 'Responsável'}, CPF: ${formData.guardianCpf || '_________________'}, RG: ${formData.guardianRg || '_______________'}, Telefone: ${formData.guardianPhone || '_______________'}, E-mail: ${formData.guardianEmail || '__________________________________'}.`;
        const splitResp = doc.splitTextToSize(respText, contentWidth);
        ensureSpace((splitResp.length * 3.25) + 2);
        doc.text(splitResp, margin, currentY);
        currentY += (splitResp.length * 3.25) + 2.5;
      }

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      ensureSpace(4);
      doc.text('Têm entre si justo e contratado, na melhor forma do direito, as seguintes cláusulas e condições:', margin, currentY);
      currentY += 4.5;

      // Helper para renderizar cláusulas com fluxo contínuo
      const renderClause = (title: string, paragraphs: string[]) => {
        const firstLines = doc.splitTextToSize(paragraphs[0] || '', contentWidth);
        const minBlock = 4 + (firstLines.length * 3.25) + 2;
        ensureSpace(minBlock);

        doc.setFontSize(8.2);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(139, 0, 0);
        doc.text(title, margin, currentY);
        currentY += 3.8;

        doc.setFontSize(7.8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(25, 25, 25);

        paragraphs.forEach((pText) => {
          const lines = doc.splitTextToSize(pText, contentWidth);
          const pHeight = lines.length * 3.25;
          ensureSpace(pHeight + 1.5);
          doc.text(lines, margin, currentY);
          currentY += pHeight + 2;
        });
      };

      // CLÁUSULA PRIMEIRA – DO OBJETIVO
      renderClause('CLÁUSULA PRIMEIRA – DO OBJETIVO', [
        'O objetivo do presente contrato constitui-se na prestação de serviços odontológicos, pelos profissionais do corpo clínico do CONTRATADO no endereço do consultório especificado no contrato ou em outro consultório indicado pelo CONTRATADO desde que previamente notificado ao paciente, de acordo com o plano de tratamento apresentado e aceito pelas partes, constando no prontuário do paciente e autoriza o uso das imagens do tratamento para divulgação em redes sociais.'
      ]);

      // CLÁUSULA SEGUNDA – DO VALOR E DO PAGAMENTO DOS HONORÁRIOS
      const valorFormatado = formData.totalAmount > 0 
        ? `R$ ${formData.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
        : formData.totalAmountText;
      
      renderClause('CLÁUSULA SEGUNDA – DO VALOR E DO PAGAMENTO DOS HONORÁRIOS', [
        `O valor total dos honorários profissionais, relativos aos serviços odontológicos prestados é de ${valorFormatado}, e seu pagamento deverá ser realizado ${formData.paymentConditions}.`,
        '§ 1º - O valor dos honorários, ora estipulado, poderá sofrer alteração, caso seja necessário modificar o plano de tratamento inicialmente aprovado, em face da constatação de questões técnicas ou outras intercorrências que inviabilizem sua execução, sendo necessário que as partes acordem, formalmente, os novos valores ajustados.',
        '§ 2º - Os pagamentos vencidos e efetuados fora dos prazos previstos, estarão sujeitos a atualização monetária e a multa de acordo com as taxas praticadas pela instituição geradora do boleto e em caso de inadimplência poderá ocorrer a negativação do CPF do devedor.',
        '§ 3º - Os recibos de pagamento deverão ser solicitados e fornecidos no momento da contratação do serviço sobre o valor pago do tratamento e não inclui o valor dos serviços relacionados a consulta de crédito, emissão de boleto, compensação bancária, cobrança, encargos por atraso e cadastro nos serviços de proteção ao crédito porque são serviços terceirizados e não fazem parte do tratamento.',
        '§ 4º - Não serão emitidos recibos em outra oportunidade, com o objetivo de evitar a duplicidade no recolhimento de impostos. Essa medida visa garantir a transparência e a conformidade fiscal, assegurando que todas as partes envolvidas estejam cientes e de acordo com as obrigações tributárias desde o início da prestação dos serviços.'
      ]);

      // CLÁUSULA TERCEIRA – DAS GARANTIAS
      renderClause('CLÁUSULA TERCEIRA – DAS GARANTIAS', [
        '§ 1º - O CONTRATADO declara que os tratamentos propostos e demais materiais utilizados possuem efetiva comprovação científica, respeitando o mais alto nível profissional e o estado atual da ciência.',
        '§ 2º - O paciente foi devidamente informado sobre propósitos, custos, riscos e alternativas de tratamento, bem como que a Odontologia não é uma ciência exata e que os resultados esperados a partir do diagnóstico poderão não se concretizar em face da resposta biológica individual de cada paciente e da própria limitação da ciência.'
      ]);

      // CLÁUSULA QUARTA – DAS OBRIGAÇÕES DO CORPO CLÍNICO
      renderClause('CLÁUSULA QUARTA – DAS OBRIGAÇÕES DO CORPO CLÍNICO', [
        'O corpo clínico se compromete a utilizar as técnicas mais modernas e eficazes e os materiais adequados à execução do plano de tratamento aprovado, assumir a responsabilidade pelos serviços prestados, resguardar a privacidade do paciente e o necessário sigilo, bem como zelar pela saúde e dignidade de forma humanizada, ética e consciente.'
      ]);

      // CLÁUSULA QUINTA – DAS OBRIGAÇÕES DO PACIENTE OU SEU RESPONSÁVEL
      renderClause('CLÁUSULA QUINTA – DAS OBRIGAÇÕES DO PACIENTE OU SEU RESPONSÁVEL', [
        '§ 1º - O paciente ou seu responsável se compromete a seguir rigorosamente as orientações do cirurgião-dentista, comunicando imediatamente qualquer alteração em decorrência do tratamento realizado, comparecer pontualmente às consultas marcadas, justificando as faltas com antecedência mínima de 24 horas.',
        'Parágrafo único – As faltas não justificadas, conforme preceitua a cláusula quinta deverão ser cobradas no valor vigente de uma consulta de emergência.',
        '§ 2º - Seguir rigorosamente as prescrições, encaminhamentos a outros especialistas da área odontológica ou profissionais de outras áreas de saúde e demais orientações fornecidas pelo(a) cirurgião-dentista, sob a pena de ser declarado interrompido o tratamento.',
        '§ 3º - O paciente deve se comportar de maneira adequada durante sua permanência na Clínica e informar ao cirurgião-dentista qualquer dúvida ou insatisfação sobre o tratamento em execução.',
        '§ 4º - Manter seus dados cadastrais sempre atualizados fornecendo comprovante de endereço e foto de documento oficial com foto, informando eventuais mudanças de endereço, telefone, e-mail ou outros dados que possam ajudar a localização do paciente.'
      ]);

      // CLÁUSULA SEXTA - DA DURAÇÃO DO CONTRATO
      renderClause('CLÁUSULA SEXTA - DA DURAÇÃO DO CONTRATO', [
        '§ 1º - O presente contrato tem duração pelo período necessário para a realização do tratamento, conforme informado no plano de tratamento aprovado, desde que o paciente compareça às consultas previamente agendadas.',
        'Parágrafo único – O tratamento proposto será realizado de acordo com a frequência com que o paciente comparecer às consultas, podendo ser mais rápido ou sofrer alguma prorrogação de acordo com eventual complexidade do caso bem como pela resposta biológica do paciente.'
      ]);

      // CLÁUSULA SÉTIMA – DA RESCISÃO
      renderClause('CLÁUSULA SÉTIMA – DA RESCISÃO', [
        'Este contrato poderá ser rescindido a qualquer tempo com comunicação por escrito, por qualquer uma das partes, sendo cobrado os valores de tabela vigente sem desconto relativos aos trabalhos realizados, mesmo que não totalmente concluídos.',
        '§ 1º - Será caracterizado o abandono de tratamento quando o paciente faltar a três consultas consecutivas ou se ausentar sem justificativa do consultório por mais de 45 dias, sendo neste caso considerado o contrato rescindido por iniciativa do paciente, ficando assim a Clínica isenta de qualquer responsabilidade desse ato.',
        '§ 2º - O paciente já se declara ciente de que o abandono de tratamento poderá acarretar prejuízos à sua saúde, inclusive com agravamento do estado inicial, não sendo necessária nova chamada do paciente para que o abandono seja caracterizado e os valores devidos devem ser quitados.',
        '§ 3º - Em consonância com o disposto no Artigo 5º, do Código de Ética Odontológica, durante o tratamento, ocorrendo fatos que à critério do Cirurgião-dentista, prejudiquem o bom relacionamento com o paciente ou pleno desempenho profissional, O CONTRATADO reserva o direito de renunciar ao atendimento do paciente mediante prévia comunicação e fornecendo todas as informações técnicas necessárias ao cirurgião-dentista sucessor.',
        '§ 4º - Em caso de desistência do tratamento mesmo antes de começar os procedimentos o consultório tem o direito de cobrar a consulta de avaliação no valor da tabela vigente e todos os encargos financeiros causados pela aprovação do tratamento e recolhimento de impostos.',
        '§ 5º - O estorno de cartões de débito e crédito somente é possível na hora da realização da transação e não é possível essa operação em outro momento devido aos custos operacionais e recolhimento de encargos, em caso de cancelamento do tratamento o consultório reserva o direito de cobrar todas as tarifas financeiras aplicadas bem como os impostos gerados nessa movimentação.',
        '§ 6º - O consultório não trabalha com reembolso de dinheiro, o cancelamento do contrato poderá ser ressarcido apenas com voucher contendo créditos no valor do saldo do pagamento realizado descontando os valores das consultas e procedimentos realizados.'
      ]);

      // CLÁUSULA OITAVA - FORO
      renderClause('CLÁUSULA OITAVA - FORO', [
        'Para dirimir quaisquer dúvidas sobre o presente contrato fica eleito o Foro da Comarca de Belo Horizonte, com exclusão de qualquer outro por mais privilegiado que seja. E por estarem de acordo com as condições acima descritas, assinam o presente contrato, em duas vias de igual teor, na presença de duas testemunhas, para que produza todos os efeitos legais.'
      ]);

      // Data de Fecho e Assinaturas
      ensureSpace(44);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(25, 25, 25);
      doc.text(formData.cityDate, margin, currentY);
      currentY += 12;

      // ==========================================
      // BLOCO DE ASSINATURAS (2 COLUNAS COMPACTAS)
      // ==========================================
      const colWidth = (contentWidth - 10) / 2;
      const col1X = margin;
      const col2X = margin + colWidth + 10;

      // COLUNA 1: PACIENTE / RESPONSÁVEL
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.4);
      doc.line(col1X + 4, currentY, col1X + colWidth - 4, currentY);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.text(signerName || 'CONTRATANTE / PACIENTE', col1X + (colWidth / 2), currentY + 3.8, { align: 'center' });

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70, 70, 70);
      doc.text(signerRole, col1X + (colWidth / 2), currentY + 7.2, { align: 'center' });
      doc.text(`CPF: ${signerCpf || '__________________'}`, col1X + (colWidth / 2), currentY + 10.5, { align: 'center' });

      // COLUNA 2: CIRURGIÃO-DENTISTA
      doc.setDrawColor(100, 100, 100);
      doc.line(col2X + 4, currentY, col2X + colWidth - 4, currentY);

      if (includeDentistSignature) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9.5);
        doc.setTextColor(139, 0, 0); // Burgundy
        doc.text('Dr. Agnaldo Ferreira', col2X + (colWidth / 2), currentY - 2.5, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(20, 20, 20);
        doc.text('Dr. Agnaldo Luiz Ferreira Junior', col2X + (colWidth / 2), currentY + 3.8, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(70, 70, 70);
        doc.text('Cirurgião-Dentista • CRO-MG 58714', col2X + (colWidth / 2), currentY + 7.2, { align: 'center' });
        doc.setTextColor(139, 0, 0);
        doc.text('CONTRATADO', col2X + (colWidth / 2), currentY + 10.5, { align: 'center' });
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(20, 20, 20);
        doc.text('Dr. Agnaldo Luiz Ferreira Junior', col2X + (colWidth / 2), currentY + 3.8, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(70, 70, 70);
        doc.text('Cirurgião-Dentista • CRO-MG 58714', col2X + (colWidth / 2), currentY + 7.2, { align: 'center' });
        doc.text('Carimbo e Assinatura', col2X + (colWidth / 2), currentY + 10.5, { align: 'center' });
      }

      currentY += 19;

      // TESTEMUNHAS
      doc.setDrawColor(160, 160, 160);
      doc.line(col1X + 4, currentY, col1X + colWidth - 4, currentY);
      doc.line(col2X + 4, currentY, col2X + colWidth - 4, currentY);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90, 90, 90);
      doc.text('Testemunha 1 (Nome e CPF)', col1X + (colWidth / 2), currentY + 3.5, { align: 'center' });
      doc.text('Testemunha 2 (Nome e CPF)', col2X + (colWidth / 2), currentY + 3.5, { align: 'center' });

      // Aplica cabeçalho e rodapé em todas as páginas geradas dinamicamente
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        addHeader(p);
        addFooter(p, totalPages);
      }

      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const safeName = (formData.patientName || 'Paciente').trim().replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Contrato_Odontologico_${safeName}.pdf`;

      return { blob: pdfBlob, url, filename };
    } catch (err) {
      console.error('Erro ao gerar contrato em PDF:', err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  // Impressão Direta na Impressora do Consultório (1 Clique)
  const handleDirectPrint = async () => {
    setIsGenerating(true);
    try {
      const { blob } = await generatePDF();
      const blobUrl = URL.createObjectURL(blob);

      if (onContractGenerated) {
        onContractGenerated(formData);
      }

      let printIframe = document.getElementById('print-contract-iframe') as HTMLIFrameElement;
      if (!printIframe) {
        printIframe = document.createElement('iframe');
        printIframe.id = 'print-contract-iframe';
        printIframe.style.position = 'fixed';
        printIframe.style.right = '0';
        printIframe.style.bottom = '0';
        printIframe.style.width = '0';
        printIframe.style.height = '0';
        printIframe.style.border = '0';
        document.body.appendChild(printIframe);
      }

      printIframe.src = blobUrl;
      printIframe.onload = () => {
        setTimeout(() => {
          try {
            printIframe.contentWindow?.focus();
            printIframe.contentWindow?.print();
          } catch (e) {
            window.open(blobUrl, '_blank')?.print();
          }
        }, 300);
      };
    } catch (e) {
      alert('Erro ao enviar o contrato para a impressora. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Baixar PDF
  const handleDownloadPDF = async () => {
    try {
      const { url, filename } = await generatePDF();
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (onContractGenerated) {
        onContractGenerated(formData);
      }
    } catch (e) {
      alert('Não foi possível gerar o PDF do contrato. Tente novamente.');
    }
  };

  // Enviar WhatsApp (Cópia Digital de Cortesia para o Paciente)
  const handleSendWhatsApp = async () => {
    try {
      const { url, filename, blob } = await generatePDF();

      if (onContractGenerated) {
        onContractGenerated(formData);
      }

      const recipientName = formData.hasGuardian && formData.guardianName ? formData.guardianName : formData.patientName;
      const cleanPhone = (formData.hasGuardian && formData.guardianPhone ? formData.guardianPhone : formData.phone).replace(/\D/g, '');

      const message = `Olá, *${recipientName}*! Tudo bem? Aqui é do consultório do *Dr. Agnaldo Ferreira*.

Estamos enviando para o seu arquivo pessoal uma cópia digital do seu *Contrato de Prestação de Serviços Odontológicos*.

Qualquer dúvida durante o seu tratamento, estamos à sua inteira disposição!`;

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'application/pdf' })] })) {
        try {
          await navigator.share({
            title: `Contrato Odontológico - ${recipientName}`,
            text: message,
            files: [new File([blob], filename, { type: 'application/pdf' })]
          });
          return;
        } catch (shareErr) {
          console.warn('Web Share cancelado ou não completado, usando fallback.', shareErr);
        }
      }

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const waUrl = cleanPhone && cleanPhone.length >= 10
        ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;

      setTimeout(() => {
        window.open(waUrl, '_blank');
      }, 600);

    } catch (e) {
      alert('Erro ao preparar envio do WhatsApp. Tente novamente.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/80 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden font-sans border border-zinc-200 w-full max-w-5xl h-[92vh]">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-[#FAF8F5] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8B0000]/10 flex items-center justify-center text-[#8B0000]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#8B0000]">
                Contrato Odontológico • Impressão e Assinatura
              </h2>
              <p className="text-xs text-zinc-500">
                Qualificação completa, cláusulas protetivas e impressão física direta
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'preview' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
              >
                <Eye className="w-3.5 h-3.5" />
                Prévia
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'edit' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar Dados
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors ml-2"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-100/60">
          {activeTab === 'edit' ? (
            /* MODO EDIÇÃO DOS CAMPOS */
            <div className="max-w-3xl mx-auto space-y-6">
              
              {/* Valor e Condições */}
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
                  <span className="text-xs font-bold text-[#8B0000] uppercase tracking-wider">
                    Cláusula Segunda • Honorários e Pagamento
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 mb-1">
                      Valor Total dos Honorários (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.totalAmount || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const ext = val > 0 ? ` (${numberToWordsBRL(val)})` : '';
                        setFormData(prev => ({
                          ...prev,
                          totalAmount: val,
                          totalAmountText: val > 0 ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${ext}` : 'A combinar'
                        }));
                      }}
                      placeholder="0,00"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-600 mb-1">
                      Descrição / Valor por Extenso (Gerado Automático)
                    </label>
                    <input
                      type="text"
                      value={formData.totalAmountText}
                      onChange={(e) => setFormData(prev => ({ ...prev, totalAmountText: e.target.value }))}
                      placeholder="Ex: R$ 3.500,00 (três mil e quinhentos reais)"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-zinc-600 mb-1">
                      Condições de Pagamento
                    </label>
                    <input
                      type="text"
                      value={formData.paymentConditions}
                      onChange={(e) => setFormData(prev => ({ ...prev, paymentConditions: e.target.value }))}
                      placeholder="Ex: em 3x sem juros no cartão de crédito conforme orçamento anexo"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20"
                    />
                    {/* Presets Rápidos de Pagamento em 1 Clique */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[
                        'à vista no PIX com desconto',
                        'em até 3x sem juros no cartão de crédito',
                        'em até 6x sem juros no cartão de crédito',
                        'em até 10x no cartão de crédito',
                        'conforme orçamento apresentado e aprovado anexo'
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, paymentConditions: preset }))}
                          className="px-2 py-0.5 bg-zinc-100 hover:bg-[#8B0000] text-zinc-700 hover:text-white rounded text-[11px] font-medium border border-zinc-200 transition-colors cursor-pointer"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dados do Paciente (Contratante) */}
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                  <span className="text-xs font-bold text-[#8B0000] uppercase tracking-wider">
                    Qualificação do Paciente / Contratante
                  </span>
                  <span className="text-[11px] text-zinc-400">Puxado da ficha</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Nome Completo</label>
                    <input
                      type="text"
                      value={formData.patientName}
                      onChange={(e) => setFormData(prev => ({ ...prev, patientName: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">CPF</label>
                    <input
                      type="text"
                      value={formData.cpf}
                      onChange={(e) => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
                      placeholder="000.000.000-00"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">RG</label>
                    <input
                      type="text"
                      value={formData.rg}
                      onChange={(e) => setFormData(prev => ({ ...prev, rg: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Data Nasc.</label>
                    <input
                      type="text"
                      value={formData.birthDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Profissão</label>
                    <input
                      type="text"
                      value={formData.profession}
                      onChange={(e) => setFormData(prev => ({ ...prev, profession: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Endereço Residencial</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1 flex items-center justify-between">
                      <span>CEP</span>
                      {isLoadingCep && (
                        <span className="text-[10px] text-[#8B0000] font-normal flex items-center gap-1 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder="00000-000"
                      maxLength={9}
                      value={formData.cep}
                      onChange={(e) => handleCepLookup(e.target.value)}
                      onBlur={(e) => handleCepLookup(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Cidade / UF</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        className="flex-1 px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553]"
                      />
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                        className="w-16 px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553] text-center uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">WhatsApp / Telefone</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553]"
                    />
                  </div>
                </div>
              </div>

              {/* Responsável Legal (Opcional / Menores) */}
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasGuardian}
                      onChange={(e) => setFormData(prev => ({ ...prev, hasGuardian: e.target.checked }))}
                      className="w-4 h-4 rounded text-[#8B0000] focus:ring-[#8B0000]"
                    />
                    <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                      Paciente Possui Responsável Legal (Menor ou Tutor)
                    </span>
                  </label>
                  {formData.hasGuardian && (
                    <span className="text-[11px] font-semibold text-zinc-700 bg-zinc-100 px-2.5 py-0.5 rounded border border-zinc-200">
                      Assina fisicamente no lugar do paciente
                    </span>
                  )}
                </div>

                {formData.hasGuardian && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-zinc-600 mb-1">Nome do Responsável</label>
                      <input
                        type="text"
                        value={formData.guardianName}
                        onChange={(e) => setFormData(prev => ({ ...prev, guardianName: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">Grau de Parentesco</label>
                      <input
                        type="text"
                        value={formData.guardianKinship}
                        onChange={(e) => setFormData(prev => ({ ...prev, guardianKinship: e.target.value }))}
                        placeholder="Ex: Mãe, Pai, Curador"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">CPF do Responsável</label>
                      <input
                        type="text"
                        value={formData.guardianCpf}
                        onChange={(e) => setFormData(prev => ({ ...prev, guardianCpf: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">RG do Responsável</label>
                      <input
                        type="text"
                        value={formData.guardianRg}
                        onChange={(e) => setFormData(prev => ({ ...prev, guardianRg: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">Telefone do Responsável</label>
                      <input
                        type="text"
                        value={formData.guardianPhone}
                        onChange={(e) => setFormData(prev => ({ ...prev, guardianPhone: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-[#C09553]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botão para voltar à Prévia */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="px-6 py-2.5 bg-[#8B0000] text-white text-xs font-bold rounded-xl hover:bg-[#6e0000] transition-colors"
                >
                  Concluir Edição e Ver Prévia
                </button>
              </div>
            </div>
          ) : (
            /* MODO PRÉVIA DO CONTRATO */
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Simulação Visual da Folha de Papel do Contrato */}
              <div className="bg-white rounded-2xl shadow-md border border-zinc-200 p-8 text-zinc-800 font-serif leading-relaxed text-xs sm:text-[13px] space-y-6">
                
                {/* Header */}
                <div className="text-center pb-4 border-b border-[#8B0000]/20 font-sans">
                  <h1 className="text-base sm:text-lg font-bold text-[#8B0000] tracking-wide">
                    CONTRATO DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS
                  </h1>
                  <p className="text-[11px] text-zinc-500 mt-1 uppercase tracking-wider">
                    Dr. Agnaldo Luiz Ferreira Junior • CRO-MG-58714
                  </p>
                </div>

                {/* Qualificação */}
                <div>
                  <h3 className="font-sans font-bold text-zinc-900 text-xs uppercase tracking-wider mb-2 text-[#8B0000]">
                    Qualificação das Partes
                  </h3>
                  <p className="mb-3 text-justify">
                    <strong>CONTRATADO:</strong> Agnaldo Luiz Ferreira Junior, Cirurgião-Dentista, Brasileiro, RG: 20068243, CRO-UF Nº: CRO-MG-58714, com consultório à Rua dos Goitacazes, 375, Sala 1001, CEP: 30190-050, Belo Horizonte/MG, Telefone: (31) 97568-5420, E-mail: dragnaldof@gmail.com.
                  </p>
                  <p className="mb-3 text-justify">
                    <strong>CONTRATANTE:</strong> {formData.patientName || '________________________'}, {formData.profession}, {formData.nationality}, Data de Nasc.: {formData.birthDate || '___/___/______'}, CPF: {formData.cpf || '_________________'}, RG: {formData.rg || '_______________'}, residente à {formData.address || '_________________________________'}, CEP: {formData.cep || '__________'}, {formData.city || 'Belo Horizonte'}/{formData.state || 'MG'}, Tel: {formData.phone || '_______________'}, E-mail: {formData.email || '_______________'}.
                  </p>
                  {formData.hasGuardian && formData.guardianName && (
                    <p className="mb-3 text-justify bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 text-xs">
                      <strong>Responsável Legal:</strong> {formData.guardianName}, Grau de Parentesco: {formData.guardianKinship}, CPF: {formData.guardianCpf}, RG: {formData.guardianRg}, Tel: {formData.guardianPhone}.
                    </p>
                  )}
                  <p className="italic text-zinc-600">
                    tem entre si contratado, na melhor forma do direito as seguintes condições:
                  </p>
                </div>

                {/* Cláusulas Resumidas na Prévia */}
                <div className="space-y-4 text-justify">
                  <div>
                    <h4 className="font-sans font-bold text-xs uppercase text-[#8B0000] mb-1">
                      Cláusula Primeira – Do Objetivo
                    </h4>
                    <p>
                      Prestação de serviços odontológicos pelo corpo clínico do CONTRATADO conforme plano de tratamento aceito no prontuário, incluindo autorização para uso de imagens do tratamento para divulgação em redes sociais.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-sans font-bold text-xs uppercase text-[#8B0000] mb-1">
                      Cláusula Segunda – Do Valor e dos Honorários
                    </h4>
                    <p className="bg-[#FAF8F5] p-3 rounded-xl border border-[#C09553]/30 font-semibold text-zinc-900">
                      Valor Total dos Honorários: <span className="text-[#8B0000] font-bold">{formData.totalAmount > 0 ? `R$ ${formData.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formData.totalAmountText}</span> ({formData.totalAmountText}).
                      <br />
                      <span className="text-xs font-normal text-zinc-600 mt-1 block">
                        Forma de Pagamento: {formData.paymentConditions}.
                      </span>
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      § 1º a § 4º: Regras de revisão por questões técnicas, juros por atraso, emissão única de recibos fiscais para conformidade tributária.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-sans font-bold text-xs uppercase text-[#8B0000] mb-1">
                      Cláusulas Terceira a Oitava (Garantias, Obrigações, Duração, Rescisão e Foro)
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-zinc-700 text-xs">
                      <li><strong>Garantias:</strong> Ciência biológica não exata, resposta individual de cada paciente com comprovação científica.</li>
                      <li><strong>Obrigações:</strong> Pontualidade e aviso prévio de 24h para faltas (falta sem aviso sujeita a taxa de emergência).</li>
                      <li><strong>Rescisão:</strong> Rescisão formal por escrito; abandono caracterizado após 3 faltas ou 45 dias sem comparecimento.</li>
                      <li><strong>Foro:</strong> Comarca de Belo Horizonte/MG.</li>
                    </ul>
                  </div>
                </div>

                {/* Bloco de Assinaturas Visual */}
                <div className="pt-6 border-t border-zinc-200">
                  <p className="font-sans text-xs font-bold text-zinc-800 mb-4 text-center">
                    {formData.cityDate}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
                    {/* Paciente / Contratante */}
                    <div className="p-4 rounded-2xl border border-zinc-200 bg-[#FAF8F5] text-center flex flex-col justify-between min-h-[120px]">
                      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                        Assinatura do Paciente / Contratante
                      </span>
                      <div className="my-2">
                        <div className="w-3/4 mx-auto border-b border-zinc-400 mb-2 mt-4"></div>
                        <p className="font-bold text-xs text-zinc-900">{signerName || 'Nome do Assinante'}</p>
                        <p className="text-[11px] text-zinc-500">CPF: {signerCpf || '000.000.000-00'}</p>
                        <p className="text-[10px] text-zinc-400">{signerRole}</p>
                      </div>
                      <span className="text-[9px] text-zinc-500 italic">
                        Assinatura física com caneta no papel
                      </span>
                    </div>

                    {/* Dr. Agnaldo */}
                    <div className="p-4 rounded-2xl border border-zinc-200 bg-[#FAF8F5] text-center flex flex-col justify-between min-h-[120px]">
                      <span className="text-[10px] font-bold text-[#8B0000] uppercase tracking-wider">
                        Assinatura do Profissional
                      </span>
                      <div className="my-2">
                        {includeDentistSignature ? (
                          <>
                            <p className="font-serif italic text-sm text-zinc-900 font-bold">Dr. Agnaldo Ferreira</p>
                            <p className="text-xs font-bold text-zinc-800">Dr. Agnaldo Luiz Ferreira Junior</p>
                            <p className="text-[11px] text-zinc-500">Cirurgião-Dentista • CRO-MG 58714</p>
                          </>
                        ) : (
                          <div className="my-2">
                            <div className="w-3/4 mx-auto border-b border-zinc-400 mb-2 mt-4"></div>
                            <p className="text-xs font-bold text-zinc-800">Dr. Agnaldo Luiz Ferreira Junior</p>
                            <p className="text-[10px] text-zinc-500">Carimbo e Assinatura Física</p>
                          </div>
                        )}
                      </div>
                      <span className={`text-[9px] font-semibold ${includeDentistSignature ? 'text-emerald-700' : 'text-zinc-500'}`}>
                        {includeDentistSignature ? '✓ Assinatura e Carimbo Pré-impressos' : 'Assinatura a caneta com carimbo'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Bottom Footer Actions */}
        <div className="p-4 border-t border-zinc-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-zinc-700 select-none text-xs hover:text-zinc-900">
            <input
              type="checkbox"
              checked={includeDentistSignature}
              onChange={(e) => setIncludeDentistSignature(e.target.checked)}
              className="w-4 h-4 text-[#8B0000] rounded focus:ring-[#8B0000] cursor-pointer"
            />
            <span>Assinatura/Carimbo do Dr. Agnaldo já impressos</span>
          </label>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={isGenerating}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#8B0000] text-white font-bold text-xs rounded-xl hover:bg-[#6e0000] transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              title="Enviar diretamente para a impressora do consultório"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4 text-[#C09553]" />}
              Imprimir Contrato
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className="w-full sm:w-auto px-4 py-2.5 bg-zinc-100 text-zinc-800 font-bold text-xs rounded-xl hover:bg-zinc-200 border border-zinc-300 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Baixar Contrato (PDF)
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={isGenerating}
              className="w-full sm:w-auto px-4 py-2.5 bg-[#25D366] text-white font-bold text-xs rounded-xl hover:bg-[#1ebd5b] transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
              Enviar no WhatsApp
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
