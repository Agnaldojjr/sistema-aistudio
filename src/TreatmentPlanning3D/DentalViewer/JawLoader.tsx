import React from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { usePlanning3D } from '../hooks/usePlanning3D';

// Lista de dentes permanentes por quadrantes
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ALL_TEETH = [...UPPER_TEETH, ...LOWER_TEETH];

// Pré-carrega o novo modelo rotulado
try {
  useGLTF.preload('/models/boca_ortodoncia_labeled.glb');
} catch (e) {
  console.warn('Erro ao pré-carregar modelo:', e);
}

interface JawLoaderProps {
  getToothPosition: (fdiCode: number) => { position: [number, number, number]; rotation: [number, number, number] };
  setControlsEnabled?: (enabled: boolean) => void;
  onLoadPositions?: (positions: Record<number, [number, number, number]>) => void;
}

// Corrige os números dos dentes que vieram invertidos no modelo 3D
function fixFdiNumber(originalFdi: number): number {
  const quadrant = Math.floor(originalFdi / 10);
  const tooth = originalFdi % 10;
  
  if (quadrant === 1) return 40 + tooth;
  if (quadrant === 2) return 30 + tooth;
  if (quadrant === 3) return 20 + tooth;
  if (quadrant === 4) return 10 + tooth;
  
  return originalFdi;
}

// Renderizador interno do modelo
function JawModelRenderer({
  modelPath,
  setControlsEnabled,
  onLoadPositions
}: {
  modelPath: string;
  getToothPosition: any;
  setControlsEnabled?: (enabled: boolean) => void;
  onLoadPositions?: (positions: Record<number, [number, number, number]>) => void;
}) {
  const { scene } = useGLTF(modelPath) as any;
  const { 
    selectTooth, 
    viewerState, 
    teeth
  } = usePlanning3D();
  const groupRef = React.useRef<THREE.Group>(null);
  
  // Escala para ajustar ao visualizador
  const modelScale = 1.0;

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
    if (!clonedScene || !groupRef.current) return;
    const positions: Record<number, [number, number, number]> = {};
    
    // Força a atualização das matrizes do Three.js para coordenadas mundiais válidas
    clonedScene.updateMatrixWorld(true);
    groupRef.current.updateMatrixWorld(true);
    
    clonedScene.traverse((child: any) => {
      if (child.isMesh && /^\d{2}$/.test(child.name)) {
        const rawFdi = parseInt(child.name);
        const fdi = fixFdiNumber(rawFdi);
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
      if (onLoadPositions) onLoadPositions(positions);
    }
  }, [clonedScene, onLoadPositions]);

  // Efeito para sincronizar visibilidade (dentes ausentes) e emissive (dente selecionado) diretamente nas malhas do 3D
  React.useEffect(() => {
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        if (/^\d{2}$/.test(child.name)) {
          const rawFdi = parseInt(child.name);
          const fdi = fixFdiNumber(rawFdi);
          const isSelected = viewerState.activeTooth === fdi;
          const isMissing = viewerState.missingTeeth?.includes(fdi) || teeth[fdi]?.condition === 'MISSING';
          const isTeethLayerVisible = viewerState.layers?.teeth?.visible ?? true;
          const teethOpacity = viewerState.layers?.teeth?.opacity ?? 1.0;
          
          // Ocultar se o dente for marcado como ausente ou se a camada estiver oculta
          child.visible = !isMissing && isTeethLayerVisible;
          
          if (child.material) {
            // Forçar configurações de material (previne bugs de materiais importados invisíveis)
            child.material.transparent = teethOpacity < 1.0;
            child.material.opacity = teethOpacity;
            child.material.depthWrite = true;
            child.material.needsUpdate = true;

            // Highlight de seleção via emissive - sem shader customizado
            if (isSelected) {
              child.material.emissive = new THREE.Color('#3b82f6');
              child.material.emissiveIntensity = 0.25;
            } else {
              child.material.emissive = new THREE.Color('#000000');
              child.material.emissiveIntensity = 0.0;
            }

            // Aplicar condição visual do dente
            const toothState = teeth[fdi];
            if (toothState?.condition === 'IMPLANT') {
              child.material.color = new THREE.Color('#9CA3AF');
              child.material.roughness = 0.2;
              child.material.metalness = 0.8;
            } else if (toothState?.condition === 'CROWN') {
              child.material.color = new THREE.Color('#F59E0B');
              child.material.roughness = 0.1;
              child.material.metalness = 0.7;
            } else {
              // Resetar cor para padrão caso estava modificado (se houver cor original guardada, idealmente deveria restaurar, 
              // mas para simplificar vamos apenas garantir que a cor branca seja aplicada caso não seja implante/coroa)
              child.material.color = new THREE.Color('#FFFFFF');
            }
          }
        } else if (child.name === 'Gengiva' || child.name === 'gums') {
          const isGumsLayerVisible = viewerState.layers?.gums?.visible ?? true;
          const gumsOpacity = viewerState.layers?.gums?.opacity ?? 1.0;

          child.visible = isGumsLayerVisible;
          if (child.material) {
            child.material.transparent = gumsOpacity < 1.0;
            child.material.opacity = gumsOpacity;
            child.material.needsUpdate = true;
          }
        }
      }
    });
  }, [
    clonedScene, 
    viewerState.activeTooth, 
    viewerState.missingTeeth, 
    teeth, 
    viewerState.activeSurfaces, 
    viewerState.simulationState,
    viewerState.layers
  ]);

  return (
    <group ref={groupRef} position={[0, -0.2, 0]}>
      {/* 1. MODELO REALISTA COM SELEÇÃO DIRECTA POR CLIQUE */}
      <group scale={[modelScale, modelScale, modelScale]} position={[0, -1.0, 0]} rotation={[Math.PI, Math.PI, 0]}>
        <primitive 
          object={clonedScene} 
          onClick={(e: any) => {
            e.stopPropagation();
            
            // Raycasting direto para obter o FDI pelo nome do nó clicado
            let current = e.object;
            let clickedFdi: number | null = null;
            while (current) {
              if (current.name && /^\d{2}$/.test(current.name)) {
                const rawFdi = parseInt(current.name);
                clickedFdi = fixFdiNumber(rawFdi);
                break;
              }
              current = current.parent;
            }

            if (clickedFdi !== null) {
              const isMissing = viewerState.missingTeeth?.includes(clickedFdi) || teeth[clickedFdi]?.condition === 'MISSING';
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
              const clickedFdi = fixFdiNumber(parseInt(e.object.name));
              const isMissing = viewerState.missingTeeth?.includes(clickedFdi) || teeth[clickedFdi]?.condition === 'MISSING';
              if (!isMissing) {
                document.body.style.cursor = 'pointer';
              }
            }
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'default';
          }}
        />
      </group>
    </group>
  );
}

// Componente exportado principal que carrega o modelo segmentado rotulado diretamente
export function JawLoader({ getToothPosition, setControlsEnabled, onLoadPositions }: JawLoaderProps) {
  return (
    <JawModelRenderer
      modelPath="/models/boca_ortodoncia_labeled.glb"
      getToothPosition={getToothPosition}
      setControlsEnabled={setControlsEnabled}
      onLoadPositions={onLoadPositions}
    />
  );
}
