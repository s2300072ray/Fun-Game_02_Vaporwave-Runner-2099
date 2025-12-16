import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';

// --- SHADER DEFINITIONS ---

// 1. Vaporwave Sun Shader (Retro Horizon)
const SunMaterial = shaderMaterial(
  { time: 0, color1: new THREE.Color('#ffaa00'), color2: new THREE.Color('#ff00aa') },
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform float time;
    uniform vec3 color1;
    uniform vec3 color2;
    varying vec2 vUv;
    void main() {
      float y = vUv.y;
      vec3 color = mix(color1, color2, y);
      float s = sin(y * 40.0);
      float cut = step(0.0, s); 
      float dist = distance(vUv, vec2(0.5));
      float alpha = 1.0 - smoothstep(0.45, 0.5, dist);
      gl_FragColor = vec4(color * cut, alpha);
    }
  `
);

// 2. Dynamic Background Shader (Starfield & Gradient)
const BackgroundMaterial = shaderMaterial(
    { time: 0, topColor: new THREE.Color('#000022'), bottomColor: new THREE.Color('#000000') },
    `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    `
      uniform float time;
      varying vec2 vUv;
      
      vec3 getGradient(float t) {
          vec3 a = vec3(0.1, 0.0, 0.2); // Dark Purple
          vec3 b = vec3(0.0, 0.1, 0.3); // Dark Cyan
          float p = sin(t * 0.1) * 0.5 + 0.5;
          return mix(a, b, p);
      }

      void main() {
        vec3 colorTop = getGradient(time);
        vec3 colorBot = vec3(0.0, 0.0, 0.0);
        vec3 finalColor = mix(colorBot, colorTop, vUv.y);
        
        // Stars
        float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
        if (noise > 0.995) {
            finalColor += vec3(0.8 * (0.5 + 0.5 * sin(time * 2.0 + noise * 100.0))); // Twinkle
        }
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
);

extend({ SunMaterial, BackgroundMaterial });

// Types for TypeScript intellisense on custom shaders
type VaporwaveSunMaterialType = THREE.ShaderMaterial & { time: number; color1: THREE.Color; color2: THREE.Color; };
type BackgroundMaterialType = THREE.ShaderMaterial & { time: number; };

// --- PHYSICS & MATH CONSTANTS ---

// Global Curve Function: Used by World, Player, and Obstacles
export const getCurveOffset = (worldZ: number, time: number) => {
    // Low frequency (0.05) for gentle winding roads
    const curveStrength = Math.sin(time * 0.05) * 0.0002;
    // Perspective distortion: Z^2
    return Math.pow(worldZ, 2) * curveStrength;
};

// Track Height Function: Used for terrain undulation
export const getTrackHeight = (virtualZ: number) => {
    return Math.sin(virtualZ * 0.08) * 0.5;
};

// --- SUB-COMPONENTS ---

const CyberMountains: React.FC = () => {
    const { speed, gameSpeedMultiplier } = useGameStore();
    
    // Configuration
    const mountainCount = 40;
    const mountainData = useMemo(() => {
        const items = [];
        for (let i = 0; i < mountainCount; i++) {
            const side = Math.random() > 0.5 ? 1 : -1;
            const xOffset = 25 + Math.random() * 25; 
            items.push({
                baseX: side * xOffset, 
                y: -10 + Math.random() * 10, 
                scale: 5 + Math.random() * 15,
                z: -100 + (i * (150 / mountainCount)), 
                rotation: Math.random() * Math.PI
            });
        }
        return items;
    }, []);

    const groupRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        
        const currentSpeed = speed * gameSpeedMultiplier;
        const time = state.clock.elapsedTime;
        
        groupRef.current.children.forEach((group, i) => {
            const data = mountainData[i];
            
            // Loop Logic
            data.z += currentSpeed * delta;
            if (data.z > 20) {
                data.z = -130;
            }

            // Position
            group.position.z = data.z;
            group.position.y = data.y;
            
            // Curve Application
            const curveX = getCurveOffset(data.z, time);
            group.position.x = data.baseX + curveX;
        });
    });

    // Material for the "Holographic/Wireframe" look
    // 1. Emissive Wireframe (Cyan/Teal)
    const wireframeMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#000000',
        emissive: '#00ffcc', // Cyber Teal
        emissiveIntensity: 1.5,
        wireframe: true,
        transparent: true,
        opacity: 0.8
    }), []);

    // 2. Inner Body (Dark blocker to hide background stars behind mountains)
    const bodyMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#001111',
        transparent: true,
        opacity: 0.7,
        roughness: 0.2,
        side: THREE.DoubleSide
    }), []);

    const geometry = useMemo(() => new THREE.ConeGeometry(1, 2, 4), []);

    return (
        <group ref={groupRef}>
            {mountainData.map((data, i) => (
                <group key={i} rotation={[0, data.rotation, 0]} scale={[data.scale, data.scale, data.scale]}>
                    {/* Outer Glow Wireframe */}
                    <mesh geometry={geometry} material={wireframeMaterial} />
                    {/* Inner Occlusion Body */}
                    <mesh geometry={geometry} material={bodyMaterial} scale={[0.98, 0.98, 0.98]} />
                </group>
            ))}
        </group>
    );
};

const InfiniteTerrain: React.FC = () => {
    const terrainRef = useRef<THREE.Mesh>(null);
    const offsetRef = useRef(0);
    const originalXPositions = useRef<Float32Array | null>(null);
    const { speed, gameSpeedMultiplier } = useGameStore();
    const TERRAIN_Z_OFFSET = -40;

    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(14, 200, 14, 60); 
        geo.rotateX(-Math.PI / 2);
        return geo;
    }, []);

    const material = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#000000',
        wireframe: true,
        emissive: '#7928ca', // Neon Purple Grid
        emissiveIntensity: 0.8,
        roughness: 0.1
    }), []);

    useEffect(() => {
        if (terrainRef.current) {
            originalXPositions.current = terrainRef.current.geometry.attributes.position.array.slice() as Float32Array;
        }
    }, [geometry]);

    useFrame((state, delta) => {
        if (!terrainRef.current || !originalXPositions.current) return;

        const time = state.clock.elapsedTime;
        const currentSpeed = speed * gameSpeedMultiplier;
        
        offsetRef.current -= currentSpeed * delta;
        
        const positions = terrainRef.current.geometry.attributes.position;
        const count = positions.count;

        for (let i = 0; i < count; i++) {
            const localZ = positions.getZ(i);
            const virtualZ = localZ - offsetRef.current;
            
            // 1. Undulate Y (Hills)
            positions.setY(i, getTrackHeight(virtualZ));
            
            // 2. Curve X (Turns)
            const worldZ = localZ + TERRAIN_Z_OFFSET;
            const originalX = originalXPositions.current[i * 3]; 
            const curveOffset = getCurveOffset(worldZ, time);
            
            positions.setX(i, originalX + curveOffset);
        }
        positions.needsUpdate = true;
    });

    return <mesh ref={terrainRef} geometry={geometry} material={material} position={[0, 0, TERRAIN_Z_OFFSET]} />;
};

const MovingVanishingPoint: React.FC = () => {
    const sunRef = useRef<VaporwaveSunMaterialType>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    
    useFrame((state) => {
        const time = state.clock.elapsedTime;
        if (sunRef.current) sunRef.current.time = time;

        // Sync Sun X position with the global curve to lead the eye
        if (meshRef.current) {
            const curvePhase = Math.sin(time * 0.05); // Match global curve frequency
            meshRef.current.position.x = curvePhase * 14; // Tuned amplitude
        }
    });

    return (
        <mesh ref={meshRef} position={[0, 20, -100]}>
            <planeGeometry args={[60, 60]} />
            {/* @ts-ignore */}
            <sunMaterial ref={sunRef} transparent />
        </mesh>
    );
};

// --- MAIN EXPORT ---

export const World: React.FC = () => {
  const bgRef = useRef<THREE.Group>(null);
  const bgMatRef = useRef<BackgroundMaterialType>(null);

  useFrame((state) => {
      const time = state.clock.elapsedTime;
      const curvePhase = Math.sin(time * 0.05);

      if (bgMatRef.current) bgMatRef.current.time = time;
      
      // Slight rotation of the skybox to enhance the turning feeling
      if (bgRef.current) {
          bgRef.current.rotation.y = -curvePhase * 0.05;
      }
  });

  return (
    <group>
      <fog attach="fog" args={['#000000', 30, 120]} />
      
      {/* Background Sphere */}
      <group ref={bgRef}>
          <mesh position={[0, 0, -50]}>
            <sphereGeometry args={[100, 32, 32]} />
            {/* @ts-ignore */}
            <backgroundMaterial ref={bgMatRef} side={THREE.BackSide} />
          </mesh>
      </group>

      <InfiniteTerrain />
      <CyberMountains />
      <MovingVanishingPoint />
    </group>
  );
};