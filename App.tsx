import React, { Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { World } from './components/World';
import { Player } from './components/Player';
import { ObstacleManager } from './components/ObstacleManager';
import { PostProcessing } from './components/PostProcessing';
import { UI } from './components/UI';
import * as THREE from 'three';

const CameraController: React.FC = () => {
    useFrame((state) => {
        const time = state.clock.elapsedTime;
        
        // 1. Calculate World Curve Influence
        // Must match the frequency in World.tsx (0.05)
        const curvePhase = Math.sin(time * 0.05);

        // 2. Camera Horizontal Sway
        // Counter-steer: If world curves right (Sun goes right), Camera moves left slightly
        // to keep the player framed nicely against the curve.
        const targetX = -curvePhase * 3.0; 

        // 3. Smooth Damping (Cinematic Feel)
        state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetX, 0.05);
        
        // 4. Vertical Bob & Distance
        // Slight rise during turns to see more track
        const targetY = 3 + Math.abs(curvePhase) * 0.5;
        state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetY, 0.05);
        state.camera.position.z = 6;

        // 5. LookAt Logic
        // Look slightly ahead into the turn
        const lookAtX = curvePhase * 1.5; 
        state.camera.lookAt(lookAtX, 2, -15);
    });
    return null;
};

const GameScene: React.FC = () => {
    return (
        <>
            <CameraController />
            
            {/* Lighting: Cyberpunk Theme (Dark with Neon highlights) */}
            <ambientLight intensity={0.2} />
            <pointLight position={[0, 5, -40]} intensity={10} color="#bc13fe" distance={100} />
            
            {/* Core Game Systems */}
            <World />
            <Player />
            <ObstacleManager />
            
            {/* VFX */}
            <PostProcessing />
            <Environment preset="city" blur={0.8} />
        </>
    );
};

const App: React.FC = () => {
    return (
        <div className="relative w-screen h-screen bg-black overflow-hidden">
            <UI />
            <Canvas
                shadows
                camera={{ position: [0, 3, 6], fov: 75 }}
                dpr={[1, 2]} // Dynamic Pixel Ratio for performance
                gl={{ 
                    antialias: false, // Post-processing handles smoothing
                    stencil: false, 
                    depth: true,
                    powerPreference: "high-performance" 
                }}
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