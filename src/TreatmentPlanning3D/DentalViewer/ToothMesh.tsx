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

export const DEFAULT_ARCH_CONFIG = {
  a: 4.5,
  b: 4.0,
  zOffset: -1.5,
  yOffset: 1.0,
  maxAngleDivider: 2.3,
  hitboxScale: 0.8,
};

export type ArchConfig = typeof DEFAULT_ARCH_CONFIG;

export function getToothPosition(fdiCode: number): { position: [number, number, number]; rotation: [number, number, number] } {
  const isUpper = fdiCode < 30;
  const config = DEFAULT_ARCH_CONFIG;
  const quadrant = Math.floor(fdiCode / 10);
  const positionIndex = fdiCode % 10;

  let index = 0;
  if (quadrant === 1 || quadrant === 4) {
    index = -positionIndex;
  } else {
    index = positionIndex;
  }

  const maxAngle = Math.PI / config.maxAngleDivider;
  const angle = (index / 8) * maxAngle;

  const x = config.a * Math.sin(angle);
  const z = config.b * Math.cos(angle) + config.zOffset;
  const y = isUpper ? config.yOffset : -config.yOffset;

  return {
    position: [x, y, z],
    rotation: [isUpper ? 0 : Math.PI, angle, 0],
  };
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

  const getCrownMaterialProps = () => {
    let color = hovered ? '#E0F2FE' : '#FAF8F5';
    let roughness = 0.05;
    let metalness = 0.15;

    const toothProcs = getToothProcedures(toothNumber);
    if (toothProcs && toothProcs.length > 0) {
      const hasInProgress = toothProcs.some((p: any) => p.status === 'Em andamento' || p.status === 'Executando');
      const isAllCompleted = toothProcs.every((p: any) => p.status === 'Concluído' || p.status === 'Executado');
      
      if (hasInProgress) {
        color = '#EAB308'; // Amarelo
      } else if (isAllCompleted) {
        color = '#22C55E'; // Verde
      } else {
        color = '#EF4444'; // Vermelho (A realizar / Pendente)
      }
    } else if (toothState?.condition === 'IMPLANT') {
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
        <ToothSurfaceOverlay toothNumber={toothNumber} isSelected={isSelected} />
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

interface ToothSurfaceOverlayProps {
  toothNumber: number;
  isSelected?: boolean;
}

export function ToothSurfaceOverlay({ toothNumber, isSelected = false }: ToothSurfaceOverlayProps) {
  const { viewerState, getSurfaceCondition, getToothProcedures, globalProcedures } = usePlanning3D();
  const isAnterior = isAnteriorTooth(toothNumber);
  const isAfterSimulation = viewerState.simulationState === 'AFTER';

  const getSurfaceColor = (surface: ToothSurface) => {
    let cond = getSurfaceCondition(toothNumber, surface);

    if (isAfterSimulation) {
      if (cond === 'CARIES' || cond === 'FRACTURE') {
        cond = 'HEALTHY';
      }
    }

    if (cond === 'IMPLANT') return '#9CA3AF';
    if (cond === 'CROWN') return '#F59E0B';

    // A cor geral do dente baseada nos procedimentos já é aplicada no getCrownMaterialProps

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

  const topSurface: ToothSurface = isAnterior ? 'I' : 'O';
  
  const faceColors = {
    distal: getSurfaceColor('D'),
    mesial: getSurfaceColor('M'),
    top: getSurfaceColor(topSurface),
    cervical: getSurfaceColor('C'),
    vestibular: getSurfaceColor('V'),
    lingual: getSurfaceColor('L'),
  };

  return (
    <mesh castShadow receiveShadow geometry={isAnterior ? sharedAnteriorBox : sharedMolarBox}>
      <meshStandardMaterial attach="material-0" color={faceColors.distal} roughness={0.1} transparent opacity={isSurfaceActive('D') ? 0.85 : 0} />
      <meshStandardMaterial attach="material-1" color={faceColors.mesial} roughness={0.1} transparent opacity={isSurfaceActive('M') ? 0.85 : 0} />
      <meshStandardMaterial attach="material-2" color={faceColors.top} roughness={0.1} transparent opacity={isSurfaceActive(topSurface) ? 0.85 : 0} />
      <meshStandardMaterial attach="material-3" color={faceColors.cervical} roughness={0.1} transparent opacity={isSurfaceActive('C') ? 0.85 : 0} />
      <meshStandardMaterial attach="material-4" color={faceColors.vestibular} roughness={0.1} transparent opacity={isSurfaceActive('V') ? 0.85 : 0} />
      <meshStandardMaterial attach="material-5" color={faceColors.lingual} roughness={0.1} transparent opacity={isSurfaceActive('L') ? 0.85 : 0} />
    </mesh>
  );
}

const toothShaderSetupMap = new WeakMap<any, boolean>();

export function setupToothShader(material: any, fdi: number) {
  if (toothShaderSetupMap.has(material)) return;
  toothShaderSetupMap.set(material, true);

  material.onBeforeCompile = (shader: any) => {
    shader.uniforms.uSelectedSurfaces = { value: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0] };
    shader.uniforms.uSurfaceColors = {
      value: [
        new THREE.Color('#FAF8F5'), // M
        new THREE.Color('#FAF8F5'), // D
        new THREE.Color('#FAF8F5'), // O/I
        new THREE.Color('#FAF8F5'), // C
        new THREE.Color('#FAF8F5'), // V
        new THREE.Color('#FAF8F5'), // L
      ]
    };
    shader.uniforms.uArchAngle = { value: 0.0 };
    shader.uniforms.uIsUpper = { value: 1.0 };
    shader.uniforms.uMidlineDirection = { value: 1.0 };
    shader.uniforms.uCameraWorldMatrix = { value: new THREE.Matrix4() };

    material.userData.shaderUniforms = shader.uniforms;

    // Injeta varyings e uniforms no Fragment Shader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uSelectedSurfaces[6];
       uniform vec3 uSurfaceColors[6];
       uniform float uArchAngle;
       uniform float uIsUpper;
       uniform float uMidlineDirection;
       uniform mat4 uCameraWorldMatrix;`
    );

    // Injeta a lógica de coloração no Fragment Shader baseado na normal de mundo rotacionada
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       // Transforma a normal de view space para world space usando a camera matrix customizada
       vec3 worldN;
       #ifdef USE_NORMAL
         worldN = normalize( (uCameraWorldMatrix * vec4(normalize(vNormal), 0.0)).xyz );
       #else
         vec3 customFdx = dFdx( vViewPosition );
         vec3 customFdy = dFdy( vViewPosition );
         vec3 faceNormal = normalize( cross( customFdx, customFdy ) );
         worldN = normalize( (uCameraWorldMatrix * vec4(faceNormal, 0.0)).xyz );
       #endif
       
       // Rotaciona a normal no eixo Y pelo ângulo do arco dentário
       float c = cos(-uArchAngle);
       float s = sin(-uArchAngle);
       vec3 localN = vec3(
         worldN.x * c - worldN.z * s,
         worldN.y,
         worldN.x * s + worldN.z * c
       );

       // Ajusta por conta da inversão da mandíbula [Math.PI, Math.PI, 0] no GLB
       localN.x = -localN.x;
       localN.y = -localN.y;

       float absX = abs(localN.x);
       float absY = abs(localN.y);
       float absZ = abs(localN.z);

       int faceIndex = -1;
       
       if (absY > absX && absY > absZ) {
         if (localN.y * uIsUpper > 0.0) {
           faceIndex = 2; // Oclusal / Incisal
         } else {
           faceIndex = 3; // Cervical
         }
       } else if (absZ > absX && absZ > absY) {
         if (localN.z > 0.0) {
           faceIndex = 4; // Vestibular
         } else {
           faceIndex = 5; // Lingual
         }
       } else {
         if (localN.x * uMidlineDirection > 0.0) {
           faceIndex = 0; // Mesial
         } else {
           faceIndex = 1; // Distal
         }
       }

       if (faceIndex >= 0 && uSelectedSurfaces[faceIndex] > 0.5) {
         diffuseColor.rgb = uSurfaceColors[faceIndex];
       }`
    );
  };

  material.needsUpdate = true;
}

export function updateToothUniforms(
  material: any,
  fdi: number,
  isSelected: boolean,
  viewerState: any,
  getSurfaceCondition: any,
  getToothProcedures: any,
  globalProcedures: any
) {
  const uniforms = material.userData.shaderUniforms;
  if (!uniforms) return;

  const isAnterior = fdi % 10 >= 1 && fdi % 10 <= 3;
  const topSurface = isAnterior ? 'I' : 'O';
  const surfacesOrder: ('M' | 'D' | 'O' | 'I' | 'V' | 'L' | 'C')[] = ['M', 'D', topSurface, 'C', 'V', 'L'];

  const selectedSurfacesValue = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
  const surfaceColorsValue = [
    new THREE.Color('#FAF8F5'),
    new THREE.Color('#FAF8F5'),
    new THREE.Color('#FAF8F5'),
    new THREE.Color('#FAF8F5'),
    new THREE.Color('#FAF8F5'),
    new THREE.Color('#FAF8F5'),
  ];

  const isAfterSimulation = viewerState.simulationState === 'AFTER';

  surfacesOrder.forEach((surface, idx) => {
    let cond = getSurfaceCondition(fdi, surface);
    if (isAfterSimulation && (cond === 'CARIES' || cond === 'FRACTURE')) {
      cond = 'HEALTHY';
    }

    let isActive = cond !== 'HEALTHY' && cond !== undefined;
    let colorHex = '#FAF8F5';

    if (cond === 'IMPLANT') {
      colorHex = '#9CA3AF';
    } else if (cond === 'CROWN') {
      colorHex = '#F59E0B';
    } else if (cond === 'CARIES' || cond === 'FRACTURE') {
      colorHex = '#EF4444';
    }

    // A cor geral baseada nos procedimentos já é configurada no material base pelo getCrownMaterialProps,
    // então não aplicamos sobreposição de shader a menos que seja selecionado ou com cárie.

    // Verificar se a face está atualmente selecionada pelo usuário
    const isSurfaceSelected = isSelected && viewerState.activeSurfaces.includes(surface);
    if (isSurfaceSelected) {
      colorHex = '#3B82F6'; // Azul de seleção
      isActive = true;
    }

    selectedSurfacesValue[idx] = isActive ? 1.0 : 0.0;
    surfaceColorsValue[idx].set(colorHex);
  });

  // Cálculo das diretrizes do dente
  const isUpper = fdi < 30;
  const quadrant = Math.floor(fdi / 10);
  const midlineDirection = (quadrant === 1 || quadrant === 4) ? 1.0 : -1.0;
  const { rotation } = getToothPosition(fdi);
  const archAngle = rotation[1];

  uniforms.uSelectedSurfaces.value = selectedSurfacesValue;
  uniforms.uArchAngle.value = archAngle;
  uniforms.uIsUpper.value = isUpper ? 1.0 : -1.0;
  uniforms.uMidlineDirection.value = midlineDirection;
  
  for (let i = 0; i < 6; i++) {
    uniforms.uSurfaceColors.value[i].copy(surfaceColorsValue[i]);
  }
}

