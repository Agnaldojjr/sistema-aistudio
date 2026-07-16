import React, { useState, useRef, useEffect } from 'react';
import { Eye, Download, ChevronLeft, ChevronRight, X, Image as ImageIcon, RotateCw, Columns, SplitSquareHorizontal, Move } from 'lucide-react';
import html2canvas from 'html2canvas';
import { uploadPatientFileToSupabase } from '../lib/supabaseStorage';
import PhotoLightboxWithEditor from './PhotoLightboxWithEditor';

export interface GalleryPhoto {
  id: string;
  patient: string;
  url: string;
  galeria: string;
  label: string;
}

interface PatientGalleryProps {
  photos: GalleryPhoto[];
  uniquePatients: string[];
  selectedPatient: string;
  setSelectedPatient: (patient: string) => void;
  onSyncDrive: () => void;
  isRunningImport: boolean;
}

export default function PatientGallery({
  photos,
  uniquePatients,
  selectedPatient,
  setSelectedPatient,
  onSyncDrive,
  isRunningImport
}: PatientGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  
  // Before/After Mode States
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareLeft, setCompareLeft] = useState<GalleryPhoto | null>(null);
  const [compareRight, setCompareRight] = useState<GalleryPhoto | null>(null);

  // Lightbox Editor States
  const [rotation, setRotation] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  // Export Before/After ref
  const compareRef = useRef<HTMLDivElement>(null);

  const activePhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  useEffect(() => {
    if (lightboxIndex !== null) {
      setRotation(0);
      setZoomLevel(1);
      setPan({ x: 0, y: 0 });
    }
  }, [lightboxIndex]);

  const handleNext = () => {
    if (lightboxIndex !== null && lightboxIndex < photos.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    }
  };

  const handlePrev = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    }
  };

  const handleDownload = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'foto-paciente.jpg';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download falhou, tentando fallback', error);
      window.open(imageUrl, '_blank');
    }
  };

  const downloadCanvasImage = () => {
    if (!activePhoto) return;
    
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Calculate canvas size based on rotation
      const isRotated = rotation % 180 !== 0;
      canvas.width = isRotated ? img.height : img.width;
      canvas.height = isRotated ? img.width : img.height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw the main image
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        
        // Reset transform to draw watermark at absolute coordinates
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Watermark settings
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = `bold ${Math.max(20, canvas.width / 30)}px Arial`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        
        // Add watermark text (e.g., date and clinic name or patient name)
        const watermarkText = `Dr. Agnaldo Ferreira - ${activePhoto.patient}`;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(watermarkText, canvas.width - 20, canvas.height - 20);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const a = document.createElement('a');
        a.href = dataUrl;
        // Salvar como nova (add timestamp to filename to ensure it's a new copy)
        const timestamp = new Date().getTime();
        a.download = `foto_${activePhoto.patient.replace(/\\s+/g, '_')}_editada_${timestamp}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    };
    img.src = activePhoto.url;
  };

  const handleDownloadCompare = async () => {
    if (compareRef.current) {
      try {
        const canvas = await html2canvas(compareRef.current, {
          useCORS: true,
          scale: 2,
          backgroundColor: '#000000'
        });
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `antes_depois_${compareLeft?.patient || 'paciente'}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        alert('Erro ao gerar imagem comparativa.');
      }
    }
  };

  const toggleComparePhoto = (photo: GalleryPhoto) => {
    if (compareLeft?.id === photo.id) {
      setCompareLeft(null);
      return;
    }
    if (compareRight?.id === photo.id) {
      setCompareRight(null);
      return;
    }
    
    if (!compareLeft) setCompareLeft(photo);
    else if (!compareRight) setCompareRight(photo);
    else {
      // If both filled, replace right
      setCompareRight(photo);
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector top filter */}
      <div className="bg-[#8B0000]/5 border border-[#C09553]/30 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <label className="block text-zinc-600 font-bold text-[10px] uppercase font-mono tracking-wider">Filtrar Galeria de Fotos Clínicas</label>
          <select 
            value={selectedPatient}
            onChange={(e) => setSelectedPatient(e.target.value)}
            className="border border-[#D5CBB3] bg-white rounded-lg p-2 font-serif text-sm font-bold focus:outline-none focus:border-[#C09553] text-[#8B0000]"
          >
            <option value="Todos">Visualizar Todos os Registros ({photos.length} fotos)</option>
            {uniquePatients.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <button
            onClick={() => setIsCompareMode(!isCompareMode)}
            className={`flex-1 md:flex-none px-4 py-2 border rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${isCompareMode ? 'bg-[#8B0000] border-[#8B0000] text-white' : 'bg-white border-[#D5CBB3] text-[#8B0000] hover:bg-[#8B0000]/5'}`}
          >
            <Columns className="w-3.5 h-3.5" />
            Modo Antes/Depois
          </button>
          <button
            onClick={onSyncDrive}
            disabled={isRunningImport}
            className="flex-1 md:flex-none px-4 py-2 border border-[#D5CBB3] rounded-lg bg-zinc-900 hover:bg-zinc-800 font-bold text-white text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <ImageIcon className="w-3.5 h-3.5 text-[#C09553]" />
            Salvar no Supabase
          </button>
        </div>
      </div>

      {/* Compare Mode Header */}
      {isCompareMode && (
        <div className="bg-zinc-900 rounded-xl p-4 text-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-serif font-bold text-lg text-[#C09553] flex items-center gap-2">
              <SplitSquareHorizontal className="w-5 h-5" />
              Comparativo Antes e Depois
            </h3>
            <button 
              onClick={() => setIsCompareMode(false)}
              className="p-1 hover:bg-white/10 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {(compareLeft || compareRight) ? (
            <div className="space-y-4">
              <div 
                ref={compareRef}
                className="flex flex-col md:flex-row gap-1 bg-black p-1 rounded-lg"
              >
                <div className="flex-1 bg-zinc-800 aspect-square md:aspect-[4/3] rounded overflow-hidden relative group">
                  {compareLeft ? (
                    <>
                      <img src={compareLeft.url} alt="Foto Antes" className="w-full h-full object-cover" crossOrigin="anonymous" />
                      <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] font-bold text-white">ANTES</div>
                      <button onClick={() => setCompareLeft(null)} className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">Selecione uma foto abaixo</div>
                  )}
                </div>
                <div className="flex-1 bg-zinc-800 aspect-square md:aspect-[4/3] rounded overflow-hidden relative group">
                  {compareRight ? (
                    <>
                      <img src={compareRight.url} alt="Foto Depois" className="w-full h-full object-cover" crossOrigin="anonymous" />
                      <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-[10px] font-bold text-white">DEPOIS</div>
                      <button onClick={() => setCompareRight(null)} className="absolute top-2 right-2 mt-8 p-1.5 bg-black/50 hover:bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">Selecione uma foto abaixo</div>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleDownloadCompare}
                  disabled={!compareLeft || !compareRight}
                  className="px-4 py-2 bg-[#C09553] hover:bg-[#a67c3b] text-white font-bold rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Baixar Imagem Comparativa
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-zinc-400 text-sm bg-white/5 rounded-lg border border-dashed border-white/20">
              Selecione 2 fotos na galeria abaixo para comparar
            </div>
          )}
        </div>
      )}

      {/* Photograph Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {photos.map((photo, idx) => {
          const isLeft = compareLeft?.id === photo.id;
          const isRight = compareRight?.id === photo.id;
          const isSelected = isLeft || isRight;

          return (
            <div 
              key={idx} 
              className={`bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group ${isSelected ? 'border-[#C09553] ring-2 ring-[#C09553]/20' : 'border-zinc-200'}`}
            >
              <div 
                className="aspect-[4/3] bg-zinc-100 overflow-hidden relative border-b border-zinc-100 select-none cursor-pointer"
                onClick={() => isCompareMode ? toggleComparePhoto(photo) : setLightboxIndex(idx)}
              >
                <img 
                  src={photo.url} 
                  alt={photo.label}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=350&q=80";
                  }}
                />
                <span className="absolute top-2 left-2 bg-[#8B0000]/80 backdrop-blur-xs text-[#C09553] text-[8.5px] px-2 py-0.5 rounded font-bold uppercase font-mono tracking-widest">{photo.galeria}</span>
                
                {isCompareMode && isSelected && (
                  <div className="absolute inset-0 bg-[#C09553]/20 flex items-center justify-center">
                    <div className="bg-[#8B0000] text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                      {isLeft ? 'ANTES' : 'DEPOIS'}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-3 space-y-1.5">
                <h5 className="text-[11.5px] font-bold text-zinc-900 leading-tight truncate">{photo.patient}</h5>
                <p className="text-[10px] text-zinc-500 font-medium italic truncate">{photo.label || 'Foto da consulta'}</p>
                
                {!isCompareMode && (
                  <div className="pt-2 border-t border-zinc-100 flex gap-2">
                    <button 
                      onClick={() => setLightboxIndex(idx)}
                      className="flex-1 py-1.5 bg-zinc-50 hover:bg-zinc-100 rounded-lg text-zinc-700 hover:text-zinc-900 border border-zinc-200 text-[10px] font-bold text-center inline-flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3 h-3 text-[#C09553]" />
                      Zoom / Editar
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {photos.length === 0 && (
          <div className="col-span-full py-12 text-center text-zinc-400">Nenhuma foto no backup corresponde aos critérios.</div>
        )}
      </div>

      {/* Lightbox Modal With Editor Abstraction */}
      {lightboxIndex !== null && photos.length > 0 && (
        <PhotoLightboxWithEditor
          photos={photos.map(p => ({
            url: p.url,
            title: p.patient,
            subtitle: p.label,
            id: p.id
          }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onSaveEdit={async (editedBase64, index) => {
            try {
              const targetPhoto = photos[index];
              const base64Response = await fetch(editedBase64);
              const blob = await base64Response.blob();
              // Upload back to Supabase
              await uploadPatientFileToSupabase(
                targetPhoto.patient,
                blob,
                `edited_${Date.now()}.png`
              );
              alert('Imagem editada salva com sucesso na galeria do paciente!');
              onSyncDrive(); // Trigger refresh
            } catch (err: any) {
              console.error(err);
              alert('Erro ao salvar imagem editada: ' + err.message);
            }
          }}
        />
      )}
    </div>
  );
}
