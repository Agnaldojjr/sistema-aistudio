import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, RotateCw, Download, Edit3 } from 'lucide-react';
import ImageMarkupEditor from './ImageMarkupEditor';

export interface LightboxPhoto {
  url: string;
  title: string;
  subtitle?: string;
  id?: string;
}

interface PhotoLightboxWithEditorProps {
  photos: LightboxPhoto[];
  initialIndex: number;
  onClose: () => void;
  onSaveEdit?: (editedBase64: string, index: number) => void;
}

export default function PhotoLightboxWithEditor({
  photos,
  initialIndex,
  onClose,
  onSaveEdit
}: PhotoLightboxWithEditorProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isEditing, setIsEditing] = useState(false);

  // Zoom / Pan states
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);

  const imageRef = useRef<HTMLImageElement>(null);
  const activePhoto = photos[currentIndex];

  useEffect(() => {
    // Reset view when changing photos
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  }, [currentIndex]);

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex < photos.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const downloadCanvasImage = () => {
    if (!imageRef.current) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = imageRef.current.naturalWidth;
    canvas.height = imageRef.current.naturalHeight;
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.rotate((rotation * Math.PI) / 180);
    
    if (rotation === 90 || rotation === 270) {
      ctx.drawImage(imageRef.current, -canvas.height/2, -canvas.width/2, canvas.height, canvas.width);
    } else {
      ctx.drawImage(imageRef.current, -canvas.width/2, -canvas.height/2, canvas.width, canvas.height);
    }
    
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.9);
    a.download = `imagem_${activePhoto.title}_${Date.now()}.jpg`;
    a.click();
  };

  if (!activePhoto) return null;

  if (isEditing) {
    return (
      <ImageMarkupEditor
        image={activePhoto.url}
        title={`Editando: ${activePhoto.title}`}
        onClose={() => setIsEditing(false)}
        onSave={(editedBase64) => {
          if (onSaveEdit) {
            onSaveEdit(editedBase64, currentIndex);
          }
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 md:px-6 bg-gradient-to-b from-black/80 to-transparent">
        <div className="text-white">
          <h3 className="font-bold text-sm md:text-base">{activePhoto.title}</h3>
          {activePhoto.subtitle && <p className="text-[#C09553] text-xs font-mono">{activePhoto.subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {onSaveEdit && (
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-[#C09553] hover:bg-[#A97E3B] text-white rounded-lg transition-colors shadow-sm" title="Editar Imagem Clínicamente">
              <Edit3 className="w-4 h-4" />
              Editar Clínicamente
            </button>
          )}
          <button onClick={() => setRotation(r => r - 90)} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="Girar">
            <RotateCw className="w-5 h-5" />
          </button>
          <button onClick={downloadCanvasImage} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="Baixar">
            <Download className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="p-2 text-white/80 hover:text-red-500 hover:bg-white/10 rounded-full transition-colors ml-2" title="Fechar">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Viewer */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Prev Button */}
        {currentIndex > 0 && (
          <button 
            onClick={handlePrev}
            className="absolute left-2 md:left-6 z-10 p-3 bg-black/50 text-white hover:bg-[#8B0000] hover:text-[#C09553] rounded-full transition-all border border-white/10"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Image Container */}
        <div 
          className="w-full h-full flex items-center justify-center cursor-move"
          onMouseDown={(e) => {
            setIsDragging(true);
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
          }}
          onMouseMove={(e) => {
            if (isDragging) {
              setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
            }
          }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onTouchStart={(e) => {
            if (e.touches.length === 1) {
              setIsDragging(true);
              setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
            }
          }}
          onTouchMove={(e) => {
            if (isDragging && e.touches.length === 1) {
              setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
            }
          }}
          onTouchEnd={() => setIsDragging(false)}
          onWheel={(e) => {
            e.preventDefault();
            setZoomLevel(z => Math.max(0.5, Math.min(5, z - e.deltaY * 0.005)));
          }}
        >
          <img 
            ref={imageRef}
            src={activePhoto.url} 
            alt={activePhoto.title || "Foto clínica do paciente"}
            className="max-w-full max-h-full object-contain transition-transform duration-75"
            crossOrigin="anonymous"
            style={{ 
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}
            draggable={false}
          />
        </div>

        {/* Next Button */}
        {currentIndex < photos.length - 1 && (
          <button 
            onClick={handleNext}
            className="absolute right-2 md:right-6 z-10 p-3 bg-black/50 text-white hover:bg-[#8B0000] hover:text-[#C09553] rounded-full transition-all border border-white/10"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Footer Controls */}
      <div className="h-16 md:h-20 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-center gap-6 px-4">
        <div className="flex items-center gap-2 bg-black/50 px-4 py-2 rounded-full border border-white/10">
          <span className="text-white/50 text-xs font-mono">-</span>
          <input 
            type="range" 
            min="0.5" 
            max="5" 
            step="0.1" 
            value={zoomLevel} 
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="w-24 md:w-32 accent-[#C09553]"
            aria-label="Controle de Zoom"
          />
          <span className="text-white/50 text-xs font-mono">+</span>
        </div>
        <button 
          onClick={() => { setZoomLevel(1); setPan({x:0, y:0}); setRotation(0); }}
          className="px-3 py-1.5 text-xs font-bold text-white/70 hover:text-white border border-white/20 hover:border-white/50 rounded-full transition-colors"
        >
          Resetar Visão
        </button>
      </div>
    </div>
  );
}
