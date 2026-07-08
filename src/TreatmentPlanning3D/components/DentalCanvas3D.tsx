import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ToothMesh } from './ToothMesh';
import { usePlanning3D } from '../hooks/usePlanning3D';

// Função auxiliar para calcular posições na arcada dentária (arco elíptico)
// theta vai de -Math.PI/2 (molar esquerdo) até Math.PI/2 (molar direito)
function getToothPosition(fdiCode: number): { position: [number, number, number]; rotation: [number, number, number] } {
  const isUpper = fdiCode < 30; // Quadrantes 10 e 20 são superiores
  const quadrant = Math.floor(fdiCode / 10);
  const positionIndex = fdiCode % 10; // 1 (incisivo) a 8 (terceiro molar)

  // Mapear dentes de -8 (molar esquerdo) a 8 (molar direito)
  let index = 0;
  if (quadrant === 1 || quadrant === 4) {
    // Lado Direito (FDI 11-18, 41-48) -> index negativo (esquerdo na tela)
    index = -positionIndex;
  } else {
    // Lado Esquerdo (FDI 21-28, 31-38) -> index positivo (direito na tela)
    index = positionIndex;
  }

  // Ângulo baseado no dente (de -PI/2.5 a PI/2.5 para distribuir os dentes no arco)
  const maxAngle = Math.PI / 2.3;
  const angle = (index / 8) * maxAngle;

  // Parâmetros da elipse
  const a = 4.5; // Largura do arco
  const b = 4.0; // Comprimento/profundidade do arco

  const x = a * Math.sin(angle);
  const z = b * Math.cos(angle) - 1.5; // Deslocamento para centralizar a rotação
  const y = isUpper ? 1.0 : -1.0; // Distância vertical entre arcada superior e inferior

  // Rotação para alinhar o dente apontando para fora do arco
  const rotY = angle;
  const rotX = isUpper ? 0 : Math.PI; // Dentes inferiores ficam invertidos verticalmente

  return {
    position: [x, y, z],
    rotation: [rotX, rotY, 0],
  };
}

// Lista de dentes permanentes por quadrantes
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ALL_TEETH = [...UPPER_TEETH, ...LOWER_TEETH];

export function DentalCanvas3D() {
  const { viewerState, setTransparencyMode } = usePlanning3D();

  return (
    <div className="relative w-full h-[550px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* HUD de Controle Rápido */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={() => setTransparencyMode(!viewerState.transparencyMode)}
          className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-md transition-all duration-200 ${
            viewerState.transparencyMode
              ? 'bg-sky-600 text-white border border-sky-500'
              : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
          }`}
        >
          {viewerState.transparencyMode ? 'Gengiva Ocultada (Raio-X)' : 'Gengiva Sólida (Normal)'}
        </button>
      </div>

      <div className="absolute bottom-4 right-4 z-10 bg-slate-950/80 backdrop-blur border border-slate-800 text-slate-400 text-[10px] px-3 py-1.5 rounded-lg pointer-events-none">
        Clique para selecionar dente • Arraste para rotacionar
      </div>

      {/* Canvas R3F */}
      <Canvas
        camera={{ position: [0, 0, 10], fov: 50 }}
        shadows
        gl={{ preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={0.5} />
        
        {/* Luz Direcional para sombras */}
        <directionalLight
          position={[5, 10, 5]}
          intensity={0.8}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        {/* Luz de Borda (Rim light) para destacar volume */}
        <pointLight position={[-5, -5, -5]} intensity={0.4} />

        <Suspense fallback={null}>
          <group position={[0, -0.2, 0]}>
            {/* Renderização de todos os dentes do odontograma */}
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

            {/* Representação realista da gengiva (Gengiva Superior e Inferior) */}
            <mesh position={[0, 0.95, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[3.3, 0.46, 12, 64, Math.PI * 1.25]} />
              <meshStandardMaterial
                color="#C77373" // Cor realista de gengiva saudável
                roughness={0.15}
                metalness={0.05}
                opacity={viewerState.transparencyMode ? 0.2 : 0.95}
                transparent={viewerState.transparencyMode}
              />
            </mesh>

            <mesh position={[0, -1.05, -0.6]} rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[3.3, 0.46, 12, 64, Math.PI * 1.25]} />
              <meshStandardMaterial
                color="#C77373" // Cor realista de gengiva saudável
                roughness={0.15}
                metalness={0.05}
                opacity={viewerState.transparencyMode ? 0.2 : 0.95}
                transparent={viewerState.transparencyMode}
              />
            </mesh>
          </group>
        </Suspense>

        {/* OrbitControls limitado em zoom e órbita vertical para evitar perder o modelo */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 1.6}
          minPolarAngle={Math.PI / 4}
          minDistance={5}
          maxDistance={15}
        />
      </Canvas>
    </div>
  );
}
