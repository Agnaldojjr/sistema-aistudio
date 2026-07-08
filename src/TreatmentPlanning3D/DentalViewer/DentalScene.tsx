import React, { Suspense, Component, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ToothMesh } from './ToothMesh';
import { StructureMesh } from './StructureMesh';
import { JawLoader } from './JawLoader';
import { ToothDetailLoader } from './ToothDetailLoader';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { ArrowLeft, Dna, Activity } from 'lucide-react';

// Lista de dentes permanentes por quadrantes
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ALL_TEETH = [...UPPER_TEETH, ...LOWER_TEETH];

// Configuração da arcada dentária geométrica (pode ser ajustada no painel de calibração)
export const DEFAULT_ARCH_CONFIG = {
  a: 4.5,
  b: 4.0,
  zOffset: -1.5,
  yOffset: 1.0,
  maxAngleDivider: 2.3,
  hitboxScale: 0.8,
};

export type ArchConfig = typeof DEFAULT_ARCH_CONFIG;

// Função auxiliar para calcular posições na arcada dentária (arco elíptico)
export function getToothPosition(fdiCode: number, config: ArchConfig = DEFAULT_ARCH_CONFIG): { position: [number, number, number]; rotation: [number, number, number] } {
  const isUpper = fdiCode < 30; // Quadrantes 10 e 20 são superiores
  const quadrant = Math.floor(fdiCode / 10);
  const positionIndex = fdiCode % 10; // 1 (incisivo) a 8 (terceiro molar)

  let index = 0;
  if (quadrant === 1 || quadrant === 4) {
    index = positionIndex;
  } else {
    index = -positionIndex;
  }

  const maxAngle = Math.PI / config.maxAngleDivider;
  const angle = (index / 8) * maxAngle;

  const a = config.a; // Largura do arco
  const b = config.b; // Comprimento/profundidade do arco

  const x = a * Math.sin(angle);
  const z = b * Math.cos(angle) + config.zOffset; // Deslocamento para centralizar a rotação
  const y = isUpper ? config.yOffset : -config.yOffset; // Distância vertical entre arcada superior e inferior

  const rotY = angle;
  const rotX = isUpper ? 0 : Math.PI; // Dentes inferiores ficam invertidos verticalmente

  return {
    position: [x, y, z],
    rotation: [rotX, rotY, 0],
  };
}

// Fallback procedural se falhar ao ler GLB (ex: arquivo ausente localmente)
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

      {/* Gengiva Superior e Inferior procedurais realistas */}
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

// Classe ErrorBoundary para capturar falha no loader 3D e ativar o modo Fallback
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

function CalibrationPanel({ 
  config, 
  setConfig, 
  isCalibrating, 
  setIsCalibrating 
}: { 
  config: ArchConfig; 
  setConfig: (c: ArchConfig) => void; 
  isCalibrating: boolean; 
  setIsCalibrating: (c: boolean) => void; 
}) {
  if (!isCalibrating) return (
    <button 
      onClick={() => setIsCalibrating(true)} 
      className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-red-600/80 hover:bg-red-600 text-white px-3 py-1.5 text-xs font-bold rounded-lg z-50 backdrop-blur"
    >
      🛠️ Calibrar Hitboxes
    </button>
  );

  return (
    <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-slate-900/90 border border-slate-700 rounded-xl p-4 w-72 z-50 shadow-2xl backdrop-blur-sm text-white">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Calibração da Arcada</h4>
        <button onClick={() => setIsCalibrating(false)} className="text-slate-400 hover:text-white text-xs">Fechar</button>
      </div>
      <div className="space-y-3 text-xs">
        <div>
          <label className="flex justify-between mb-1">
            <span>Largura (a):</span>
            <span className="font-mono">{config.a.toFixed(2)}</span>
          </label>
          <input 
            type="range" min="3.0" max="6.0" step="0.05" value={config.a}
            onChange={(e) => setConfig({ ...config, a: parseFloat(e.target.value) })}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div>
          <label className="flex justify-between mb-1">
            <span>Profundidade (b):</span>
            <span className="font-mono">{config.b.toFixed(2)}</span>
          </label>
          <input 
            type="range" min="3.0" max="6.0" step="0.05" value={config.b}
            onChange={(e) => setConfig({ ...config, b: parseFloat(e.target.value) })}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div>
          <label className="flex justify-between mb-1">
            <span>Deslocamento Z:</span>
            <span className="font-mono">{config.zOffset.toFixed(2)}</span>
          </label>
          <input 
            type="range" min="-3.0" max="1.0" step="0.05" value={config.zOffset}
            onChange={(e) => setConfig({ ...config, zOffset: parseFloat(e.target.value) })}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div>
          <label className="flex justify-between mb-1">
            <span>Escala Hitbox:</span>
            <span className="font-mono">{config.hitboxScale.toFixed(2)}</span>
          </label>
          <input 
            type="range" min="0.5" max="1.5" step="0.02" value={config.hitboxScale}
            onChange={(e) => setConfig({ ...config, hitboxScale: parseFloat(e.target.value) })}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <button 
          onClick={() => console.log('CONFIG ATUAL:', JSON.stringify(config))} 
          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-1.5 rounded-lg border border-slate-700 transition-colors"
        >
          Print no Console
        </button>
      </div>
    </div>
  );
}

interface DentalSceneProps {
  isPresentationMode?: boolean;
}

export function DentalScene({ isPresentationMode = false }: DentalSceneProps) {
  const { viewerState, selectTooth, setViewingAnatomy } = usePlanning3D();
  const [variant, setVariant] = useState<'anatomic' | 'endodontic'>('anatomic');
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [archConfig, setArchConfig] = useState<ArchConfig>(DEFAULT_ARCH_CONFIG);

  const isDetailedView = viewerState.activeTooth !== null && viewerState.viewingAnatomy;
  const showActionMenu = viewerState.activeTooth !== null && !viewerState.viewingAnatomy;

  const handleBack = () => {
    setViewingAnatomy(false);
    setVariant('anatomic'); 
  };

  // getToothPosition adaptada para usar o config dinâmico
  const getDynamicToothPosition = (fdiCode: number) => getToothPosition(fdiCode, archConfig);

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full min-h-[550px] relative">
      {/* 3D Canvas Container */}
      <div className="flex-1 relative h-[550px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-900 shadow-2xl">
        
        {/* Modal de Ações sobre a Arcada */}
        {showActionMenu && <ToothActionMenu />}

        {/* Painel de Calibração (Apenas visível se nenhum dente estiver selecionado) */}
        {viewerState.activeTooth === null && (
          <CalibrationPanel 
            config={archConfig} 
            setConfig={setArchConfig} 
            isCalibrating={isCalibrating} 
            setIsCalibrating={setIsCalibrating} 
          />
        )}

        {/* Controles do Modo Detalhado (Dente Individual) */}
        {isDetailedView && (
          <>
            <button
              onClick={handleBack}
              className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg backdrop-blur-sm transition-all border border-slate-700 shadow-lg"
            >
              <ArrowLeft size={16} />
              <span className="text-sm font-medium">Voltar para Arcada</span>
            </button>

            {/* Toggle Anatômico vs Endodôntico */}
            <div className="absolute top-4 right-4 z-10 flex items-center bg-slate-800/80 rounded-lg p-1 backdrop-blur-sm border border-slate-700 shadow-lg">
              <button
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
            </div>
          </>
        )}

        <div className="absolute bottom-4 left-4 z-10 bg-slate-900/80 backdrop-blur border border-slate-800 text-slate-400 text-[10px] px-3 py-1.5 rounded-lg pointer-events-none">
          Clique para selecionar dente • Arraste para rotacionar
        </div>

        <Canvas
          camera={{ position: [0, 0, 10], fov: 48 }}
          shadows
          gl={{ preserveDrawingBuffer: true }}
        >
          <ambientLight intensity={0.5} />
          
          <directionalLight
            position={[5, 10, 5]}
            intensity={0.8}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />

          <pointLight position={[-5, -5, -5]} intensity={0.4} />

          <Suspense fallback={null}>
            <SceneErrorBoundary>
              {isDetailedView ? (
                <ToothDetailLoader toothNumber={viewerState.activeTooth!} variant={variant} />
              ) : (
                <JawLoader 
                  getToothPosition={getDynamicToothPosition} 
                  isCalibrating={isCalibrating} 
                  archConfig={archConfig} 
                />
              )}
            </SceneErrorBoundary>
          </Suspense>

          <OrbitControls
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
