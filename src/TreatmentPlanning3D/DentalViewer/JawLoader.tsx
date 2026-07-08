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

  // 1. Clonamos a cena primeiro
  const clonedScene = React.useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        
        // Ativa customDepthMaterial para garantir que a sombra respeite o discard
        child.customDepthMaterial = new THREE.MeshDepthMaterial({
          depthPacking: THREE.RGBADepthPacking,
          alphaTest: 0.5
        });

        const patchShader = (shader: any) => {
          child.material.userData.shader = shader;
          shader.uniforms.uMissingCount = { value: 0 };
          // FIX: Do not use .fill(new Vector3()), as it uses the exact same reference for all elements!
          shader.uniforms.uMissingCenters = { value: Array.from({ length: 32 }, () => new THREE.Vector3()) };
          
          shader.vertexShader = `
            varying vec3 vWorldPos;
            ${shader.vertexShader}
          `.replace(
            `#include <worldpos_vertex>`,
            `
            #include <worldpos_vertex>
            // Use the internally computed worldPosition to be safe
            vWorldPos = worldPosition.xyz;
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
              // Radius 0.4 world units covers exactly one tooth
              if(distance(vWorldPos, uMissingCenters[i]) < 0.4) {
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

  // 2. Agora calculamos os centros baseados na clonedScene
  const missingCenters = React.useMemo(() => {
    // Generate accurate centers based on the model's bounding box
    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    return (viewerState.missingTeeth || []).map(num => {
      // 100% pixel-perfect hit point from the user's click!
      if (viewerState.missingTeethCoords?.[num]) {
        return viewerState.missingTeethCoords[num];
      }

      const isUpper = num < 30;
      const quadrant = Math.floor(num / 10);
      const index = num % 10;

      // Approximate angles for each tooth index
      const angles = [0, 7.5, 22.5, 37.5, 55, 75, 97.5, 122.5, 150];
      let deg = angles[index] || 0;

      // Right side of patient (screen left) is negative X -> negative angle
      if (quadrant === 1 || quadrant === 4) {
        deg = -deg;
      }

      const rad = (deg * Math.PI) / 180;
      
      // Radius based on model size (slightly inside the bounding box)
      const rx = (size.x / 2) * 0.85;
      const rz = (size.z / 2) * 0.85;

      // Local positions (unscaled)
      const localX = center.x + rx * Math.sin(rad);
      const localZ = center.z + rz * Math.cos(rad);
      const localY = center.y + (isUpper ? (size.y * 0.25) : -(size.y * 0.25));

      // The group wrapper applies scale=85 and position=[0, -0.2, 0] + [0, 0, 1.5]
      const worldX = localX * modelScale;
      const worldY = localY * modelScale - 0.2;
      const worldZ = localZ * modelScale + 1.5;

      // The returned Vector3 is in world space, perfect for the shader
      return new THREE.Vector3(worldX, worldY, worldZ);
    });
  }, [viewerState.missingTeeth, viewerState.missingTeethCoords, clonedScene]);

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
      
      {/* 1. MODELO REALISTA (FUNDO COM RAYCAST DENTÁRIO) */}
      <group scale={[modelScale, modelScale, modelScale]} position={[0, 0, 1.5]}>
        <primitive 
          object={clonedScene} 
          onClick={(e: any) => {
            e.stopPropagation();
            
            // Descobre o ponto clicado no espaço local do modelo
            const point = e.point;
            
            // Calcula o centro e limites do modelo (pode ser cacheado, mas faremos aqui para simplificar)
            const box = new THREE.Box3().setFromObject(clonedScene);
            const center = box.getCenter(new THREE.Vector3());
            
            // Upper ou Lower (Y)
            const isUpper = point.y > center.y;
            
            // Calcula o ângulo a partir do centro (no plano XZ)
            const dx = point.x - center.x;
            const dz = point.z - center.z;
            const angle = Math.atan2(dx, dz);
            
            // Converte ângulo para graus
            let deg = (angle * 180) / Math.PI;
            
            // Ajusta o mapeamento de dentes baseado na geometria real do arco
            const absDeg = Math.abs(deg);
            
            // 0 = centro da frente. 90 = fundo.
            let toothIndex = 1;
            if (absDeg < 15) toothIndex = 1;      // Incisivo Central
            else if (absDeg < 30) toothIndex = 2; // Incisivo Lateral
            else if (absDeg < 45) toothIndex = 3; // Canino
            else if (absDeg < 65) toothIndex = 4; // 1º Pré-molar
            else if (absDeg < 85) toothIndex = 5; // 2º Pré-molar
            else if (absDeg < 110) toothIndex = 6; // 1º Molar
            else if (absDeg < 135) toothIndex = 7; // 2º Molar
            else toothIndex = 8;                  // 3º Molar (Siso)
            
            // Determina o quadrante (1 a 4)
            // deg negativo é o lado direito do paciente (nossa esquerda na tela)
            let quadrant;
            if (isUpper) {
              quadrant = deg < 0 ? 1 : 2;
            } else {
              quadrant = deg < 0 ? 4 : 3;
            }
            
            const selectedTooth = (quadrant * 10) + toothIndex;
            
            // Pass the 2D coordinates of the click so the menu can float there
            // Also pass the 3D e.point so the "Hide Tooth" shader can perfectly match the click coordinate
            selectTooth(selectedTooth, { x: e.clientX, y: e.clientY }, e.point);
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
    </group>
  );
}
