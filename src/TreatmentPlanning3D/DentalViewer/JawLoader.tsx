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
  const { procedures, selectTooth, viewerState, teeth } = usePlanning3D();

  // O modelo do Sketchfab está em metros (~0.1 de largura), precisamos escalar para ~85 para bater com as hitboxes de 9 unidades
  const modelScale = 85.0; 

  const missingCenters = React.useMemo(() => {
    return (viewerState.missingTeeth || []).map(num => {
      const pos = getToothPosition(num).position;
      // As the hitboxes are within a group with position={[0, -0.2, 0]},
      // their world position would be y - 0.2.
      return new THREE.Vector3(pos[0], pos[1] - 0.2, pos[2]);
    });
  }, [viewerState.missingTeeth, getToothPosition]);

  // Clonamos a cena para não afetar outras instâncias e injetamos o shader
  const clonedScene = React.useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child: any) => {
      if (child.isMesh && child.name.includes('teeth')) {
        child.material = child.material.clone();
        
        // Ativa customDepthMaterial para garantir que a sombra respeite o discard
        child.customDepthMaterial = new THREE.MeshDepthMaterial({
          depthPacking: THREE.RGBADepthPacking,
          alphaTest: 0.5
        });

        const patchShader = (shader: any) => {
          child.material.userData.shader = shader;
          shader.uniforms.uMissingCount = { value: 0 };
          shader.uniforms.uMissingCenters = { value: Array(32).fill(new THREE.Vector3()) };
          
          shader.vertexShader = `
            varying vec3 vWorldPos;
            ${shader.vertexShader}
          `.replace(
            `#include <worldpos_vertex>`,
            `
            #include <worldpos_vertex>
            vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
            `
          );

          shader.fragmentShader = `
            uniform int uMissingCount;
            uniform vec3 uMissingCenters[32];
            varying vec3 vWorldPos;
            ${shader.fragmentShader}
          `.replace(
            `#include <clipping_planes_fragment>`,
            `
            #include <clipping_planes_fragment>
            for(int i = 0; i < 32; i++) {
              if(i >= uMissingCount) break;
              if(distance(vWorldPos, uMissingCenters[i]) < 0.6) {
                discard;
              }
            }
            `
          );
        };

        child.material.onBeforeCompile = patchShader;
        child.customDepthMaterial.onBeforeCompile = patchShader;
      }
    });
    return clone;
  }, [scene]);

  // Atualizar os uniforms quando missingTeeth mudar
  React.useEffect(() => {
    clonedScene.traverse((child: any) => {
      if (child.isMesh && child.material.userData.shader) {
        child.material.userData.shader.uniforms.uMissingCount.value = missingCenters.length;
        // Atualizar o array (Three.js aceita array de Vector3)
        const padded = [...missingCenters];
        while(padded.length < 32) padded.push(new THREE.Vector3());
        child.material.userData.shader.uniforms.uMissingCenters.value = padded;
      }
      if (child.isMesh && child.customDepthMaterial && child.customDepthMaterial.userData.shader) {
        child.customDepthMaterial.userData.shader.uniforms.uMissingCount.value = missingCenters.length;
        const padded = [...missingCenters];
        while(padded.length < 32) padded.push(new THREE.Vector3());
        child.customDepthMaterial.userData.shader.uniforms.uMissingCenters.value = padded;
      }
    });
  }, [missingCenters, clonedScene]);

  return (
    <group position={[0, -0.2, 0]}>
      
      {/* 1. MODELO REALISTA (FUNDO) */}
      <group scale={[modelScale, modelScale, modelScale]} position={[0, 0, 1.5]}>
        <primitive object={clonedScene} />
      </group>

      {/* 2. HITBOXES E HIGHLIGHTS DE ORÇAMENTO */}
      {/* Como o modelo realista tem dentes fundidos (1 única mesh "Object_1"),
          nós sobrepomos hitboxes invisíveis nas posições calculadas para detectar os cliques 
          e criar os brilhos neon de orçamento. */}
      {ALL_TEETH.map((toothNum) => {
        const { position, rotation } = getToothPosition(toothNum);
        const toothState = teeth[toothNum];
        const toothProcedures = toothState ? procedures.filter(p => p.tooth_id === toothState.id) : [];
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
