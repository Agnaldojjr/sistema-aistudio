import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

interface CameraSyncProps {
  isPresentationMode: boolean;
}

export function CameraSync({ isPresentationMode }: CameraSyncProps) {
  const { camera } = useThree();
  const controls = useThree((state) => state.controls) as any;
  const channelRef = useRef<BroadcastChannel | null>(null);
  
  // Guardamos as últimas posições enviadas/recebidas para evitar feedbacks infinitos
  const lastSent = useRef<{ pos: [number, number, number]; target: [number, number, number] }>({
    pos: [0, 0, 0],
    target: [0, 0, 0]
  });

  useEffect(() => {
    const channel = new BroadcastChannel('planning_3d_camera_sync');
    channelRef.current = channel;

    if (isPresentationMode) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'camera_sync' && event.data.payload) {
          const { position, target } = event.data.payload;
          
          camera.position.set(position[0], position[1], position[2]);
          
          // Se tiver OrbitControls (mesmo desativado), atualizamos o target dele
          if (controls) {
            controls.target.set(target[0], target[1], target[2]);
            controls.update();
          }
        }
      };
      
      channel.addEventListener('message', handleMessage);
      
      // Solicitar o estado da câmera inicial do visualizador principal
      channel.postMessage({ type: 'request_initial_camera' });

      return () => {
        channel.removeEventListener('message', handleMessage);
        channel.close();
      };
    } else {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'request_initial_camera') {
          // Enviar imediatamente a posição e o target atuais do controle principal
          if (channelRef.current) {
            channelRef.current.postMessage({
              type: 'camera_sync',
              payload: {
                position: [camera.position.x, camera.position.y, camera.position.z],
                target: controls ? [controls.target.x, controls.target.y, controls.target.z] : [0, 0, 0]
              }
            });
          }
        }
      };
      
      channel.addEventListener('message', handleMessage);
      
      return () => {
        channel.removeEventListener('message', handleMessage);
        channel.close();
      };
    }
  }, [isPresentationMode, camera, controls]);

  useFrame((state) => {
    // Apenas a tela principal (onde o OrbitControls está ativo) transmite os movimentos
    if (isPresentationMode) return;
    
    const currentControls = (state as any).controls;
    if (!currentControls || !channelRef.current) return;

    const pos = camera.position;
    const tgt = currentControls.target;

    const dx = Math.abs(pos.x - lastSent.current.pos[0]);
    const dy = Math.abs(pos.y - lastSent.current.pos[1]);
    const dz = Math.abs(pos.z - lastSent.current.pos[2]);

    const tx = Math.abs(tgt.x - lastSent.current.target[0]);
    const ty = Math.abs(tgt.y - lastSent.current.target[1]);
    const tz = Math.abs(tgt.z - lastSent.current.target[2]);

    // Limiar mínimo para otimização e redução de ruído/processamento
    if (dx > 0.0005 || dy > 0.0005 || dz > 0.0005 || tx > 0.0005 || ty > 0.0005 || tz > 0.0005) {
      lastSent.current = {
        pos: [pos.x, pos.y, pos.z],
        target: [tgt.x, tgt.y, tgt.z]
      };

      channelRef.current.postMessage({
        type: 'camera_sync',
        payload: {
          position: [pos.x, pos.y, pos.z],
          target: [tgt.x, tgt.y, tgt.z]
        }
      });
    }
  });

  return null;
}
