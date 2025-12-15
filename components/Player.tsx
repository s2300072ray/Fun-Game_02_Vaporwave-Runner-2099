import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store';
import * as THREE from 'three';
import { getTrackHeight, getCurveOffset } from './World'; 
import { playSynthSound } from '../utils/audio';

const LANE_WIDTH = 3;
const GRAVITY = 40;
const JUMP_FORCE = 15;

// Robot colors
const BODY_COLOR = "#2a2a35";
const JOINT_COLOR = "#111111";
const ACCENT_COLOR = "#00f3ff"; // Neon Blue

export const Player: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  
  const headRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);

  const { currentLane, isJumping, actions, speed, gameSpeedMultiplier } = useGameStore();
  
  const verticalVelocity = useRef(0);
  const jumpHeightOffset = useRef(0);
  const distanceRef = useRef(0);

  useEffect(() => {
    if (isJumping && jumpHeightOffset.current <= 0) {
        verticalVelocity.current = JUMP_FORCE;
        playSynthSound('jump');
    }
  }, [isJumping]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    const currentSpeed = speed * gameSpeedMultiplier;
    distanceRef.current -= currentSpeed * delta;

    // --- 1. Position & Physics ---
    
    // Lane X Position
    const targetLaneX = currentLane * LANE_WIDTH;
    const lerpedLaneX = THREE.MathUtils.lerp(
      groupRef.current.position.x, // Note: this X includes previous curve offset, so this logic is slightly flawed if we don't separate them.
      targetLaneX,
      15 * delta
    );
    
    // Note: We want to lerp the "Lane Position", then ADD the "Curve Offset".
    // But since we write directly to position.x, we need to be careful.
    // Simpler approach: Lerp a ref value for lane, then apply to mesh.
    // For now, assuming the curve change per frame is small enough that lerping absolute X is okay-ish, 
    // BUT strictly speaking, we should calculate BaseX (Lane) + CurveX.
    // Let's rely on the fact that at z=0, CurveX is 0! 
    // getCurveOffset(0, time) returns 0.
    // So for the player at Z=0, Position X IS just Lane X. 
    // The curve only affects rotation for the player.
    
    groupRef.current.position.x = lerpedLaneX; 
    
    // Jump Physics
    if (isJumping || jumpHeightOffset.current > 0) {
        jumpHeightOffset.current += verticalVelocity.current * delta;
        verticalVelocity.current -= GRAVITY * delta;

        if (jumpHeightOffset.current <= 0) {
            jumpHeightOffset.current = 0;
            verticalVelocity.current = 0;
            if (isJumping) {
                actions.land();
            }
        }
    }

    // Height Y
    // Player Virtual Z = 0 - distanceRef.current
    const virtualZ = 0 - distanceRef.current;
    const trackHeight = getTrackHeight(virtualZ);
    const targetY = trackHeight + jumpHeightOffset.current;
    
    // Smooth Y movement
    groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        targetY,
        25 * delta 
    );

    // --- 2. Rotation & Tilt ---
    const tilt = (lerpedLaneX - targetLaneX) * 0.1; 
    
    // Pitch (Slope) - Look ahead slightly for slope tangent
    const slope = Math.cos(virtualZ * 0.08) * 0.5;
    
    // Yaw (Curve) - Look ahead to see where the road bends
    // At z=0, curve is 0. We need to look at z=-10 to see the turn.
    const lookAheadZ = -20;
    const time = state.clock.elapsedTime;
    const curveOffsetAhead = getCurveOffset(lookAheadZ, time);
    // Approximate angle: atan(offset / distance)
    const curveAngle = Math.atan2(curveOffsetAhead, Math.abs(lookAheadZ));

    if (bodyRef.current) {
        // Z Rotation: Banking (Lane switch) + Banking (Curve)
        const curveBank = curveAngle * 2; 
        bodyRef.current.rotation.z = THREE.MathUtils.lerp(
            bodyRef.current.rotation.z, 
            -tilt + curveBank, 
            10 * delta
        );

        // X Rotation: Slope
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, slope, 10 * delta);
        
        // Y Rotation: Face the curve
        // If the road curves left, we should rotate left.
        groupRef.current.rotation.y = THREE.MathUtils.lerp(
            groupRef.current.rotation.y,
            curveAngle, 
            5 * delta
        );
    }

    // --- 3. Animation (Running Man) ---
    const animTime = state.clock.elapsedTime * (currentSpeed * 0.5);

    if (isJumping) {
        if (leftArmRef.current) leftArmRef.current.rotation.x = 2.5; 
        if (rightArmRef.current) rightArmRef.current.rotation.x = 2.5;
        if (leftLegRef.current) leftLegRef.current.rotation.x = 0.5;
        if (rightLegRef.current) rightLegRef.current.rotation.x = 1.0; 
    } else {
        if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(animTime) * 0.8;
        if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(animTime + Math.PI) * 0.8;
        if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(animTime + Math.PI) * 1.0;
        if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(animTime) * 1.0;
    }
  });

  const neonMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
      color: ACCENT_COLOR, 
      emissive: ACCENT_COLOR, 
      emissiveIntensity: 2,
      toneMapped: false
  }), []);

  const bodyMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
      color: BODY_COLOR, 
      roughness: 0.3,
      metalness: 0.8
  }), []);

  return (
    <group ref={groupRef}>
        <group ref={bodyRef} position={[0, 1.0, 0]}> 
            
            {/* Torso */}
            <mesh position={[0, 0, 0]} material={bodyMaterial}>
                <boxGeometry args={[0.5, 0.7, 0.3]} />
            </mesh>
            <mesh position={[0, 0.1, 0.2]}>
                <boxGeometry args={[0.3, 0.4, 0.15]} />
                <primitive object={neonMaterial} />
            </mesh>

            {/* Head */}
            <group position={[0, 0.55, 0]} ref={headRef}>
                <mesh material={bodyMaterial}>
                    <boxGeometry args={[0.3, 0.3, 0.35]} />
                </mesh>
                <mesh position={[0, 0, -0.15]}>
                    <boxGeometry args={[0.25, 0.1, 0.05]} />
                    <primitive object={neonMaterial} />
                </mesh>
            </group>

            {/* Arms & Legs */}
            <group position={[-0.35, 0.25, 0]}>
                <mesh ref={leftArmRef} position={[0, -0.3, 0]} material={bodyMaterial}>
                    <boxGeometry args={[0.15, 0.6, 0.15]} />
                </mesh>
            </group>

            <group position={[0.35, 0.25, 0]}>
                <mesh ref={rightArmRef} position={[0, -0.3, 0]} material={bodyMaterial}>
                     <boxGeometry args={[0.15, 0.6, 0.15]} />
                </mesh>
            </group>

            <group position={[-0.15, -0.35, 0]}>
                <mesh ref={leftLegRef} position={[0, -0.35, 0]} material={bodyMaterial}>
                    <boxGeometry args={[0.18, 0.7, 0.18]} />
                </mesh>
            </group>

             <group position={[0.15, -0.35, 0]}>
                <mesh ref={rightLegRef} position={[0, -0.35, 0]} material={bodyMaterial}>
                    <boxGeometry args={[0.18, 0.7, 0.18]} />
                </mesh>
            </group>

            <pointLight position={[0, 0, -1]} intensity={2} color="#00f3ff" distance={8} />
        </group>
    </group>
  );
};
