import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { ToothSurface, ToothCondition } from '../types';
import { SelectionManager } from './SelectionManager';

interface ToothMeshProps {
  toothNumber: number;
  position: [number, number, number];
  rotation?: [number, number, number];
  geometries?: {
    enamel?: THREE.BufferGeometry;
    dentin?: THREE.BufferGeometry;
    pulp?: THREE.BufferGeometry;
    root?: THREE.BufferGeometry;
    canal?: THREE.BufferGeometry;
  };
}

export function isAnteriorTooth(toothNumber: number): boolean {
  const code = toothNumber % 10;
  return code >= 1 && code <= 3;
}

// Geometrias compartilhadas para fallback procedural de alto nível
const sharedMolarCrownCylinder = new THREE.CylinderGeometry(0.42, 0.42, 0.7, 16);
const sharedMolarCrownSphere = new THREE.SphereGeometry(0.42, 16, 16);
const sharedAnteriorCrownCylinder = new THREE.CylinderGeometry(0.38, 0.2, 0.8, 16);
const sharedMolarRootCone = new THREE.ConeGeometry(0.15, 0.8, 8);
const sharedAnteriorRootCone = new THREE.ConeGeometry(0.15, 1.0, 8);
const sharedCylinderGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 4);

const sharedMolarBox = new THREE.BoxGeometry(0.88, 0.78, 0.88);
const sharedAnteriorBox = new THREE.BoxGeometry(0.78, 0.83, 0.32);
const sharedSphereGeometry = new THREE.SphereGeometry(0.08, 16, 16);

export function ToothMesh({ toothNumber, position, rotation = [0, 0, 0], geometries }: ToothMeshProps) {
  const { viewerState, selectTooth, getToothState, getSurfaceCondition } = usePlanning3D();
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const toothState = getToothState(toothNumber);
  const isSelected = viewerState.activeTooth === toothNumber;
  const isAnterior = isAnteriorTooth(toothNumber);
  const isAfterSimulation = viewerState.simulationState === 'AFTER';

  const selectionManager = SelectionManager.getInstance();

  // Camadas individuais do contexto
  const teethLayer = viewerState.layers.teeth;
  const rootsLayer = viewerState.layers.roots;
  const pulpLayer = viewerState.layers.pulp;
  const canalsLayer = viewerState.layers.canals;

  // Se o dente estiver ausente (MISSING):
  // No modo "Antes": Fica ocultado.
  // No modo "Depois" (AFTER): Simula reabilitação com coroa de porcelana/implante
  if (toothState?.condition === 'MISSING') {
    if (isAfterSimulation) {
      return (
        <group position={position} rotation={rotation}>
          {geometries?.enamel ? (
            <mesh castShadow receiveShadow geometry={geometries.enamel}>
              <meshStandardMaterial color="#FAF8F5" roughness={0.05} metalness={0.1} />
            </mesh>
          ) : (
            <group>
              {isAnterior ? (
                <mesh castShadow receiveShadow geometry={sharedAnteriorCrownCylinder} scale={[1, 1, 0.3]}>
                  <meshStandardMaterial color="#FAF8F5" roughness={0.05} metalness={0.1} />
                </mesh>
              ) : (
                <group>
                  <mesh castShadow receiveShadow geometry={sharedMolarCrownCylinder}>
                    <meshStandardMaterial color="#FAF8F5" roughness={0.05} metalness={0.1} />
                  </mesh>
                  <mesh castShadow receiveShadow geometry={sharedMolarCrownSphere} position={[0, 0.35, 0]} scale={[1, 0.3, 1]}>
                    <meshStandardMaterial color="#FAF8F5" roughness={0.05} metalness={0.1} />
                  </mesh>
                </group>
              )}
            </group>
          )}
        </group>
      );
    }
    return null;
  }

  // Obter a cor de cada face (superfície) individual
  const getSurfaceColor = (surface: ToothSurface) => {
    let cond = getSurfaceCondition(toothNumber, surface);

    if (isAfterSimulation) {
      if (cond === 'CARIES' || cond === 'FRACTURE') {
        cond = 'HEALTHY';
      }
    }

    if (toothState?.condition === 'IMPLANT' || cond === 'IMPLANT') return '#9CA3AF';
    if (toothState?.condition === 'CROWN' || cond === 'CROWN') return '#F59E0B';

    switch (cond) {
      case 'CARIES':
      case 'FRACTURE':
        return '#EF4444';
      case 'HEALTHY':
      default:
        const isSurfaceSelected = isSelected && viewerState.activeSurfaces.includes(surface);
        if (isSurfaceSelected) {
          return '#3B82F6';
        }
        return '#FAF8F5';
    }
  };

  const isSurfaceActive = (surface: ToothSurface) => {
    const cond = getSurfaceCondition(toothNumber, surface);
    
    let activeCond = cond;
    if (isAfterSimulation && (cond === 'CARIES' || cond === 'FRACTURE')) {
      activeCond = 'HEALTHY';
    }

    const isSurfaceSelected = isSelected && viewerState.activeSurfaces.includes(surface);
    return activeCond !== 'HEALTHY' || isSurfaceSelected;
  };

  const getCrownMaterialProps = () => {
    let color = hovered ? '#E0F2FE' : '#FAF8F5';
    let roughness = 0.05;
    let metalness = 0.15;

    if (toothState?.condition === 'IMPLANT') {
      color = '#9CA3AF';
      roughness = 0.2;
      metalness = 0.8;
    } else if (toothState?.condition === 'CROWN') {
      color = '#F59E0B';
      roughness = 0.1;
      metalness = 0.7;
    }

    return { color, roughness, metalness };
  };

  const topSurface: ToothSurface = isAnterior ? 'I' : 'O';
  
  const faceColors = {
    distal: getSurfaceColor('D'),
    mesial: getSurfaceColor('M'),
    top: getSurfaceColor(topSurface),
    cervical: getSurfaceColor('C'),
    vestibular: getSurfaceColor('V'),
    lingual: getSurfaceColor('L'),
  };

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    if (viewerState.presentationMode) return;
    setHovered(true);
    selectionManager.hoverTooth(toothNumber);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (e: any) => {
    setHovered(false);
    selectionManager.hoverTooth(null);
    document.body.style.cursor = 'default';
  };

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (viewerState.presentationMode) return;
    if (isSelected) {
      selectTooth(null);
      selectionManager.selectTooth(null);
    } else {
      selectTooth(toothNumber);
      selectionManager.selectTooth(toothNumber);
    }
  };

  const crownProps = getCrownMaterialProps();
  const highlightProps = selectionManager.getHighlightProps(toothNumber, viewerState.activeTooth, hovered);

  const opacityTeeth = teethLayer.opacity;
  const showTeeth = teethLayer.visible;

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* 1. COROA ANATÔMICA DO DENTE */}
      {showTeeth && (
        <group>
          {geometries?.enamel ? (
            // Se carregado do GLTF
            <mesh castShadow receiveShadow geometry={geometries.enamel}>
              <meshStandardMaterial
                color={crownProps.color}
                roughness={crownProps.roughness}
                metalness={crownProps.metalness}
                transparent={opacityTeeth < 1}
                opacity={opacityTeeth}
                emissive={highlightProps.emissive}
                emissiveIntensity={highlightProps.emissiveIntensity}
              />
            </mesh>
          ) : (
            // Fallback anatômico
            <group>
              {isAnterior ? (
                <mesh castShadow receiveShadow geometry={sharedAnteriorCrownCylinder} scale={[1, 1, 0.3]}>
                  <meshStandardMaterial
                    color={crownProps.color}
                    roughness={crownProps.roughness}
                    metalness={crownProps.metalness}
                    transparent={opacityTeeth < 1}
                    opacity={opacityTeeth}
                    emissive={highlightProps.emissive}
                    emissiveIntensity={highlightProps.emissiveIntensity}
                  />
                </mesh>
              ) : (
                <group>
                  <mesh castShadow receiveShadow geometry={sharedMolarCrownCylinder}>
                    <meshStandardMaterial
                      color={crownProps.color}
                      roughness={crownProps.roughness}
                      metalness={crownProps.metalness}
                      transparent={opacityTeeth < 1}
                      opacity={opacityTeeth}
                      emissive={highlightProps.emissive}
                      emissiveIntensity={highlightProps.emissiveIntensity}
                    />
                  </mesh>
                  <mesh castShadow receiveShadow geometry={sharedMolarCrownSphere} position={[0, 0.35, 0]} scale={[1, 0.3, 1]}>
                    <meshStandardMaterial
                      color={crownProps.color}
                      roughness={crownProps.roughness}
                      metalness={crownProps.metalness}
                      transparent={opacityTeeth < 1}
                      opacity={opacityTeeth}
                      emissive={highlightProps.emissive}
                      emissiveIntensity={highlightProps.emissiveIntensity}
                    />
                  </mesh>
                </group>
              )}
            </group>
          )}
        </group>
      )}

      {/* 1.2 DENTINA ANATÔMICA (Se carregada do GLTF) */}
      {showTeeth && geometries?.dentin && (
        <mesh geometry={geometries.dentin}>
          <meshStandardMaterial
            color="#FEF08A" // Amarelado
            roughness={0.7}
            transparent
            opacity={opacityTeeth * 0.9}
          />
        </mesh>
      )}

      {/* 2. RAÍZES ANATÔMICAS */}
      {rootsLayer.visible && toothState?.condition !== 'IMPLANT' && (
        <group>
          {geometries?.root ? (
            <mesh castShadow receiveShadow geometry={geometries.root}>
              <meshStandardMaterial
                color="#D1D5DB"
                transparent={rootsLayer.opacity < 1}
                opacity={rootsLayer.opacity}
                roughness={0.8}
              />
            </mesh>
          ) : (
            // Fallback de raiz
            <group>
              {!isAnterior ? (
                <group>
                  <mesh position={[-0.2, -0.65, 0]} rotation={[0, 0, 0.15]} geometry={sharedMolarRootCone}>
                    <meshStandardMaterial
                      color="#D1D5DB"
                      transparent={rootsLayer.opacity < 1}
                      opacity={rootsLayer.opacity}
                      roughness={0.8}
                    />
                  </mesh>
                  <mesh position={[0.2, -0.65, 0]} rotation={[0, 0, -0.15]} geometry={sharedMolarRootCone}>
                    <meshStandardMaterial
                      color="#D1D5DB"
                      transparent={rootsLayer.opacity < 1}
                      opacity={rootsLayer.opacity}
                      roughness={0.8}
                    />
                  </mesh>
                </group>
              ) : (
                <mesh position={[0, -0.8, 0]} scale={[1, 1, 0.6]} geometry={sharedAnteriorRootCone}>
                  <meshStandardMaterial
                    color="#D1D5DB"
                    transparent={rootsLayer.opacity < 1}
                    opacity={rootsLayer.opacity}
                    roughness={0.8}
                  />
                </mesh>
              )}
            </group>
          )}
        </group>
      )}

      {/* 3. POLPA (NERVO DENTÁRIO) */}
      {pulpLayer.visible && (geometries?.pulp || toothState?.condition === 'PULPITIS') && (
        <mesh
          geometry={geometries?.pulp || sharedCylinderGeometry}
          position={geometries?.pulp ? [0, 0, 0] : [0, -0.2, 0]}
          scale={geometries?.pulp ? [1, 1, 1] : [1, 1.2, 1]}
        >
          <meshStandardMaterial
            color={toothState?.condition === 'PULPITIS' ? '#EF4444' : '#F43F5E'}
            roughness={0.2}
            emissive="#EF4444"
            emissiveIntensity={toothState?.condition === 'PULPITIS' ? 0.6 : 0.2}
            transparent={pulpLayer.opacity < 1}
            opacity={pulpLayer.opacity}
          />
        </mesh>
      )}

      {/* 3.2 CANAIS RADICULARES */}
      {canalsLayer.visible && (geometries?.canal || viewerState.transparencyMode) && (
        <mesh
          geometry={geometries?.canal || sharedCylinderGeometry}
          position={geometries?.canal ? [0, 0, 0] : [0, -0.6, 0]}
        >
          <meshStandardMaterial
            color="#EF4444"
            transparent={canalsLayer.opacity < 1}
            opacity={canalsLayer.opacity}
          />
        </mesh>
      )}

      {/* 4. OVERLAY DAS SUPERFÍCIES (Exibe as cores de patologias/seleção nas faces correspondentes) */}
      {showTeeth && (
        <mesh castShadow receiveShadow geometry={isAnterior ? sharedAnteriorBox : sharedMolarBox}>
          <meshStandardMaterial attach="material-0" color={faceColors.distal} roughness={0.1} transparent opacity={isSurfaceActive('D') ? 0.85 : 0} />
          <meshStandardMaterial attach="material-1" color={faceColors.mesial} roughness={0.1} transparent opacity={isSurfaceActive('M') ? 0.85 : 0} />
          <meshStandardMaterial attach="material-2" color={faceColors.top} roughness={0.1} transparent opacity={isSurfaceActive(topSurface) ? 0.85 : 0} />
          <meshStandardMaterial attach="material-3" color={faceColors.cervical} roughness={0.1} transparent opacity={isSurfaceActive('C') ? 0.85 : 0} />
          <meshStandardMaterial attach="material-4" color={faceColors.vestibular} roughness={0.1} transparent opacity={isSurfaceActive('V') ? 0.85 : 0} />
          <meshStandardMaterial attach="material-5" color={faceColors.lingual} roughness={0.1} transparent opacity={isSurfaceActive('L') ? 0.85 : 0} />
        </mesh>
      )}

      {/* Rótulo de seleção ativo */}
      {isSelected && (
        <mesh position={[0, 0.8, 0.5]} geometry={sharedSphereGeometry}>
          <meshBasicMaterial color="#3B82F6" />
        </mesh>
      )}
    </group>
  );
}
