/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { Upload, Eye, EyeOff, LayoutGrid, Sparkles, HelpCircle, AlertCircle, Info, Camera, X, SwitchCamera, Zap, ZapOff, ZoomIn, Loader2, ImageIcon, Focus, Plus } from 'lucide-react';
import { PhotoSection, ToothMarker, Procedure } from '../types';
import { DEMO_SVG_PLACEHOLDERS } from '../constants';
import { compressImage, compressFileToDataUrl } from '../lib/imageUtils';
import { listPatientFilesFromSupabase, downloadFileAsDataUrlFromSupabase, uploadPatientFileToSupabase } from '../lib/supabaseStorage';
import ImageMarkupEditor from './ImageMarkupEditor';

interface PhotoEditorProps {
  section: PhotoSection;
  procedures: Procedure[];
  onUpdateSection: (updatedSection: PhotoSection) => void;
  markerSize?: number;
  patientName?: string;
  driveFolderId?: string;
  onAddProcedure?: (proc: Procedure) => void;
}

export default function PhotoEditor({
  section,
  procedures,
  onUpdateSection,
  markerSize = 26,
  patientName = '',
  driveFolderId = '',
  onAddProcedure,
}: PhotoEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Local state for currently active / highlighted tooth marker
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [flashOn, setFlashOn] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomCapabilities, setZoomCapabilities] = useState<{min: number, max: number, step: number} | null>(null);
  const [hasFlash, setHasFlash] = useState(false);

  // Markup Editor Modal State
  const [isMarkupEditorOpen, setIsMarkupEditorOpen] = useState(false);

  // New advanced camera controls state
  const [cameraZoom, setCameraZoom] = useState<1 | 2>(1);
  const [cameraExposure, setCameraExposure] = useState<number>(1.0);
  const [focusLocked, setFocusLocked] = useState(false);
  const [showCameraGuide, setShowCameraGuide] = useState(true);

  // Patient Gallery Selector States
  const [showGallerySelector, setShowGallerySelector] = useState(false);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [isDownloadingFromGallery, setIsDownloadingFromGallery] = useState<string | null>(null);

  // Inline new procedure form state
  const [showInlineAddProc, setShowInlineAddProc] = useState(false);
  const [inlineProcName, setInlineProcName] = useState('');
  const [inlineProcPrice, setInlineProcPrice] = useState<number | string>('');

  const INLINE_COLORS = ['#22C55E', '#A855F7', '#EC4899', '#3B82F6', '#F97316', '#EAB308', '#06B6D4', '#EF4444'];

  const handleInlineAddProcedure = () => {
    if (!inlineProcName.trim() || !onAddProcedure) return;
    const parsedPrice = typeof inlineProcPrice === 'number' ? inlineProcPrice : parseFloat(String(inlineProcPrice)) || 0;
    const colorIndex = procedures.length % INLINE_COLORS.length;
    const newProc: Procedure = {
      id: 'p-' + Date.now().toString(),
      name: inlineProcName.trim(),
      price: Math.max(0, parsedPrice),
      color: INLINE_COLORS[colorIndex],
    };
    onAddProcedure(newProc);
    setInlineProcName('');
    setInlineProcPrice('');
    setShowInlineAddProc(false);
  };

  const handleOpenGallery = async () => {
    if (!patientName || patientName.trim() === '') {
      setGalleryError('Você precisa definir o nome do paciente primeiro (ou carregar um existente) para ter uma galeria ativa.');
      setShowGallerySelector(true);
      return;
    }
    setShowGallerySelector(true);
    setIsLoadingGallery(true);
    setGalleryError(null);
    try {
      const folderName = driveFolderId || patientName;
      const imgs = await listPatientFilesFromSupabase(folderName);
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const filteredImgs = (imgs || []).filter(f => 
        imageExtensions.some(ext => f.name.toLowerCase().endsWith(ext))
      );
      setGalleryImages(filteredImgs);
      if (filteredImgs.length === 0) {
        setGalleryError(`Nenhuma imagem encontrada na galeria do paciente "${patientName}".`);
      }
    } catch (err: any) {
      console.error(err);
      setGalleryError('Erro ao carregar galeria do Supabase: ' + err.message);
    } finally {
      setIsLoadingGallery(false);
    }
  };

  const handleSelectGalleryImage = async (fileId: string) => {
    try {
      setIsDownloadingFromGallery(fileId);
      const dataUrl = await downloadFileAsDataUrlFromSupabase(fileId);
      onUpdateSection({ ...section, image: dataUrl, markers: [] });
      setShowGallerySelector(false);
    } catch (err: any) {
      alert('Erro ao carregar imagem selecionada da galeria: ' + err.message);
    } finally {
      setIsDownloadingFromGallery(null);
    }
  };

  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setIsCameraActive(true);
    setCameraError(null);
    setFlashOn(false);
    setCameraZoom(1);
    setCameraExposure(1.0);
    setFocusLocked(false);

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        try {
          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities ? track.getCapabilities() : {} as any;
          
          setHasFlash(!!capabilities.torch);
          
          if (capabilities.zoom) {
            setZoomCapabilities({
              min: capabilities.zoom.min || 1,
              max: capabilities.zoom.max || 5,
              step: capabilities.zoom.step || 0.1
            });
            const settings = track.getSettings() as any;
            setZoom(settings.zoom || 1);
          } else {
            setZoomCapabilities(null);
          }
        } catch (e) {
          console.warn('Camera capabilities not supported', e);
        }
      }
    } catch (err) {
      console.error(err);
      setCameraError('Não foi possível acessar a câmera do aparelho. Verifique as permissões no navegador ou tente outro navegador.');
    }
  };

  const toggleFlash = async () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      const newFlashState = !flashOn;
      try {
        await track.applyConstraints({
           advanced: [{ torch: newFlashState }]
        } as any);
        setFlashOn(newFlashState);
      } catch (e) {
        console.error('Failed to toggle flash', e);
      }
    }
  };

  const handleZoomChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = Number(e.target.value);
    setZoom(newZoom);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      try {
        await track.applyConstraints({
           advanced: [{ zoom: newZoom }]
        } as any);
      } catch (e) {
        console.error('Failed to apply zoom', e);
      }
    }
  };

  const toggleCameraZoom = async () => {
    const nextZoom: 1 | 2 = cameraZoom === 1 ? 2 : 1;
    setCameraZoom(nextZoom);
    
    if (videoRef.current && videoRef.current.srcObject && zoomCapabilities) {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      try {
        const val = nextZoom === 2 ? Math.min(zoomCapabilities.max, 2.0) : 1.0;
        await track.applyConstraints({
          advanced: [{ zoom: val }]
        } as any);
        setZoom(val);
      } catch (e) {
        console.warn('Hardware zoom adjustment failed', e);
      }
    }
  };

  const handleExposureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCameraExposure(val);
    
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      try {
        const expCompensation = (val - 1.0) * 4.0;
        await track.applyConstraints({
          advanced: [{ exposureMode: 'manual', exposureCompensation: expCompensation }]
        } as any);
      } catch (err) {
        // Falls back to CSS brightness filter automatically
      }
    }
  };

  const toggleFocusLock = async () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      const nextFocusLock = !focusLocked;
      setFocusLocked(nextFocusLock);
      try {
        await track.applyConstraints({
          advanced: [{ focusMode: nextFocusLock ? 'manual' : 'continuous' }]
        } as any);
      } catch (e) {
        console.warn('Focus lock constraint not supported by hardware/browser', e);
      }
    }
  };

  const switchCamera = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    startCamera(newMode);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          
          // Apply exposure / brightness filter
          ctx.filter = `brightness(${cameraExposure})`;
          
          // Mirror frame if user camera is active
          if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          
          // Software crop zoom 2x fallback
          const isHardwareZoomActive = zoomCapabilities && zoom > 1.1;
          if (cameraZoom === 2 && !isHardwareZoomActive) {
            const sw = video.videoWidth / 2;
            const sh = video.videoHeight / 2;
            const sx = (video.videoWidth - sw) / 2;
            const sy = (video.videoHeight - sh) / 2;
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
          } else {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
          
          ctx.restore();
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          compressImage(dataUrl, 1024, 0.7).then((compressedDataUrl) => {
            onUpdateSection({ ...section, image: compressedDataUrl, markers: [] });
            stopCamera();
          });

          // Upload to Supabase patient folder in the background
          const folderName = driveFolderId || patientName;
          if (folderName) {
            canvas.toBlob(async (blob) => {
              if (blob) {
                try {
                  const filename = `${section.id}_capture_${Date.now()}.jpg`;
                  await uploadPatientFileToSupabase(folderName, blob, filename);
                  console.log(`Webcam capture saved to patient ${patientName} on Supabase`);
                } catch (err) {
                  console.warn("Failed to upload quadrant webcam snapshot to Supabase:", err);
                }
              }
            }, 'image/jpeg', 0.9);
          }
        }
      }
    }
  };

  const handleSaveMarkup = async (editedImage: string) => {
    onUpdateSection({
      ...section,
      image: editedImage
    });
    setIsMarkupEditorOpen(false);

    const folderName = driveFolderId || patientName;
    if (folderName) {
      try {
        const arr = editedImage.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const filename = `${section.id}_edited_${Date.now()}.jpg`;
        await uploadPatientFileToSupabase(folderName, blob, filename);
        console.log(`Edited quadrant saved to patient ${patientName} on Supabase`);
      } catch (err) {
        console.warn("Failed to upload edited quadrant to Supabase:", err);
      }
    }
  };

  // Helper arrays for tooth list rendering based on FDI notation
  const getTeethList = () => {
    if (section.id === 'upper') {
      // Upper Right (18 to 11) and Upper Left (21 to 28)
      return [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
    } else if (section.id === 'lower') {
      // Lower Right (48 to 41) and Lower Left (31 to 38)
      return [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
    } else {
      // Smile / Anterior teeth commonly displayed (upper and lower anterior)
      return [13, 12, 11, 21, 22, 23, 43, 42, 41, 31, 32, 33];
    }
  };

  const teethList = getTeethList();

  // Load standard pre-designed dental illustration SVG
  const handleLoadDemo = () => {
    onUpdateSection({
      ...section,
      image: DEMO_SVG_PLACEHOLDERS[section.id],
    });
  };

  // Upload actions
  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, faça upload de um arquivo de imagem.');
      return;
    }
    try {
      const compressedDataUrl = await compressFileToDataUrl(file, 1024, 0.7);
      onUpdateSection({
        ...section,
        image: compressedDataUrl,
      });

      // Upload to Supabase patient folder in the background
      const folderName = driveFolderId || patientName;
      if (folderName) {
        const filename = `${section.id}_upload_${Date.now()}_${file.name}`;
        await uploadPatientFileToSupabase(folderName, file, filename);
        console.log(`Quadrant upload saved to patient ${patientName} on Supabase`);
      }
    } catch (err) {
      console.warn("Failed to upload quadrant image upload to Supabase:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Toggle tooth marker existence on the image
  const toggleToothMarker = (toothNum: number) => {
    const existingIndex = section.markers.findIndex((m) => m.toothNumber === toothNum);
    
    if (existingIndex >= 0) {
      // Remove marker
      const updatedMarkers = section.markers.filter((m) => m.toothNumber !== toothNum);
      onUpdateSection({
        ...section,
        markers: updatedMarkers,
      });
      if (selectedMarkerId === `${section.id}-${toothNum}`) {
        setSelectedMarkerId(null);
      }
    } else {
      // Create new marker centered
      const newMarker: ToothMarker = {
        id: `${section.id}-${toothNum}`,
        toothNumber: toothNum,
        x: 50, // center default
        y: 60, // slightly lower center default
        procedures: [], // empty therapies initially
      };
      
      onUpdateSection({
        ...section,
        markers: [...section.markers, newMarker],
      });
      // Set focus to the newly created marker for immediate therapy allocation
      setSelectedMarkerId(newMarker.id);
    }
  };

  // Dragger state management (mouse down / touch start tracking)
  const handleMarkerDragStart = (markerId: string, e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setSelectedMarkerId(markerId); // focus on clicked dente
    
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    const onDragMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      let xPct = ((clientX - containerRect.left) / containerRect.width) * 100;
      let yPct = ((clientY - containerRect.top) / containerRect.height) * 100;

      // Bound clamp
      xPct = Math.max(3, Math.min(97, xPct));
      yPct = Math.max(3, Math.min(97, yPct));

      onUpdateSection({
        ...section,
        markers: section.markers.map((m) =>
          m.id === markerId ? { ...m, x: parseFloat(xPct.toFixed(1)), y: parseFloat(yPct.toFixed(1)) } : m
        ),
      });
    };

    const onDragEnd = () => {
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
      window.removeEventListener('touchmove', onDragMove);
      window.removeEventListener('touchend', onDragEnd);
    };

    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchmove', onDragMove, { passive: true });
    window.addEventListener('touchend', onDragEnd);
  };

  // Add or remove therapy from active tooth marker
  const toggleProcedureForMarker = (markerId: string, procId: string) => {
    onUpdateSection({
      ...section,
      markers: section.markers.map((m) => {
        if (m.id !== markerId) return m;
        
        const hasProc = m.procedures.includes(procId);
        const updatedProcs = hasProc
          ? m.procedures.filter((id) => id !== procId)
          : [...m.procedures, procId];
          
        // Synchronize procedureInstances
        let currentInstances = m.procedureInstances || [];
        
        // If it was empty/undefined, populate it from existing procedures first
        if (!m.procedureInstances || m.procedureInstances.length === 0) {
          currentInstances = m.procedures.map((pid, idx) => {
            const proc = procedures.find((p) => p.id === pid);
            return {
              id: `${m.id}-${pid}-${idx}`,
              procedureId: pid,
              name: proc ? proc.name : 'Procedimento',
              price: proc ? proc.price : 0,
              includeFinancial: true,
              status: 'A realizar' as const,
              date: '',
              dentist: '',
              faces: [],
              observation: '',
            };
          });
        }
        
        let updatedInstances;
        if (hasProc) {
          // Remove the corresponding instances of this procedure ID
          updatedInstances = currentInstances.filter((inst) => inst.procedureId !== procId);
        } else {
          // Add a new instance for this procedure ID
          const proc = procedures.find((p) => p.id === procId);
          const newInstId = `inst-${m.id}-${procId}-${Date.now()}`;
          const newInstance = {
            id: newInstId,
            procedureId: procId,
            name: proc ? proc.name : 'Procedimento',
            price: proc ? proc.price : 0,
            includeFinancial: true,
            status: 'A realizar' as const,
            date: '',
            dentist: '',
            faces: [],
            observation: '',
          };
          updatedInstances = [...currentInstances, newInstance];
        }
        
        return {
          ...m,
          procedures: updatedProcs,
          procedureInstances: updatedInstances,
        };
      }),
    });
  };

  // Update clinical notes for active tooth marker
  const updateNotesForMarker = (markerId: string, newNotes: string) => {
    onUpdateSection({
      ...section,
      markers: section.markers.map((m) => {
        if (m.id !== markerId) return m;
        return {
          ...m,
          notes: newNotes,
        };
      }),
    });
  };

  // Identify active marker object
  const activeMarker = section.markers.find((m) => m.id === selectedMarkerId);

  // Totalized section calculations
  const calculateSectionTotal = () => {
    return section.markers.reduce((sum, marker) => {
      if (marker.procedureInstances && marker.procedureInstances.length > 0) {
        const markerSum = marker.procedureInstances.reduce((pSum, inst) => {
          return pSum + (inst.includeFinancial !== false ? inst.price : 0);
        }, 0);
        return sum + markerSum;
      }
      const markerSum = marker.procedures.reduce((pSum, pid) => {
        const proc = procedures.find((p) => p.id === pid);
        return pSum + (proc ? proc.price : 0);
      }, 0);
      return sum + markerSum;
    }, 0);
  };

  const hasPhoto = !!section.image;

  return (
    <div className="bg-white border border-[#E6DEC9] rounded-xl overflow-hidden shadow-sm flex flex-col relative">
      {/* Câmera Modal */}
      {isCameraActive && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black">
          <div className="flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800 absolute top-0 left-0 right-0 z-10 shadow-lg">
            <h3 className="text-white font-bold text-sm tracking-wide">Captura de Foto</h3>
            <button onClick={stopCamera} className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-white hover:bg-red-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex-1 flex flex-col justify-center items-center bg-black relative">
            {cameraError ? (
              <div className="p-6 text-center max-w-sm">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-white font-medium text-sm">{cameraError}</p>
                <p className="text-zinc-500 mt-2 text-xs">A permissão da câmera pode ter sido negada ou o dispositivo não tem câmera disponível.</p>
              </div>
            ) : (
              <>
                <video 
                  ref={videoRef} 
                  className="w-full h-full object-contain bg-zinc-950 transition-all duration-200"
                  playsInline
                  muted
                  style={{ 
                    transform: `scale(${cameraZoom}) ${facingMode === 'user' ? 'scaleX(-1)' : ''}`,
                    filter: `brightness(${cameraExposure})`
                  }}
                />

                {/* SVG Alignment Guides */}
                {showCameraGuide && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-15">
                    {section.id === 'upper' && (
                      <svg viewBox="0 0 400 300" className="w-full max-w-xl h-auto text-yellow-500/40 fill-none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6">
                        <path d="M 80 225 C 80 85, 320 85, 320 225" />
                        <text x="200" y="45" fill="currentColor" fontSize="10" textAnchor="middle" fontWeight="bold" letterSpacing="1">GUIA: ARCADA SUPERIOR</text>
                      </svg>
                    )}
                    {section.id === 'lower' && (
                      <svg viewBox="0 0 400 300" className="w-full max-w-xl h-auto text-yellow-500/40 fill-none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6">
                        <path d="M 80 75 C 80 215, 320 215, 320 75" />
                        <text x="200" y="270" fill="currentColor" fontSize="10" textAnchor="middle" fontWeight="bold" letterSpacing="1">GUIA: ARCADA INFERIOR</text>
                      </svg>
                    )}
                    {section.id === 'smile' && (
                      <svg viewBox="0 0 400 300" className="w-full max-w-xl h-auto text-yellow-500/40 fill-none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6">
                        <ellipse cx="200" cy="150" rx="90" ry="45" />
                        <text x="200" y="85" fill="currentColor" fontSize="10" textAnchor="middle" fontWeight="bold" letterSpacing="1">GUIA: ESTÉTICA / SORRISO</text>
                      </svg>
                    )}
                  </div>
                )}
                
                {/* Camera Controls Overlay */}
                <div className="absolute top-20 right-4 flex flex-col gap-3 z-20">
                  <button 
                    onClick={switchCamera}
                    title="Alternar Câmera"
                    className="w-11 h-11 rounded-full bg-black/60 backdrop-blur border border-white/20 flex items-center justify-center text-white hover:bg-zinc-800 transition-colors active:scale-95"
                  >
                    <SwitchCamera className="w-5 h-5" />
                  </button>
                  
                  {hasFlash && (
                    <button 
                      onClick={toggleFlash}
                      title="Lanterna/Flash"
                      className={`w-11 h-11 rounded-full backdrop-blur border border-white/20 flex items-center justify-center transition-colors active:scale-95 ${flashOn ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-black/60 text-white hover:bg-zinc-800'}`}
                    >
                      {flashOn ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
                    </button>
                  )}

                  {/* Custom Zoom toggle button */}
                  <button
                    onClick={toggleCameraZoom}
                    title="Zoom (1x / 2x)"
                    className={`w-11 h-11 rounded-full backdrop-blur border border-white/20 flex items-center justify-center font-bold text-xs transition-colors active:scale-95 ${cameraZoom === 2 ? 'bg-[#C09553] text-black border-[#C09553]' : 'bg-black/60 text-white hover:bg-zinc-800'}`}
                  >
                    {cameraZoom}x
                  </button>

                  {/* Focus Lock control */}
                  <button
                    onClick={toggleFocusLock}
                    title="Travar Foco"
                    className={`w-11 h-11 rounded-full backdrop-blur border border-white/20 flex items-center justify-center transition-colors active:scale-95 ${focusLocked ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-black/60 text-white hover:bg-zinc-800'}`}
                  >
                    <Focus className="w-5 h-5" />
                  </button>

                  {/* Guide lines toggle */}
                  <button
                    onClick={() => setShowCameraGuide(prev => !prev)}
                    title="Mostrar/Ocultar Guia da Arcada"
                    className={`w-11 h-11 rounded-full backdrop-blur border border-white/20 flex items-center justify-center transition-colors active:scale-95 ${showCameraGuide ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-black/60 text-zinc-400 hover:bg-zinc-800'}`}
                  >
                    <LayoutGrid className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Exposure/Brightness adjustment overlay slider */}
                <div className="absolute bottom-28 left-6 right-6 md:left-auto md:right-6 md:w-64 z-20 bg-black/60 backdrop-blur rounded-2xl px-4 py-2.5 border border-white/10 flex items-center gap-3">
                  <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider min-w-[50px]">Brilho</span>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="1.5" 
                    step="0.05" 
                    value={cameraExposure} 
                    onChange={handleExposureChange}
                    className="flex-1 accent-[#C09553] cursor-pointer"
                  />
                  <span className="text-[10px] text-zinc-400 font-mono w-8 text-right">{Math.round(cameraExposure * 100)}%</span>
                </div>
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="p-6 bg-zinc-900 flex justify-center pb-10 absolute bottom-0 left-0 right-0">
            <button 
              onClick={takePhoto}
              disabled={!!cameraError}
              className="w-20 h-20 rounded-full border-4 border-white bg-red-600 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
            >
              <Camera className="w-8 h-8 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Patient Gallery Selector Modal */}
      {showGallerySelector && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-150 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] text-left">
            {/* Modal Header */}
            <div className="bg-[#4E1119] text-[#FAF8F5] p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#C09553]" />
                <div>
                  <h3 className="font-serif font-bold text-base">Fotos da Galeria do Paciente</h3>
                  <p className="text-[10px] text-[#E1CDAC] uppercase tracking-wider font-semibold">
                    {patientName || 'Nenhum paciente selecionado'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGallerySelector(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingGallery ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#C09553]" />
                  <p className="text-xs text-zinc-500 font-medium font-sans">Carregando fotos do Supabase...</p>
                </div>
              ) : galleryError ? (
                <div className="text-center py-8 px-4 flex flex-col items-center">
                  <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
                  <p className="text-sm font-semibold text-zinc-700">{galleryError}</p>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm leading-relaxed">
                    {patientName 
                      ? 'Adicione fotos à galeria deste paciente na guia "Galeria" para visualizá-las aqui.' 
                      : 'Carregue um paciente ou digite o nome na aba "Identificação" primeiro.'}
                  </p>
                  <button
                    onClick={() => setShowGallerySelector(false)}
                    className="mt-5 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Selecione uma foto da galeria do paciente para usar como imagem de fundo neste quadrante ({section.title}):
                  </p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {galleryImages.map((img) => {
                      const isDownloading = isDownloadingFromGallery === img.id;
                      return (
                        <button
                          key={img.id}
                          disabled={!!isDownloadingFromGallery}
                          onClick={() => handleSelectGalleryImage(img.id)}
                          className={`group text-left border rounded-xl overflow-hidden bg-zinc-50 relative focus:outline-none transition-all flex flex-col items-stretch ${
                            isDownloading 
                              ? 'border-[#C09553] ring-2 ring-[#C09553]/20' 
                              : 'border-zinc-200 hover:border-[#C09553] hover:shadow-md cursor-pointer'
                          }`}
                        >
                          <div className="aspect-square bg-zinc-100 overflow-hidden relative flex-1">
                            {img.thumbnailLink ? (
                              <img
                                src={img.thumbnailLink}
                                alt={img.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full text-zinc-400 text-[10px]">
                                Sem Miniatura
                              </div>
                            )}

                            {isDownloading && (
                              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white gap-1 animate-pulse">
                                <Loader2 className="w-6 h-6 animate-spin text-[#C09553]" />
                                <span className="text-[9px] font-bold">Baixando...</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="p-2 border-t border-zinc-100 bg-white text-center">
                            <p className="text-[10px] font-bold text-zinc-700 truncate">{img.name}</p>
                            <p className="text-[9px] text-zinc-400 font-medium">
                              {new Date(img.createdTime).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-[#FAF8F5] border-t border-[#E6DEC9] p-4 flex justify-between items-center">
              <button 
                type="button"
                onClick={() => {
                  handleLoadDemo();
                  setShowGallerySelector(false);
                }} 
                className="px-4 py-2 bg-white text-[#B48C4D] hover:bg-zinc-50 border border-[#E6DEC9] text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Usar Amostra</span>
              </button>
              
              <button
                onClick={() => setShowGallerySelector(false)}
                className="px-4 py-2 bg-[#4E1119] text-white hover:bg-[#6c1b26] text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab/Banner title */}
      <div className="bg-[#4E1119] text-[#FAF8F5] px-5 py-3 flex justify-between items-center select-none">
        <div>
          <h3 className="font-serif font-medium tracking-wide text-[15px]">
            {section.title}
          </h3>
          <p className="text-[10px] text-[#E1CDAC] uppercase tracking-wider font-semibold">
            {section.subtitle}
          </p>
        </div>
        
        {section.markers.length > 0 && (
          <span className="text-[10px] font-bold bg-[#FAF8F5]/10 text-[#C09553] border border-[#C09553]/40 rounded-full px-2.5 py-1 font-mono">
            R$ {calculateSectionTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white">
        
        {/* Interactive Editor Side (LHS) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          
          {/* Main Visual Frame */}
          <div
            id={`canvas-frame-${section.id}`}
            ref={containerRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative w-full aspect-video sm:aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all flex flex-col items-center justify-center select-none ${
              isDragOver
                ? 'border-dashed border-[#C09553] bg-amber-50/10 scale-[0.99]'
                : borderForState(hasPhoto)
            }`}
          >
            {hasPhoto ? (
              <>
                {/* Clinical Image */}
                <img
                  src={section.image!}
                  alt={section.title}
                  className="w-full h-full object-cover select-none pointer-events-none"
                  referrerPolicy="no-referrer"
                />

                {/* Dark overlay hint, hides on printing */}
                <div className="absolute bottom-2.5 left-2.5 bg-black/70 text-white text-[10px] px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-xs font-medium">
                  <Info className="w-3.5 h-3.5 text-[#C09553]" />
                  <span>Arraste os dentes para os dentes reais d'água</span>
                </div>

                {/* Markers Overlay Node */}
                {section.markers.map((marker) => {
                  const isFocused = marker.id === selectedMarkerId;
                  
                  return (
                    <div
                      key={marker.id}
                      id={`tooth-marker-${marker.id}`}
                      onMouseDown={(e) => handleMarkerDragStart(marker.id, e)}
                      onTouchStart={(e) => handleMarkerDragStart(marker.id, e)}
                      style={{
                        left: `${marker.x}%`,
                        top: `${marker.y}%`,
                        width: `${markerSize}px`,
                        height: `${markerSize}px`,
                        fontSize: marker.procedures.includes('p_21') ? `${Math.max(8, Math.round(markerSize * 0.35))}px` : `${Math.max(9, Math.round(markerSize * 0.42))}px`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className={`absolute z-10 rounded-full flex items-center justify-center font-bold bg-white text-zinc-950 transition-all cursor-grab active:cursor-grabbing shadow-lg select-none ${
                        isFocused
                          ? 'border-[2px] border-[#C09553] ring-3 ring-[#4E1119]/20 scale-105'
                          : 'border border-zinc-200 hover:border-zinc-400 hover:scale-105'
                      }`}
                      title={`Dente ${marker.toothNumber}. Clique para ver procedimentos.`}
                    >
                      {/* Custom Implant Icon logic */}
                      {marker.procedures.includes('p_21') ? (
                        <div className="flex flex-col items-center justify-center -mt-1">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-teal-600" style={{ width: `${markerSize * 0.55}px`, height: `${markerSize * 0.55}px` }}>
                            <path d="M7 5h10M9 9h6M10 13h4M11 17h2M8 5v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5M12 2v3" />
                          </svg>
                          <span className="absolute -bottom-2.5 bg-white border border-teal-600 text-teal-700 px-1 rounded-sm shadow-sm leading-none" style={{ fontSize: `${Math.max(8, Math.round(markerSize * 0.3))}px` }}>
                            {marker.toothNumber}
                          </span>
                        </div>
                      ) : (
                        <span>{marker.toothNumber}</span>
                      )}

                      {/* Associated Procedure Dots Overlay: Positioned precisely around the curve of the Tooth circle */}
                      {marker.procedures.length > 0 && (
                        <div 
                          className="absolute flex gap-0.5 justify-end"
                          style={{
                            bottom: `-${Math.round(markerSize * 0.1)}px`,
                            right: `-${Math.round(markerSize * 0.1)}px`,
                            maxWidth: `${markerSize * 1.5}px`,
                          }}
                        >
                          {marker.procedures.map((procId, idx) => {
                            const proc = procedures.find((p) => p.id === procId);
                            if (!proc) return null;
                            const dotSize = Math.max(5, Math.round(markerSize * 0.3));
                            return (
                              <span
                                key={`${procId}-${idx}`}
                                className="rounded-full border border-white shadow-xs block"
                                style={{ 
                                  backgroundColor: proc.color,
                                  width: `${dotSize}px`,
                                  height: `${dotSize}px`,
                                }}
                                title={proc.name}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              /* Dropzone Placeholder */
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#FAF8F5] border border-[#E6DEC9] mx-auto flex items-center justify-center text-[#B48C4D]">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#4E1119]">
                    Foto da {section.title}
                  </p>
                  <p className="text-xs text-zinc-400 max-w-sm mt-0.5 mx-auto">
                    Arraste o arquivo aqui ou clique abaixo para fazer o upload da foto da boca do paciente.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Check if it's likely a mobile device that handles capture="environment" well natively
                      // or just always use our custom WebRTC modal.
                      // Let's use custom WebRTC modal always to ensure consistency, 
                      // or let it be mobile if preferred. We'll use our custom modal.
                      startCamera();
                    }}
                    className="px-4 py-2 bg-[#FAF8F5] text-[#4E1119] border border-[#4E1119] hover:bg-[#F3EFE9] text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Tirar Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-[#4E1119] hover:bg-[#6c1b26] text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
                  >
                    Selecionar Foto
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenGallery}
                    className="px-4 py-2 bg-white text-[#B48C4D] hover:bg-zinc-50 border border-[#E6DEC9] text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Usar fotos salvas na galeria do paciente"
                  >
                    <ImageIcon className="w-3.5 h-3.5 select-none text-[#B48C4D]" />
                    <span>Usar da Galeria</span>
                  </button>
                </div>
              </div>
            )}

            {/* Hidden Input Files */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleFileChange}
              accept="image/*"
              capture="environment"
              className="hidden"
            />
          </div>

          {/* Load Sample alternative or Delete image buttons when image is visible */}
          {hasPhoto && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mt-2 w-full">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold text-[#B48C4D] hover:text-[#4E1119] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Trocar foto do quadrante</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMarkupEditorOpen(true)}
                className="text-xs font-bold text-[#8B0000] hover:text-[#C09553] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C09553]" />
                <span>Editar Imagem (Marcações/Adesivos)</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSection({ ...section, image: null, markers: [] })
                }
                className="text-xs font-semibold text-zinc-400 hover:text-red-600 transition-colors cursor-pointer"
              >
                Remover Imagem e Marcadores
              </button>
            </div>
          )}

        </div>

        {/* Teeth Selector and Treatment Mapping Box (RHS) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          
          {/* Teeth Select Grid */}
          <div className="border border-zinc-100 rounded-xl p-4 bg-[#FAF8F5]/40">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2.5">
              1. Selecionar Dentes a Tratar
            </span>
            
            <div className="flex flex-wrap gap-1.5 justify-start">
              {teethList.map((toothNum) => {
                const isActive = section.markers.some((m) => m.toothNumber === toothNum);
                return (
                  <button
                    key={toothNum}
                    id={`btn-tooth-toggle-${section.id}-${toothNum}`}
                    type="button"
                    onClick={() => toggleToothMarker(toothNum)}
                    className={`w-8.5 h-8.5 text-xs font-bold rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#4E1119] border-[#4E1119] text-white shadow-xs scale-105'
                        : 'bg-white border-zinc-200 text-zinc-600 hover:border-[#B48C4D]/60 hover:text-[#4E1119]'
                    }`}
                  >
                    {toothNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Specific Tooth Action mapping card */}
          {activeMarker ? (
            <div className="border-2 border-[#C09553]/50 bg-white rounded-xl p-4.5 shadow-sm space-y-3.5">
              
              {/* Header marker focus */}
              <div className="flex justify-between items-center border-b border-zinc-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-[#4E1119] text-white flex items-center justify-center text-xs font-bold font-mono">
                    {activeMarker.toothNumber}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-800">
                      Tratamento do Dente {activeMarker.toothNumber}
                    </h4>
                    <p className="text-[10px] text-zinc-400 font-medium">
                      Configure os procedimentos abaixo
                    </p>
                  </div>
                </div>
                
                {/* Release focus but keep tooth */}
                <button
                  type="button"
                  onClick={() => setSelectedMarkerId(null)}
                  className="text-[10px] font-bold text-[#B48C4D] bg-[#FAF8F5] border border-[#E6DEC9] rounded px-2 py-1 hover:bg-[#F3EFE9]"
                >
                  OK
                </button>
              </div>

              {/* Treatments Selector Checklist */}
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {procedures.map((proc) => {
                  const isChecked = activeMarker.procedures.includes(proc.id);
                  return (
                    <button
                      key={proc.id}
                      id={`opt-treatment-${section.id}-${activeMarker.toothNumber}-${proc.id}`}
                      type="button"
                      onClick={() => toggleProcedureForMarker(activeMarker.id, proc.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs border transition-all ${
                        isChecked
                          ? 'border-[#C09553]/40 bg-amber-50/20 font-medium'
                          : 'border-zinc-100 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2.5">
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${isChecked ? 'scale-125' : 'opacity-40'}`}
                          style={{ backgroundColor: proc.color }}
                        />
                        <span className="truncate text-zinc-700">{proc.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 flex-shrink-0 font-mono">
                        <span className="text-[10px] text-zinc-400 font-semibold">
                          R$ {proc.price.toLocaleString('pt-BR')}
                        </span>
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                            isChecked
                              ? 'bg-[#4E1119] border-[#4E1119] text-white'
                              : 'border-zinc-300 bg-white'
                          }`}
                        >
                          {isChecked && <CheckIcon className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Inline Add New Procedure */}
              {onAddProcedure && (
                <div className="pt-1">
                  {!showInlineAddProc ? (
                    <button
                      type="button"
                      onClick={() => setShowInlineAddProc(true)}
                      className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg border border-dashed border-[#C09553]/40 text-[11px] font-semibold text-[#B48C4D] hover:bg-amber-50/30 hover:border-[#C09553] transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Novo Procedimento / Valor</span>
                    </button>
                  ) : (
                    <div className="bg-[#FAF8F5] border border-[#E6DEC9] rounded-lg p-3 space-y-2 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#4E1119] uppercase tracking-wide">Novo Procedimento</span>
                        <button
                          type="button"
                          onClick={() => { setShowInlineAddProc(false); setInlineProcName(''); setInlineProcPrice(''); }}
                          className="text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Nome do procedimento"
                        value={inlineProcName}
                        onChange={(e) => setInlineProcName(e.target.value)}
                        className="w-full bg-white border border-zinc-200 focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000] rounded-md px-2.5 py-1.5 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none transition-all"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">R$</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Valor"
                            value={inlineProcPrice}
                            onChange={(e) => setInlineProcPrice(e.target.value)}
                            className="w-full bg-white border border-zinc-200 focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000] rounded-md pl-7 pr-2.5 py-1.5 text-xs font-mono text-zinc-800 placeholder-zinc-400 focus:outline-none transition-all"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleInlineAddProcedure}
                          disabled={!inlineProcName.trim()}
                          className="px-3 py-1.5 bg-[#4E1119] hover:bg-[#6c1b26] text-white text-xs font-semibold rounded-md flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Inserir</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mini calculation for this single tooth */}
              <div className="flex justify-between items-center text-[11px] pt-1 border-t border-dashed border-zinc-100">
                <span className="text-zinc-400 font-medium">Subtotal deste dente:</span>
                <span className="font-bold text-zinc-700 font-mono">
                  R${' '}
                  {(() => {
                    if (activeMarker.procedureInstances && activeMarker.procedureInstances.length > 0) {
                      return activeMarker.procedureInstances
                        .reduce((sum, inst) => sum + (inst.includeFinancial !== false ? inst.price : 0), 0)
                        .toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                    }
                    return activeMarker.procedures
                      .reduce((sum, pid) => {
                        const proc = procedures.find((p) => p.id === pid);
                        return sum + (proc ? proc.price : 0);
                      }, 0)
                      .toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                  })()}
                </span>
              </div>

              {/* Specific clinical notes/observations for this tooth */}
              <div className="space-y-1.5 pt-2.5 border-t border-dashed border-zinc-100">
                <label
                  htmlFor={`tooth-notes-${activeMarker.id}`}
                  className="text-[10px] font-bold text-[#4E1119] uppercase tracking-wide block flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B48C4D]" />
                  Observações Clínicas
                </label>
                <textarea
                  id={`tooth-notes-${activeMarker.id}`}
                  rows={2}
                  placeholder="Ex: canal tratado, desgaste acentuado, provisório necessário..."
                  value={activeMarker.notes || ''}
                  onChange={(e) => updateNotesForMarker(activeMarker.id, e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#D5CBB3] px-2.5 py-1.5 text-xs text-zinc-800 rounded-lg focus:outline-none focus:border-[#4E1119] resize-none leading-normal placeholder-zinc-400"
                />
              </div>

            </div>
          ) : (
            /* Standby panel helper */
            <div className="border border-zinc-100 bg-zinc-50/40 rounded-xl p-5 text-center flex-1 flex flex-col items-center justify-center">
              {section.markers.length === 0 ? (
                <>
                  <LayoutGrid className="w-7 h-7 text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-zinc-400">Nenhum dente ativo</p>
                  <p className="text-[10px] text-zinc-400 max-w-[200px] mt-0.5 mx-auto">
                    Para selecionar procedimentos, marque números de dentes acima.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-[#B48C4D] font-bold text-sm mb-2 font-mono">
                    {section.markers[0].toothNumber}
                  </div>
                  <p className="text-xs font-bold text-zinc-600">Mapeamento Clínico</p>
                  <p className="text-[10px] text-zinc-400 max-w-[200px] mt-1 mx-auto leading-relaxed">
                    Clique em qualquer <span className="bg-white border border-zinc-300 rounded px-1 text-zinc-700 font-bold">número</span> ativo no visual para configurar suas respectivas terapias.
                  </p>
                </>
              )}
            </div>
          )}

        </div>

      </div>

      {isMarkupEditorOpen && (
        <ImageMarkupEditor
          image={section.image || ''}
          onSave={handleSaveMarkup}
          onClose={() => setIsMarkupEditorOpen(false)}
          title={`Marcações clínicas - ${section.title}`}
        />
      )}
    </div>
  );
}

// Helpers
function borderForState(hasPhoto: boolean) {
  return hasPhoto
    ? 'border-[#E6DEC9] bg-zinc-900 shadow-inner'
    : 'border-dashed border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50/80 hover:border-zinc-300';
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={4.5}
      stroke="currentColor"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
