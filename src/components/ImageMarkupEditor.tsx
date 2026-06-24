import React, { useRef, useState, useEffect } from 'react';
import { 
  RotateCw, 
  FlipHorizontal, 
  Brush, 
  Circle, 
  Trash2, 
  Check, 
  X, 
  Sliders, 
  Eraser, 
  Square,
  Sparkles,
  RefreshCw,
  Undo
} from 'lucide-react';

interface Shape {
  id: string;
  type: 'circle';
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  radius: number; // percentage
  color: string;
}

interface Sticker {
  id: string;
  type: 'implant' | 'molar' | 'premolar' | 'incisor' | 'bracket' | 'extraction' | 'arrow' | 'caries' | 'veneer' | 'crown' | 'rootcanal' | 'lesion';
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  scale: number;
  rotation: number; // degrees
}

interface StrokePoint {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

interface Stroke {
  points: StrokePoint[];
  color: string;
  size: number;
  isEraser: boolean;
}

interface ImageMarkupEditorProps {
  image: string; // base64 dataurl or url
  onSave: (editedImageBase64: string) => void;
  onClose: () => void;
  title?: string;
}

const STICKER_SVGS: Record<string, string> = {
  implant: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <rect x="38" y="5" width="24" height="15" rx="3" fill="#A97E3B" stroke="white" stroke-width="2"/>
    <path d="M40 20h20v6h-20zm4 6h12v8h-12z" fill="#D4AF37" stroke="white" stroke-width="2"/>
    <path d="M42 34h16l-2 8h-12zm1 8h14l-2 8h-10zm1 8h12l-2 8h-8zm1 8h10l-1 8h-8zm1 8h6v4h-6z" fill="#C0C0C0" stroke="white" stroke-width="2"/>
    <path d="M48 78l2 6 2-6z" fill="#808080"/>
  </svg>`,
  
  molar: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <path d="M20 25c0-10 10-15 20-10c5-5 15-5 20 0c10-5 20 0 20 10c0 15-5 25-10 35c-5 10-5 18-5 25c0 5-5 10-10 5c-5-5-5-10-15-5c-10-5-10 0-15 5c-5 5-10 0-10-5c0-7 0-15-5-25c-5-10-10-20-10-35z" fill="white" stroke="#4E1119" stroke-width="4" stroke-linejoin="round"/>
    <path d="M40 30c5 5 15 5 20 0M30 45c10 5 30 5 40 0M50 20v25" stroke="#C09553" stroke-width="3" stroke-linecap="round" fill="none"/>
  </svg>`,

  premolar: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <path d="M25 30c0-12 15-15 25-8c10-7 25-4 25 8c0 12-5 22-10 30c-5 8-5 18-5 24c0 4-4 8-8 4c-4-4-5-8-14-4c-9-4-10 0-14 4c-4 4-8 0-8-4c0-6 0-16-5-24c-5-8-10-18-10-30z" fill="white" stroke="#4E1119" stroke-width="4" stroke-linejoin="round"/>
    <path d="M42 35c3 3 13 3 16 0M35 48c10 4 20 4 30 0" stroke="#C09553" stroke-width="3" stroke-linecap="round" fill="none"/>
  </svg>`,

  incisor: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <path d="M30 20h40v35c0 15-10 25-20 35c-10-10-20-20-20-35V20z" fill="white" stroke="#4E1119" stroke-width="4" stroke-linejoin="round"/>
    <path d="M35 45c10 2 20 2 30 0" stroke="#C09553" stroke-width="3" stroke-linecap="round" fill="none"/>
  </svg>`,

  bracket: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <rect x="25" y="25" width="50" height="50" rx="8" fill="#C0C0C0" stroke="#4a5568" stroke-width="3"/>
    <rect x="35" y="35" width="30" height="30" rx="3" fill="#E2E8F0" stroke="#718096" stroke-width="2"/>
    <line x1="10" y1="50" x2="90" y2="50" stroke="#C09553" stroke-width="6"/>
    <line x1="50" y1="10" x2="50" y2="90" stroke="#718096" stroke-width="4"/>
  </svg>`,

  extraction: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <line x1="15" y1="15" x2="85" y2="85" stroke="#ef4444" stroke-width="12" stroke-linecap="round"/>
    <line x1="85" y1="15" x2="15" y2="85" stroke="#ef4444" stroke-width="12" stroke-linecap="round"/>
  </svg>`,

  arrow: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <path d="M15 50h55M45 20l30 30l-30 30" fill="none" stroke="#3b82f6" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  caries: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <path d="M30 40c0-10 15-20 25-10c10-10 25-5 20 15c-5 20-20 25-25 15c-5 10-20 0-20-20z" fill="#78350f" opacity="0.85" stroke="#451a03" stroke-width="3"/>
  </svg>`,

  veneer: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <path d="M30 20h40v35c0 15-10 25-20 35c-10-10-20-20-20-35V20z" fill="#f8fafc" stroke="#38bdf8" stroke-width="4" stroke-linejoin="round"/>
    <path d="M25 50Q50 65 75 50" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.6"/>
  </svg>`,

  crown: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <path d="M20 25c0-10 10-15 20-10c5-5 15-5 20 0c10-5 20 0 20 10c0 15-5 25-10 35c-5 10-5 18-5 25H35c0-7 0-15-5-25c-5-10-10-20-10-35z" fill="#fef08a" stroke="#ca8a04" stroke-width="4" stroke-linejoin="round"/>
    <path d="M25 45h50M30 60h40" stroke="#ca8a04" stroke-width="2" opacity="0.5"/>
  </svg>`,

  rootcanal: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <path d="M30 45c10 5 30 5 40 0M50 20v25" stroke="#dc2626" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M42 45v40M58 45v40" stroke="#dc2626" stroke-width="4" stroke-linecap="round" fill="none"/>
  </svg>`,

  lesion: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <circle cx="50" cy="85" r="10" fill="#fca5a5" stroke="#dc2626" stroke-width="3" opacity="0.8"/>
    <path d="M45 80L55 90M55 80L45 90" stroke="#dc2626" stroke-width="2"/>
  </svg>`
};

const COLORS = [
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#eab308', label: 'Amarelo' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#ffffff', label: 'Branco' },
];

export default function ImageMarkupEditor({
  image,
  onSave,
  onClose,
  title = 'Editor Clínico de Imagens'
}: ImageMarkupEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);

  // States
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [isMirrored, setIsMirrored] = useState(false);
  const [editorMode, setEditorMode] = useState<'view' | 'draw' | 'circle'>('view');
  
  // Brush states
  const [brushColor, setBrushColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  
  // Drawing states
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[] | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Annotation states
  const [circles, setCircles] = useState<Shape[]>([]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  
  // Selection states
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementType, setSelectedElementType] = useState<'circle' | 'sticker' | null>(null);
  
  // Saving state
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  // Reset drawing canvas and redraw strokes when strokes or mode changes
  useEffect(() => {
    redrawStrokes();
  }, [strokes, rotation, isMirrored]);

  const rotateImage = () => {
    setRotation(prev => {
      if (prev === 0) return 90;
      if (prev === 90) return 180;
      if (prev === 180) return 270;
      return 0;
    });
  };

  const toggleMirror = () => {
    setIsMirrored(prev => !prev);
  };

  // Helper to get mouse/touch position relative to canvas (percentage)
  const getEventCoordinates = (e: React.MouseEvent | React.TouchEvent): StrokePoint | null => {
    if (!drawingCanvasRef.current) return null;
    const canvas = drawingCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    
    return { 
      x: Math.max(0, Math.min(100, x)), 
      y: Math.max(0, Math.min(100, y)) 
    };
  };

  // Drawing Handlers
  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (editorMode !== 'draw') return;
    e.preventDefault();
    const coords = getEventCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    setCurrentStroke([coords]);
    setSelectedElementId(null);
    setSelectedElementType(null);
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStroke) return;
    e.preventDefault();
    const coords = getEventCoordinates(e);
    if (!coords) return;

    setCurrentStroke(prev => prev ? [...prev, coords] : [coords]);

    // Fast preview draw directly on canvas
    if (drawingCanvasRef.current) {
      const canvas = drawingCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const lastPt = currentStroke[currentStroke.length - 1];
        const canvasX = (coords.x / 100) * canvas.width;
        const canvasY = (coords.y / 100) * canvas.height;
        const lastCanvasX = (lastPt.x / 100) * canvas.width;
        const lastCanvasY = (lastPt.y / 100) * canvas.height;

        ctx.beginPath();
        if (isEraser) {
          ctx.globalCompositeOperation = 'destination-out';
        } else {
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.moveTo(lastCanvasX, lastCanvasY);
        ctx.lineTo(canvasX, canvasY);
        ctx.stroke();
      }
    }
  };

  const handleStopDraw = () => {
    if (!isDrawing || !currentStroke) return;
    setIsDrawing(false);
    
    if (currentStroke.length > 1) {
      setStrokes(prev => [...prev, {
        points: currentStroke,
        color: brushColor,
        size: brushSize,
        isEraser
      }]);
    }
    setCurrentStroke(null);
  };

  const redrawStrokes = () => {
    if (!drawingCanvasRef.current) return;
    const canvas = drawingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (stroke.isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      const firstPt = stroke.points[0];
      ctx.moveTo((firstPt.x / 100) * canvas.width, (firstPt.y / 100) * canvas.height);

      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        ctx.lineTo((pt.x / 100) * canvas.width, (pt.y / 100) * canvas.height);
      }
      ctx.stroke();
    });
    
    // reset global composite operation
    ctx.globalCompositeOperation = 'source-over';
  };

  const undoLastStroke = () => {
    setStrokes(prev => prev.slice(0, -1));
  };

  const clearAllDrawings = () => {
    if (window.confirm("Deseja apagar todos os desenhos feitos nesta imagem?")) {
      setStrokes([]);
    }
  };

  // Sticker & Shape Management
  const addCircle = () => {
    const newCircle: Shape = {
      id: `circle-${Date.now()}`,
      type: 'circle',
      x: 50,
      y: 50,
      radius: 8,
      color: brushColor
    };
    setCircles(prev => [...prev, newCircle]);
    setSelectedElementId(newCircle.id);
    setSelectedElementType('circle');
    setEditorMode('view');
  };

  const addSticker = (type: Sticker['type']) => {
    const newSticker: Sticker = {
      id: `sticker-${type}-${Date.now()}`,
      type,
      x: 50,
      y: 50,
      scale: 1.0,
      rotation: 0
    };
    setStickers(prev => [...prev, newSticker]);
    setSelectedElementId(newSticker.id);
    setSelectedElementType('sticker');
    setEditorMode('view');
  };

  const removeSelectedElement = () => {
    if (!selectedElementId) return;
    if (selectedElementType === 'circle') {
      setCircles(prev => prev.filter(c => c.id !== selectedElementId));
    } else if (selectedElementType === 'sticker') {
      setStickers(prev => prev.filter(s => s.id !== selectedElementId));
    }
    setSelectedElementId(null);
    setSelectedElementType(null);
  };

  // Handle Dragging circles/stickers on UI overlay
  const handleElementDragStart = (
    id: string, 
    type: 'circle' | 'sticker', 
    e: React.MouseEvent | React.TouchEvent
  ) => {
    e.stopPropagation();
    setSelectedElementId(id);
    setSelectedElementType(type);
    
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    const onDragMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      let xPct = ((clientX - containerRect.left) / containerRect.width) * 100;
      let yPct = ((clientY - containerRect.top) / containerRect.height) * 100;

      xPct = Math.max(0, Math.min(100, xPct));
      yPct = Math.max(0, Math.min(100, yPct));

      if (type === 'circle') {
        setCircles(prev => prev.map(c => c.id === id ? { ...c, x: parseFloat(xPct.toFixed(1)), y: parseFloat(yPct.toFixed(1)) } : c));
      } else {
        setStickers(prev => prev.map(s => s.id === id ? { ...s, x: parseFloat(xPct.toFixed(1)), y: parseFloat(yPct.toFixed(1)) } : s));
      }
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

  const getSelectedElement = () => {
    if (!selectedElementId) return null;
    if (selectedElementType === 'circle') {
      return circles.find(c => c.id === selectedElementId);
    }
    return stickers.find(s => s.id === selectedElementId);
  };

  const updateSelectedElementProperty = (property: string, value: any) => {
    if (!selectedElementId) return;
    if (selectedElementType === 'circle') {
      setCircles(prev => prev.map(c => c.id === selectedElementId ? { ...c, [property]: value } : c));
    } else if (selectedElementType === 'sticker') {
      setStickers(prev => prev.map(s => s.id === selectedElementId ? { ...s, [property]: value } : s));
    }
  };

  // SVG Loader helper for saving
  const loadSvgImage = (svgString: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString);
    });
  };

  // Base image loader helper
  const loadImage = (srcString: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = srcString;
    });
  };

  // Renders the final combined canvas and calls onSave
  const handleSaveImage = async () => {
    setIsSavingProgress(true);
    try {
      const baseImg = await loadImage(image);
      
      // Determine final canvas size based on rotation
      const is90or270 = rotation === 90 || rotation === 270;
      const finalWidth = is90or270 ? baseImg.naturalHeight : baseImg.naturalWidth;
      const finalHeight = is90or270 ? baseImg.naturalWidth : baseImg.naturalHeight;

      const saveCanvas = document.createElement('canvas');
      saveCanvas.width = finalWidth;
      saveCanvas.height = finalHeight;
      const ctx = saveCanvas.getContext('2d');

      if (!ctx) {
        throw new Error("Could not acquire 2D context for final render");
      }

      // Step 1: Draw base image with rotation & mirror applied
      ctx.save();
      ctx.translate(finalWidth / 2, finalHeight / 2);
      
      // Apply rotation
      ctx.rotate((rotation * Math.PI) / 180);
      
      // Apply mirror
      if (isMirrored) {
        ctx.scale(-1, 1);
      }

      ctx.drawImage(
        baseImg, 
        -baseImg.naturalWidth / 2, 
        -baseImg.naturalHeight / 2, 
        baseImg.naturalWidth, 
        baseImg.naturalHeight
      );
      ctx.restore();

      // Step 2: Draw drawings/strokes
      strokes.forEach(stroke => {
        if (stroke.points.length < 2) return;
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = (stroke.size / 100) * Math.max(finalWidth, finalHeight); // scale relative to image size
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (stroke.isEraser) {
          ctx.globalCompositeOperation = 'destination-out';
        } else {
          ctx.globalCompositeOperation = 'source-over';
        }

        const firstPt = stroke.points[0];
        ctx.moveTo((firstPt.x / 100) * finalWidth, (firstPt.y / 100) * finalHeight);

        for (let i = 1; i < stroke.points.length; i++) {
          const pt = stroke.points[i];
          ctx.lineTo((pt.x / 100) * finalWidth, (pt.y / 100) * finalHeight);
        }
        ctx.stroke();
        ctx.restore();
      });

      // Step 3: Draw circles
      circles.forEach(circle => {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = circle.color;
        // Stroke width relative to image size
        ctx.lineWidth = Math.max(finalWidth, finalHeight) * 0.005 || 3;
        
        const cx = (circle.x / 100) * finalWidth;
        const cy = (circle.y / 100) * finalHeight;
        const radius = (circle.radius / 100) * Math.min(finalWidth, finalHeight);

        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
      });

      // Step 4: Draw stickers
      for (const sticker of stickers) {
        ctx.save();
        const svgString = STICKER_SVGS[sticker.type];
        if (svgString) {
          try {
            const stickerImg = await loadSvgImage(svgString);
            
            const sx = (sticker.x / 100) * finalWidth;
            const sy = (sticker.y / 100) * finalHeight;
            
            // Standard size of sticker is 15% of the minor axis of the image
            const size = Math.min(finalWidth, finalHeight) * 0.15 * sticker.scale;
            
            ctx.translate(sx, sy);
            ctx.rotate((sticker.rotation * Math.PI) / 180);
            ctx.drawImage(stickerImg, -size / 2, -size / 2, size, size);
          } catch (e) {
            console.error("Failed to load sticker SVG: ", sticker.type, e);
          }
        }
        ctx.restore();
      }

      // Step 5: Export as Base64 Data URL
      const dataUrl = saveCanvas.toDataURL('image/jpeg', 0.92);
      onSave(dataUrl);
    } catch (err: any) {
      alert("Erro ao salvar marcações: " + err.message);
      console.error(err);
    } finally {
      setIsSavingProgress(false);
    }
  };

  const selectedElement = getSelectedElement();

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-fade-in">
      <div className="bg-[#111317] border border-[#E6DEC9]/20 rounded-3xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl text-zinc-100">
        
        {/* Header */}
        <div className="bg-[#16181D] px-6 py-4 border-b border-[#E6DEC9]/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#C09553]/15 flex items-center justify-center border border-[#C09553]/25">
              <Sparkles className="w-4 h-4 text-[#C09553]" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm sm:text-base text-[#FAF8F5]">{title}</h3>
              <p className="text-[10px] text-zinc-400 font-sans tracking-wide uppercase">Desenhos, círculos de diagnóstico e implantes</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Left Panel: Tools */}
          <div className="w-full md:w-80 bg-[#16181D] border-b md:border-b-0 md:border-r border-[#E6DEC9]/10 p-5 flex flex-col gap-6 overflow-y-auto min-h-0 select-none">
            
            {/* Rotation & Flip */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-[#C09553] tracking-widest uppercase">1. Orientar Foto</span>
              <div className="flex gap-2.5">
                <button
                  onClick={rotateImage}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-zinc-700 cursor-pointer active:scale-95"
                >
                  <RotateCw className="w-3.5 h-3.5 text-[#C09553]" />
                  Girar 90°
                </button>
                <button
                  onClick={toggleMirror}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border cursor-pointer active:scale-95 ${isMirrored ? 'bg-[#C09553] text-black border-[#C09553]' : 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700'}`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  Espelhar H
                </button>
              </div>
            </div>

            {/* Freehand Brush Annotations */}
            <div className="space-y-3.5 border-t border-zinc-800/80 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-[#C09553] tracking-widest uppercase">2. Caneta Clínica</span>
                {strokes.length > 0 && (
                  <button
                    onClick={undoLastStroke}
                    className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Undo className="w-3 h-3" /> Desfazer
                  </button>
                )}
              </div>

              {/* Mode toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditorMode('draw'); setIsEraser(false); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${editorMode === 'draw' && !isEraser ? 'bg-[#8B0000] text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                >
                  <Brush className="w-3.5 h-3.5" /> Desenhar
                </button>
                <button
                  onClick={() => { setEditorMode('draw'); setIsEraser(true); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${editorMode === 'draw' && isEraser ? 'bg-[#8B0000] text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                >
                  <Eraser className="w-3.5 h-3.5" /> Borracha
                </button>
              </div>

              {editorMode === 'draw' && (
                <div className="space-y-3 p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 animate-fadeIn">
                  {/* Brush Colors */}
                  {!isEraser && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-400 font-semibold uppercase">Cor do Traço</label>
                      <div className="flex justify-between">
                        {COLORS.map(c => (
                          <button
                            key={c.value}
                            onClick={() => setBrushColor(c.value)}
                            style={{ backgroundColor: c.value }}
                            className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${brushColor === c.value ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-65 hover:opacity-100'}`}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Brush Size */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-zinc-400 font-semibold uppercase">
                      <span>Espessura</span>
                      <span>{brushSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="16"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-full accent-[#8B0000] cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={clearAllDrawings}
                    className="w-full py-1.5 bg-zinc-950 hover:bg-red-950/20 text-zinc-500 hover:text-red-400 text-[10px] font-bold uppercase rounded-lg border border-zinc-800 transition-colors cursor-pointer"
                  >
                    Apagar Todos Desenhos
                  </button>
                </div>
              )}
            </div>

            {/* Diagnostic Circles & Dental Stickers */}
            <div className="space-y-3 border-t border-zinc-800/80 pt-4 flex-1 flex flex-col min-h-0">
              <span className="text-[10px] font-bold text-[#C09553] tracking-widest uppercase">3. Demarcações e Adesivos</span>
              
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {/* Circle Marker */}
                <button
                  onClick={addCircle}
                  className="w-full py-2.5 bg-zinc-850 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-zinc-700 transition-all cursor-pointer active:scale-95"
                >
                  <Circle className="w-3.5 h-3.5 text-[#C09553]" />
                  Adicionar Círculo de Diagnóstico
                </button>

                {/* Stickers Grid */}
                <div className="space-y-3 pt-2 pb-6">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Adesivos Odontológicos</label>
                  
                  {/* Diagnóstico Geral */}
                  <details className="group bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden" open>
                    <summary className="text-[11px] font-bold text-zinc-300 p-3 cursor-pointer select-none hover:bg-zinc-800/50 transition-colors flex justify-between items-center">
                      Diagnóstico Geral
                      <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="grid grid-cols-3 gap-2 p-3 pt-0">
                      <button onClick={() => addSticker('molar')} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left flex flex-col items-center gap-1 transition-all group/btn"><div className="w-6 h-6 flex items-center justify-center group-hover/btn:scale-105 transition-transform" dangerouslySetInnerHTML={{ __html: STICKER_SVGS.molar }} /><span className="text-[8px] font-bold uppercase tracking-wide text-zinc-400 group-hover/btn:text-white">Molar</span></button>
                      <button onClick={() => addSticker('premolar')} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left flex flex-col items-center gap-1 transition-all group/btn"><div className="w-6 h-6 flex items-center justify-center group-hover/btn:scale-105 transition-transform" dangerouslySetInnerHTML={{ __html: STICKER_SVGS.premolar }} /><span className="text-[8px] font-bold uppercase tracking-wide text-zinc-400 group-hover/btn:text-white">Pré-Molar</span></button>
                      <button onClick={() => addSticker('incisor')} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left flex flex-col items-center gap-1 transition-all group/btn"><div className="w-6 h-6 flex items-center justify-center group-hover/btn:scale-105 transition-transform" dangerouslySetInnerHTML={{ __html: STICKER_SVGS.incisor }} /><span className="text-[8px] font-bold uppercase tracking-wide text-zinc-400 group-hover/btn:text-white">Incisivo</span></button>
                      <button onClick={() => addSticker('extraction')} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left flex flex-col items-center gap-1 transition-all group/btn"><div className="w-6 h-6 flex items-center justify-center group-hover/btn:scale-105 transition-transform" dangerouslySetInnerHTML={{ __html: STICKER_SVGS.extraction }} /><span className="text-[8px] font-bold uppercase tracking-wide text-zinc-400 group-hover/btn:text-white">Extração</span></button>
                      <button onClick={() => addSticker('arrow')} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left flex flex-col items-center gap-1 transition-all group/btn"><div className="w-6 h-6 flex items-center justify-center group-hover/btn:scale-105 transition-transform" dangerouslySetInnerHTML={{ __html: STICKER_SVGS.arrow }} /><span className="text-[8px] font-bold uppercase tracking-wide text-zinc-400 group-hover/btn:text-white">Seta</span></button>
                      <button onClick={() => addSticker('caries')} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left flex flex-col items-center gap-1 transition-all group/btn"><div className="w-6 h-6 flex items-center justify-center group-hover/btn:scale-105 transition-transform" dangerouslySetInnerHTML={{ __html: STICKER_SVGS.caries }} /><span className="text-[8px] font-bold uppercase tracking-wide text-zinc-400 group-hover/btn:text-white">Cárie</span></button>
                    </div>
                  </details>

                  {/* Implantodontia */}
                  <details className="group bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
                    <summary className="text-[11px] font-bold text-zinc-300 p-3 cursor-pointer select-none hover:bg-zinc-800/50 transition-colors flex justify-between items-center">
                      Implantodontia
                      <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="grid grid-cols-3 gap-2 p-3 pt-0">
                      <button onClick={() => addSticker('implant')} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left flex flex-col items-center gap-1 transition-all group/btn"><div className="w-6 h-6 flex items-center justify-center text-[#C09553] group-hover/btn:scale-105 transition-transform" dangerouslySetInnerHTML={{ __html: STICKER_SVGS.implant }} /><span className="text-[8px] font-bold uppercase tracking-wide text-zinc-400 group-hover/btn:text-white">Implante</span></button>
                    </div>
                  </details>

                  {/* Ortodontia */}
                  <details className="group bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
                    <summary className="text-[11px] font-bold text-zinc-300 p-3 cursor-pointer select-none hover:bg-zinc-800/50 transition-colors flex justify-between items-center">
                      Ortodontia
                      <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="grid grid-cols-3 gap-2 p-3 pt-0">
                      <button onClick={() => addSticker('bracket')} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left flex flex-col items-center gap-1 transition-all group/btn"><div className="w-6 h-6 flex items-center justify-center group-hover/btn:scale-105 transition-transform" dangerouslySetInnerHTML={{ __html: STICKER_SVGS.bracket }} /><span className="text-[8px] font-bold uppercase tracking-wide text-zinc-400 group-hover/btn:text-white">Braquete</span></button>
                    </div>
                  </details>

                  {/* Estética e Prótese */}
                  <details className="group bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
                    <summary className="text-[11px] font-bold text-zinc-300 p-3 cursor-pointer select-none hover:bg-zinc-800/50 transition-colors flex justify-between items-center">
                      Estética e Prótese
                      <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="grid grid-cols-3 gap-2 p-3 pt-0">
                      <button onClick={() => addSticker('veneer')} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left flex flex-col items-center gap-1 transition-all group/btn"><div className="w-6 h-6 flex items-center justify-center group-hover/btn:scale-105 transition-transform" dangerouslySetInnerHTML={{ __html: STICKER_SVGS.veneer }} /><span className="text-[8px] font-bold uppercase tracking-wide text-zinc-400 group-hover/btn:text-white">Faceta</span></button>
                      <button onClick={() => addSticker('crown')} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left flex flex-col items-center gap-1 transition-all group/btn"><div className="w-6 h-6 flex items-center justify-center group-hover/btn:scale-105 transition-transform" dangerouslySetInnerHTML={{ __html: STICKER_SVGS.crown }} /><span className="text-[8px] font-bold uppercase tracking-wide text-zinc-400 group-hover/btn:text-white">Coroa</span></button>
                    </div>
                  </details>

                  {/* Endodontia */}
                  <details className="group bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
                    <summary className="text-[11px] font-bold text-zinc-300 p-3 cursor-pointer select-none hover:bg-zinc-800/50 transition-colors flex justify-between items-center">
                      Endodontia
                      <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="grid grid-cols-3 gap-2 p-3 pt-0">
                      <button onClick={() => addSticker('rootcanal')} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left flex flex-col items-center gap-1 transition-all group/btn"><div className="w-6 h-6 flex items-center justify-center group-hover/btn:scale-105 transition-transform" dangerouslySetInnerHTML={{ __html: STICKER_SVGS.rootcanal }} /><span className="text-[8px] font-bold uppercase tracking-wide text-zinc-400 group-hover/btn:text-white">Canal</span></button>
                      <button onClick={() => addSticker('lesion')} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left flex flex-col items-center gap-1 transition-all group/btn"><div className="w-6 h-6 flex items-center justify-center group-hover/btn:scale-105 transition-transform" dangerouslySetInnerHTML={{ __html: STICKER_SVGS.lesion }} /><span className="text-[8px] font-bold uppercase tracking-wide text-zinc-400 group-hover/btn:text-white">Lesão</span></button>
                    </div>
                  </details>

                </div>
              </div>
            </div>

          </div>

          {/* Center Canvas Viewport */}
          <div 
            onClick={() => { setSelectedElementId(null); setSelectedElementType(null); }}
            className="flex-1 bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden min-h-0"
          >
            {/* Guide label */}
            <div className="absolute top-4 left-4 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 border border-zinc-800 rounded-xl text-[10px] text-zinc-400 font-mono select-none pointer-events-none z-10">
              Modo: {editorMode === 'draw' ? (isEraser ? 'Borracha clínica ativada' : 'Caneta clínica ativada') : editorMode === 'circle' ? 'Clique para adicionar círculo' : 'Visualização livre de objetos'}
            </div>

            {/* Workspace holding image and markup overlays */}
            <div 
              ref={containerRef}
              className="relative max-w-full max-h-[70vh] aspect-video bg-zinc-900 shadow-inner rounded-xl overflow-hidden"
              style={{
                height: '500px',
                width: 'auto',
                maxWidth: '100%',
                maxHeight: '100%',
                aspectRatio: '4/3'
              }}
            >
              {/* 1. Base Image with rotation/mirror filters */}
              <img
                src={image}
                alt="Editor Base"
                className="w-full h-full object-contain pointer-events-none select-none"
                style={{
                  transform: `rotate(${rotation}deg) scaleX(${isMirrored ? -1 : 1})`,
                  transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />

              {/* 2. Drawing Canvas overlay */}
              <canvas
                ref={drawingCanvasRef}
                width="800"
                height="600"
                onMouseDown={handleStartDraw}
                onMouseMove={handleDrawMove}
                onMouseUp={handleStopDraw}
                onMouseLeave={handleStopDraw}
                onTouchStart={handleStartDraw}
                onTouchMove={handleDrawMove}
                onTouchEnd={handleStopDraw}
                className={`absolute inset-0 w-full h-full ${editorMode === 'draw' ? 'cursor-crosshair z-20' : 'pointer-events-none z-10'}`}
              />

              {/* 3. Circles overlay (interactive HTML) */}
              {circles.map(circle => (
                <div
                  key={circle.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedElementId(circle.id);
                    setSelectedElementType('circle');
                  }}
                  onMouseDown={(e) => handleElementDragStart(circle.id, 'circle', e)}
                  onTouchStart={(e) => handleElementDragStart(circle.id, 'circle', e)}
                  style={{
                    left: `${circle.x}%`,
                    top: `${circle.y}%`,
                    width: `${circle.radius * 2}%`,
                    height: `${circle.radius * 2}%`,
                    borderColor: circle.color,
                    borderWidth: selectedElementId === circle.id ? '3px' : '2px',
                    transform: 'translate(-50%, -50%)',
                    cursor: 'move'
                  }}
                  className={`absolute rounded-full border border-dashed flex items-center justify-center transition-all ${selectedElementId === circle.id ? 'ring-2 ring-white/55 ring-offset-2 ring-offset-black z-30' : 'hover:border-zinc-300 z-20'}`}
                />
              ))}

              {/* 4. Stickers overlay (interactive HTML) */}
              {stickers.map(sticker => (
                <div
                  key={sticker.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedElementId(sticker.id);
                    setSelectedElementType('sticker');
                  }}
                  onMouseDown={(e) => handleElementDragStart(sticker.id, 'sticker', e)}
                  onTouchStart={(e) => handleElementDragStart(sticker.id, 'sticker', e)}
                  style={{
                    left: `${sticker.x}%`,
                    top: `${sticker.y}%`,
                    width: `${15 * sticker.scale}%`,
                    height: `${15 * sticker.scale}%`,
                    transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
                    cursor: 'move',
                  }}
                  className={`absolute flex items-center justify-center select-none ${selectedElementId === sticker.id ? 'border-2 border-dashed border-[#C09553] p-1 bg-black/30 rounded-xl z-30' : 'z-20'}`}
                >
                  <div 
                    className="w-full h-full pointer-events-none" 
                    dangerouslySetInnerHTML={{ __html: STICKER_SVGS[sticker.type] }} 
                  />
                  {selectedElementId === sticker.id && (
                    <div className="absolute -top-6 bg-zinc-900 border border-zinc-800 text-[8px] text-zinc-300 px-1 py-0.5 rounded font-mono uppercase tracking-wider scale-75 whitespace-nowrap">
                      {sticker.type}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Slider / Element Adjustments toolbar */}
            {selectedElement && (
              <div className="w-full max-w-xl mt-4 bg-[#16181D]/90 backdrop-blur border border-[#E6DEC9]/10 p-4 rounded-2xl flex flex-col gap-3.5 shadow-xl z-40 select-none">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="text-[10px] font-bold text-[#C09553] tracking-wider uppercase flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" /> Ajustar Elemento Selecionado
                  </span>
                  <button
                    onClick={removeSelectedElement}
                    className="p-1 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remover
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedElementType === 'circle' ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-400 font-semibold uppercase">
                        <span>Raio do Círculo</span>
                        <span>{(selectedElement as Shape).radius}%</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="25"
                        step="0.5"
                        value={(selectedElement as Shape).radius}
                        onChange={(e) => updateSelectedElementProperty('radius', parseFloat(e.target.value))}
                        className="w-full accent-[#C09553] cursor-pointer"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-400 font-semibold uppercase">
                        <span>Tamanho (Escala)</span>
                        <span>{Math.round((selectedElement as Sticker).scale * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.3"
                        max="3.0"
                        step="0.1"
                        value={(selectedElement as Sticker).scale}
                        onChange={(e) => updateSelectedElementProperty('scale', parseFloat(e.target.value))}
                        className="w-full accent-[#C09553] cursor-pointer"
                      />
                    </div>
                  )}

                  {selectedElementType === 'sticker' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-400 font-semibold uppercase">
                        <span>Rotação</span>
                        <span>{(selectedElement as Sticker).rotation}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="5"
                        value={(selectedElement as Sticker).rotation}
                        onChange={(e) => updateSelectedElementProperty('rotation', parseInt(e.target.value))}
                        className="w-full accent-[#C09553] cursor-pointer"
                      />
                    </div>
                  )}

                  {selectedElementType === 'circle' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-400 font-semibold uppercase block">Cor do Círculo</label>
                      <div className="flex gap-2">
                        {COLORS.map(c => (
                          <button
                            key={c.value}
                            onClick={() => updateSelectedElementProperty('color', c.value)}
                            style={{ backgroundColor: c.value }}
                            className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${(selectedElement as Shape).color === c.value ? 'border-white scale-110' : 'border-transparent opacity-60'}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="bg-[#16181D] px-6 py-4 border-t border-[#E6DEC9]/10 flex justify-end gap-3 select-none">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl border border-zinc-700 transition-all cursor-pointer active:scale-95"
            disabled={isSavingProgress}
          >
            Cancelar
          </button>
          
          <button
            onClick={handleSaveImage}
            disabled={isSavingProgress}
            className="px-6 py-2.5 bg-[#C09553] hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md active:scale-95 flex items-center gap-1.5"
          >
            {isSavingProgress ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Salvar Marcações
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
