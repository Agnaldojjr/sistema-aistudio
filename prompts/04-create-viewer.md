# Prompt 04: Construção do Visualizador 3D Base

Você é um desenvolvedor frontend especialista em WebGL e Three.js. Seu objetivo é criar o componente visualizador 3D da arcada dentária utilizando React Three Fiber.

Siga as instruções de codificação abaixo:

---

## 1. Criação do Componente Canvas 3D
- Desenvolva o componente `DentalViewer.tsx` na pasta `src/components`.
- Configure o `<Canvas>` com uma câmera orbital responsiva (`OrbitControls`), iluminação tridimensional adequada (ambiente + direcional + pontual) e fundo cinza neutro.
- Implemente um placeholder visual (ex: spinner ou barra de progresso) enquanto os arquivos 3D estão carregando através do `<Suspense>`.

---

## 2. Carregamento e Posicionamento do Modelo da Arcada
- Utilize a biblioteca `@react-three/drei` e seu hook `useGLTF` para carregar o modelo 3D da arcada dentária.
- Caso não haja um arquivo GLTF de arcada completo disponível de imediato, implemente um modelo paramétrico de dentes representados por cubos ou esferas estilizadas posicionadas de forma elíptica (em formato de U) simulando a arcada dentária humana, para validação da prova de conceito (PoC).
- Adicione suporte para carregar o modelo 3D real da gengiva e dos 32 dentes permanentes individualmente.

---

## 3. Entregável Esperado
Implemente o código do visualizador em `src/components/DentalViewer.tsx` e atualize o `src/App.tsx` para exibi-lo em uma nova tela/aba. Garanta que:
1. A renderização funcione a 60 FPS sem travar o navegador.
2. Seja possível rodar, arrastar e dar zoom na arcada com o mouse ou dedos (tablet).
3. Haja tratamento de erro de carregamento de arquivo 3D com fallback de segurança.
