import React from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePlanning3D } from '../hooks/usePlanning3D';

// Lista de dentes permanentes por quadrantes
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ALL_TEETH = [...UPPER_TEETH, ...LOWER_TEETH];

// Pré-carrega ambos os modelos para otimização
try {
  useGLTF.preload('/models/boca_ortodoncia.glb');
  useGLTF.preload('/models/human_mouth_detailed.glb');
} catch (e) {
  console.warn('Erro ao pré-carregar modelos:', e);
}

interface JawLoaderProps {
  getToothPosition: (fdiCode: number) => { position: [number, number, number]; rotation: [number, number, number] };
  isCalibrating?: boolean;
  onUpdateToothPosition?: (fdiCode: number, position: [number, number, number]) => void;
  setControlsEnabled?: (enabled: boolean) => void;
}

// Geometria procedural leve para o highlight e hitbox
const hitBoxGeo = new THREE.SphereGeometry(0.35, 16, 16);

// Componente da Esfera Arrastável 3D
function DraggableSphere({
  toothNum,
  initialPosition,
  geometry,
  color,
  emissive,
  opacity,
  depthTest,
  onDoubleClick,
  onDrag,
  setControlsEnabled
}: {
  toothNum: number;
  initialPosition: [number, number, number];
  geometry: THREE.BufferGeometry;
  color: string;
  emissive: string;
  opacity: number;
  depthTest: boolean;
  onDoubleClick: (e: any) => void;
  onDrag: (position: [number, number, number]) => void;
  setControlsEnabled?: (enabled: boolean) => void;
}) {
  const { camera, raycaster } = useThree();
  const [isDragging, setIsDragging] = React.useState(false);
  const meshRef = React.useRef<THREE.Mesh>(null);
  
  // Guardamos o plano de arrasto e o ponto de interseção
  const planeRef = React.useRef(new THREE.Plane());
  const intersectionRef = React.useRef(new THREE.Vector3());

  // Posiciona inicialmente de acordo com a posição vinda do pai
  const [pos, setPos] = React.useState<[number, number, number]>(initialPosition);

  // Sincroniza se a posição inicial vinda do pai mudar
  React.useEffect(() => {
    setPos(initialPosition);
  }, [initialPosition]);

  return (
    <mesh
      ref={meshRef}
      position={pos}
      geometry={geometry}
      onDoubleClick={onDoubleClick}
      onPointerDown={(e: any) => {
        e.stopPropagation();
        e.target.setPointerCapture(e.pointerId);
        setIsDragging(true);

        // Desativa OrbitControls temporariamente via React state
        setControlsEnabled?.(false);

        const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
        const worldPos = meshRef.current?.getWorldPosition(new THREE.Vector3()) || new THREE.Vector3(...pos);
        planeRef.current.setFromNormalAndCoplanarPoint(normal, worldPos);
      }}
      onPointerMove={(e: any) => {
        if (!isDragging) return;
        e.stopPropagation();

        raycaster.setFromCamera(e.pointer, camera);
        if (raycaster.ray.intersectPlane(planeRef.current, intersectionRef.current)) {
          const parent = meshRef.current?.parent;
          if (parent) {
            const localPoint = parent.worldToLocal(intersectionRef.current.clone());
            const newPos: [number, number, number] = [localPoint.x, localPoint.y, localPoint.z];
            setPos(newPos);
            onDrag(newPos);
          }
        }
      }}
      onPointerUp={(e: any) => {
        if (!isDragging) return;
        e.stopPropagation();
        e.target.releasePointerCapture(e.pointerId);
        setIsDragging(false);

        // Reativa OrbitControls via React state
        setControlsEnabled?.(true);
      }}
      onPointerOver={(e: any) => {
        e.stopPropagation();
        document.body.style.cursor = 'move';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      <meshStandardMaterial 
        color={isDragging ? '#ef4444' : color} 
        emissive={isDragging ? '#ef4444' : emissive}
        emissiveIntensity={0.5} 
        transparent 
        opacity={opacity} 
        depthWrite={false}
        depthTest={depthTest} 
      />
    </mesh>
  );
}

// Componente interno que renderiza a malha do modelo 3D carregado
function JawModelRenderer({
  modelPath,
  getToothPosition,
  isCalibrating,
  onUpdateToothPosition,
  setControlsEnabled
}: {
  modelPath: string;
  getToothPosition: any;
  isCalibrating: boolean;
  onUpdateToothPosition: any;
  setControlsEnabled?: (enabled: boolean) => void;
}) {
  const { scene } = useGLTF(modelPath) as any;
  const { procedures, selectTooth, viewerState, toggleMissingTooth } = usePlanning3D();
  const groupRef = React.useRef<THREE.Group>(null);
  
  // Escala para ajustar ao visualizador
  const modelScale = 85.0;

  const clonedScene = React.useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.material = child.material.clone();
      }
    });
    return clone;
  }, [scene]);

  return (
    <group ref={groupRef} position={[0, -0.2, 0]}>
      {/* 1. MODELO REALISTA (FUNDO COM RAYCAST DENTÁRIO) */}
      <group scale={[modelScale, modelScale, modelScale]} position={[0, 0, 1.5]}>
        <primitive 
          object={clonedScene} 
          onClick={(e: any) => {
            e.stopPropagation();
            if (!groupRef.current) return;
            
            groupRef.current.updateMatrixWorld(true);
            const localPoint = groupRef.current.worldToLocal(e.point.clone());
            
            let closestTooth = 11;
            let minDistance = Infinity;
            
            ALL_TEETH.forEach((toothNum) => {
              const isMissing = viewerState.missingTeeth?.includes(toothNum);
              if (isMissing) return;

              const { position } = getToothPosition(toothNum);
              const dx = localPoint.x - position[0];
              const dy = localPoint.y - position[1];
              const dz = localPoint.z - (position[2] + 1.5);
              const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
              
              if (distance < minDistance) {
                minDistance = distance;
                closestTooth = toothNum;
              }
            });
            
            selectTooth(closestTooth, { x: e.clientX, y: e.clientY });
          }}
          onPointerOver={(e: any) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'default';
          }}
        />
      </group>

      {/* 2. HIGHLIGHTS E ESFERAS DE CALIBRAÇÃO */}
      <group position={[0, 0, 1.5]}>
        {ALL_TEETH.map((toothNum) => {
          const isMissing = viewerState.missingTeeth?.includes(toothNum);
          if (isMissing) return null;

          const toothProcedures = procedures.filter(p => p.tooth_id === String(toothNum));
          const hasBudget = toothProcedures.length > 0;
          const isSelected = viewerState.activeTooth === toothNum;

          if (!isSelected && !hasBudget && !isCalibrating) return null;

          const { position } = getToothPosition(toothNum);
          
          let color = '#0ea5e9';
          let emissive = '#0284c7';
          let opacity = 0.5;

          if (isCalibrating) {
            color = '#ef4444';
            emissive = '#dc2626';
            opacity = 0.6;
          } else if (isSelected) {
            color = '#3B82F6';
            emissive = '#3B82F6';
            opacity = 0.6;
          }

          return (
            <DraggableSphere
              key={toothNum}
              toothNum={toothNum}
              initialPosition={position}
              geometry={hitBoxGeo}
              color={color}
              emissive={emissive}
              opacity={opacity}
              depthTest={!isCalibrating}
              onDoubleClick={(e) => {
                e.stopPropagation();
                toggleMissingTooth(toothNum);
              }}
              onDrag={(newPos) => onUpdateToothPosition?.(toothNum, newPos)}
              setControlsEnabled={setControlsEnabled}
            />
          );
        })}
      </group>
    </group>
  );
}

// Componente exportado principal com detecção inteligente de arquivo
export function JawLoader({ getToothPosition, isCalibrating = false, onUpdateToothPosition, setControlsEnabled }: JawLoaderProps) {
  const [modelPath, setModelPath] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Faz uma requisição HEAD rápida para verificar se a nova boca foi carregada no projeto,
    // caso contrário, mantém a antiga boca detalhada realista como fallback.
    fetch('/models/boca_ortodoncia.glb', { method: 'HEAD' })
      .then((res) => {
        if (res.ok) {
          setModelPath('/models/boca_ortodoncia.glb');
        } else {
          setModelPath('/models/human_mouth_detailed.glb');
        }
      })
      .catch(() => {
        setModelPath('/models/human_mouth_detailed.glb');
      });
  }, []);

  if (!modelPath) return null;

  return (
    <JawModelRenderer
      modelPath={modelPath}
      getToothPosition={getToothPosition}
      isCalibrating={isCalibrating}
      onUpdateToothPosition={onUpdateToothPosition}
      setControlsEnabled={setControlsEnabled}
    />
  );
}
