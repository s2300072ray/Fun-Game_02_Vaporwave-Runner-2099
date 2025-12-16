import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store';
import { GameState, Lane, ObstacleData } from '../types';
import * as THREE from 'three';
import { getTrackHeight, getCurveOffset } from './World';

// --- CONSTANTS ---
const LANE_WIDTH = 3;
const SPAWN_Z = -100;
const DESPAWN_Z = 5;
const VISIBLE_LIMIT_Z = 5; 
const COLLISION_THRESHOLD_Z_NEAR = -1.5;
const COLLISION_THRESHOLD_Z_FAR = 1.5;

// --- ASSETS (Geometries/Materials) ---
// Pre-allocating these outside the component to prevent recreation
const obstacleGeo = new THREE.ConeGeometry(1.2, 2.5, 4);
const obstacleEdges = new THREE.EdgesGeometry(obstacleGeo);
const obstacleMatBody = new THREE.MeshStandardMaterial({ color: "#220000", roughness: 0.1, metalness: 0.8 });
const obstacleMatLine = new THREE.LineBasicMaterial({ color: "#ff0000", toneMapped: false, linewidth: 2 });

const bonusGeo = new THREE.IcosahedronGeometry(0.8, 1);
const bonusRingGeo = new THREE.TorusGeometry(1.2, 0.05, 16, 32);
const bonusMat = new THREE.MeshStandardMaterial({ color: "#00f3ff", emissive: "#00f3ff", emissiveIntensity: 3, toneMapped: false });
const bonusRingMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });

const laserGeoCore = new THREE.CylinderGeometry(0.1, 0.1, 12, 8);
const laserGeoGlow = new THREE.CylinderGeometry(0.3, 0.3, 12, 8);
const laserMatCore = new THREE.MeshBasicMaterial({ color: "#ff0000", toneMapped: false });
const laserMatGlow = new THREE.MeshBasicMaterial({ color: "#ff0000", transparent: true, opacity: 0.3, toneMapped: false });

// --- RENDER COMPONENTS ---

const ObstacleMesh: React.FC = React.memo(() => (
    <group position={[0, 1.25, 0]}>
        <mesh geometry={obstacleGeo} material={obstacleMatBody} />
        <lineSegments geometry={obstacleEdges} material={obstacleMatLine} />
        <pointLight color="red" intensity={3} distance={4} />
    </group>
));

const BonusMesh: React.FC = React.memo(() => (
    <group position={[0, 1.5, 0]}>
        <mesh geometry={bonusGeo} material={bonusMat} />
        <mesh geometry={bonusRingGeo} material={bonusRingMat} rotation={[Math.PI/2, 0, 0]} />
        <pointLight color="#00f3ff" intensity={2} distance={5} />
    </group>
));

const LaserMesh: React.FC = React.memo(() => (
    <group position={[0, 0.2, 0]}>
        <group rotation={[0, 0, Math.PI / 2]}>
            <mesh geometry={laserGeoCore} material={laserMatCore} />
            <mesh geometry={laserGeoGlow} material={laserMatGlow} />
        </group>
        <pointLight color="#ff0000" intensity={5} distance={10} />
    </group>
));

// --- LOGIC COMPONENT ---

const MovingObject: React.FC<{ data: ObstacleData, distanceRef: React.MutableRefObject<number> }> = ({ data, distanceRef }) => {
    const group = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (!group.current) return;

        // 1. Position Calculation
        // Virtual Z calculates where we are relative to the "scrolling" terrain for Y-height
        const virtualZ = data.z - distanceRef.current;
        const trackHeight = getTrackHeight(virtualZ);
        
        // World Space Mapping
        group.current.position.z = data.z;
        group.current.position.y = trackHeight + (data.type === 'laser' ? 0.0 : 0);
        
        // Curve Application
        const laneX = data.lane * LANE_WIDTH;
        const curveOffset = getCurveOffset(data.z, state.clock.elapsedTime);
        group.current.position.x = laneX + curveOffset;

        // 2. Rotation & Orientation
        // Calculate tangent to the curve for correct facing
        const curveStrength = Math.sin(state.clock.elapsedTime * 0.05) * 0.0002;
        const tangent = 2 * data.z * curveStrength;
        
        group.current.rotation.y = -tangent;

        // Bonus animation
        if (data.type === 'bonus') {
            group.current.rotation.y += state.clock.elapsedTime; 
            group.current.rotation.z = Math.sin(data.z * 0.2) * 0.2;
        }

        // 3. Culling
        group.current.visible = data.z <= VISIBLE_LIMIT_Z && data.z >= SPAWN_Z;
    });

    return (
        <group ref={group}>
            {data.type === 'obstacle' && <ObstacleMesh />}
            {data.type === 'bonus' && <BonusMesh />}
            {data.type === 'laser' && <LaserMesh />}
        </group>
    );
};

// --- SYSTEM MANAGER ---

export const ObstacleManager: React.FC = () => {
  const { gameState, actions, speed, gameSpeedMultiplier } = useGameStore();
  
  // ECS Data
  const obstaclesRef = useRef<ObstacleData[]>([]);
  const lastSpawnTime = useRef(0);
  const distanceRef = useRef(0);
  
  // Render container
  const groupRef = useRef<THREE.Group>(null);
  
  // Reset logic
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      obstaclesRef.current = [];
      lastSpawnTime.current = 0;
      distanceRef.current = 0;
    }
  }, [gameState]);

  useFrame((state, delta) => {
    if (gameState !== GameState.PLAYING) return;
    
    const currentSpeed = speed * gameSpeedMultiplier;
    distanceRef.current -= currentSpeed * delta;

    // --- SYSTEM 1: MOVEMENT ---
    obstaclesRef.current.forEach(obs => {
      obs.z += currentSpeed * delta;
    });

    // --- SYSTEM 2: SPAWNER ---
    const spawnInterval = Math.max(0.3, 1.0 / gameSpeedMultiplier);
    if (state.clock.elapsedTime - lastSpawnTime.current > spawnInterval) {
      const lanes = [Lane.LEFT, Lane.CENTER, Lane.RIGHT];
      const shuffledLanes = lanes.sort(() => 0.5 - Math.random());
      const rand = Math.random();
      
      const newObstacles: ObstacleData[] = [];

      // 15% Chance for Laser (Tripwire)
      if (rand < 0.15) {
          newObstacles.push({
            id: crypto.randomUUID(),
            lane: Lane.CENTER,
            z: SPAWN_Z,
            type: 'laser'
          });
      } else {
          // Standard Obstacles / Bonus
          const isBonus = rand < 0.3;
          const count = (isBonus || Math.random() > 0.6) ? 1 : 2; // 1 or 2 items

          for(let i=0; i<count; i++) {
            // Prevent blocking all lanes if mixing bonus + obstacle
            if (i === 1 && isBonus) continue; 
            
            newObstacles.push({
              id: crypto.randomUUID(),
              lane: shuffledLanes[i],
              z: SPAWN_Z,
              type: (isBonus && i === 0) ? 'bonus' : 'obstacle'
            });
          }
      }
      obstaclesRef.current.push(...newObstacles);
      lastSpawnTime.current = state.clock.elapsedTime;
    }

    // --- SYSTEM 3: CLEANUP ---
    const beforeCount = obstaclesRef.current.length;
    obstaclesRef.current = obstaclesRef.current.filter(obs => obs.z < DESPAWN_Z);
    const despawnedCount = beforeCount - obstaclesRef.current.length;
    if (despawnedCount > 0) {
        actions.increaseSpeed(0.02 * despawnedCount);
    }

    // --- SYSTEM 4: COLLISION DETECTION ---
    const playerStore = useGameStore.getState();
    const pLane = playerStore.currentLane;
    const pJumping = playerStore.isJumping;

    for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
        const obs = obstaclesRef.current[i];
        
        // AABB-ish Z-Check
        if (obs.z > COLLISION_THRESHOLD_Z_NEAR && obs.z < COLLISION_THRESHOLD_Z_FAR) {
            
            // Lane Check
            if (obs.type === 'laser') {
                // Lasers span all lanes, must jump
                if (!pJumping) {
                    actions.endGame();
                    break;
                }
            } else if (obs.lane === pLane) {
                // Same lane interaction
                if (obs.type === 'bonus') {
                    actions.setScore(playerStore.score + 500);
                    obstaclesRef.current.splice(i, 1); // Remove bonus immediately
                } else if (obs.type === 'obstacle') {
                    if (!pJumping) {
                        actions.endGame();
                        break;
                    } else {
                        // Jumped over it - Success (Add slight score maybe?)
                    }
                }
            }
        }
    }
  });

  return (
    <group ref={groupRef}>
      {obstaclesRef.current.map((obs) => (
        <MovingObject key={obs.id} data={obs} distanceRef={distanceRef} />
      ))}
    </group>
  );
};