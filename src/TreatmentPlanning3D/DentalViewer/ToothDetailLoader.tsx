import React, { Component, Suspense } from 'react';
import { useGLTF, Environment } from '@react-three/drei';
import { ToothMesh } from './ToothMesh';
import * as THREE from 'three';

interface ToothDetailLoaderProps {
  toothNumber: number;
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

function DetailedToothGLB({ toothNumber }: { toothNumber: number }) {
  // Tenta carregar o dente individual. Ex: /models/dente_22.glb
  const { scene } = useGLTF(`/models/dente_${toothNumber}.glb`) as any;

  // Centraliza o dente no pivot (útil se o modelo veio com a origem fora do centro)
  React.useLayoutEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      scene.position.x = -center.x;
      scene.position.y = -center.y;
      scene.position.z = -center.z;
    }
  }, [scene]);

  return (
    <primitive object={scene} scale={[2, 2, 2]} />
  );
}

export function ToothDetailLoader({ toothNumber }: ToothDetailLoaderProps) {
  return (
    <group>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 10]} intensity={1.5} castShadow />
      <directionalLight position={[-10, 5, -10]} intensity={0.8} />
      <Environment preset="city" />

      <Suspense fallback={null}>
        <SingleToothErrorBoundary toothNumber={toothNumber}>
          <DetailedToothGLB toothNumber={toothNumber} />
        </SingleToothErrorBoundary>
      </Suspense>
    </group>
  );
}
