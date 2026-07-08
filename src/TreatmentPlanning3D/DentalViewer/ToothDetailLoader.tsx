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

function DetailedToothGLB({ toothNumber, variant }: { toothNumber: number, variant: 'anatomic' | 'endodontic' }) {
  // Carrega a versão baseada na variante escolhida
  const filename = variant === 'endodontic' 
    ? `/models/dente_${toothNumber}_endodontic.glb` 
    : `/models/dente_${toothNumber}_anatomic.glb`;
    
  const { scene } = useGLTF(filename) as any;

  // Centraliza o dente no pivot (útil se o modelo veio com a origem fora do centro)
  React.useLayoutEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      scene.position.x = -center.x;
      scene.position.y = -center.y;
      scene.position.z = -center.z;
    }
  }, [scene, variant]);

  return (
    <primitive object={scene} scale={[2, 2, 2]} />
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
