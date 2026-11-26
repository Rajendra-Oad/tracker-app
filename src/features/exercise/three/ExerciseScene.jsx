import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import CameraRig from "./CameraRig";
import ExerciseModel from "./ExerciseModel";

export default function ExerciseScene({ exercise, theme = "dark", playing, slow, speed = 1, loop = true, restartKey = 0, musclesVisible = true, cameraView = "front", onTimeline, autoRotate = false, resetCameraKey = 0, timelineSeek = null, selectedMuscle = null, isolationMode = false, explodedView = false, autoTrack = false }) {
  const controls = useRef();
  const palette = useMemo(() => theme === "light" ? { primary: "#404040", secondary: "#737373", stabilizing: "#a3a3a3", neutral: "#d4d4d4", floor: "#e5e5e5", grid: "#d4d4d4", gridSection: "#737373" } : { primary: "#f5f5f5", secondary: "#a3a3a3", stabilizing: "#525252", neutral: "#737373", floor: "#171717", grid: "#373737", gridSection: "#737373" }, [theme]);
  const cameraPositions = { front: [3.2, 2.1, 4.2], back: [-3.2, 2.1, -4.2], left: [-4.4, 1.8, 0], right: [4.4, 1.8, 0] };
  useEffect(() => { if (controls.current) controls.current.reset(); }, [cameraView, resetCameraKey]);
  return <Canvas className="h-full w-full" camera={{ position: cameraPositions[cameraView] || cameraPositions.front, fov: 38 }} gl={{ alpha: true, antialias: true }} dpr={[1, 2]} aria-label={`${exercise} 3D demonstration`}>
    <CameraRig cameraView={cameraView} selectedMuscle={selectedMuscle} autoTrack={autoTrack} />
    <hemisphereLight intensity={1.2} groundColor={palette.gridSection} />
    <directionalLight position={[3, 5, 4]} intensity={1.3} />
    <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#ffffff" />
    <Suspense fallback={null}><ExerciseModel exercise={exercise} playing={playing} slow={slow} speed={speed} loop={loop} restartKey={restartKey} musclesVisible={musclesVisible} onTimeline={onTimeline} timelineSeek={timelineSeek} selectedMuscle={selectedMuscle} isolationMode={isolationMode} explodedView={explodedView} palette={palette} /></Suspense>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.741, 0]} receiveShadow><circleGeometry args={[2.35, 64]} /><meshStandardMaterial color={palette.floor} roughness={0.88} metalness={0.02} /></mesh>
    <Grid position={[0, -0.738, 0]} args={[5, 5]} cellColor={palette.grid} sectionColor={palette.gridSection} fadeDistance={5.5} fadeStrength={1} />
    <ContactShadows position={[0, -0.735, 0]} opacity={0.48} scale={3.2} blur={2.2} far={1.4} color="#07090a" />
    <OrbitControls ref={controls} makeDefault enablePan={false} enableRotate minDistance={3} maxDistance={7} autoRotate={autoRotate} autoRotateSpeed={1.1} />
  </Canvas>;
}

