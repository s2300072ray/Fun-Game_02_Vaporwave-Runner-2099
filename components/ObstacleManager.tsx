import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store';
import { GameState, Lane, ObstacleData } from '../types';
import * as THREE from 'three';
import { getTrackHeight, getCurveOffset } from './World';

const LANE_WIDTH = 3;
const SPAWN_Z = -100;
const DESPAWN_Z = 5;
const VISIBLE_LIMIT_Z = 5; 
const COLLISION_THRESHOLD = 1.5;

// --- Visual Components ---

const ObstacleMesh: React.FC = () => {
    const geometry = useMemo(() => new THREE.ConeGeometry(1.2, 2.5, 4), []);
    const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);
    return (
        <group position={[0, 1.25, 0]}>
            <mesh geometry={geometry}>
                <meshStandardMaterial color="#220000" roughness={0.1} metalness={0.8} />
            </mesh>
            <lineSegments geometry={edges}>
                <lineBasicMaterial color="#ff0000" toneMapped={false} linewidth={2} />
            </lineSegments>
            <pointLight color="red" intensity={3} distance={4} />
        </group>
    );
};

const LaserMesh: React.FC = () => {
    return (
        <group position={[0, 0.2, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.1, 0.1, 12, 8]} />
                <meshBasicMaterial color="#ff0000" toneMapped={false} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
                 <cylinderGeometry args={[0.3, 0.3, 12, 8]} />
                 <meshBasicMaterial color="#ff0000" transparent opacity={0.3} toneMapped={false} />
            </mesh>
            <pointLight color="#ff0000" intensity={5} distance={10} />
        </group>
    );
};

const BonusMesh: React.FC = () => {
    return (
        <group position={[0, 1.5, 0]}>
            <mesh>
                <icosahedronGeometry args={[0.8, 1]} />
                <meshStandardMaterial 
                    color="#00f3ff" 
                    emissive="#00f3ff" 
                    emissiveIntensity={3} 
                    toneMapped={false} 
                />
            </mesh>
            <mesh rotation={[Math.PI/2, 0, 0]}>
                <torusGeometry args={[1.2, 0.05, 16, 32]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>
             <pointLight color="#00f3ff" intensity={2} distance={5} />
        </group>
    );
};

// --- Manager ---

const MovingObject: React.FC<{ data: ObstacleData, distanceRef: React.MutableRefObject<number> }> = ({ data, distanceRef }) => {
    const group = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (group.current) {
            // 1. Z Position (World Space)
            // Obstacles physically move towards camera, so their Z changes.
            group.current.position.z = data.z;

            // 2. Y Position (Undulation)
            // To sit ON the hill, we need the "Virtual Map Z".
            // Virtual Z = Current World Z - Total Distance Traveled
            // Note: Since distanceRef is negative (moving forward), we usually do:
            // playerVirtualZ = 0 - distanceRef.
            // obstacleVirtualZ = data.z - distanceRef.
            const virtualZ = data.z - distanceRef.current;
            const y = getTrackHeight(virtualZ);
            
            const heightOffset = data.type === 'laser' ? 0.0 : 0; 
            group.current.position.y = y + heightOffset;

            // 3. X Position (Curve)
            // To align with road, we use World Z for the curve calculation
            const laneX = data.lane * LANE_WIDTH;
            const curveOffset = getCurveOffset(data.z, state.clock.elapsedTime);
            
            group.current.position.x = laneX + curveOffset;

            // 4. Rotation
            // Tangent calculation to face the curve
            // MUST MATCH WORLD CURVE LOGIC (time * 0.05, strength 0.0002)
            const curveStrength = Math.sin(state.clock.elapsedTime * 0.05) * 0.0002;
            // Derivative of x = z^2 * C is dx/dz = 2 * z * C
            const tangent = 2 * data.z * curveStrength;
            
            // Basic rotation facing
            group.current.rotation.y = -tangent; 
            
            // Add extra rotation for bonus
            if (data.type === 'bonus') {
                group.current.rotation.y += 0.05; 
                group.current.rotation.z = Math.sin(data.z * 0.2) * 0.2;
            }

            group.current.visible = data.z <= VISIBLE_LIMIT_Z;
        }
    });

    return (
        <group ref={group}>
            {data.type === 'obstacle' && <ObstacleMesh />}
            {data.type === 'bonus' && <BonusMesh />}
            {data.type === 'laser' && <LaserMesh />}
        </group>
    );
};

export const ObstacleManager: React.FC = () => {
  const { gameState, actions, speed, gameSpeedMultiplier, isJumping } = useGameStore();
  
  const obstaclesRef = useRef<ObstacleData[]>([]);
  const lastSpawnTime = useRef(0);
  const groupRef = useRef<THREE.Group>(null);
  
  // Track total distance purely for visual sync of undulation (Y-axis)
  const distanceRef = useRef(0);

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      obstaclesRef.current = [];
      lastSpawnTime.current = 0;
      distanceRef.current = 0;
    }
  }, [gameState]);

  useFrame((state, delta) => {
    if (gameState !== GameState.PLAYING) return;
    if (!groupRef.current) return;

    const currentSpeed = speed * gameSpeedMultiplier;
    
    // Update distance tracker (syncs with World and Player)
    distanceRef.current -= currentSpeed * delta;

    // 1. Move Obstacles
    obstaclesRef.current.forEach(obs => {
      obs.z += currentSpeed * delta;
    });

    // 2. Spawn
    const spawnInterval = Math.max(0.3, 1.0 / gameSpeedMultiplier);
    
    if (state.clock.elapsedTime - lastSpawnTime.current > spawnInterval) {
      const lanes = [Lane.LEFT, Lane.CENTER, Lane.RIGHT];
      const shuffledLanes = lanes.sort(() => 0.5 - Math.random());
      
      const rand = Math.random();
      
      if (rand < 0.15) {
          obstaclesRef.current.push({
            id: Math.random().toString(36).substr(2, 9),
            lane: Lane.CENTER,
            z: SPAWN_Z,
            type: 'laser'
          });
      } else {
          const isBonus = rand < 0.3;
          const lanesToFill = (isBonus || Math.random() > 0.6) ? 1 : 2;

          for(let i=0; i<lanesToFill; i++) {
            if (i === 1 && isBonus) continue; 
            obstaclesRef.current.push({
              id: Math.random().toString(36).substr(2, 9),
              lane: shuffledLanes[i],
              z: SPAWN_Z,
              type: isBonus && i === 0 ? 'bonus' : 'obstacle'
            });
          }
      }
      
      lastSpawnTime.current = state.clock.elapsedTime;
    }

    // 3. Cleanup & Difficulty
    const initialCount = obstaclesRef.current.length;
    obstaclesRef.current = obstaclesRef.current.filter(obs => obs.z < DESPAWN_Z);
    const despawned = initialCount - obstaclesRef.current.length;
    
    if (despawned > 0) {
        actions.increaseSpeed(0.02 * despawned);
    }

    // 4. Collision
    const playerLane = useGameStore.getState().currentLane;
    const jumpingNow = useGameStore.getState().isJumping;

    for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
        const obs = obstaclesRef.current[i];
        
        if (obs.z > -1.5 && obs.z < COLLISION_THRESHOLD) {
            
            if (obs.type === 'laser') {
                if (!jumpingNow) {
                     actions.endGame();
                     break;
                }
            } else if (obs.lane === playerLane) {
                if (obs.type === 'bonus') {
                    actions.setScore(useGameStore.getState().score + 500);
                    obstaclesRef.current.splice(i, 1);
                    continue;
                } else if (obs.type === 'obstacle') {
                    if (jumpingNow) {
                        // Dodged
                    } else {
                        actions.endGame();
                        break;
                    }
                }
            }
        }
    }
  });

  return (
    <group ref={groupRef}>
      {obstaclesRef.current.map((obs) => (
        <MovingObject 
            key={obs.id} 
            data={obs} 
            distanceRef={distanceRef} 
        />
      ))}
    </group>
  );
};