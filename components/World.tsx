import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, extend, useThree } from '@react-three/fiber';
import { Plane, shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';

// --- Vaporwave Sun Shader ---
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
extend({ SunMaterial });

// --- Dynamic Background Shader ---
const BackgroundMaterial = shaderMaterial(
    { time: 0, topColor: new THREE.Color('#000022'), bottomColor: new THREE.Color('#000000') },
    // Vertex
    `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    // Fragment
    `
      uniform float time;
      varying vec2 vUv;
      
      // Function to get color based on time
      vec3 getGradient(float t) {
          vec3 a = vec3(0.1, 0.0, 0.2); // Dark Purple
          vec3 b = vec3(0.0, 0.1, 0.3); // Dark Cyan
          vec3 c = vec3(0.2, 0.0, 0.1); // Dark Red
          
          float p = sin(t * 0.1) * 0.5 + 0.5;
          return mix(a, b, p);
      }

      void main() {
        // Vertical gradient
        vec3 colorTop = getGradient(time);
        vec3 colorBot = vec3(0.0, 0.0, 0.0);
        
        vec3 finalColor = mix(colorBot, colorTop, vUv.y);
        
        // Add some subtle stars/noise
        float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
        if (noise > 0.995) {
            finalColor += vec3(0.8);
        }

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
);
extend({ BackgroundMaterial });

type VaporwaveSunMaterialType = THREE.ShaderMaterial & {
  time: number;
  color1: THREE.Color;
  color2: THREE.Color;
};

type BackgroundMaterialType = THREE.ShaderMaterial & {
    time: number;
};

// --- CURVE LOGIC ---
// Shared logic for calculating the world bend based on WORLD Z-depth and Time
export const getCurveOffset = (worldZ: number, time: number) => {
    // Determine the curve direction and strength
    // A slow sine wave creates a winding road effect
    // REDUCED FREQUENCY AND STRENGTH for subtler effect
    const curveStrength = Math.sin(time * 0.05) * 0.0002;
    
    // We square the Z distance so the curve gets more dramatic further away (perspective)
    // worldZ is usually negative in front of camera.
    // We use the absolute world position to determine how much to bend X.
    return Math.pow(worldZ, 2) * curveStrength;
};

// Helper function for track undulation (Y-axis hills)
// This depends on "Distance Traveled" (virtualZ) to create the scrolling effect
export const getTrackHeight = (virtualZ: number) => {
    return Math.sin(virtualZ * 0.08) * 0.5;
};

// --- Cyber Mountains Component ---
const CyberMountains: React.FC = () => {
    const { speed, gameSpeedMultiplier } = useGameStore();
    
    const mountainCount = 40;
    const mountainData = useMemo(() => {
        const items = [];
        for (let i = 0; i < mountainCount; i++) {
            const side = Math.random() > 0.5 ? 1 : -1;
            const xOffset = 25 + Math.random() * 25; 
            items.push({
                baseX: side * xOffset, // Store base X
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
        
        // Iterating over the groups now, not just meshes
        groupRef.current.children.forEach((object, i) => {
            const data = mountainData[i];
            
            // Move forward (Looping)
            data.z += currentSpeed * delta;
            if (data.z > 20) {
                data.z = -130;
            }

            // Apply positions
            object.position.z = data.z;
            object.position.y = data.y;
            
            // Apply Curve - Use absolute World Z
            const curveX = getCurveOffset(data.z, time);
            object.position.x = data.baseX + curveX;
        });
    });

    return (
        <group ref={groupRef}>
            {mountainData.map((data, i) => (
                <group key={i} rotation={[0, data.rotation, 0]}>
                    {/* 1. The Wireframe "Cage" - Glowing Blue-Green */}
                    <mesh>
                        <coneGeometry args={[data.scale, data.scale * 2, 4]} />
                        <meshStandardMaterial 
                            color="#000000"
                            emissive="#00ffcc"    // Cyan/Green glow
                            emissiveIntensity={1.2}
                            wireframe={true}
                            transparent={true}
                            opacity={0.8}
                        />
                    </mesh>

                    {/* 2. The Inner Volume - Semi-transparent Dark Body */}
                    <mesh scale={[0.98, 0.98, 0.98]}>
                        <coneGeometry args={[data.scale, data.scale * 2, 4]} />
                        <meshStandardMaterial 
                            color="#001111"       // Very dark teal
                            transparent={true}
                            opacity={0.6}
                            roughness={0.2}
                            metalness={0.8}
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                </group>
            ))}
        </group>
    );
};

const DynamicBackground: React.FC<{ groupRef: React.RefObject<THREE.Group> }> = ({ groupRef }) => {
    const ref = useRef<BackgroundMaterialType>(null);
    useFrame((state) => {
        if (ref.current) {
            ref.current.time = state.clock.elapsedTime;
        }
    });

    return (
        <group ref={groupRef}>
            <mesh position={[0, 0, -50]}>
                <sphereGeometry args={[100, 32, 32]} />
                {/* @ts-ignore */}
                <backgroundMaterial ref={ref} side={THREE.BackSide} />
            </mesh>
        </group>
    );
}

export const World: React.FC = () => {
  const terrainRef = useRef<THREE.Mesh>(null);
  
  // Refs for the vanishing point animation
  const sunRef = useRef<VaporwaveSunMaterialType>(null);
  const sunMeshRef = useRef<THREE.Mesh>(null);
  const backgroundGroupRef = useRef<THREE.Group>(null);

  const { speed, gameSpeedMultiplier } = useGameStore();
  const offsetRef = useRef(0);
  
  // The terrain mesh is positioned at Z = -40
  const TERRAIN_Z_OFFSET = -40;

  const originalXPositions = useRef<Float32Array | null>(null);

  const terrainGeometry = useMemo(() => {
    // Narrow track: Width 14
    const geo = new THREE.PlaneGeometry(14, 200, 14, 60); 
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  useEffect(() => {
      if (terrainRef.current) {
          originalXPositions.current = terrainRef.current.geometry.attributes.position.array.slice() as Float32Array;
      }
  }, [terrainGeometry]);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;

    // --- 1. Animate Vanishing Point (Sun & Background) ---
    // The curve logic uses sin(time * 0.05). We sync the sun movement to this.
    // If the road curves to X+, the Sun should move to X+ to lead the eye.
    // REDUCED SPEED: 0.05
    const curvePhase = Math.sin(time * 0.05);
    
    if (sunMeshRef.current) {
        // Move the sun significantly to create the illusion of the road leading there
        // REDUCED AMPLITUDE: 35 -> 14
        sunMeshRef.current.position.x = curvePhase * 14; 
    }

    if (backgroundGroupRef.current) {
        // Rotate background slightly opposite to the turn to enhance the "car turning" feel
        // REDUCED ROTATION: 0.1 -> 0.05
        backgroundGroupRef.current.rotation.y = -curvePhase * 0.05;
    }

    // --- 2. Animate Terrain ---
    if (terrainRef.current && originalXPositions.current) {
      const currentSpeed = speed * gameSpeedMultiplier;
      offsetRef.current -= currentSpeed * delta; // Virtual distance traveled
      
      const positions = terrainRef.current.geometry.attributes.position;
      const count = positions.count;

      for (let i = 0; i < count; i++) {
        const localZ = positions.getZ(i);
        const virtualZ = localZ - offsetRef.current;
        const height = getTrackHeight(virtualZ);
        positions.setY(i, height); 
        
        const worldZ = localZ + TERRAIN_Z_OFFSET;
        const originalX = originalXPositions.current[i * 3]; 
        const curveOffset = getCurveOffset(worldZ, time);
        
        positions.setX(i, originalX + curveOffset);
      }
      positions.needsUpdate = true;
    }

    // --- 3. Animate Sun Shader ---
    if (sunRef.current) {
        sunRef.current.time = time;
    }
  });

  return (
    <group>
      <fog attach="fog" args={['#000000', 30, 120]} />
      <DynamicBackground groupRef={backgroundGroupRef} />

      <mesh ref={terrainRef} geometry={terrainGeometry} position={[0, 0, TERRAIN_Z_OFFSET]}>
         <meshStandardMaterial 
            color="#000000"
            wireframe={true}
            emissive="#7928ca"
            emissiveIntensity={0.8}
            roughness={0.1}
         />
      </mesh>
      
      <CyberMountains />

       {/* The Moving Vanishing Point */}
       <mesh ref={sunMeshRef} position={[0, 20, -100]}>
         <planeGeometry args={[60, 60]} />
         {/* @ts-ignore */}
         <sunMaterial ref={sunRef} transparent />
       </mesh>
    </group>
  );
};