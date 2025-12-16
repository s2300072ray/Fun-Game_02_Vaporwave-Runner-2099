import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store';
import * as THREE from 'three';
import { getTrackHeight, getCurveOffset } from './World'; 
import { playSynthSound } from '../utils/audio';

const LANE_WIDTH = 3;
const GRAVITY = 40;
const JUMP_FORCE = 15;

// Visual Configuration
const BODY_COLOR = "#2a2a35";
const ACCENT_COLOR = "#00f3ff"; 

export const Player: React.FC = () => {
  // Scene Graph Refs
  const containerRef = useRef<THREE.Group>(null); // Handles Physics Position (X, Y, Z)
  const visualRef = useRef<THREE.Group>(null);    // Handles Banking/Tilting animations
  
  // Animation Refs
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);

  const { currentLane, isJumping, actions, speed, gameSpeedMultiplier } = useGameStore();
  
  // Physics State
  const verticalVelocity = useRef(0);
  const jumpHeightOffset = useRef(0);
  const distanceRef = useRef(0);

  // Jump Trigger
  useEffect(() => {
    if (isJumping && jumpHeightOffset.current <= 0) {
        verticalVelocity.current = JUMP_FORCE;
        playSynthSound('jump');
    }
  }, [isJumping]);

  useFrame((state, delta) => {
    if (!containerRef.current || !visualRef.current) return;
    
    const currentSpeed = speed * gameSpeedMultiplier;
    const time = state.clock.elapsedTime;
    
    // Track distance for procedural undulation
    distanceRef.current -= currentSpeed * delta;

    // --- PHYSICS STEP ---
    
    // 1. Horizontal (Lane Switching)
    // We strictly interpret the lane index to a coordinate.
    const targetLaneX = currentLane * LANE_WIDTH;
    
    // Smoothly interpolate current X to target X (Simple spring-like dampening)
    // Note: The player sits at World Z = 0.
    // The curve function `getCurveOffset(0, time)` is always 0.
    // So Player.x is purely Lane.x. The curve only affects the "Look Ahead" rotation.
    const currentX = containerRef.current.position.x;
    const nextX = THREE.MathUtils.lerp(currentX, targetLaneX, 15 * delta);
    containerRef.current.position.x = nextX;
    
    // 2. Vertical (Jumping + Terrain Follow)
    if (isJumping || jumpHeightOffset.current > 0) {
        jumpHeightOffset.current += verticalVelocity.current * delta;
        verticalVelocity.current -= GRAVITY * delta;

        if (jumpHeightOffset.current <= 0) {
            jumpHeightOffset.current = 0;
            verticalVelocity.current = 0;
            if (isJumping) actions.land();
        }
    }

    // Terrain Height at player's virtual distance
    const virtualZ = 0 - distanceRef.current;
    const terrainY = getTrackHeight(virtualZ);
    const totalY = terrainY + jumpHeightOffset.current;
    
    containerRef.current.position.y = THREE.MathUtils.lerp(
        containerRef.current.position.y,
        totalY,
        25 * delta
    );

    // --- VISUAL ANIMATION STEP ---

    // 1. Bank/Tilt (Derived from movement delta)
    const velocityX = nextX - currentX;
    const tilt = velocityX * -2.0; // Bank into the turn

    // 2. Curve Anticipation (Look Ahead)
    // We sample the curve 20 units ahead to rotate the player mesh
    const lookAheadZ = -20;
    const curveOffsetAhead = getCurveOffset(lookAheadZ, time);
    const curveAngle = Math.atan2(curveOffsetAhead, Math.abs(lookAheadZ));

    // Apply rotations to the Visual container, not the physics container
    // Z-Rot: Banking
    visualRef.current.rotation.z = THREE.MathUtils.lerp(visualRef.current.rotation.z, tilt, 10 * delta);
    
    // Y-Rot: Facing the curve + slight bank compensation
    visualRef.current.rotation.y = THREE.MathUtils.lerp(visualRef.current.rotation.y, curveAngle, 5 * delta);

    // X-Rot: Slope adjustment (Tangent of terrain height)
    const slope = Math.cos(virtualZ * 0.08) * 0.5;
    containerRef.current.rotation.x = THREE.MathUtils.lerp(containerRef.current.rotation.x, slope, 10 * delta);

    // 3. Running Animation
    const animSpeed = state.clock.elapsedTime * (currentSpeed * 0.5);
    
    if (isJumping) {
        // Jump Pose
        if (leftArmRef.current) leftArmRef.current.rotation.x = 2.5; 
        if (rightArmRef.current) rightArmRef.current.rotation.x = 2.5;
        if (leftLegRef.current) leftLegRef.current.rotation.x = 0.5;
        if (rightLegRef.current) rightLegRef.current.rotation.x = 1.0; 
    } else {
        // Run Cycle
        if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(animSpeed) * 0.8;
        if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(animSpeed + Math.PI) * 0.8;
        if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(animSpeed + Math.PI) * 1.0;
        if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(animSpeed) * 1.0;
    }
  });

  // Material Instantiation
  const neonMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
      color: ACCENT_COLOR, emissive: ACCENT_COLOR, emissiveIntensity: 2, toneMapped: false
  }), []);
  const bodyMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
      color: BODY_COLOR, roughness: 0.3, metalness: 0.8
  }), []);

  return (
    <group ref={containerRef}>
        <group ref={visualRef} position={[0, 1.0, 0]}> 
            {/* Torso */}
            <mesh material={bodyMaterial}><boxGeometry args={[0.5, 0.7, 0.3]} /></mesh>
            <mesh position={[0, 0.1, 0.2]} material={neonMaterial}><boxGeometry args={[0.3, 0.4, 0.15]} /></mesh>

            {/* Head */}
            <group position={[0, 0.55, 0]}>
                <mesh material={bodyMaterial}><boxGeometry args={[0.3, 0.3, 0.35]} /></mesh>
                <mesh position={[0, 0, -0.15]} material={neonMaterial}><boxGeometry args={[0.25, 0.1, 0.05]} /></mesh>
            </group>

            {/* Limbs */}
            <group position={[-0.35, 0.25, 0]}><mesh ref={leftArmRef} position={[0, -0.3, 0]} material={bodyMaterial}><boxGeometry args={[0.15, 0.6, 0.15]} /></mesh></group>
            <group position={[0.35, 0.25, 0]}><mesh ref={rightArmRef} position={[0, -0.3, 0]} material={bodyMaterial}><boxGeometry args={[0.15, 0.6, 0.15]} /></mesh></group>
            <group position={[-0.15, -0.35, 0]}><mesh ref={leftLegRef} position={[0, -0.35, 0]} material={bodyMaterial}><boxGeometry args={[0.18, 0.7, 0.18]} /></mesh></group>
            <group position={[0.15, -0.35, 0]}><mesh ref={rightLegRef} position={[0, -0.35, 0]} material={bodyMaterial}><boxGeometry args={[0.18, 0.7, 0.18]} /></mesh></group>

            {/* Character Light */}
            <pointLight position={[0, 0, -1]} intensity={2} color="#00f3ff" distance={8} />
        </group>
    </group>
  );
};