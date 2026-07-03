import React from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ToothMesh } from './ToothMesh';
import { StructureMesh } from './StructureMesh';

// Lista de dentes permanentes por quadrantes
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ALL_TEETH = [...UPPER_TEETH, ...LOWER_TEETH];

// Pré-carrega o modelo anatômico padrão e o decodificador Draco
try {
  useGLTF.preload('/models/dental_jaw.glb', '/models/draco/');
} catch (e) {
  console.warn('Erro ao pré-carregar useGLTF:', e);
}

interface JawLoaderProps {
  getToothPosition: (fdiCode: number) => { position: [number, number, number]; rotation: [number, number, number] };
}

export function JawLoader({ getToothPosition }: JawLoaderProps) {
  // Carrega o GLTF/GLB usando Drei.
  // Se o arquivo não existir, o Suspense/ErrorBoundary acima capturará o erro e renderizará o FallbackProcedural.
  const { nodes } = useGLTF('/models/dental_jaw.glb', '/models/draco/') as any;

  // Extrair as geometrias de cada dente mapeado pelo padrão FDI
  const teethGeometries: Record<number, any> = {};

  ALL_TEETH.forEach((num) => {
    teethGeometries[num] = {
      enamel: nodes[`Enamel_${num}`]?.geometry || nodes[`${num}`]?.geometry,
      dentin: nodes[`Dentin_${num}`]?.geometry,
      pulp: nodes[`Pulp_${num}`]?.geometry,
      root: nodes[`Root_${num}`]?.geometry || nodes[`Root_${num}_Mesial`]?.geometry,
      canal: nodes[`Canal_${num}`]?.geometry,
    };
  });

  return (
    <group position={[0, -0.2, 0]}>
      {/* 1. RENDERIZAÇÃO DOS DENTES COM GEOMETRIAS ANATÔMICAS GLB */}
      {ALL_TEETH.map((toothNum) => {
        const { position, rotation } = getToothPosition(toothNum);
        return (
          <ToothMesh
            key={toothNum}
            toothNumber={toothNum}
            position={position}
            rotation={rotation}
            geometries={teethGeometries[toothNum]}
          />
        );
      })}

      {/* 2. RENDERIZAÇÃO DAS ESTRUTURAS ADICIONAIS DO GLB */}
      <StructureMesh
        layerKey="gums"
        color="#C77373"
        geometry={nodes.Gingiva_Upper?.geometry || nodes.Gingiva?.geometry}
      />
      <StructureMesh
        layerKey="gums"
        color="#C77373"
        geometry={nodes.Gingiva_Lower?.geometry}
      />

      <StructureMesh
        layerKey="bone"
        color="#E5E7EB"
        geometry={nodes.Bone_Upper?.geometry || nodes.Bone?.geometry}
      />
      <StructureMesh
        layerKey="bone"
        color="#E5E7EB"
        geometry={nodes.Bone_Lower?.geometry}
      />

      <StructureMesh
        layerKey="nerves"
        color="#FBBF24"
        geometry={nodes.Nerve_Mandibular?.geometry || nodes.Nerve?.geometry}
      />

      <StructureMesh
        layerKey="sinus"
        color="#A7F3D0"
        geometry={nodes.Sinus_Maxillar?.geometry || nodes.Sinus?.geometry}
      />
    </group>
  );
}
