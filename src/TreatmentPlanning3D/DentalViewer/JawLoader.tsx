import React from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { usePlanning3D } from '../hooks/usePlanning3D';

// Lista de dentes permanentes por quadrantes
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ALL_TEETH = [...UPPER_TEETH, ...LOWER_TEETH];

// Pré-carrega o modelo da arcada
try {
  useGLTF.preload('/models/human_mouth_detailed.glb');
} catch (e) {
  console.warn('Erro ao pré-carregar human_mouth_detailed.glb:', e);
}

interface JawLoaderProps {
  getToothPosition: (fdiCode: number) => { position: [number, number, number]; rotation: [number, number, number] };
  isCalibrating?: boolean;
}

// Geometria procedural leve para o highlight e hitbox
const hitBoxGeo = new THREE.SphereGeometry(0.35, 16, 16);

export function JawLoader({ getToothPosition, isCalibrating = false }: JawLoaderProps) {
  const { scene } = useGLTF('/models/human_mouth_detailed.glb') as any;
  const { procedures, selectTooth, viewerState } = usePlanning3D();
  
  const groupRef = React.useRef<THREE.Group>(null);

  // O modelo do Sketchfab está em metros (~0.1 de largura), precisamos escalar para ~85 para bater com as hitboxes de 9 unidades
  const modelScale = 85.0; 

  // 1. Clonamos a cena primeiro
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
            
            // Converte o ponto clicado (world space) para o espaço local do grupo principal (onde escala é 1.0)
            groupRef.current.updateMatrixWorld(true);
            const localPoint = groupRef.current.worldToLocal(e.point.clone());
            
            // Encontra o dente mais próximo usando as posições matemáticas calculadas
            let closestTooth = 11;
            let minDistance = Infinity;
            
            ALL_TEETH.forEach((toothNum) => {
              const { position } = getToothPosition(toothNum);
              const dx = localPoint.x - position[0];
              const dy = localPoint.y - position[1];
              const dz = localPoint.z - (position[2] + 1.5); // Compensa a translação de +1.5 Z do modelo
              const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
              
              if (distance < minDistance) {
                minDistance = distance;
                closestTooth = toothNum;
              }
            });
            
            // Passa as coordenadas 2D do clique para o menu flutuar na tela
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

      {/* 2. HIGHLIGHTS E ESFERAS DE CALIBRAÇÃO (Apenas visíveis se selecionados, com orçamento ou em calibração) */}
      {/* Grupo com translação de +1.5 Z para alinhar perfeitamente com a malha do modelo realista */}
      <group position={[0, 0, 1.5]}>
        {ALL_TEETH.map((toothNum) => {
          const toothProcedures = procedures.filter(p => p.tooth_id === String(toothNum));
          const hasBudget = toothProcedures.length > 0;
          const isSelected = viewerState.activeTooth === toothNum;

          if (!isSelected && !hasBudget && !isCalibrating) return null;

          const { position } = getToothPosition(toothNum);
          
          let color = '#0ea5e9';
          let emissive = '#0284c7';
          let opacity = 0.5;

          if (isCalibrating) {
            color = '#ef4444'; // Vermelho para calibração
            emissive = '#dc2626';
            opacity = 0.6;
          } else if (isSelected) {
            color = '#3B82F6'; // Azul para selecionado
            emissive = '#3B82F6';
            opacity = 0.6;
          }

          return (
            <mesh key={toothNum} position={position} geometry={hitBoxGeo}>
              <meshStandardMaterial 
                color={color} 
                emissive={emissive} 
                emissiveIntensity={0.5} 
                transparent 
                opacity={opacity} 
                depthWrite={false}
                depthTest={!isCalibrating} // Se calibrando, renderiza por cima para visualizarmos melhor
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
