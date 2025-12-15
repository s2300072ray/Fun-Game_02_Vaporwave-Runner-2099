import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { World } from './components/World';
import { Player } from './components/Player';
import { ObstacleManager } from './components/ObstacleManager';
import { PostProcessing } from './components/PostProcessing';
import { UI } from './components/UI';
import { useGameStore } from './store';
import * as THREE from 'three';

const CameraController: React.FC = () => {
    useFrame((state) => {
        const time = state.clock.elapsedTime;
        
        // Match the frequency from World.tsx (0.05)
        // World: Sun moves +X (Right) when sine is positive
        const curvePhase = Math.sin(time * 0.05);

        // Logic: If Sun moves Right (Turn Right), Camera moves Left (Counter-steer perspective)
        // This enhances the feeling of the turn.
        // REDUCED AMPLITUDE: 8 -> 3
        const targetX = -curvePhase * 3; // Move camera horizontally opposite to the vanishing point

        // Smoothly interpolate camera position
        state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetX, 0.05);
        
        // Maintain base height and distance, but allow slight sway
        // Base: [0, 3, 6]
        state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, 3 + Math.abs(curvePhase) * 0.5, 0.05); // Slight rise in turns
        state.camera.position.z = 6;

        // Dynamic LookAt: Always look slightly down the track, but compensate for the camera's offset
        // If camera is Left (-X), we look slightly Right (+X) to keep the player centered visually
        const lookAtX = curvePhase * 1.0; 
        state.camera.lookAt(lookAtX, 2, -10);
    });
    return null;
};

const GameScene: React.FC = () => {
    // Camera is now controlled by CameraController
    return (
        <>
            <CameraController />
            <ambientLight intensity={0.2} />
            {/* The sun/moon light from behind the vanishing point */}
            <pointLight position={[0, 5, -40]} intensity={10} color="#bc13fe" distance={100} />
            
            <World />
            <Player />
            <ObstacleManager />
            <PostProcessing />
            
            <Environment preset="city" />
        </>
    );
};

const App: React.FC = () => {
    // Force re-render of canvas on game start is sometimes cleaner for cleanup, 
    // but here we manage state internally.
    return (
        <div className="relative w-screen h-screen bg-black overflow-hidden">
            <UI />
            <Canvas
                shadows
                camera={{ position: [0, 3, 6], fov: 75 }}
                dpr={[1, 2]} // Optimize pixel ratio
                gl={{ antialias: false, stencil: false, depth: true }} // Let post-processing handle AA
            >
                <color attach="background" args={['#050505']} />
                <Suspense fallback={null}>
                    <GameScene />
                </Suspense>
            </Canvas>
        </div>
    );
};

export default App;