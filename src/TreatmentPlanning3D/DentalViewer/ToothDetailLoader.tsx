import React, { Component, Suspense } from 'react';
import { useGLTF, Environment } from '@react-three/drei';
import { ToothMesh } from './ToothMesh';
import * as THREE from 'three';

interface ToothDetailLoaderProps {
  toothNumber: number;
  variant: 'anatomic' | 'endodontic';
}

// Fallback caso o usuário não tenha feito o download do dente individual ainda
function FallbackSingleTooth({ toothNumber }: { toothNumber: number }) {
  return (
    <group position={[0, 0, 0]} scale={[3, 3, 3]}>
      <ToothMesh
        toothNumber={toothNumber}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
      />
    </group>
  );
}

class SingleToothErrorBoundary extends Component<{ children: React.ReactNode, toothNumber: number }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('Aviso: Modelo GLB individual indisponível. Usando malha procedural.', error);
  }

  render() {
    if (this.state.hasError) {
      return <FallbackSingleTooth toothNumber={this.props.toothNumber} />;
    }
    return this.props.children;
  }
}

function getToothModelPath(toothNumber: number): { path: string; scaleX: number } {
  const isUpper = toothNumber < 30;
  const position = toothNumber % 10;
  // 1 (incisor) to 8 (third molar)
  
  // Quadrant 1 and 4 are right side. Quadrant 2 and 3 are left side.
  // Dundee models are mostly left-sided or unspecified (assumed left for rendering).
  // If it's right side, we flip scaleX to -1.
  const quadrant = Math.floor(toothNumber / 10);
  const isRight = quadrant === 1 || quadrant === 4;
  const scaleX = isRight ? -1 : 1;

  let filename = '';

  if (isUpper) {
    switch (position) {
      case 1: filename = 'maxillary_left_central_incisor_c8a7c2d9280d4c92bc651cfa1459866a.glb'; break;
      case 2: filename = 'maxillary_lateral_incisor_5e89ddbfc6454e2e8e09c645574b8932.glb'; break;
      case 3: filename = 'maxillary_canine_bd930c9b9da14f2a9a8c9b130b0e08a2.glb'; break;
      case 4: filename = 'maxillary_first_premolar_f9b48a29d34f4923b683433f030c5c70.glb'; break;
      case 5: filename = 'maxillary_second_premolar_69f3142830064588b000b04bea0ee09f.glb'; break;
      case 6: filename = 'maxillary_first_molar_e719a474ef7e4bd7abec508f85f1e984.glb'; break;
      case 7: filename = 'maxillary_first_molar_e719a474ef7e4bd7abec508f85f1e984.glb'; break; // Missing 2nd molar, use 1st
      case 8: filename = 'maxillary_third_molar_1b3c50ded70c4b6297d4526a733a9cf1.glb'; break;
      default: filename = 'maxillary_left_central_incisor_c8a7c2d9280d4c92bc651cfa1459866a.glb';
    }
  } else {
    switch (position) {
      case 1: filename = 'mandibular_left_central_incisor_90dcbf474e5a4d97b8783b7eb2b9c4b7.glb'; break;
      case 2: filename = 'mandibular_left_lateral_incisor_00fa4f74e10b4769830bf60469c65e27.glb'; break;
      case 3: filename = 'mandibular_left_canine_1082011ab5aa46bb96b2af6a02a4ec0c.glb'; break;
      case 4: filename = 'mandibular_first_premolar_935637a703dc49eb9eeec9b15a8a5c4c.glb'; break;
      case 5: filename = 'mandibular_left_second_premolar_fe59fe04725446479bc1115bb12d0ad8.glb'; break;
      case 6: filename = 'mandibular_first_molar_e1c919d6603846eca873154eeededdd6.glb'; break;
      case 7: filename = 'mandibular_second_molar_b77dcbc5052e4740b87cdb1964649742.glb'; break;
      case 8: filename = 'mandibular_third_molar_561bb06b3b084b84978163906de1c2b5.glb'; break;
      default: filename = 'mandibular_left_central_incisor_90dcbf474e5a4d97b8783b7eb2b9c4b7.glb';
    }
  }

  return { path: `/models/teeth/${filename}`, scaleX };
}

function DetailedToothGLB({ toothNumber, variant }: { toothNumber: number, variant: 'anatomic' | 'endodontic' }) {
  // Use mapping
  const { path, scaleX } = getToothModelPath(toothNumber);
    
  const { scene } = useGLTF(path) as any;

  // Clone to avoid mutating cached scene if same model is used
  const clonedScene = React.useMemo(() => scene.clone(), [scene]);

  React.useLayoutEffect(() => {
    if (clonedScene) {
      const box = new THREE.Box3().setFromObject(clonedScene);
      const center = box.getCenter(new THREE.Vector3());
      clonedScene.position.x = -center.x;
      clonedScene.position.y = -center.y;
      clonedScene.position.z = -center.z;
    }
  }, [clonedScene]);

  // If variant === 'endodontic', we could maybe apply a material change or transparency to show root canals if we had them.
  // Since we only downloaded anatomic, we'll just show anatomic for both.
  
  // scaleX to mirror if right side
  return (
    <primitive object={clonedScene} scale={[20 * scaleX, 20, 20]} />
  );
}

export function ToothDetailLoader({ toothNumber, variant }: ToothDetailLoaderProps) {
  // Chave baseada na variante para forçar o re-render e re-capturar erros de arquivos inexistentes
  return (
    <group key={variant}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 10]} intensity={1.5} castShadow />
      <directionalLight position={[-10, 5, -10]} intensity={0.8} />
      <Environment preset="city" />

      <Suspense fallback={null}>
        <SingleToothErrorBoundary toothNumber={toothNumber}>
          <DetailedToothGLB toothNumber={toothNumber} variant={variant} />
        </SingleToothErrorBoundary>
      </Suspense>
    </group>
  );
}
