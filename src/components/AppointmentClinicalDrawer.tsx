/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  FileText, 
  Clock, 
  Plus, 
  Upload, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  Calendar, 
  Loader2, 
  Phone, 
  ShieldAlert, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CRMPatient, CRMClinicalHistory, CRMAppointment } from '../types';
import { uploadPatientFileToSupabase, listPatientFilesFromSupabase } from '../lib/supabaseStorage';

interface AppointmentClinicalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: CRMAppointment | any | null;
  patient: CRMPatient | null;
  clinicalHistory: CRMClinicalHistory[];
  galeriaList: any[];
  treatmentPlan?: {
    proposal?: any;
    sections?: any[];
  } | null;
  onAddClinicalNote: (note: { proceduresPerformed: string; treatmentEvolution: string; observations?: string }) => Promise<void>;
  onRefreshData?: () => void;
  onNavigateToPlanning?: (patientName?: string) => void;
}

export default function AppointmentClinicalDrawer({
  isOpen,
  onClose,
  appointment,
  patient,
  clinicalHistory,
  galeriaList,
  treatmentPlan,
  onAddClinicalNote,
  onRefreshData,
  onNavigateToPlanning
}: AppointmentClinicalDrawerProps) {
  const [activeTab, setActiveTab] = useState<'history' | 'add_note' | 'photos'>('history');

  // Form states for adding evolution
  const [proceduresPerformed, setProceduresPerformed] = useState('');
  const [treatmentEvolution, setTreatmentEvolution] = useState('');
  const [observations, setObservations] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [noteSuccess, setNoteSuccess] = useState(false);

  // Gallery & Upload states
  const [photos, setPhotos] = useState<any[]>(galeriaList || []);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  // Synchronize photos when drawer opens or galeriaList updates
  useEffect(() => {
    setPhotos(galeriaList || []);
  }, [galeriaList]);

  // Load photos directly from Supabase Storage if patient name is available
  useEffect(() => {
    if (isOpen && patient?.name) {
      setIsLoadingPhotos(true);
      listPatientFilesFromSupabase(patient.name)
        .then((files) => {
          if (files && files.length > 0) {
            setPhotos(files);
          }
        })
        .catch((err) => {
          console.warn('Could not list patient files from storage:', err);
        })
        .finally(() => {
          setIsLoadingPhotos(false);
        });
    }
  }, [isOpen, patient?.name]);

  if (!isOpen || !appointment) return null;

  const patientName = patient?.name || appointment.patientName || 'Paciente';

  // Derive Treatment Plan stats (mapped teeth & open procedures)
  let mappedTeethCount = 0;
  let openProceduresCount = 0;
  let proposalStatus = treatmentPlan?.proposal?.status || 'Sem plano cadastrado';

  if (treatmentPlan?.sections) {
    const teethSet = new Set<number>();
    treatmentPlan.sections.forEach((sec: any) => {
      sec.markers?.forEach((m: any) => {
        if (m.toothNumber) teethSet.add(m.toothNumber);
        if (m.procedureInstances) {
          m.procedureInstances.forEach((inst: any) => {
            if (inst.status === 'A realizar' || inst.status === 'Em andamento') {
              openProceduresCount++;
            }
          });
        }
      });
    });
    mappedTeethCount = teethSet.size;
  }

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proceduresPerformed.trim() || !treatmentEvolution.trim()) {
      setNoteError('Preencha os procedimentos e a evolução clínica.');
      return;
    }

    setIsSavingNote(true);
    setNoteError('');
    setNoteSuccess(false);

    try {
      await onAddClinicalNote({
        proceduresPerformed,
        treatmentEvolution,
        observations
      });
      setNoteSuccess(true);
      setProceduresPerformed('');
      setTreatmentEvolution('');
      setObservations('');
      setTimeout(() => {
        setNoteSuccess(false);
        setActiveTab('history');
      }, 1200);
    } catch (err: any) {
      console.error('Erro ao salvar evolução:', err);
      setNoteError(err.message || 'Falha ao salvar a evolução clínica.');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !patientName) return;

    setIsUploadingPhoto(true);
    setUploadError('');

    try {
      const filename = `foto_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      await uploadPatientFileToSupabase(patientName, file, filename);

      // Refresh photo list
      const updatedFiles = await listPatientFilesFromSupabase(patientName);
      setPhotos(updatedFiles);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Erro no upload de foto clínica:', err);
      setUploadError(err.message || 'Erro ao enviar foto para o Supabase Storage.');
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    if (status.includes('Aprovado') || status.includes('Concluído')) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    if (status.includes('Em Andamento')) {
      return 'bg-blue-50 text-blue-800 border-blue-200';
    }
    if (status.includes('Aberto') || status.includes('Aguardando')) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden border-l border-zinc-200">
        
        {/* DRAWER HEADER */}
        <div className="bg-gradient-to-r from-[#4E1119] to-[#8B0000] text-white p-5 flex items-start justify-between shrink-0 shadow-md">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-[#C09553]/30 text-[#E1CDAC] border border-[#C09553]/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Prontuário & Evolução Clínica
              </span>
              {appointment.time && (
                <span className="text-xs text-white/80 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#C09553]" />
                  {appointment.time}
                </span>
              )}
            </div>
            <h2 className="text-xl font-serif font-bold tracking-tight text-white uppercase">
              {patientName}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-white/80">
              {patient?.cpf && <span>CPF: {patient.cpf}</span>}
              {patient?.medicalRecord && <span>Prontuário: {patient.medicalRecord}</span>}
              {patient?.phone && (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3" />
                  {patient.phone}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="Fechar Prontuário"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ACTIVE TREATMENT OVERVIEW CARD */}
        <div className="bg-[#FAF8F5] border-b border-[#E6DEC9] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div className="space-y-1">
            <div className="text-[10px] font-extrabold uppercase text-zinc-500 tracking-wider">
              Estágio do Plano de Tratamento
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadgeStyle(proposalStatus)}`}>
                <Activity className="w-3.5 h-3.5" />
                {proposalStatus}
              </span>
              <span className="text-xs text-zinc-600 font-semibold">
                • {mappedTeethCount} {mappedTeethCount === 1 ? 'dente mapeado' : 'dentes mapeados'}
              </span>
              <span className="text-xs text-zinc-600 font-semibold">
                • {openProceduresCount} {openProceduresCount === 1 ? 'proc. pendente' : 'procs. pendentes'}
              </span>
            </div>
          </div>

          {onNavigateToPlanning && (
            <button
              onClick={() => {
                onClose();
                onNavigateToPlanning(patientName);
              }}
              className="px-3.5 py-2 bg-[#4E1119] hover:bg-[#6c1b26] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <span>Abrir Odontograma</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-zinc-200 bg-zinc-50 px-4 pt-2 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'history'
                ? 'border-[#8B0000] text-[#8B0000]'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Histórico & Evoluções ({clinicalHistory.length})
          </button>

          <button
            onClick={() => setActiveTab('add_note')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1 cursor-pointer ${
              activeTab === 'add_note'
                ? 'border-[#8B0000] text-[#8B0000]'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Evolução
          </button>

          <button
            onClick={() => setActiveTab('photos')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1 cursor-pointer ${
              activeTab === 'photos'
                ? 'border-[#8B0000] text-[#8B0000]'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Galeria Clínica ({photos.length})
          </button>
        </div>

        {/* TAB CONTENT CONTAINER */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* TAB 1: HISTÓRICO & EVOLUÇÃO TIMELINE */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              
              {/* Quick Patient Clinical Observations */}
              {patient?.observations && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Observações do Paciente:</span>
                    <p className="text-zinc-700 mt-0.5">{patient.observations}</p>
                  </div>
                </div>
              )}

              {clinicalHistory.length === 0 ? (
                <div className="py-16 text-center text-zinc-400 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-600">Nenhuma evolução registrada</p>
                  <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                    Clique em "Nova Evolução" para adicionar a conduta e procedimentos desta consulta.
                  </p>
                  <button
                    onClick={() => setActiveTab('add_note')}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#8B0000] text-white text-xs font-bold rounded-xl hover:bg-[#6c1b26] transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Primeira Evolução
                  </button>
                </div>
              ) : (
                <div className="relative border-l-2 border-zinc-200 ml-3 pl-5 space-y-6">
                  {clinicalHistory.map((item, idx) => (
                    <div key={item.id || idx} className="relative group">
                      {/* Circle marker */}
                      <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-[#8B0000] border-2 border-white ring-2 ring-zinc-200" />
                      
                      <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-shadow space-y-2">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                          <span className="text-xs font-bold text-[#8B0000] font-mono flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {item.date || 'Data não especificada'}
                          </span>
                        </div>

                        {item.proceduresPerformed && (
                          <div>
                            <span className="text-[10px] font-extrabold uppercase text-zinc-400 block tracking-wider">
                              Procedimento(s) Realizado(s)
                            </span>
                            <p className="text-xs font-bold text-zinc-800">
                              {item.proceduresPerformed}
                            </p>
                          </div>
                        )}

                        {item.treatmentEvolution && (
                          <div>
                            <span className="text-[10px] font-extrabold uppercase text-zinc-400 block tracking-wider">
                              Evolução Clínica / Conduta
                            </span>
                            <p className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">
                              {item.treatmentEvolution}
                            </p>
                          </div>
                        )}

                        {item.observations && (
                          <div className="pt-1 text-[11px] text-zinc-500 italic bg-zinc-50 rounded-lg p-2 border border-zinc-100">
                            Obs: {item.observations}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FORMULÁRIO DE NOVA EVOLUÇÃO */}
          {activeTab === 'add_note' && (
            <form onSubmit={handleSaveNote} className="space-y-4 bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
              <h3 className="text-sm font-bold text-[#4E1119] flex items-center gap-2 border-b border-zinc-100 pb-2">
                <Plus className="w-4 h-4 text-[#C09553]" />
                Registrar Evolução do Atendimento
              </h3>

              {noteError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs border border-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{noteError}</span>
                </div>
              )}

              {noteSuccess && (
                <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-xs border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Evolução clínica salva com sucesso!</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 block">
                  Procedimentos Realizados <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Restauração em resina composta no dente 16 (MOD)"
                  value={proceduresPerformed}
                  onChange={(e) => setProceduresPerformed(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl text-xs focus:ring-2 focus:ring-[#C09553] focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 block">
                  Evolução Clínica / Descrição do Procedimento <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Descreva a conduta clínica, anestesia aplicada, intercorrências, recomendações e retorno..."
                  value={treatmentEvolution}
                  onChange={(e) => setTreatmentEvolution(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl text-xs focus:ring-2 focus:ring-[#C09553] focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600 block">
                  Observações Adicionais / Recomendações Pós-Operatórias
                </label>
                <input
                  type="text"
                  placeholder="Ex: Prescrito Analgésico. Retorno em 7 dias para revisão."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl text-xs focus:ring-2 focus:ring-[#C09553] focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingNote}
                  className="px-5 py-2.5 bg-[#4E1119] hover:bg-[#6c1b26] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingNote ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salva no Supabase...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Salvar Evolução</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: GALERIA CLÍNICA & UPLOAD */}
          {activeTab === 'photos' && (
            <div className="space-y-5">
              
              {/* Direct File Upload Action Dropzone */}
              <div className="bg-[#FAF8F5] border-2 border-dashed border-[#C09553]/50 rounded-2xl p-6 text-center space-y-3 relative hover:border-[#C09553] transition-colors">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  disabled={isUploadingPhoto}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                
                <div className="w-12 h-12 rounded-full bg-[#C09553]/10 text-[#C09553] flex items-center justify-center mx-auto">
                  {isUploadingPhoto ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-zinc-800">
                    {isUploadingPhoto ? 'Enviando foto para o Supabase Storage...' : 'Clique ou arraste uma foto clínica aqui'}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Radiografias, Fotos Pré/Pós Tratamento, Tomografias (PNG, JPG, PDF)
                  </p>
                </div>

                {uploadError && (
                  <p className="text-xs text-red-600 font-semibold">{uploadError}</p>
                )}
              </div>

              {/* Photo Gallery Grid */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                  <span>Fotos e Documentos ({photos.length})</span>
                  {isLoadingPhotos && (
                    <span className="text-[10px] text-[#C09553] flex items-center gap-1 font-normal">
                      <Loader2 className="w-3 h-3 animate-spin" /> Atualizando...
                    </span>
                  )}
                </h4>

                {photos.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold text-zinc-600">Nenhuma foto clínica cadastrada</p>
                    <p className="text-[10px] text-zinc-400">Use a área acima para fazer o upload direto.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((item, idx) => {
                      const imgUrl = item.thumbnailLink || item.url || item.image || item.src;
                      return (
                        <div
                          key={item.id || idx}
                          onClick={() => setSelectedPhotoUrl(imgUrl)}
                          className="group relative bg-zinc-900 rounded-xl overflow-hidden aspect-square border border-zinc-200 cursor-pointer shadow-2xs hover:shadow-md transition-all"
                        >
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={item.name || `Foto ${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-100 text-zinc-400">
                              <FileText className="w-8 h-8" />
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end text-white">
                            <p className="text-[10px] font-bold truncate">{item.name || `Arquivo ${idx + 1}`}</p>
                            {item.createdTime && (
                              <p className="text-[8px] opacity-75 font-mono">
                                {new Date(item.createdTime).toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* LIGHTBOX FOR PHOTO PREVIEW */}
        {selectedPhotoUrl && (
          <div className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-4">
            <button
              onClick={() => setSelectedPhotoUrl(null)}
              className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 rounded-full cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedPhotoUrl}
              alt="Visualização Ampliada"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        )}

      </div>
    </div>
  );
}
