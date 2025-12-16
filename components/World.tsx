import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';

/**
 * --- ENGINE CONSTANTS & CONFIG ---
 */
const WORLD_CURVE_FREQ = 0.05;
const WORLD_CURVE_AMP = 0.0002;
const TERRAIN_Z_OFFSET = -40;

/**
 * --- UTILITIES (PHYSICS & MATH) ---
 * Exported for use by Player and Obstacle subsystems to ensure visual/physical synchronization.
 */

// Calculates the lateral curve offset based on Z-depth (World Space)
export const getCurveOffset = (worldZ: number, time: number) => {
    const curveStrength = Math.sin(time * WORLD_CURVE_FREQ) * WORLD_CURVE_AMP;
    return Math.pow(worldZ, 2) * curveStrength;
};

// Calculates the terrain height (Y) based on Z-depth (Virtual Space)
export const getTrackHeight = (virtualZ: number) => {
    return Math.sin(virtualZ * 0.08) * 0.5;
};

/**
 * --- SHADER DEFINITIONS ---
 */

// Shader 1: Retro Sun (Vaporwave Horizon)
const SunMaterial = shaderMaterial(
  { time: 0, color1: new THREE.Color('#ffaa00'), color2: new THREE.Color('#ff00aa') },
  // Vertex Shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader
  `
    uniform float time;
    uniform vec3 color1;
    uniform vec3 color2;
    varying vec2 vUv;
    void main() {
      float y = vUv.y;
      vec3 color = mix(color1, color2, y);
      
      // Horizon bars effect
      float s = sin(y * 40.0);
      float cut = step(0.0, s); 
      
      // Circle cutout
      float dist = distance(vUv, vec2(0.5));
      float alpha = 1.0 - smoothstep(0.45, 0.5, dist);
      
      gl_FragColor = vec4(color * cut, alpha);
    }
  `
);

// Shader 2: Deep Space Background
const BackgroundMaterial = shaderMaterial(
    { time: 0, topColor: new THREE.Color('#000022'), bottomColor: new THREE.Color('#000000') },
    // Vertex Shader
    `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    // Fragment Shader
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
        
        // Star generation noise
        float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
        if (noise > 0.995) {
            finalColor += vec3(0.8 * (0.5 + 0.5 * sin(time * 2.0 + noise * 100.0))); // Twinkle effect
        }
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
);

extend({ SunMaterial, BackgroundMaterial });

// TypeScript definitions for custom shader materials in JSX
type VaporwaveSunMaterialType = THREE.ShaderMaterial & { time: number; color1: THREE.Color; color2: THREE.Color; };
type BackgroundMaterialType = THREE.ShaderMaterial & { time: number; };

/**
 * --- SUB-SYSTEMS ---
 */

const CyberMountains: React.FC = () => {
    const { speed, gameSpeedMultiplier } = useGameStore();
    const MOUNTAIN_COUNT = 40;
    
    // Static data generation for optimization
    const mountainData = useMemo(() => {
        const items = [];
        for (let i = 0; i < MOUNTAIN_COUNT; i++) {
            const side = Math.random() > 0.5 ? 1 : -1;
            const xOffset = 25 + Math.random() * 25; 
            items.push({
                baseX: side * xOffset, 
                y: -10 + Math.random() * 10, 
                scale: 5 + Math.random() * 15,
                z: -100 + (i * (150 / MOUNTAIN_COUNT)), 
                rotation: Math.random() * Math.PI
            });
        }
        return items;
    }, []);

    const groupRef = useRef<THREE.Group>(null);

    // Optimized Geometry: Deep base to hide clipping
    // Radius: 3, Height: 6, Segments: 4 (Low poly aesthetic)
    const geometry = useMemo(() => new THREE.ConeGeometry(3, 6, 4), []);

    // Materials: Cached
    const wireframeMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#000000',
        emissive: '#00ffcc',
        emissiveIntensity: 1.5,
        wireframe: true,
        transparent: true,
        opacity: 0.8
    }), []);

    const bodyMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#001111',
        transparent: true,
        opacity: 0.7,
        roughness: 0.2,
        side: THREE.DoubleSide
    }), []);

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        const currentSpeed = speed * gameSpeedMultiplier;
        const time = state.clock.elapsedTime;
        
        // Object Pooling Logic: Recycle mountains
        groupRef.current.children.forEach((group, i) => {
            const data = mountainData[i];
            
            data.z += currentSpeed * delta;
            if (data.z > 20) {
                data.z = -130; // Reset position to far back
            }

            group.position.z = data.z;
            // Visual Offset to center the extended base
            group.position.y = data.y - (data.scale * 2);
            
            // Sync with World Curve
            const curveX = getCurveOffset(data.z, time);
            group.position.x = data.baseX + curveX;
        });
    });

    return (
        <group ref={groupRef}>
            {mountainData.map((data, i) => (
                <group key={i} rotation={[0, data.rotation, 0]} scale={[data.scale, data.scale, data.scale]}>
                    <mesh geometry={geometry} material={wireframeMaterial} />
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

    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(14, 200, 14, 60); 
        geo.rotateX(-Math.PI / 2);
        return geo;
    }, []);

    // Visuals: Dual-layer approach for 80% Opacity + Wireframe
    const gridMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#000000',
        wireframe: true,
        emissive: '#7928ca',
        emissiveIntensity: 1.5,
        toneMapped: false,
        roughness: 0.1
    }), []);

    const surfaceMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#080010',
        transparent: true,
        opacity: 0.8, // 20% Transparency as requested
        roughness: 0.2,
        metalness: 0.6
    }), []);

    // Cache original vertices for CPU-based vertex animation
    useEffect(() => {
        if (terrainRef.current) {
            originalXPositions.current = terrainRef.current.geometry.attributes.position.array.slice() as Float32Array;
        }
    }, [geometry]);

    useFrame((state, delta) => {
        if (!terrainRef.current || !originalXPositions.current) return;

        const time = state.clock.elapsedTime;
        const currentSpeed = speed * gameSpeedMultiplier;
        
        // Move the "Virtual Texture" offset
        offsetRef.current -= currentSpeed * delta;
        
        const positions = terrainRef.current.geometry.attributes.position;
        const count = positions.count;

        // Vertex Animation Loop
        for (let i = 0; i < count; i++) {
            const localZ = positions.getZ(i);
            const virtualZ = localZ - offsetRef.current;
            
            // 1. Hills
            positions.setY(i, getTrackHeight(virtualZ));
            
            // 2. Curve
            const worldZ = localZ + TERRAIN_Z_OFFSET;
            const originalX = originalXPositions.current[i * 3]; 
            const curveOffset = getCurveOffset(worldZ, time);
            
            positions.setX(i, originalX + curveOffset);
        }
        positions.needsUpdate = true;
    });

    return (
        <group position={[0, 0, TERRAIN_Z_OFFSET]}>
            <mesh ref={terrainRef} geometry={geometry} material={gridMaterial} />
            {/* Underside surface layer to block view but maintain transparency */}
            <mesh geometry={geometry} material={surfaceMaterial} position={[0, -0.01, 0]} />
        </group>
    );
};

const Skybox: React.FC = () => {
    const bgRef = useRef<THREE.Group>(null);
    const bgMatRef = useRef<BackgroundMaterialType>(null);
    const sunRef = useRef<VaporwaveSunMaterialType>(null);
    const sunMeshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const time = state.clock.elapsedTime;
        const curvePhase = Math.sin(time * WORLD_CURVE_FREQ);

        // Update Shader Time Uniforms
        if (bgMatRef.current) bgMatRef.current.time = time;
        if (sunRef.current) sunRef.current.time = time;
        
        // Rotate Skybox for dynamic turn feeling
        if (bgRef.current) {
            bgRef.current.rotation.y = -curvePhase * 0.05;
        }

        // Move Sun to guide player eye
        if (sunMeshRef.current) {
            sunMeshRef.current.position.x = curvePhase * 14; 
        }
    });

    return (
        <group>
            {/* Stars & Gradient */}
            <group ref={bgRef}>
                <mesh position={[0, 0, -50]}>
                    <sphereGeometry args={[100, 32, 32]} />
                    {/* @ts-ignore */}
                    <backgroundMaterial ref={bgMatRef} side={THREE.BackSide} />
                </mesh>
            </group>
            
            {/* Retro Sun */}
            <mesh ref={sunMeshRef} position={[0, 20, -100]}>
                <planeGeometry args={[60, 60]} />
                {/* @ts-ignore */}
                <sunMaterial ref={sunRef} transparent />
            </mesh>
        </group>
    );
};

/**
 * --- MAIN EXPORT ---
 */
export const World: React.FC = () => {
  return (
    <group>
      <fog attach="fog" args={['#000000', 30, 120]} />
      <Skybox />
      <InfiniteTerrain />
      <CyberMountains />
    </group>
  );
};