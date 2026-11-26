import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export default function CameraRig({ cameraView, selectedMuscle, autoTrack }) {
  const { camera } = useThree();
  const trackingRef = useRef(new THREE.Vector3(0, 0, 0));
  useFrame(() => { if (autoTrack) camera.lookAt(selectedMuscle ? trackingRef.current : new THREE.Vector3(0, 0, 0)); });
  useEffect(() => {
    const presets = { front: { position: [3.2, 2.1, 4.2], target: [0, 0, 0] }, back: { position: [-3.2, 2.1, -4.2], target: [0, 0, 0] }, left: { position: [-4.4, 1.8, 0], target: [0, 0, 0] }, right: { position: [4.4, 1.8, 0], target: [0, 0, 0] } };
    const preset = presets[cameraView] || presets.front;
    const focusTargets = { chest: [0, 0.45, 0.15], triceps: [0.55, 0.25, 0], shoulders: [0.45, 0.55, 0], core: [0, 0.05, 0.12], back: [0, 0.35, -0.15], legs: [0, -0.45, 0], default: [0, 0, 0] };
    const target = selectedMuscle ? (focusTargets[selectedMuscle] || focusTargets.default) : preset.target;
    const destination = selectedMuscle ? [target[0] + 1.65, target[1] + 0.55, target[2] + 2.2] : preset.position;
    const start = camera.position.clone(); const end = new THREE.Vector3(...destination); const started = performance.now();
    let frameId;
    const move = (now) => { const t = Math.min((now - started) / 520, 1); const eased = 1 - Math.pow(1 - t, 3); camera.position.lerpVectors(start, end, eased); camera.lookAt(...target); camera.updateProjectionMatrix(); if (t < 1) frameId = requestAnimationFrame(move); };
    frameId = requestAnimationFrame(move);
    return () => cancelAnimationFrame(frameId);
  }, [camera, cameraView, selectedMuscle]);
  return null;
}

