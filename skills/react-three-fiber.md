# Guia de React Three Fiber (R3F) e 3D

Este documento detalha as boas práticas e implementações necessárias para a renderização, manipulação e otimização da arcada dentária tridimensional usando **React Three Fiber** e **Three.js**.

---

## 1. Configuração do Canvas R3F
- O componente `<Canvas>` deve ser envelopado em uma div com dimensões controladas no CSS para evitar estouros de layout.
- Habilite o suporte a antialiasing (`antialias: true`) e ajuste o mapeamento de cores (tone mapping) para garantir que as cores dos dentes sejam naturais.

```tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center } from '@react-three/drei';

export function DentalViewer() {
  return (
    <div className="w-full h-[500px] bg-gray-100 rounded-lg overflow-hidden">
      <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <Center>
          <ToothArcade />
        </Center>
        <OrbitControls enableZoom={true} enablePan={true} />
      </Canvas>
    </div>
  );
}
```

---

## 2. Carregamento de Modelos 3D (Asset Loading)
- Carregue os dentes de forma otimizada usando a diretiva `useGLTF` do `@react-three/drei`.
- Adicione o componente `<Suspense>` como envelope do modelo para lidar com estados de carregamento (loading placeholders).
- Faça a compressão do arquivo `.gltf` / `.glb` utilizando ferramentas como `gltf-pipeline` ou `Draco` para diminuir o tamanho dos arquivos transferidos pela rede.

---

## 3. Seleção e Interação com Dentes (Raycasting)
- Cada dente dentro do arquivo GLTF deve estar nomeado com o seu código internacional (ex: `Tooth_11`, `Tooth_21`).
- Capture o clique e o hover utilizando os eventos nativos do R3F aplicados diretamente na malha (`mesh`):
  - `onClick`: Dispara a abertura do drawer com os detalhes do dente.
  - `onPointerOver`: Altera o cursor do mouse para `pointer` e ativa um brilho de destaque (emissão ou material de outline).
  - `onPointerOut`: Restaura o estado original do cursor e do material.

```tsx
<mesh
  geometry={nodes.Tooth_11.geometry}
  material={materials.Enamel}
  onClick={(e) => {
    e.stopPropagation();
    handleToothSelection(11);
  }}
  onPointerOver={(e) => {
    e.stopPropagation();
    setHovered(true);
  }}
  onPointerOut={() => setHovered(false)}
/>
```

---

## 4. Otimização de Performance 3D
- **Instanced Meshes**: Se o modelo de cada dente for idêntico e mudar apenas a posição/escala, utilize `instancedMesh` para reduzir as chamadas de desenho (draw calls).
- **Descarte de Materiais**: Sempre que um dente ou componente 3D for desmontado, certifique-se de realizar o descarte manual de geometrias e materiais para prevenir vazamento de memória (memory leaks) na GPU:
  ```typescript
  geometry.dispose();
  material.dispose();
  ```
- **LOD (Level of Detail)**: Utilize modelos simplificados para a visualização distante da boca inteira e modelos de maior contagem poligonal apenas quando der zoom em um único dente.
