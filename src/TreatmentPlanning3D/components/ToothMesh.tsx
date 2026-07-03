import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { ToothCondition, ToothSurface } from '../types';

interface ToothMeshProps {
  toothNumber: number;
  position: [number, number, number];
  rotation?: [number, number, number];
}

export function isAnteriorTooth(toothNumber: number): boolean {
  const code = toothNumber % 10;
  return code >= 1 && code <= 3;
}

// Geometrias compartilhadas para economizar alocação de GPU e evitar WebGL Context Lost
const sharedBoxGeometry = new THREE.BoxGeometry(0.8, 0.9, 0.8);
const sharedConeGeometry = new THREE.ConeGeometry(0.3, 0.8, 4);
const sharedCylinderGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 4);
const sharedSphereGeometry = new THREE.SphereGeometry(0.08, 16, 16);

// Geometrias anatômicas realistas
const sharedMolarCrownCylinder = new THREE.CylinderGeometry(0.42, 0.42, 0.7, 16);
const sharedMolarCrownSphere = new THREE.SphereGeometry(0.42, 16, 16);
const sharedAnteriorCrownCylinder = new THREE.CylinderGeometry(0.38, 0.2, 0.8, 16);
const sharedMolarRootCone = new THREE.ConeGeometry(0.15, 0.8, 8);
const sharedAnteriorRootCone = new THREE.ConeGeometry(0.15, 1.0, 8);

const sharedMolarBox = new THREE.BoxGeometry(0.88, 0.78, 0.88);
const sharedAnteriorBox = new THREE.BoxGeometry(0.78, 0.83, 0.32);

export function ToothMesh({ toothNumber, position, rotation = [0, 0, 0] }: ToothMeshProps) {
  const { viewerState, selectTooth, getToothState, getSurfaceCondition } = usePlanning3D();
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const toothState = getToothState(toothNumber);
  const isSelected = viewerState.activeTooth === toothNumber;
  const isAnterior = isAnteriorTooth(toothNumber);
  const isAfterSimulation = viewerState.simulationState === 'AFTER';

  // Se o dente estiver ausente (MISSING):
  // No modo "Antes": Fica ocultado.
  // No modo "Depois" (AFTER): Simula reabilitação com coroa de porcelana
  if (toothState?.condition === 'MISSING') {
    if (isAfterSimulation) {
      return (
        <group position={position} rotation={rotation}>
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
      );
    }
    return null;
  }

  // Helper para obter a cor de cada face (superfície) individual
  const getSurfaceColor = (surface: ToothSurface) => {
    let cond = getSurfaceCondition(toothNumber, surface);

    // No modo "Depois", todas as patologias de cáries/fraturas são limpas (ficam saudáveis)
    if (isAfterSimulation) {
      if (cond === 'CARIES' || cond === 'FRACTURE') {
        cond = 'HEALTHY';
      }
    }

    // Se for Implante ou Coroa
    if (toothState?.condition === 'IMPLANT' || cond === 'IMPLANT') return '#9CA3AF';
    if (toothState?.condition === 'CROWN' || cond === 'CROWN') return '#F59E0B';

    switch (cond) {
      case 'CARIES':
      case 'FRACTURE':
        return '#EF4444'; // Vermelho para patologias
      case 'HEALTHY':
      default:
        const isSurfaceSelected = isSelected && viewerState.activeSurfaces.includes(surface);
        if (isSurfaceSelected) {
          return '#3B82F6'; // Azul para seleção
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
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (e: any) => {
    setHovered(false);
    document.body.style.cursor = 'default';
  };

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (viewerState.presentationMode) return;
    if (isSelected) {
      selectTooth(null);
    } else {
      selectTooth(toothNumber);
    }
  };

  const crownProps = getCrownMaterialProps();

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* 1. COROA ANATÔMICA DO DENTE (Formas orgânicas realistas) */}
      {isAnterior ? (
        // Dente Anterior: Formato cinzel/cuneiforme
        <mesh castShadow receiveShadow geometry={sharedAnteriorCrownCylinder} scale={[1, 1, 0.3]}>
          <meshStandardMaterial color={crownProps.color} roughness={crownProps.roughness} metalness={crownProps.metalness} />
        </mesh>
      ) : (
        // Dente Posterior (Molar/Pré-molar): Formato cilíndrico com cúspides arredondadas
        <group>
          <mesh castShadow receiveShadow geometry={sharedMolarCrownCylinder}>
            <meshStandardMaterial color={crownProps.color} roughness={crownProps.roughness} metalness={crownProps.metalness} />
          </mesh>
          <mesh castShadow receiveShadow geometry={sharedMolarCrownSphere} position={[0, 0.35, 0]} scale={[1, 0.3, 1]}>
            <meshStandardMaterial color={crownProps.color} roughness={crownProps.roughness} metalness={crownProps.metalness} />
          </mesh>
        </group>
      )}

      {/* 2. RAÍZES ANATÔMICAS (Duas para molares, uma para anteriores) */}
      {!isAnterior ? (
        <group visible={toothState?.condition !== 'IMPLANT'}>
          <mesh
            position={[-0.2, -0.65, 0]}
            rotation={[0, 0, 0.15]}
            castShadow
            receiveShadow
            geometry={sharedMolarRootCone}
          >
            <meshStandardMaterial
              color={viewerState.transparencyMode ? '#FCA5A5' : '#D1D5DB'}
              opacity={viewerState.transparencyMode ? 0.3 : 1}
              transparent={viewerState.transparencyMode}
              roughness={0.8}
            />
          </mesh>
          <mesh
            position={[0.2, -0.65, 0]}
            rotation={[0, 0, -0.15]}
            castShadow
            receiveShadow
            geometry={sharedMolarRootCone}
          >
            <meshStandardMaterial
              color={viewerState.transparencyMode ? '#FCA5A5' : '#D1D5DB'}
              opacity={viewerState.transparencyMode ? 0.3 : 1}
              transparent={viewerState.transparencyMode}
              roughness={0.8}
            />
          </mesh>
        </group>
      ) : (
        <mesh
          position={[0, -0.8, 0]}
          scale={[1, 1, 0.6]}
          castShadow
          receiveShadow
          geometry={sharedAnteriorRootCone}
          visible={toothState?.condition !== 'IMPLANT'}
        >
          <meshStandardMaterial
            color={viewerState.transparencyMode ? '#FCA5A5' : '#D1D5DB'}
            opacity={viewerState.transparencyMode ? 0.3 : 1}
            transparent={viewerState.transparencyMode}
          />
        </mesh>
      )}

      {/* 2.5. GENGIVA MARGINAL / PAPILA (Garante o contorno realista da gengiva ao redor do dente) */}
      {!viewerState.transparencyMode && (
        <mesh
          position={[0, -0.32, 0.05]}
          scale={[1.1, 0.5, 1.1]}
        >
          <sphereGeometry args={[0.48, 16, 16]} />
          <meshStandardMaterial
            color="#C77373" // Cor rosada realista da gengiva
            roughness={0.15}
            metalness={0.05}
          />
        </mesh>
      )}

      {/* 3. MESH DO CANAL RADICULAR */}
      <mesh
        position={[0, -0.6, 0]}
        geometry={sharedCylinderGeometry}
        visible={(toothState?.condition === 'PULPITIS' || viewerState.transparencyMode) && !isAfterSimulation}
      >
        <meshStandardMaterial
          color={toothState?.condition === 'PULPITIS' ? '#EF4444' : '#F43F5E'}
          emissive="#EF4444"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* 4. OVERLAY DAS SUPERFÍCIES (Exibe as cores de patologias/seleção nas faces correspondentes) */}
      <mesh castShadow receiveShadow geometry={isAnterior ? sharedAnteriorBox : sharedMolarBox}>
        <meshStandardMaterial attach="material-0" color={faceColors.distal} roughness={0.1} transparent opacity={isSurfaceActive('D') ? 0.85 : 0} />
        <meshStandardMaterial attach="material-1" color={faceColors.mesial} roughness={0.1} transparent opacity={isSurfaceActive('M') ? 0.85 : 0} />
        <meshStandardMaterial attach="material-2" color={faceColors.top} roughness={0.1} transparent opacity={isSurfaceActive(topSurface) ? 0.85 : 0} />
        <meshStandardMaterial attach="material-3" color={faceColors.cervical} roughness={0.1} transparent opacity={isSurfaceActive('C') ? 0.85 : 0} />
        <meshStandardMaterial attach="material-4" color={faceColors.vestibular} roughness={0.1} transparent opacity={isSurfaceActive('V') ? 0.85 : 0} />
        <meshStandardMaterial attach="material-5" color={faceColors.lingual} roughness={0.1} transparent opacity={isSurfaceActive('L') ? 0.85 : 0} />
      </mesh>

      {/* Rótulo de seleção ativo */}
      {isSelected && (
        <mesh position={[0, 0.8, 0.5]} geometry={sharedSphereGeometry}>
          <meshBasicMaterial color="#3B82F6" />
        </mesh>
      )}
    </group>
  );
}
