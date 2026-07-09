import React, { Suspense, Component, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { ToothMesh } from './ToothMesh';
import { StructureMesh } from './StructureMesh';
import { JawLoader } from './JawLoader';
import { ToothDetailLoader } from './ToothDetailLoader';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { ArrowLeft, Dna, Activity } from 'lucide-react';
import { motion } from 'motion/react';

// Lista de dentes permanentes por quadrantes
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ALL_TEETH = [...UPPER_TEETH, ...LOWER_TEETH];

// Configuração estática padrão apenas para o Fallback Procedural
export const DEFAULT_ARCH_CONFIG = {
  a: 4.5,
  b: 4.0,
  zOffset: -1.5,
  yOffset: 1.0,
  maxAngleDivider: 2.3,
  hitboxScale: 0.8,
};

export type ArchConfig = typeof DEFAULT_ARCH_CONFIG;

// Função auxiliar simples para posicionar dentes procedurais no Fallback
export function getToothPosition(fdiCode: number): { position: [number, number, number]; rotation: [number, number, number] } {
  const isUpper = fdiCode < 30;
  const config = DEFAULT_ARCH_CONFIG;
  const quadrant = Math.floor(fdiCode / 10);
  const positionIndex = fdiCode % 10;

  let index = 0;
  if (quadrant === 1 || quadrant === 4) {
    index = -positionIndex;
  } else {
    index = positionIndex;
  }

  const maxAngle = Math.PI / config.maxAngleDivider;
  const angle = (index / 8) * maxAngle;

  const x = config.a * Math.sin(angle);
  const z = config.b * Math.cos(angle) + config.zOffset;
  const y = isUpper ? config.yOffset : -config.yOffset;

  return {
    position: [x, y, z],
    rotation: [isUpper ? 0 : Math.PI, angle, 0],
  };
}

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

        <div className="absolute bottom-4 left-4 z-10 bg-slate-900/80 backdrop-blur border border-slate-800 text-slate-400 text-[10px] px-3 py-1.5 rounded-lg pointer-events-none">
          Clique no dente para selecionar • Arraste bolinhas para mover • Dois cliques para ocultar bolinha
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
                  onUpdateToothPosition={(fdiCode, position) => {
                    setCustomPositions(prev => ({
                      ...prev,
                      [fdiCode]: position
                    }));
                  }}
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

          <OrbitControls
            enabled={controlsEnabled}
            enableDamping
            dampingFactor={0.05}
            maxPolarAngle={isDetailedView ? Math.PI : Math.PI / 1.6}
            minPolarAngle={isDetailedView ? 0 : Math.PI / 4}
            minDistance={isDetailedView ? 1 : 4}
            maxDistance={isDetailedView ? 20 : 30}
            enablePan={true}
          />
        </Canvas>
      </div>

    </div>
  );
}

export default DentalScene;
