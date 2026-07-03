import React, { useRef, useState, useEffect } from 'react';
import { ShieldCheck, RotateCcw } from 'lucide-react';

interface SignatureCanvasProps {
  onSave: (base64: string) => void;
  onCancel?: () => void;
}

export function SignatureCanvas({ onSave, onCancel }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#38BDF8'; // Sky blue line
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, []);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    // Suporte para eventos Touch (dispositivos móveis)
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }

    // Suporte para eventos de Mouse
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: any) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const coords = getCoordinates(e);
    
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      setIsDrawing(true);
    }
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const coords = getCoordinates(e);

    if (ctx && canvas) {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      setHasSigned(true);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSigned(false);
    }
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (canvas && hasSigned) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  return (
    <div className="flex flex-col gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl max-w-md w-full">
      <div className="text-center">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Aceite Digital do Paciente</h3>
        <p className="text-slate-400 text-xs mt-1">Escreva sua assinatura digital utilizando o dedo ou caneta stylus na tela.</p>
      </div>

      {/* Área do Canvas */}
      <div className="relative border-2 border-dashed border-slate-700 bg-slate-950 rounded-xl overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          width={360}
          height={180}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full cursor-crosshair touch-none"
        />
        {!hasSigned && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-600 text-xs font-semibold uppercase tracking-widest">
            Assine aqui
          </div>
        )}
      </div>

      {/* Botões de Controle */}
      <div className="flex gap-2">
        <button
          onClick={handleClear}
          className="flex-1 py-2 text-xs font-bold bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-xl text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Limpar</span>
        </button>
        <button
          onClick={handleConfirm}
          disabled={!hasSigned}
          className="flex-1 py-2 text-xs font-bold bg-sky-600 border border-sky-500 disabled:bg-slate-800 disabled:border-slate-800 disabled:text-slate-500 hover:bg-sky-500 disabled:cursor-not-allowed rounded-xl text-white flex items-center justify-center gap-1.5 transition-colors"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Confirmar Aceite</span>
        </button>
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          className="text-slate-500 hover:text-slate-300 text-xs font-semibold py-1 transition-colors text-center"
        >
          Cancelar
        </button>
      )}
    </div>
  );
}
