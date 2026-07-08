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
}

// Geometria procedural leve para o highlight e hitbox
const hitBoxGeo = new THREE.SphereGeometry(0.35, 16, 16);

export function JawLoader({ getToothPosition }: JawLoaderProps) {
  const { scene } = useGLTF('/models/human_mouth_detailed.glb') as any;
  const { procedures, selectTooth, viewerState } = usePlanning3D();

  // Escala para ajustar o modelo realista com as nossas posições procedurais
  const modelScale = 0.8; 

  return (
    <group position={[0, -0.2, 0]}>
      
      {/* 1. MODELO REALISTA (FUNDO) */}
      <group scale={[modelScale, modelScale, modelScale]} position={[0, 0, 0]}>
        <primitive object={scene} />
      </group>

      {/* 2. HITBOXES E HIGHLIGHTS DE ORÇAMENTO */}
      {/* Como o modelo realista tem dentes fundidos (1 única mesh "Object_1"),
          nós sobrepomos hitboxes invisíveis nas posições calculadas para detectar os cliques 
          e criar os brilhos neon de orçamento. */}
      {ALL_TEETH.map((toothNum) => {
        const { position, rotation } = getToothPosition(toothNum);
        
        const toothProcedures = procedures.filter(p => p.tooth_id === toothNum);
        const hasBudget = toothProcedures.length > 0;
        const isSelected = viewerState.activeTooth === toothNum;

        // Mostrar highlight visível se estiver com orçamento ou selecionado
        const showHighlight = hasBudget || isSelected;

        return (
          <mesh
            key={toothNum}
            position={position}
            geometry={hitBoxGeo}
            onClick={(e) => {
              e.stopPropagation();
              selectTooth(toothNum);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'default';
            }}
            visible={true}
          >
            <meshStandardMaterial
              color={isSelected ? '#3B82F6' : '#0ea5e9'}
              emissive={isSelected ? '#3B82F6' : '#0284c7'}
              emissiveIntensity={0.6}
              transparent={true}
              opacity={showHighlight ? 0.7 : 0.0} // Invisível (0) para clique, visível (0.7) para highlight
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
