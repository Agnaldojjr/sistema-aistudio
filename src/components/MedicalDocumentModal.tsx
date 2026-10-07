import React, { useState } from 'react';
import { X, FileText, Smartphone, Download, Loader2, Sparkles, ChevronRight, Plus, Printer, Check } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { PatientData, ClinicSettings } from '../types';
import letterheadTemplateA4 from '../assets/receituario_template_a4.png';

interface MedicalDocumentModalProps {
  type: 'receituario' | 'atestado' | 'declaracao';
  patientName: string;
  patientData: PatientData;
  clinicSettings: ClinicSettings;
  onClose: () => void;
  onEmit?: (data: { arrivalTime: string, departureTime: string }) => void;
  initialArrivalTime?: string;
  initialDepartureTime?: string;
}

const DRUGS = [
  { class: 'Analgésicos', name: 'Dipirona Sódica 500mg', posology: 'Tomar 1 comprimido de 6 em 6 horas se houver dor.' },
  { class: 'Analgésicos', name: 'Dipirona Sódica 1g', posology: 'Tomar 1 comprimido de 6 em 6 horas se houver dor forte.' },
  { class: 'Analgésicos', name: 'Paracetamol 750mg', posology: 'Tomar 1 comprimido de 6 em 6 horas se houver dor.' },
  { class: 'AINEs', name: 'Ibuprofeno 400mg', posology: 'Tomar 1 comprimido de 8 em 8 horas por 3 dias.' },
  { class: 'AINEs', name: 'Ibuprofeno 600mg', posology: 'Tomar 1 comprimido de 8 em 8 horas por 3 dias.' },
  { class: 'AINEs', name: 'Nimesulida 100mg', posology: 'Tomar 1 comprimido de 12 em 12 horas por 3 a 5 dias.' },
  { class: 'Corticosteroides', name: 'Dexametasona 4mg', posology: 'Tomar 1 comprimido a cada 12 horas, nas primeiras 24 a 48 horas.' },
  { class: 'Antibióticos', name: 'Amoxicilina 500mg', posology: 'Tomar 1 comprimido de 8 em 8 horas por 7 dias.' },
  { class: 'Antibióticos', name: 'Amoxicilina+Clavulanato 875/125mg', posology: 'Tomar 1 comprimido de 8 em 8 horas por 7 a 10 dias.' },
  { class: 'Antibióticos', name: 'Azitromicina 500mg', posology: 'Tomar 1 comprimido ao dia por 3 a 5 dias.' },
  { class: 'Analgésicos Opioides', name: 'Tramadol 50mg', posology: 'Tomar 1 comprimido de 6 em 6 horas em caso de dor intratável.' },
  { class: 'Analgésicos Opioides', name: 'Paracetamol + Codeína', posology: 'Tomar 1 comprimido de 6 em 6 horas.' },
  { class: 'Uso Externo', name: 'Digluconato de Clorexidina 0,12%', posology: 'Bochechar 15 mL por 1 minuto, 2 vezes ao dia (após 24h).' },
  { class: 'Lesões Orais', name: 'Triancinolona Acetonida 1 mg/g', posology: 'Aplicar pequena quantidade (6 mm) sobre a lesão, sem esfregar. 2 a 3x ao dia, preferencialmente após as refeições e à noite. Evitar comer/beber por 30 min após (máx 7 dias).' },
  { class: 'Lesões Orais', name: 'Pomada Orabase (Gingilone)', posology: 'Friccionar uma pequena quantidade no local afetado, 3 a 6 vezes ao dia até alívio dos sintomas (até 1 semana).' },
  { class: 'Enxaguatórios', name: 'Fluoreto de Sódio 0,05% (Diário)', posology: 'Bochechar 10 a 20 mL por 1 minuto, 1 a 2x ao dia. Não engolir, não enxaguar com água e evitar comer/beber por 30 min.' },
  { class: 'Enxaguatórios', name: 'Fluoreto de Sódio 0,2% (Semanal)', posology: 'Bochechar 10 a 20 mL por 1 minuto, 1 vez na semana. Não engolir, não enxaguar com água e evitar comer/beber por 30 min.' },
  { class: 'Prevenção', name: 'Creme Dental 5000 ppm Flúor', posology: 'Aplicar tamanho de ervilha na escova. Escovar 1x ao dia (à noite) por 2 min. Apenas cuspir excesso, não enxaguar com água. Uso por 20 a 30 dias.' }
];

const PROTOCOLS = [
  {
    name: 'Extração Simples (Rotina)',
    items: [
      'Uso Interno:',
      '1. Ibuprofeno 400mg - Tomar 1 comprimido de 8 em 8 horas, por 3 dias.',
      '2. Dipirona Sódica 500mg - Tomar 1 comprimido de 6 em 6 horas nas primeiras 48h. Após, usar apenas se dor.'
    ]
  },
  {
    name: 'Extração de Siso Incluso e Cirurgias Complexas',
    items: [
      'Uso Interno:',
      '1. Dexametasona 4mg - Tomar 1 comprimido a cada 12 horas, nas primeiras 24 a 48 horas.',
      '2. Nimesulida 100mg - Tomar 1 comprimido a cada 12 horas, durante 3 a 5 dias.',
      '3. Dipirona Sódica 1g - Tomar 1 comprimido de 6 em 6 horas contínuas pelas primeiras 72 horas.',
      '\nUso Externo:',
      '4. Digluconato de Clorexidina 0,12% - Bochechar 15 mL por 1 minuto, a cada 12 horas. (Iniciar modo passivo após o 1º dia)'
    ]
  },
  {
    name: 'Implante Unitário Regular (Profilaxia)',
    items: [
      'Uso Interno (Ataque):',
      '1. Amoxicilina 500mg - Tomar 4 comprimidos (2g) em dose única, 1 hora antes do procedimento.',
      '\nPós-operatório Mínimo:',
      '2. Paracetamol 750mg - Tomar 1 comprimido a cada 6 horas.',
      '3. Dexametasona 4mg - Tomar 1 comprimido 1 hora antes do procedimento.',
      '\nUso Externo:',
      '4. Digluconato de Clorexidina 0,12% - Bochechar 15 mL duas vezes ao dia por até 14 dias.'
    ]
  },
  {
    name: 'Implante (Alérgicos a Penicilina)',
    items: [
      'Uso Interno (Ataque):',
      '1. Azitromicina 500mg - Tomar 1 comprimido 1 hora antes do procedimento.'
    ]
  },
  {
    name: 'Restauração Profunda (Sensibilidade)',
    items: [
      'Uso Interno:',
      '1. Ibuprofeno 600mg - Tomar 1 comprimido a cada 12 horas.',
      '2. Dipirona Sódica 500mg - Tomar 1 comprimido a cada 6 horas.'
    ]
  },
  {
    name: 'Dor de Pulpite Irreversível (Urgência)',
    items: [
      'Uso Interno:',
      '1. Paracetamol 500mg + Fosfato de Codeína 30mg - Tomar 1 comprimido a cada 6 horas para dor aguda.'
    ]
  },
  {
    name: 'Abscesso Periapical Agudo',
    items: [
      'Uso Interno:',
      '1. Amoxicilina + Clavulanato 875/125mg - Tomar 1 comprimido a cada 8 horas, por 7 a 10 dias.',
      '2. Dipirona Sódica 1g - Tomar 1 comprimido a cada 6 horas, suporte analgésico.',
      '3. Ibuprofeno 600mg - Tomar 1 comprimido a cada 8 horas, anti-inflamatório.'
    ]
  }
];

export default function MedicalDocumentModal({
  type,
  patientName,
  patientData,
  clinicSettings,
  onClose,
  onEmit,
  initialArrivalTime,
  initialDepartureTime
}: MedicalDocumentModalProps) {
  const [content, setContent] = useState('');
  const [daysOfRest, setDaysOfRest] = useState('1');
  const [atestadoOptions, setAtestadoOptions] = useState({
    retornarAtividades: false,
    repousoHoje: false,
    repousoDias: true,
    acompanhante: false
  });
  const [cid, setCid] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [procedureInput, setProcedureInput] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [aiError, setAiError] = useState('');
  const [arrivalTime, setArrivalTime] = useState(initialArrivalTime || '');
  const [departureTime, setDepartureTime] = useState(initialDepartureTime || '');
  
  // Estilo do documento: 'oficial' (timbre idêntico à clínica), 'economico' (texto simples para economizar tinta), 'pre_impresso' (sem timbre para bloco da gráfica)
  const [docStyle, setDocStyle] = useState<'oficial' | 'economico' | 'pre_impresso'>('oficial');
  const [includeDigitalSignature, setIncludeDigitalSignature] = useState(true);
  const [printTwoCopies, setPrintTwoCopies] = useState(false);

  const COMMON_CIDS = [
    { code: 'K01.1', label: 'Siso / Dente Incluso (K01.1)' },
    { code: 'K04.0', label: 'Pulpite / Canal (K04.0)' },
    { code: 'K04.7', label: 'Abscesso Periapical (K04.7)' },
    { code: 'K05.3', label: 'Periodontite (K05.3)' },
    { code: 'Z01.2', label: 'Consulta de Rotina (Z01.2)' },
    { code: 'Z54.0', label: 'Pós-Cirúrgico (Z54.0)' }
  ];

  const setNowAsDeparture = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setDepartureTime(`${hh}:${mm}`);
  };

  const setArrivalFromDeparture = (minutesAgo: number) => {
    let baseDate = new Date();
    if (departureTime && departureTime.includes(':')) {
      const [h, m] = departureTime.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        baseDate = new Date();
        baseDate.setHours(h, m, 0, 0);
      }
    } else {
      setNowAsDeparture();
    }
    const arrivalDate = new Date(baseDate.getTime() - minutesAgo * 60000);
    const hh = String(arrivalDate.getHours()).padStart(2, '0');
    const mm = String(arrivalDate.getMinutes()).padStart(2, '0');
    setArrivalTime(`${hh}:${mm}`);
  };

  const setQuickRestDays = (days: number, isToday?: boolean) => {
    if (days === 0) {
      setAtestadoOptions({
        retornarAtividades: true,
        repousoHoje: false,
        repousoDias: false,
        acompanhante: false
      });
    } else if (isToday) {
      setDaysOfRest('1');
      setAtestadoOptions({
        retornarAtividades: false,
        repousoHoje: true,
        repousoDias: false,
        acompanhante: false
      });
    } else {
      setDaysOfRest(String(days));
      setAtestadoOptions({
        retornarAtividades: false,
        repousoHoje: false,
        repousoDias: true,
        acompanhante: false
      });
    }
  };

  const handleSuggestPrescription = async () => {
    if (!procedureInput) return;
    setIsSuggesting(true);
    setAiError('');
    try {
      const resp = await fetch("/api/suggest-prescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedure: procedureInput })
      });
      const data = await resp.json();
      if (data.suggestion) {
        setContent(data.suggestion);
      } else {
        setAiError(data.error || "Falha ao gerar sugestão.");
      }
    } catch (err) {
      console.error(err);
      setAiError("Erro ao conectar com a IA. Tente novamente mais tarde.");
    } finally {
      setIsSuggesting(false);
    }
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      // Carrega o fundo timbrado oficial em alta definição apenas se o modo oficial estiver ativo
      let letterheadImg = '';
      if (docStyle === 'oficial') {
        letterheadImg = await new Promise<string>((resolve) => {
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } else {
              resolve('');
            }
          };
          img.onerror = () => {
            const fallbackImg = new Image();
            fallbackImg.crossOrigin = "Anonymous";
            fallbackImg.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = fallbackImg.naturalWidth || fallbackImg.width;
              canvas.height = fallbackImg.naturalHeight || fallbackImg.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(fallbackImg, 0, 0);
                resolve(canvas.toDataURL('image/png'));
              } else {
                resolve('');
              }
            };
            fallbackImg.onerror = () => resolve('');
            fallbackImg.src = '/receituario_template_a4.png';
          };
          img.src = letterheadTemplateA4 || '/receituario_template_a4.png';
        });
      }

      const renderDocumentPage = (viaLabel?: string) => {
        const isEco = docStyle === 'economico';
        const isOfficial = docStyle === 'oficial';

        // 1. Fundo do Timbre Oficial da Clínica
        if (isOfficial && letterheadImg) {
          doc.addImage(letterheadImg, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
        }

        // 1.1 Cabeçalho e Rodapé Econômicos em Texto Normal (Economia de Tinta)
        if (isEco) {
          // Cabeçalho simples e limpo
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(15);
          doc.setTextColor(30, 30, 30);
          const docName = clinicSettings.doctorName || 'DR. AGNALDO FERREIRA';
          doc.text(docName.toUpperCase(), 105, 25, { align: 'center', charSpace: 0.5 });

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(70, 70, 70);
          doc.text(`${(clinicSettings.doctorRole || 'CIRURGIÃO DENTISTA').toUpperCase()}  •  ${clinicSettings.cro || 'CRO-MG 58714'}`, 105, 31, { align: 'center' });

          doc.setLineWidth(0.2);
          doc.setDrawColor(200, 200, 200);
          doc.line(24, 36, 186, 36);

          // Rodapé simples com todos os dados do consultório
          doc.setLineWidth(0.2);
          doc.setDrawColor(200, 200, 200);
          doc.line(24, 274, 186, 274);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(50, 50, 50);
          doc.text(`Consultório Odontológico ${clinicSettings.doctorName || 'Dr. Agnaldo Ferreira'}`, 105, 279, { align: 'center' });

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(90, 90, 90);
          doc.text(clinicSettings.address || 'Rua dos Goitacazes, 375 - Sala 1001 - Centro, Belo Horizonte - MG, 30190-050', 105, 283.5, { align: 'center' });
          doc.text('Tel: (31) 98513-1303   |   E-mail: dragnaldof@gmail.com   |   Instagram: @dr.agnaldoferreira', 105, 287.5, { align: 'center' });
        }

        // 2. Indicador de Via (1ª Via / 2ª Via)
        if (viaLabel) {
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(140, 140, 140);
          doc.text(`[ ${viaLabel} ]`, 185, isEco ? 22 : 14, { align: 'right' });
        }

        // 3. Título Centralizado do Documento
        const titleY = isEco ? 52 : 96;
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(20, 20, 20);
        if (type === 'atestado') {
          doc.text('ATESTADO', 105, titleY, { align: 'center', charSpace: 2 });
        } else if (type === 'declaracao') {
          doc.setFontSize(15);
          doc.text('DECLARAÇÃO DE COMPARECIMENTO', 105, titleY, { align: 'center', charSpace: 1 });
        } else {
          doc.text('RECEITUÁRIO', 105, titleY, { align: 'center', charSpace: 2 });
        }

        if (type === 'atestado' || type === 'declaracao') {
          const bodyY = isEco ? 68 : 115;
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(30, 30, 30);
          const prefix = type === 'atestado' ? 'Atesto que o(a) paciente ' : 'Declaro que o(a) paciente ';
          const today = new Date().toLocaleDateString('pt-BR');
          const paragraphText = `${prefix}${patientName || '__________________________________________'}, esteve neste consultório recebendo atendimento odontológico no período das ${arrivalTime || '___:___'} às ${departureTime || '___:___'} horas, do dia ${today}${type === 'declaracao' ? ' devendo retornar as suas atividades normais.' : '.'}`;
          
          const splitParagraph = doc.splitTextToSize(paragraphText, 158);
          doc.text(splitParagraph, 24, bodyY, { lineHeightFactor: 1.4 });

          if (type === 'atestado') {
            const boxYStart = bodyY + (splitParagraph.length * 7) + 12;
            const boxSize = 3.5;
            
            doc.setLineWidth(0.35);
            doc.setDrawColor(40, 40, 40);
            
            // Retornar as atividades normais.
            if (atestadoOptions.retornarAtividades) {
              doc.setFillColor(30, 30, 30);
              doc.rect(24, boxYStart, boxSize, boxSize, 'F');
            } else {
              doc.rect(24, boxYStart, boxSize, boxSize);
            }
            doc.text('Retornar as atividades normais.', 30, boxYStart + 2.8);
            
            // Permanecer em repouso hoje.
            if (atestadoOptions.repousoHoje) {
              doc.setFillColor(30, 30, 30);
              doc.rect(24, boxYStart + 10, boxSize, boxSize, 'F');
            } else {
              doc.rect(24, boxYStart + 10, boxSize, boxSize);
            }
            doc.text('Permanecer em repouso hoje.', 30, boxYStart + 12.8);
            
            // Permanecer em repouso ___ dias
            if (atestadoOptions.repousoDias) {
              doc.setFillColor(30, 30, 30);
              doc.rect(24, boxYStart + 20, boxSize, boxSize, 'F');
            } else {
              doc.rect(24, boxYStart + 20, boxSize, boxSize);
            }
            const parsedDays = parseInt(daysOfRest) || 0;
            doc.text(`Permanecer em repouso ${parsedDays > 0 ? parsedDays : '___'} dias a partir desta data.`, 30, boxYStart + 22.8);
            
            // Acompanhante.
            if (atestadoOptions.acompanhante) {
              doc.setFillColor(30, 30, 30);
              doc.rect(24, boxYStart + 30, boxSize, boxSize, 'F');
            } else {
              doc.rect(24, boxYStart + 30, boxSize, boxSize);
            }
            doc.text('Acompanhante.', 30, boxYStart + 32.8);
    
            doc.text(`CID: ${cid || '________________'}`, 24, boxYStart + 48);
          }

        } else {
          // Identificação do Paciente no Receituário
          const patientY = isEco ? 68 : 110;
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(20, 20, 20);
          doc.text("Para: ", 24, patientY);

          const prefixWidth = doc.getTextWidth("Para: ");
          const patientText = (patientName || '__________________________________________').toUpperCase();
          const splitPatient = doc.splitTextToSize(patientText, 158 - prefixWidth);
          doc.text(splitPatient, 24 + prefixWidth, patientY);

          if (isEco) {
            doc.setLineWidth(0.15);
            doc.setDrawColor(220, 220, 220);
            doc.line(24, patientY + (splitPatient.length * 6), 186, patientY + (splitPatient.length * 6));
          }

          // Conteúdo da receita (medicamentos e posologia)
          doc.setFontSize(11);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(30, 30, 30);
          const contentStartY = patientY + (splitPatient.length * 6) + (isEco ? 8 : 6);
          const splitContent = doc.splitTextToSize(content || '', 158);
          doc.text(splitContent, 24, contentStartY, { lineHeightFactor: 1.35 });
        }

        // 4. Assinatura e Carimbo Centralizados
        const bottomY = isEco ? 222 : 232;
        doc.setLineWidth(0.35);
        doc.setDrawColor(120, 120, 120);
        doc.line(65, bottomY, 145, bottomY);
        
        const todayStr = new Date().toLocaleDateString('pt-BR');
        if (includeDigitalSignature) {
          doc.setFontSize(10.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(40, 40, 40);
          doc.text(clinicSettings.doctorName || 'Dr. Agnaldo Ferreira', 105, bottomY + 5.5, { align: 'center' });
          doc.setFontSize(8.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(90, 90, 90);
          doc.text(`${clinicSettings.doctorRole || 'Cirurgião Dentista'} • ${clinicSettings.cro || 'CRO-MG 58714'}`, 105, bottomY + 10, { align: 'center' });
          doc.setFontSize(8);
          doc.setTextColor(130, 130, 130);
          doc.text(`Data: ${todayStr}`, 105, bottomY + 14.5, { align: 'center' });
        } else {
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(80, 80, 80);
          doc.text("Assinatura e Carimbo", 105, bottomY + 5.5, { align: 'center' });
          doc.setFontSize(8);
          doc.setTextColor(130, 130, 130);
          doc.text(`Data: ${todayStr}`, 105, bottomY + 10, { align: 'center' });
        }
      };

      // Renderiza 1ª Via
      renderDocumentPage(printTwoCopies ? '1ª VIA - PACIENTE' : undefined);

      // Se selecionou 2 Vias, gera a segunda página
      if (printTwoCopies) {
        doc.addPage();
        renderDocumentPage(type === 'receituario' ? '2ª VIA - FARMÁCIA / CLÍNICA' : '2ª VIA - CLÍNICA / ARQUIVO');
      }

      // Output Blob
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const filename = `${type === 'receituario' ? 'Receituario' : type === 'atestado' ? 'Atestado' : 'Declaracao'}_${patientName.replace(/\s+/g, '_')}.pdf`;

      return { blob: pdfBlob, url, filename };

    } catch (err) {
      console.error("PDF Gen Error:", err);
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

      let printIframe = document.getElementById('print-doc-iframe') as HTMLIFrameElement;
      if (!printIframe) {
        printIframe = document.createElement('iframe');
        printIframe.id = 'print-doc-iframe';
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

      if (type === 'declaracao' && onEmit) {
        onEmit({ arrivalTime, departureTime });
      }
    } catch (err) {
      console.error("Print Error:", err);
      alert("Erro ao enviar para impressão. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    const { url, filename } = await generatePDF();
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (type === 'declaracao' && onEmit) {
      onEmit({ arrivalTime, departureTime });
    }
  };

  const handleSendWhatsApp = async () => {
    const { url, filename, blob } = await generatePDF();
    
    if (type === 'declaracao' && onEmit) {
      onEmit({ arrivalTime, departureTime });
    }

    const docDesc = type === 'receituario' ? 'receituário' : type === 'atestado' ? 'atestado' : 'declaração de comparecimento';

    // Attempt Web Share api on Mobile
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'application/pdf' })] })) {
      try {
        await navigator.share({
          title: `Documento Odontológico - ${patientName}`,
          text: `Segue sua ${docDesc}.`,
          files: [new File([blob], filename, { type: 'application/pdf' })]
        });
        return;
      } catch (err) {
        console.error("Share failed", err);
      }
    }

    // Fallback: Download and open WhatsApp Web with text
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // After triggering download, open whatsapp
    const cleanNumber = (patientData.mobile || patientData.phone || '').replace(/\D/g, '');
    const message = `Olá ${patientName}, segue seu/sua ${docDesc} em anexo! (Envie o arquivo PDF baixado)`;
    const waUrl = cleanNumber && cleanNumber.length >= 10
      ? `https://wa.me/55${cleanNumber}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    setTimeout(() => {
       window.open(waUrl, '_blank');
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-xs">
      <div className={`bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden font-sans border border-zinc-200 w-full ${type === 'receituario' ? 'max-w-6xl h-[90vh]' : 'max-w-2xl max-h-[90vh]'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-[#FAF8F5]">
          <h2 className="text-xl font-bold text-[#4E1119] flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {type === 'receituario' ? 'Emitir Receituário' : type === 'atestado' ? 'Emitir Atestado' : 'Emitir Declaração'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`flex-1 ${type === 'receituario' ? 'overflow-hidden' : 'overflow-y-auto'} p-6 space-y-6 flex flex-col min-h-0`}>
          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 shrink-0">
             <p className="text-sm font-semibold text-zinc-700">Paciente: <span className="font-bold text-[#4E1119]">{patientName || 'NÃO INFORMADO'}</span></p>
             <p className="text-xs text-zinc-500 mt-1">
               Contato: {patientData.mobile || patientData.phone || 'Nenhum contato salvo'}
             </p>
          </div>

          {type === 'atestado' || type === 'declaracao' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-zinc-500 uppercase">Horário de Chegada</label>
                  </div>
                  <input
                    type="time"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20 text-sm font-semibold"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setArrivalFromDeparture(30)}
                      className="px-2 py-0.5 bg-zinc-100 hover:bg-[#C09553]/20 text-zinc-700 hover:text-[#4E1119] rounded text-[11px] font-semibold border border-zinc-200 transition-colors"
                      title="Chegou 30 minutos antes"
                    >
                      -30 min
                    </button>
                    <button
                      type="button"
                      onClick={() => setArrivalFromDeparture(60)}
                      className="px-2 py-0.5 bg-zinc-100 hover:bg-[#C09553]/20 text-zinc-700 hover:text-[#4E1119] rounded text-[11px] font-semibold border border-zinc-200 transition-colors"
                      title="Chegou 1 hora antes"
                    >
                      -1 hora
                    </button>
                    <button
                      type="button"
                      onClick={() => setArrivalFromDeparture(120)}
                      className="px-2 py-0.5 bg-zinc-100 hover:bg-[#C09553]/20 text-zinc-700 hover:text-[#4E1119] rounded text-[11px] font-semibold border border-zinc-200 transition-colors"
                      title="Chegou 2 horas antes"
                    >
                      -2 horas
                    </button>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-zinc-500 uppercase">Horário de Saída</label>
                  </div>
                  <input
                    type="time"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20 text-sm font-semibold"
                  />
                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={setNowAsDeparture}
                      className="px-2.5 py-0.5 bg-[#4E1119] hover:bg-[#380c12] text-white rounded text-[11px] font-bold transition-colors shadow-2xs"
                      title="Definir horário atual como saída"
                    >
                      Agora
                    </button>
                  </div>
                </div>
              </div>

              {type === 'atestado' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Dias de Repouso</label>
                      <input
                        type="number"
                        min="0"
                        value={daysOfRest}
                        onChange={(e) => setDaysOfRest(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-zinc-300 focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20 text-sm font-semibold"
                      />
                      {/* Chips de Repouso Rápido */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[
                          { label: 'Hoje', days: 1, isToday: true },
                          { label: '1 dia', days: 1 },
                          { label: '2 dias', days: 2 },
                          { label: '3 dias', days: 3 },
                          { label: '5 dias', days: 5 },
                          { label: '7 dias', days: 7 },
                          { label: '14 dias', days: 14 }
                        ].map((chip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setQuickRestDays(chip.days, chip.isToday)}
                            className="px-2 py-0.5 bg-zinc-100 hover:bg-[#4E1119] text-zinc-700 hover:text-white rounded text-[11px] font-bold border border-zinc-200 transition-colors cursor-pointer"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">CID (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: K04.0"
                        value={cid}
                        onChange={(e) => setCid(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-zinc-300 focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20 text-sm font-semibold"
                      />
                      {/* Chips de CIDs Odontológicos Comuns */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {COMMON_CIDS.map(c => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => setCid(c.code)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${cid === c.code ? 'bg-[#4E1119] text-white border-[#4E1119]' : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-[#C09553]/20'}`}
                            title={c.label}
                          >
                            {c.code}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 mt-4">
                     <label className="block text-xs font-bold text-zinc-500 uppercase mb-3">Opções do Atestado</label>
                     <div className="space-y-3">
                       <label className="flex items-center gap-3 cursor-pointer">
                         <input type="checkbox" checked={atestadoOptions.retornarAtividades} onChange={e => setAtestadoOptions(prev => ({...prev, retornarAtividades: e.target.checked}))} className="w-5 h-5 text-[#C09553] rounded focus:ring-[#C09553]" />
                         <span className="text-sm font-medium text-zinc-700">Retornar as atividades normais.</span>
                       </label>
                       <label className="flex items-center gap-3 cursor-pointer">
                         <input type="checkbox" checked={atestadoOptions.repousoHoje} onChange={e => setAtestadoOptions(prev => ({...prev, repousoHoje: e.target.checked}))} className="w-5 h-5 text-[#C09553] rounded focus:ring-[#C09553]" />
                         <span className="text-sm font-medium text-zinc-700">Permanecer em repouso hoje.</span>
                       </label>
                       <label className="flex items-center gap-3 cursor-pointer">
                         <input type="checkbox" checked={atestadoOptions.repousoDias} onChange={e => setAtestadoOptions(prev => ({...prev, repousoDias: e.target.checked}))} className="w-5 h-5 text-[#C09553] rounded focus:ring-[#C09553]" />
                         <span className="text-sm font-medium text-zinc-700">Permanecer em repouso ({daysOfRest}) dias a partir desta data.</span>
                       </label>
                       <label className="flex items-center gap-3 cursor-pointer">
                         <input type="checkbox" checked={atestadoOptions.acompanhante} onChange={e => setAtestadoOptions(prev => ({...prev, acompanhante: e.target.checked}))} className="w-5 h-5 text-[#C09553] rounded focus:ring-[#C09553]" />
                         <span className="text-sm font-medium text-zinc-700">Acompanhante.</span>
                       </label>
                     </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6 h-full flex-1 min-h-0 overflow-hidden">
              {/* Left Panel - Protocolos e Fármacos */}
              <div className="w-full lg:w-1/3 flex flex-col gap-4 overflow-y-auto pr-2">
                <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                  <h3 className="text-xs font-bold text-[#4E1119] uppercase mb-3">Protocolos Clínicos</h3>
                  <div className="space-y-2">
                    {PROTOCOLS.map((prot, idx) => (
                      <button
                        key={idx}
                        onClick={() => setContent(prev => prev + (prev ? '\n\n' : '') + prot.items.join('\n'))}
                        className="w-full text-left p-2.5 rounded-lg border border-zinc-200 hover:border-[#C09553] hover:bg-[#FAF8F5] transition-all group flex items-start justify-between"
                      >
                        <span className="text-[11px] font-bold text-zinc-700">{prot.name}</span>
                        <Plus className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#C09553]" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                  <h3 className="text-xs font-bold text-[#4E1119] uppercase mb-3">Adicionar Fármaco</h3>
                  <div className="space-y-2">
                    {DRUGS.map((drug, idx) => (
                      <button
                        key={'d'+idx}
                        onClick={() => {
                           const drugLine = `${drug.name} --------------------------- 1 cx\n${drug.posology}`;
                           setContent(prev => prev + (prev ? '\n\n' : '') + drugLine);
                        }}
                        className="w-full relative text-left p-2.5 rounded-lg border border-zinc-200 hover:border-[#C09553] hover:bg-[#FAF8F5] transition-all flex flex-col gap-1 group"
                      >
                        <div className="flex items-start justify-between w-full">
                           <span className="text-[11px] font-bold text-zinc-800">{drug.name}</span>
                           <Plus className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#C09553] flex-shrink-0" />
                        </div>
                        <span className="text-[9px] font-semibold text-zinc-400 uppercase">{drug.class}</span>
                        <span className="text-[10px] text-zinc-500 leading-tight">{drug.posology}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#FAF8F5] p-4 rounded-xl border border-[#C09553]/30 flex flex-col gap-3">
                  <label className="block text-xs font-bold text-[#4E1119] uppercase">Gerar com IA</label>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Extração siso inferior direito"
                      value={procedureInput}
                      onChange={(e) => setProcedureInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20"
                    />
                    <button
                      onClick={handleSuggestPrescription}
                      disabled={isSuggesting || !procedureInput}
                      className="px-3 py-2 w-full bg-[#4E1119] text-white text-xs font-bold rounded-lg hover:bg-[#3a0c12] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSuggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      Sugerir
                    </button>
                  </div>
                  {aiError && (
                    <p className="text-red-600 text-xs font-medium">{aiError}</p>
                  )}
                </div>
              </div>

              {/* Right Panel - Receita Viewer */}
              <div className="w-full lg:w-2/3 flex flex-col h-full bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200">
                <div className="bg-zinc-200 py-2 px-4 shadow-inner border-b border-zinc-300 flex items-center justify-between z-10">
                   <div className="flex items-center gap-2">
                     <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Visualização em Tempo Real (Folha A4)</span>
                     {docStyle === 'oficial' && (
                       <span className="px-1.5 py-0.5 bg-[#4E1119] text-white text-[9px] font-bold rounded">Timbre Oficial</span>
                     )}
                     {docStyle === 'economico' && (
                       <span className="px-1.5 py-0.5 bg-emerald-700 text-white text-[9px] font-bold rounded">Modo Econômico</span>
                     )}
                     {docStyle === 'pre_impresso' && (
                       <span className="px-1.5 py-0.5 bg-zinc-700 text-white text-[9px] font-bold rounded">Papel da Gráfica</span>
                     )}
                   </div>
                   <button onClick={() => setContent('')} className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer">Limpar</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 flex justify-center items-start bg-zinc-200/60">
                  <div 
                    className="w-full max-w-[210mm] shadow-xl relative rounded-xs border border-zinc-300 transition-all select-none overflow-hidden" 
                    style={{
                      aspectRatio: '210 / 297',
                      backgroundImage: docStyle === 'oficial' ? `url(${letterheadTemplateA4 || '/receituario_template_a4.png'})` : 'none',
                      backgroundColor: '#ffffff',
                      backgroundSize: '100% 100%',
                      backgroundRepeat: 'no-repeat'
                    }}
                  >
                    {/* Header Econômico (em texto simples) */}
                    {docStyle === 'economico' && (
                      <div className="absolute top-[4%] left-[8%] right-[8%] pb-2.5 border-b border-zinc-300 text-center pointer-events-none">
                        <h1 className="text-sm sm:text-base md:text-lg font-bold text-zinc-800 tracking-wide uppercase">
                          {clinicSettings.doctorName || 'DR. AGNALDO FERREIRA'}
                        </h1>
                        <p className="text-[10px] sm:text-xs text-zinc-500 font-medium tracking-wide mt-0.5 uppercase">
                          {clinicSettings.doctorRole || 'CIRURGIÃO DENTISTA'} • {clinicSettings.cro || 'CRO-MG 58714'}
                        </p>
                      </div>
                    )}

                    {/* Badge do Papel da Gráfica */}
                    {docStyle === 'pre_impresso' && (
                      <div className="absolute top-4 left-6 text-[10px] text-zinc-400 font-mono">
                        [Modo Folha Pré-Impressa da Gráfica - Sem fundo nem cabeçalho]
                      </div>
                    )}

                    {/* Título Centralizado */}
                    <div 
                      className="absolute left-0 right-0 text-center pointer-events-none"
                      style={{ top: docStyle === 'economico' ? '16.5%' : '32.3%' }}
                    >
                      <h2 className="text-base sm:text-lg md:text-xl font-black text-zinc-800 tracking-[0.2em] uppercase">
                        RECEITUÁRIO
                      </h2>
                    </div>

                    {/* Identificação da Paciente */}
                    <div 
                      className="absolute left-[11.5%] right-[13.5%] pointer-events-none"
                      style={{ top: docStyle === 'economico' ? '22%' : '37%' }}
                    >
                      <div className={`text-xs sm:text-sm font-bold text-zinc-900 flex items-baseline gap-1 ${docStyle === 'economico' ? 'pb-1 border-b border-zinc-200' : ''}`}>
                        <span>Para:</span>
                        <span className="font-extrabold underline uppercase tracking-wide truncate">
                          {patientName || '________________________'}
                        </span>
                      </div>
                    </div>

                    {/* Caixa de Texto do Receituário */}
                    <div 
                      className="absolute left-[11.5%] right-[13.5%] flex flex-col"
                      style={{
                        top: docStyle === 'economico' ? '26.5%' : '41.5%',
                        bottom: docStyle === 'economico' ? '25%' : '23%'
                      }}
                    >
                      <textarea
                        className="w-full h-full resize-none border-none focus:ring-0 bg-transparent py-0 px-0 text-xs sm:text-sm font-medium text-zinc-800 leading-relaxed placeholder:text-zinc-400 placeholder:italic select-text cursor-text"
                        placeholder="Selecione um protocolo ou fármaco à esquerda, ou digite livremente a prescrição aqui..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                      />
                    </div>

                    {/* Bloco de Assinatura Centralizado */}
                    <div 
                      className="absolute left-0 right-0 flex justify-center pointer-events-none"
                      style={{ bottom: docStyle === 'economico' ? '15%' : '17%' }}
                    >
                      <div className="text-center w-56 sm:w-64 pt-1.5 border-t border-zinc-400">
                        {includeDigitalSignature ? (
                          <>
                            <p className="text-[11px] sm:text-xs font-bold text-zinc-800 leading-tight">
                              {clinicSettings.doctorName || 'Dr. Agnaldo Ferreira'}
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-zinc-600 leading-tight mt-0.5">
                              {clinicSettings.doctorRole || 'Cirurgião Dentista'} • {clinicSettings.cro || 'CRO-MG 58714'}
                            </p>
                            <p className="text-[8px] sm:text-[9px] text-zinc-400 mt-0.5">
                              Data: {new Date().toLocaleDateString('pt-BR')}
                            </p>
                          </>
                        ) : (
                          <p className="text-[10px] sm:text-[11px] text-zinc-500 font-medium">Assinatura e Carimbo</p>
                        )}
                      </div>
                    </div>

                    {/* Rodapé Econômico (em texto simples) */}
                    {docStyle === 'economico' && (
                      <div className="absolute bottom-[3.5%] left-[8%] right-[8%] pt-2 border-t border-zinc-200 text-center pointer-events-none text-zinc-600">
                        <p className="text-[9px] sm:text-[10px] font-bold text-zinc-700">
                          Consultório Odontológico {clinicSettings.doctorName || 'Dr. Agnaldo Ferreira'}
                        </p>
                        <p className="text-[8px] sm:text-[9px] text-zinc-500 mt-0.5">
                          {clinicSettings.address || 'Rua dos Goitacazes, 375 - Sala 1001 - Centro, Belo Horizonte - MG, 30190-050'}
                        </p>
                        <p className="text-[8px] sm:text-[9px] text-zinc-400 mt-0.5">
                          Tel: (31) 98513-1303 | E-mail: dragnaldof@gmail.com | Instagram: @dr.agnaldoferreira
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Barra de Opções para Impressão Física no Consultório */}
        <div className="px-6 py-2.5 bg-[#FAF8F5] border-t border-zinc-200 flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-4">
            {/* Seletor de Estilo */}
            <div className="flex items-center gap-1.5 bg-zinc-200/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setDocStyle('oficial')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  docStyle === 'oficial'
                    ? 'bg-[#4E1119] text-white shadow-xs'
                    : 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
                title="Timbre oficial idêntico ao modelo da clínica (logo AF, marcas d'água laterais e rodapé bordô)"
              >
                <span>Timbre Oficial</span>
              </button>

              <button
                type="button"
                onClick={() => setDocStyle('economico')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  docStyle === 'economico'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
                title="Economiza tinta com fonte normal e layout limpo, com todos os dados do consultório"
              >
                <span>Econômico (Sem Imagens)</span>
              </button>

              <button
                type="button"
                onClick={() => setDocStyle('pre_impresso')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  docStyle === 'pre_impresso'
                    ? 'bg-zinc-800 text-white shadow-xs'
                    : 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
                title="Apenas texto (para quem coloca a folha do bloco físico da gráfica na impressora)"
              >
                <span>Papel da Gráfica</span>
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer font-medium text-zinc-700 select-none hover:text-zinc-900">
              <input
                type="checkbox"
                checked={includeDigitalSignature}
                onChange={(e) => setIncludeDigitalSignature(e.target.checked)}
                className="w-4 h-4 text-[#4E1119] rounded focus:ring-[#4E1119] cursor-pointer"
              />
              <span>Assinatura/Carimbo inclusos</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-medium text-zinc-700 select-none hover:text-zinc-900">
              <input
                type="checkbox"
                checked={printTwoCopies}
                onChange={(e) => setPrintTwoCopies(e.target.checked)}
                className="w-4 h-4 text-[#4E1119] rounded focus:ring-[#4E1119] cursor-pointer"
              />
              <span>Imprimir em 2 Vias</span>
            </label>
          </div>
          <span className="text-[11px] text-zinc-500 font-medium bg-zinc-100 px-2.5 py-1 rounded-md border border-zinc-200">Formato: Folha A4 (210 x 297 mm)</span>
        </div>

        <div className="p-4 border-t border-zinc-200 bg-white flex flex-col sm:flex-row items-center gap-3 justify-end shrink-0">
          <button
            type="button"
            onClick={handleDirectPrint}
            disabled={isGenerating}
            className="w-full sm:w-auto px-6 py-2.5 bg-[#4E1119] text-white font-bold rounded-xl hover:bg-[#380c12] transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            title="Enviar diretamente para a impressora do consultório"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4 text-[#C09553]" />}
            Imprimir Agora
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isGenerating}
            className="w-full sm:w-auto px-4 py-2.5 bg-zinc-100 text-zinc-700 font-bold rounded-xl hover:bg-zinc-200 border border-zinc-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Baixar PDF
          </button>

          <button
            type="button"
            onClick={handleSendWhatsApp}
            disabled={isGenerating}
            className="w-full sm:w-auto px-4 py-2.5 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#128C7E] transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
