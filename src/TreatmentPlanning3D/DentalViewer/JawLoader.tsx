import React from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePlanning3D } from '../hooks/usePlanning3D';

// Lista de dentes permanentes por quadrantes
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ALL_TEETH = [...UPPER_TEETH, ...LOWER_TEETH];

// Pré-carrega o novo modelo rotulado
try {
  useGLTF.preload('/models/boca_ortodoncia_labeled.glb');
  useGLTF.preload('/models/boca_ortodoncia.glb');
  useGLTF.preload('/models/_deprecated/human_mouth_detailed.glb');
} catch (e) {
  console.warn('Erro ao pré-carregar modelos:', e);
}

interface JawLoaderProps {
  getToothPosition: (fdiCode: number) => { position: [number, number, number]; rotation: [number, number, number] };
  onUpdateToothPosition?: (fdiCode: number, position: [number, number, number]) => void;
  setControlsEnabled?: (enabled: boolean) => void;
  onLoadPositions?: (positions: Record<number, [number, number, number]>) => void;
}

// Geometria procedural leve para o highlight
const hitBoxGeo = new THREE.SphereGeometry(0.32, 16, 16);

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
  
  const planeRef = React.useRef(new THREE.Plane());
  const intersectionRef = React.useRef(new THREE.Vector3());

  const [pos, setPos] = React.useState<[number, number, number]>(initialPosition);

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

        // Desativa OrbitControls temporariamente
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

        // Reativa OrbitControls
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
        emissiveIntensity={0.6} 
        transparent 
        opacity={opacity} 
        depthWrite={false}
        depthTest={depthTest} 
      />
    </mesh>
  );
}

// Renderizador interno do modelo
function JawModelRenderer({
  modelPath,
  getToothPosition,
  onUpdateToothPosition,
  setControlsEnabled,
  onLoadPositions
}: {
  modelPath: string;
  getToothPosition: any;
  onUpdateToothPosition: any;
  setControlsEnabled?: (enabled: boolean) => void;
  onLoadPositions?: (positions: Record<number, [number, number, number]>) => void;
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

  // Calcula e notifica os centróides assim que a cena é clonada
  React.useEffect(() => {
    if (!clonedScene || !onLoadPositions || !groupRef.current) return;
    const positions: Record<number, [number, number, number]> = {};
    
    // Força a atualização das matrizes do Three.js para coordenadas mundiais válidas
    clonedScene.updateMatrixWorld(true);
    groupRef.current.updateMatrixWorld(true);
    
    clonedScene.traverse((child: any) => {
      if (child.isMesh && /^\d{2}$/.test(child.name)) {
        const fdi = parseInt(child.name);
        child.geometry.computeBoundingBox();
        const bbox = child.geometry.boundingBox;
        if (bbox) {
          const center = new THREE.Vector3();
          bbox.getCenter(center);
          
          // Transforma o centroide local para coordenadas globais
          center.applyMatrix4(child.matrixWorld);
          
          // Converte de globais para local do grupo pai
          const localCenter = groupRef.current!.worldToLocal(center.clone());
          
          positions[fdi] = [localCenter.x, localCenter.y, localCenter.z];
        }
      }
    });
    
    if (Object.keys(positions).length > 0) {
      onLoadPositions(positions);
    }
  }, [clonedScene, onLoadPositions]);

  // Efeito para sincronizar visibilidade (dentes ausentes) e emissive (dente selecionado) diretamente nas malhas do 3D
  React.useEffect(() => {
    clonedScene.traverse((child: any) => {
      if (child.isMesh && /^\d{2}$/.test(child.name)) {
        const fdi = parseInt(child.name);
        const isSelected = viewerState.activeTooth === fdi;
        const isMissing = viewerState.missingTeeth?.includes(fdi);
        
        // Ocultar se o dente for marcado como ausente
        child.visible = !isMissing;
        
        if (child.material) {
          if (isSelected) {
            // Emissive azul forte para destaque
            child.material.emissive.set('#3b82f6');
            child.material.emissiveIntensity = 0.6;
          } else {
            child.material.emissive.set('#000000');
            child.material.emissiveIntensity = 0.0;
          }
        }
      }
    });
  }, [clonedScene, viewerState.activeTooth, viewerState.missingTeeth]);

  return (
    <group ref={groupRef} position={[0, -0.2, 0]}>
      {/* 1. MODELO REALISTA COM SELEÇÃO DIRECTA POR CLIQUE */}
      <group scale={[modelScale, modelScale, modelScale]} position={[0, 0, 1.5]}>
        <primitive 
          object={clonedScene} 
          onClick={(e: any) => {
            e.stopPropagation();
            
            // Raycasting direto para obter o FDI pelo nome do nó clicado
            let current = e.object;
            let clickedFdi: number | null = null;
            while (current) {
              if (current.name && /^\d{2}$/.test(current.name)) {
                clickedFdi = parseInt(current.name);
                break;
              }
              current = current.parent;
            }

            if (clickedFdi !== null) {
              const isMissing = viewerState.missingTeeth?.includes(clickedFdi);
              if (!isMissing) {
                selectTooth(clickedFdi, { x: e.clientX, y: e.clientY });
              }
            }
          }}
          onPointerOver={(e: any) => {
            e.stopPropagation();
            let current = e.object;
            let isTooth = false;
            while (current) {
              if (current.name && /^\d{2}$/.test(current.name)) {
                isTooth = true;
                break;
              }
              current = current.parent;
            }
            if (isTooth) {
              document.body.style.cursor = 'pointer';
            }
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'default';
          }}
        />
      </group>

      {/* 2. HIGHLIGHTS DENTÁRIOS E CONTROLES DE ARRASTE */}
      <group position={[0, 0, 0]}>
        {ALL_TEETH.map((toothNum) => {
          const isMissing = viewerState.missingTeeth?.includes(toothNum);
          if (isMissing) return null;

          const toothProcedures = procedures.filter(p => p.tooth_id === String(toothNum));
          const hasBudget = toothProcedures.length > 0;
          const isSelected = viewerState.activeTooth === toothNum;

          if (!isSelected && !hasBudget) return null;

          const { position } = getToothPosition(toothNum);
          
          let color = '#0ea5e9';
          let emissive = '#0284c7';
          let opacity = 0.5;

          if (isSelected) {
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
              depthTest={true}
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
export function JawLoader({ getToothPosition, onUpdateToothPosition, setControlsEnabled, onLoadPositions }: JawLoaderProps) {
  const [modelPath, setModelPath] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Tenta carregar o modelo segmentado rotulado, caso contrário faz fallback para o modelo depreciado
    fetch('/models/boca_ortodoncia_labeled.glb', { method: 'HEAD' })
      .then((res) => {
        if (res.ok) {
          setModelPath('/models/boca_ortodoncia_labeled.glb');
        } else {
          fetch('/models/boca_ortodoncia.glb', { method: 'HEAD' })
            .then((r) => {
              if (r.ok) {
                setModelPath('/models/boca_ortodoncia.glb');
              } else {
                setModelPath('/models/_deprecated/human_mouth_detailed.glb');
              }
            })
            .catch(() => {
              setModelPath('/models/_deprecated/human_mouth_detailed.glb');
            });
        }
      })
      .catch(() => {
        setModelPath('/models/_deprecated/human_mouth_detailed.glb');
      });
  }, []);

  if (!modelPath) return null;

  return (
    <JawModelRenderer
      modelPath={modelPath}
      getToothPosition={getToothPosition}
      onUpdateToothPosition={onUpdateToothPosition}
      setControlsEnabled={setControlsEnabled}
      onLoadPositions={onLoadPositions}
    />
  );
}
