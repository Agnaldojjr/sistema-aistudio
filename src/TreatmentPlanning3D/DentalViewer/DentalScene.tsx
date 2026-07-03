import React, { Suspense, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ToothMesh } from './ToothMesh';
import { StructureMesh } from './StructureMesh';
import { JawLoader } from './JawLoader';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { LayersPanel } from './LayersPanel';
import { TransparencyPanel } from './TransparencyPanel';
import { AnatomyLegend } from './AnatomyLegend';

// Lista de dentes permanentes por quadrantes
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ALL_TEETH = [...UPPER_TEETH, ...LOWER_TEETH];

// Função auxiliar para calcular posições na arcada dentária (arco elíptico)
function getToothPosition(fdiCode: number): { position: [number, number, number]; rotation: [number, number, number] } {
  const isUpper = fdiCode < 30; // Quadrantes 10 e 20 são superiores
  const quadrant = Math.floor(fdiCode / 10);
  const positionIndex = fdiCode % 10; // 1 (incisivo) a 8 (terceiro molar)

  let index = 0;
  if (quadrant === 1 || quadrant === 4) {
    index = positionIndex;
  } else {
    index = -positionIndex;
  }

  const maxAngle = Math.PI / 2.3;
  const angle = (index / 8) * maxAngle;

  const a = 4.5; // Largura do arco
  const b = 4.0; // Comprimento/profundidade do arco

  const x = a * Math.sin(angle);
  const z = b * Math.cos(angle) - 1.5; // Deslocamento para centralizar a rotação
  const y = isUpper ? 1.0 : -1.0; // Distância vertical entre arcada superior e inferior

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

export function DentalScene() {
  const { viewerState } = usePlanning3D();

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full min-h-[550px]">
      {/* 3D Canvas Container */}
      <div className="flex-1 relative h-[550px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-900 shadow-2xl">
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
              <JawLoader getToothPosition={getToothPosition} />
            </SceneErrorBoundary>
          </Suspense>

          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            maxPolarAngle={Math.PI / 1.6}
            minPolarAngle={Math.PI / 4}
            minDistance={4}
            maxDistance={12}
          />
        </Canvas>
      </div>

      {/* Controles de Interação Lateral */}
      <div className="w-full lg:w-[280px] flex flex-col gap-4">
        <LayersPanel />
        <TransparencyPanel />
        <AnatomyLegend />
      </div>
    </div>
  );
}

export default DentalScene;
