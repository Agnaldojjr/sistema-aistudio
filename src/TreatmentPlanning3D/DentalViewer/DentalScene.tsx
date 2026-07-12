import React, { Suspense, Component, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { ToothMesh, getToothPosition, DEFAULT_ARCH_CONFIG, ArchConfig } from './ToothMesh';
import { StructureMesh } from './StructureMesh';
import { JawLoader } from './JawLoader';
import { ToothDetailLoader } from './ToothDetailLoader';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { ArrowLeft, Dna, Activity, Settings, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import { CameraSync } from './CameraSync';

const presetViews: Record<string, { position: [number, number, number], target: [number, number, number] }> = {
  frontal: { position: [0, 0, 10], target: [0, 0, 0] },
  oclusalSup: { position: [0, -10, 1], target: [0, 0, 0] },
  oclusalInf: { position: [0, 10, 1], target: [0, 0, 0] },
  lateralDir: { position: [10, 0, 0], target: [0, 0, 0] },
  lateralEsq: { position: [-10, 0, 0], target: [0, 0, 0] },
};

function CameraController({ targetView, onAnimationComplete }: { targetView: string | null, onAnimationComplete: () => void }) {
  const { camera } = useThree();
  const controls = useThree((state) => state.controls) as any;
  const targetPos = React.useMemo(() => new THREE.Vector3(), []);
  const targetLook = React.useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (targetView && controls) {
      targetPos.set(...presetViews[targetView].position);
      targetLook.set(...presetViews[targetView].target);
      
      const dist = camera.position.distanceTo(targetPos);
      if (dist < 0.1) {
        onAnimationComplete();
        return;
      }
      
      camera.position.lerp(targetPos, 5 * delta);
      controls.target.lerp(targetLook, 5 * delta);
      controls.update();
    }
  });
  return null;
}

// Lista de dentes permanentes por quadrantes
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ALL_TEETH = [...UPPER_TEETH, ...LOWER_TEETH];



// Fallback procedural se falhar ao ler GLB
function FallbackProcedural() {
  const { viewerState } = usePlanning3D();

  return (
    <group position={[0, -0.2, 0]}>
      {ALL_TEETH.map((toothNum) => {
        const { position, rotation } = getToothPosition(toothNum);
        return (
          <ToothMesh
            key={toothNum}
            toothNumber={toothNum}
            position={position}
            rotation={rotation}
          />
        );
      })}

      {/* Gengiva Superior e Inferior procedurais */}
      <StructureMesh layerKey="gums" color="#C77373">
        <mesh position={[0, 0.95, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.3, 0.46, 12, 64, Math.PI * 1.25]} />
          <meshStandardMaterial
            color="#C77373"
            roughness={0.15}
            metalness={0.05}
            opacity={viewerState.layers.gums.opacity}
            transparent={viewerState.layers.gums.opacity < 1}
          />
        </mesh>
        <mesh position={[0, -1.05, -0.6]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.3, 0.46, 12, 64, Math.PI * 1.25]} />
          <meshStandardMaterial
            color="#C77373"
            roughness={0.15}
            metalness={0.05}
            opacity={viewerState.layers.gums.opacity}
            transparent={viewerState.layers.gums.opacity < 1}
          />
        </mesh>
      </StructureMesh>
    </group>
  );
}

// ErrorBoundary para capturar falha no loader 3D e ativar o modo Fallback
class SceneErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.warn('Aviso: Modelo GLB indisponível. Ativando visualizador anatômico offline.', error);
  }

  render() {
    if (this.state.hasError) {
      return <FallbackProcedural />;
    }
    return this.props.children;
  }
}

import { ToothActionMenu } from '../components/ToothActionMenu';

interface DentalSceneProps {
  isPresentationMode?: boolean;
}

export function DentalScene({ isPresentationMode = false }: DentalSceneProps) {
  const { viewerState, setViewingAnatomy } = usePlanning3D();
  const [variant, setVariant] = useState<'anatomic' | 'endodontic'>('anatomic');
  
  // Posições extraídas dinamicamente do GLB e arrastadas individualmente
  const [customPositions, setCustomPositions] = useState<Record<number, [number, number, number]>>({});

  // Controla se a rotação geral do cenário está ativa ou pausada
  const [controlsEnabled, setControlsEnabled] = useState(true);
  
  // Estado para o controle de câmera animada
  const [activeView, setActiveView] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const isDetailedView = viewerState.activeTooth !== null && viewerState.viewingAnatomy;
  const showActionMenu = viewerState.activeTooth !== null && !viewerState.viewingAnatomy;

  const handleBack = () => {
    setViewingAnatomy(false);
    setVariant('anatomic'); 
  };

  // getToothPosition adaptada para usar posições carregadas do GLB
  const getDynamicToothPosition = (fdiCode: number) => {
    if (customPositions[fdiCode]) {
      return {
        position: customPositions[fdiCode],
        rotation: getToothPosition(fdiCode).rotation
      };
    }
    return getToothPosition(fdiCode);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full min-h-[550px] relative">
      {/* 3D Canvas Container */}
      <div className="flex-1 relative h-[550px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-900 shadow-2xl">
        
        {/* Modal de Ações sobre a Arcada */}
        {showActionMenu && <ToothActionMenu />}

        {/* Controles do Modo Detalhado (Dente Individual) */}
        {isDetailedView && (
          <>
            <motion.button
              drag
              dragMomentum={false}
              onClick={handleBack}
              className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg backdrop-blur-sm transition-all border border-slate-700 shadow-lg cursor-move active:cursor-grabbing select-none"
            >
              <ArrowLeft size={16} />
              <span className="text-sm font-medium">Voltar para Arcada</span>
            </motion.button>

            {/* Toggle Anatômico vs Endodôntico */}
            <motion.div 
              drag
              dragMomentum={false}
              className="absolute top-4 right-4 z-10 flex items-center bg-slate-800/80 rounded-lg p-1 backdrop-blur-sm border border-slate-700 shadow-lg cursor-move active:cursor-grabbing select-none"
            >
              <button
                onPointerDown={(e) => e.stopPropagation()} 
                onClick={() => setVariant('anatomic')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  variant === 'anatomic'
                    ? 'bg-blue-500 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                <Dna size={16} />
                Anatômico
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()} 
                onClick={() => setVariant('endodontic')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  variant === 'endodontic'
                    ? 'bg-rose-500 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                <Activity size={16} />
                Endodôntico
              </button>
            </motion.div>
          </>
        )}

        {/* Menu de Visualização 3D */}
        {!isDetailedView && (
          <div className="absolute top-4 right-4 z-20">
            <div className="relative">
              <button 
                onClick={() => setMenuOpen(!menuOpen)}
                className={`p-2 rounded-lg backdrop-blur-sm border shadow-lg transition-all flex items-center gap-2 ${
                  menuOpen 
                    ? 'bg-sky-600/90 border-sky-500 text-white' 
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="Modos de Visualização"
              >
                <Settings size={18} />
              </button>
              
              {menuOpen && (
                <div className="absolute top-12 right-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 w-48 z-30">
                  <div className="text-[10px] font-bold text-slate-500 uppercase px-3 py-2 border-b border-slate-800 mb-2">
                    Vistas Rápidas
                  </div>
                  {[
                    { id: 'frontal', label: 'Frontal' },
                    { id: 'oclusalSup', label: 'Oclusal Superior' },
                    { id: 'oclusalInf', label: 'Oclusal Inferior' },
                    { id: 'lateralDir', label: 'Lateral Direita' },
                    { id: 'lateralEsq', label: 'Lateral Esquerda' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      onClick={() => { setActiveView(v.id); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-sky-600/20 hover:border-sky-500/50 rounded-lg transition-colors border border-transparent flex items-center gap-2"
                    >
                      <Eye size={14} className="text-sky-400" />
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-4 z-10 bg-slate-900/80 backdrop-blur border border-slate-800 text-slate-400 text-[10px] px-3 py-1.5 rounded-lg pointer-events-none">
          Gire livremente (360º) • Clique no dente para detalhes • Dois cliques para ocultar
        </div>

        <Canvas
          camera={{ position: [0, 0, 10], fov: 48 }}
          shadows
          gl={{ preserveDrawingBuffer: true }}
        >
          <ambientLight intensity={1.5} />
          
          <directionalLight
            position={[10, 10, 10]}
            intensity={1.5}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />

          <directionalLight
            position={[-10, 10, 10]}
            intensity={1.0}
          />

          <directionalLight
            position={[0, -10, 10]}
            intensity={0.8}
          />

          <pointLight position={[-5, -5, -5]} intensity={0.5} />
          
          <Environment preset="city" />

          <Suspense fallback={null}>
            <SceneErrorBoundary>
              {isDetailedView ? (
                <ToothDetailLoader toothNumber={viewerState.activeTooth!} variant={variant} />
              ) : (
                <JawLoader 
                  getToothPosition={getDynamicToothPosition} 
                  setControlsEnabled={setControlsEnabled}
                  onLoadPositions={(positions) => {
                    setCustomPositions(prev => {
                      const merged = { ...positions, ...prev };
                      return merged;
                    });
                  }}
                />
              )}
            </SceneErrorBoundary>
          </Suspense>

          <CameraController targetView={activeView} onAnimationComplete={() => setActiveView(null)} />

          <CameraSync isPresentationMode={isPresentationMode} />

          <OrbitControls
            makeDefault
            enabled={!isPresentationMode && controlsEnabled && !activeView}
            enableDamping
            dampingFactor={0.05}
            maxPolarAngle={Math.PI}
            minPolarAngle={0}
            minDistance={isDetailedView ? 1 : 4}
            maxDistance={isDetailedView ? 20 : 30}
            enablePan={false}
          />
        </Canvas>
      </div>

    </div>
  );
}

export default DentalScene;
