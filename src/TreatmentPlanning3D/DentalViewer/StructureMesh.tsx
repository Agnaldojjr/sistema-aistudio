import React from 'react';
import * as THREE from 'three';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { LayerKey } from '../types';

interface StructureMeshProps {
  layerKey: LayerKey;
  geometry?: THREE.BufferGeometry;
  color: string;
  defaultPosition?: [number, number, number];
  defaultRotation?: [number, number, number];
  children?: React.ReactNode;
}

export function StructureMesh({
  layerKey,
  geometry,
  color,
  defaultPosition = [0, 0, 0],
  defaultRotation = [0, 0, 0],
  children
}: StructureMeshProps) {
  const { viewerState } = usePlanning3D();
  const layerState = viewerState.layers[layerKey];

  if (!layerState || !layerState.visible) return null;

  // Se houver geometria provida pelo GLTF Loader
  if (geometry) {
    return (
      <mesh
        geometry={geometry}
        position={defaultPosition}
        rotation={defaultRotation}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={color}
          roughness={layerKey === 'gums' ? 0.15 : 0.6}
          metalness={layerKey === 'bone' ? 0.1 : 0.05}
          transparent={layerState.opacity < 1}
          opacity={layerState.opacity}
        />
      </mesh>
    );
  }

  // Caso seja renderizado como Fallback Procedural via filhos
  if (children) {
    return <group>{children}</group>;
  }

  return null;
}
