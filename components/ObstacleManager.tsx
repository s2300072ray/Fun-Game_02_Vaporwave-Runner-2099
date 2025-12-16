import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store';
import { GameState, Lane, ObstacleData } from '../types';
import * as THREE from 'three';
import { getTrackHeight, getCurveOffset } from './World';

/**
 * --- GAMEPLAY CONSTANTS ---
 */
const GAME_CONFIG = {
    LANE_WIDTH: 3,
    SPAWN_Z: -100,
    DESPAWN_Z: 5,
    VISIBLE_LIMIT_Z: 5,
    COLLISION_NEAR: -1.5,
    COLLISION_FAR: 1.5,
    SPAWN_INTERVAL_BASE: 1.0,
    SPAWN_INTERVAL_MIN: 0.3
};

/**
 * --- ASSET PRE-ALLOCATION (Memory Optimization) ---
 */
const Assets = {
    Obstacle: {
        geo: new THREE.ConeGeometry(1.2, 2.5, 4),
        edges: new THREE.EdgesGeometry(new THREE.ConeGeometry(1.2, 2.5, 4)),
        bodyMat: new THREE.MeshStandardMaterial({ color: "#220000", roughness: 0.1, metalness: 0.8 }),
        lineMat: new THREE.LineBasicMaterial({ color: "#ff0000", toneMapped: false, linewidth: 2 })
    },
    Bonus: {
        geo: new THREE.IcosahedronGeometry(0.8, 1),
        ringGeo: new THREE.TorusGeometry(1.2, 0.05, 16, 32),
        mat: new THREE.MeshStandardMaterial({ color: "#00f3ff", emissive: "#00f3ff", emissiveIntensity: 3, toneMapped: false }),
        ringMat: new THREE.MeshBasicMaterial({ color: "#ffffff" })
    },
    Laser: {
        coreGeo: new THREE.CylinderGeometry(0.1, 0.1, 12, 8),
        glowGeo: new THREE.CylinderGeometry(0.3, 0.3, 12, 8),
        coreMat: new THREE.MeshBasicMaterial({ color: "#ff0000", toneMapped: false }),
        glowMat: new THREE.MeshBasicMaterial({ color: "#ff0000", transparent: true, opacity: 0.3, toneMapped: false })
    }
};

/**
 * --- VISUAL COMPONENTS (Pure Rendering) ---
 */
const ObstacleMesh: React.FC = React.memo(() => (
    <group position={[0, 1.25, 0]}>
        <mesh geometry={Assets.Obstacle.geo} material={Assets.Obstacle.bodyMat} />
        <lineSegments geometry={Assets.Obstacle.edges} material={Assets.Obstacle.lineMat} />
        <pointLight color="red" intensity={3} distance={4} />
    </group>
));

const BonusMesh: React.FC = React.memo(() => (
    <group position={[0, 1.5, 0]}>
        <mesh geometry={Assets.Bonus.geo} material={Assets.Bonus.mat} />
        <mesh geometry={Assets.Bonus.ringGeo} material={Assets.Bonus.ringMat} rotation={[Math.PI/2, 0, 0]} />
        <pointLight color="#00f3ff" intensity={2} distance={5} />
    </group>
));

const LaserMesh: React.FC = React.memo(() => (
    <group position={[0, 0.2, 0]}>
        <group rotation={[0, 0, Math.PI / 2]}>
            <mesh geometry={Assets.Laser.coreGeo} material={Assets.Laser.coreMat} />
            <mesh geometry={Assets.Laser.glowGeo} material={Assets.Laser.glowMat} />
        </group>
        <pointLight color="#ff0000" intensity={5} distance={10} />
    </group>
));

/**
 * --- LOGIC COMPONENT (Transform Updates) ---
 */
const EntityRenderer: React.FC<{ data: ObstacleData, distanceRef: React.MutableRefObject<number> }> = ({ data, distanceRef }) => {
    const group = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (!group.current) return;

        // 1. Calculate Virtual Position relative to Player
        const virtualZ = data.z - distanceRef.current;
        
        // 2. Apply World Physics (Height & Curve)
        const trackHeight = getTrackHeight(virtualZ);
        const laneX = data.lane * GAME_CONFIG.LANE_WIDTH;
        const curveOffset = getCurveOffset(data.z, state.clock.elapsedTime);

        // 3. Update Transforms
        group.current.position.set(
            laneX + curveOffset, 
            trackHeight + (data.type === 'laser' ? 0.0 : 0), 
            data.z
        );

        // 4. Orientation Logic (Face the curve)
        const curveStrength = Math.sin(state.clock.elapsedTime * 0.05) * 0.0002;
        const tangent = 2 * data.z * curveStrength;
        group.current.rotation.y = -tangent;

        // 5. Special Animations
        if (data.type === 'bonus') {
            group.current.rotation.y += state.clock.elapsedTime; 
            group.current.rotation.z = Math.sin(data.z * 0.2) * 0.2;
        }

        // 6. Culling
        group.current.visible = data.z <= GAME_CONFIG.VISIBLE_LIMIT_Z && data.z >= GAME_CONFIG.SPAWN_Z;
    });

    return (
        <group ref={group}>
            {data.type === 'obstacle' && <ObstacleMesh />}
            {data.type === 'bonus' && <BonusMesh />}
            {data.type === 'laser' && <LaserMesh />}
        </group>
    );
};

/**
 * --- MAIN MANAGER (ECS-Lite System) ---
 */
export const ObstacleManager: React.FC = () => {
  const { gameState, actions, speed, gameSpeedMultiplier } = useGameStore();
  
  // Game State Refs (Mutable for performance)
  const entitiesRef = useRef<ObstacleData[]>([]);
  const lastSpawnTime = useRef(0);
  const distanceRef = useRef(0);
  
  // Clear entities on reset
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      entitiesRef.current = [];
      lastSpawnTime.current = 0;
      distanceRef.current = 0;
    }
  }, [gameState]);

  useFrame((state, delta) => {
    if (gameState !== GameState.PLAYING) return;
    
    const currentSpeed = speed * gameSpeedMultiplier;
    distanceRef.current -= currentSpeed * delta;

    // --- SYSTEM 1: MOVEMENT ---
    // Move entities towards player (Positive Z)
    entitiesRef.current.forEach(entity => {
      entity.z += currentSpeed * delta;
    });

    // --- SYSTEM 2: SPAWNING LOGIC ---
    const spawnInterval = Math.max(GAME_CONFIG.SPAWN_INTERVAL_MIN, GAME_CONFIG.SPAWN_INTERVAL_BASE / gameSpeedMultiplier);
    
    if (state.clock.elapsedTime - lastSpawnTime.current > spawnInterval) {
      const lanes = [Lane.LEFT, Lane.CENTER, Lane.RIGHT];
      const shuffledLanes = lanes.sort(() => 0.5 - Math.random());
      const rng = Math.random();
      
      const newEntities: ObstacleData[] = [];

      // Pattern: Laser Trap (15%)
      if (rng < 0.15) {
          newEntities.push({
            id: crypto.randomUUID(),
            lane: Lane.CENTER,
            z: GAME_CONFIG.SPAWN_Z,
            type: 'laser'
          });
      } else {
          // Pattern: Standard Obstacles & Bonuses
          const isBonus = rng < 0.3;
          const count = (isBonus || Math.random() > 0.6) ? 1 : 2; 

          for(let i=0; i<count; i++) {
            if (i === 1 && isBonus) continue; // Don't block all paths
            
            newEntities.push({
              id: crypto.randomUUID(),
              lane: shuffledLanes[i],
              z: GAME_CONFIG.SPAWN_Z,
              type: (isBonus && i === 0) ? 'bonus' : 'obstacle'
            });
          }
      }
      entitiesRef.current.push(...newEntities);
      lastSpawnTime.current = state.clock.elapsedTime;
    }

    // --- SYSTEM 3: CLEANUP (Garbage Collection) ---
    const initialCount = entitiesRef.current.length;
    entitiesRef.current = entitiesRef.current.filter(e => e.z < GAME_CONFIG.DESPAWN_Z);
    const despawnedCount = initialCount - entitiesRef.current.length;
    
    // Reward for survival (Speed increase per cleared wave)
    if (despawnedCount > 0) {
        actions.increaseSpeed(0.02 * despawnedCount);
    }

    // --- SYSTEM 4: COLLISION DETECTION ---
    const { currentLane, isJumping, score } = useGameStore.getState();

    for (let i = entitiesRef.current.length - 1; i >= 0; i--) {
        const entity = entitiesRef.current[i];
        
        // Z-Axis Intersection Check (AABB)
        if (entity.z > GAME_CONFIG.COLLISION_NEAR && entity.z < GAME_CONFIG.COLLISION_FAR) {
            
            // Type: Laser (Lane Independent, must Jump)
            if (entity.type === 'laser') {
                if (!isJumping) {
                    actions.endGame();
                    break;
                }
            } 
            // Type: Lane Specific
            else if (entity.lane === currentLane) {
                if (entity.type === 'bonus') {
                    actions.setScore(score + 500);
                    entitiesRef.current.splice(i, 1); // Consume bonus
                } else if (entity.type === 'obstacle') {
                    if (!isJumping) {
                        actions.endGame();
                        break;
                    }
                    // Implicit "Jump Over" success
                }
            }
        }
    }
  });

  return (
    <group>
      {entitiesRef.current.map((entity) => (
        <EntityRenderer key={entity.id} data={entity} distanceRef={distanceRef} />
      ))}
    </group>
  );
};