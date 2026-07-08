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
      }
    });
    return clone;
  }, [scene]);



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
