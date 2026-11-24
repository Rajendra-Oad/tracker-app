import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

function PushUpModel({ exercise, playing, slow, speed, loop, restartKey, musclesVisible, cameraView, onTimeline, timelineSeek, selectedMuscle, isolationMode, explodedView }) {
  const group = useRef();
  const { scene, animations } = useGLTF("/models/push-up.glb");
  const animationPhase = useRef(0);
  const jointRig = useMemo(() => {
    const bones = {};
    scene.traverse((child) => {
      if (child.isBone) bones[child.name.toLowerCase()] = child;
    });
    return bones;
  }, [scene]);

  const mixer = useMemo(() => {
    if (exercise !== "Push-ups" || !animations?.length) return null;
    const value = new THREE.AnimationMixer(scene);
    const action = value.clipAction(animations[0]);
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.play();
    return value;
  }, [scene, animations, exercise, loop]);

  useEffect(() => () => mixer?.stopAllAction(), [mixer]);

  useEffect(() => {
    if (!mixer) return;
    mixer.timeScale = speed * (slow ? 0.45 : 1);
  }, [mixer, speed, slow]);

  useEffect(() => {
    if (!mixer) return;
    mixer.setTime(0);
  }, [mixer, restartKey]);

  useEffect(() => {
    if (!mixer || timelineSeek === null) return;
    const action = mixer.existingAction(animations[0]);
    if (!action) return;
    const duration = action.getClip().duration || 1;
    action.time = THREE.MathUtils.clamp(timelineSeek, 0, 1) * duration;
  }, [mixer, animations, timelineSeek]);

  useEffect(() => {
    if (!group.current) return;
    group.current.position.set(0, 0, 0);
    group.current.rotation.set(0, 0, 0);
  }, [exercise]);

  useFrame((_, delta) => {
    if (playing) mixer?.update(delta);
    let progress = 0;
    if (mixer && onTimeline) {
      const action = mixer.existingAction(animations[0]);
      const duration = action?.getClip().duration || 1;
      progress = THREE.MathUtils.euclideanModulo(action?.time || mixer.time, duration) / duration;
      onTimeline(progress);
    }

    animationPhase.current = progress;
    if (group.current) {
      group.current.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const phaseMultiplier = progress > 0.18 && progress < 0.66
          ? 0.12 + (progress - 0.18) / 0.48 * 0.18
          : progress >= 0.66 && progress < 0.96
            ? 0.30 - (progress - 0.66) / 0.30 * 0.12
            : 0.10;
        child.material.emissiveIntensity = musclesVisible ? phaseMultiplier : 0;
      });
    }
    if (exercise === "Push-ups") {
      const depth = Math.sin(progress * Math.PI);

      if (group.current) {
        group.current.position.y = -depth * 0.12;
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, depth * 0.025, 0.08);
      }

      const riggedBones = [
        ["mixamorigspine", "x", depth * 0.012],
        ["mixamorigspine1", "x", depth * 0.018],
        ["mixamorigspine2", "x", depth * 0.018],
        ["mixamorigleftshoulder", "z", -depth * 0.035],
        ["mixamorigrightshoulder", "z", depth * 0.035],
        ["mixamorigleftforearm", "z", -depth * 0.025],
        ["mixamorigrightforearm", "z", depth * 0.025],
      ];
      riggedBones.forEach(([name, axis, target]) => {
        const bone = jointRig[name];
        if (bone) bone.rotation[axis] = THREE.MathUtils.lerp(bone.rotation[axis], target, 0.08);
      });
    } else if (group.current) {
      const motion = Math.sin(progress * Math.PI * 2);
      const half = progress * 2 * Math.PI;
      const profiles = {
        "Pull-ups": { y: 0.12 * (0.5 - motion * 0.5), x: 0 },
        "Table rows": { y: 0.025 * motion, z: -0.04 * motion },
        "Chair dips": { y: -0.04 * motion, x: 0.02 * motion },
        "Split squats": { y: -0.08 * (0.5 - Math.cos(half) * 0.5), z: -0.04 * motion },
        "Plank": { y: 0, z: 0.015 * motion },
        "Bench Press": { y: -0.025 * motion, z: 0.015 * motion },
        "Bicep Curls": { y: -0.02 * motion, z: 0 },
        "Tricep Extensions": { y: 0, z: -0.018 * motion },
        "Shoulder Press": { y: 0.04 * (0.5 - Math.cos(half) * 0.5), z: 0 },
        "Lateral Raises": { y: 0.02 * motion, z: 0.06 * motion },
        "Squats": { y: -0.10 * (0.5 - Math.cos(half) * 0.5), x: 0.025 * motion },
        "Lunges": { y: -0.07 * (0.5 - Math.cos(half) * 0.5), z: 0.06 * motion },
        "Deadlifts": { y: -0.04 * motion, x: -0.025 * motion },
        "Calf Raises": { y: 0.05 * (0.5 - Math.cos(half) * 0.5), z: 0 },
        "Leg Extensions": { y: 0, z: 0.03 * motion },
        "Crunches": { y: 0.03 * (0.5 - Math.cos(half) * 0.5), x: -0.06 * motion },
        "Leg Raises": { y: 0.02 * motion, z: 0.05 * motion },
        "Russian Twists": { y: 0, yRotation: 0.12 * motion },
      };
      const pose = profiles[exercise] || { y: 0, x: 0, z: 0 };
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, pose.y || 0, 0.12);
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, pose.x || 0, 0.12);
      group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, pose.z || 0, 0.12);
      if (pose.yRotation !== undefined) {
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, pose.yRotation, 0.12);
      }
    }
  });

  useEffect(() => {
    scene.traverse((child) => {
      if (!child.isMesh) return;

      const skinIndex = child.geometry.attributes.skinIndex;
      const skinWeight = child.geometry.attributes.skinWeight;
      if (child.isSkinnedMesh && skinIndex && skinWeight) {
        const boneNames = child.skeleton.bones.map((bone) => bone.name.toLowerCase());
        const vertexColors = new Float32Array(child.geometry.attributes.position.count * 3);
        const primary = exercise === "Push-ups"
          ? /chest|spine2|shoulder|arm|forearm/
          : exercise === "Table rows"
            ? /spine|back|shoulder|arm|forearm/
            : exercise === "Chair dips"
              ? /shoulder|arm|forearm|spine2|chest/
              : exercise === "Split squats"
                ? /hip|leg|upleg|foot/
                : exercise === "Plank"
                  ? /spine|core|shoulder|arm/
                  : /spine|leg|arm|shoulder/;
        const boneColors = {
          primary: new THREE.Color("#FFD43B"),
          secondary: new THREE.Color("#35D07F"),
          stabilizing: new THREE.Color("#35C8FF"),
          neutral: new THREE.Color("#c5a58f"),
        };

        for (let vertex = 0; vertex < child.geometry.attributes.position.count; vertex += 1) {
          let strongestBone = 0;
          let strongestWeight = 0;
          for (let lane = 0; lane < 4; lane += 1) {
            const weight = skinWeight.getComponent(vertex, lane);
            if (weight > strongestWeight) {
              strongestWeight = weight;
              strongestBone = skinIndex.getComponent(vertex, lane);
            }
          }

          const boneName = boneNames[strongestBone] || "";
          let group = boneColors.neutral;
          if (/chest|spine2/.test(boneName)) group = boneColors.primary;
          if (/shoulder/.test(boneName)) group = boneColors.primary;
          if (/arm|forearm/.test(boneName)) group = boneColors.secondary;
          if (/hand|thumb|index|middle|ring|pinky/.test(boneName)) group = boneColors.neutral;
          if (/spine|hips/.test(boneName) && !/spine2/.test(boneName)) group = boneColors.stabilizing;
          if (/upleg|leg|foot|toe/.test(boneName)) group = boneColors.stabilizing;

          if (isolationMode && selectedMuscle) {
            const selectedRegion = selectedMuscle === "chest"
              ? /chest|spine2/
              : selectedMuscle === "triceps"
                ? /arm|forearm/
                : selectedMuscle === "shoulders"
                  ? /shoulder/
                  : selectedMuscle === "core"
                    ? /spine|hips/
                    : selectedMuscle === "back"
                      ? /spine|back/
                      : /upleg|leg|foot|toe/;
            if (selectedRegion.test(boneName)) {
              group = boneColors.primary.clone().lerp(new THREE.Color("#ffffff"), 0.18);
            } else {
              group = boneColors.neutral.clone().multiplyScalar(0.38);
            }
          }

          vertexColors[vertex * 3] = group.r;
          vertexColors[vertex * 3 + 1] = group.g;
          vertexColors[vertex * 3 + 2] = group.b;
        }
        child.geometry.setAttribute("color", new THREE.BufferAttribute(vertexColors, 3));
      }

      const material = new THREE.MeshPhysicalMaterial({
        map: null,
        vertexColors: !!child.geometry.attributes.color,
        roughness: 0.52,
        metalness: 0,
        clearcoat: 0.08,
        clearcoatRoughness: 0.7,
        emissive: new THREE.Color(musclesVisible ? "#ffd43b" : "#000000"),
        emissiveIntensity: musclesVisible ? 0.12 : 0,
        transparent: isolationMode && selectedMuscle ? true : false,
        opacity: isolationMode && selectedMuscle ? 0.62 : 1,
      });
      child.material = material;
      child.castShadow = true;
      child.receiveShadow = true;
    });

    scene.updateMatrixWorld(true);
    const originalBox = new THREE.Box3().setFromObject(scene);
    const originalSize = originalBox.getSize(new THREE.Vector3());
    const originalCenter = originalBox.getCenter(new THREE.Vector3());
    scene.position.sub(originalCenter);
    scene.scale.setScalar(2 / Math.max(originalSize.x, originalSize.y, originalSize.z));
    scene.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(scene);
    const groundHeight = -0.74;
    scene.position.y += groundHeight - scaledBox.min.y;
  }, [scene, exercise, musclesVisible, selectedMuscle, isolationMode]);

  return <primitive ref={group} object={scene} position={[0, 0, 0]} />;
}

function CameraRig({ cameraView, selectedMuscle, autoTrack }) {
  const { camera } = useThree();
  const trackingRef = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    if (!autoTrack) return;
    const target = selectedMuscle ? trackingRef.current : new THREE.Vector3(0, 0, 0);
    camera.lookAt(target);
  });
  useEffect(() => {
    const presets = {
      front: { position: [3.2, 2.1, 4.2], target: [0, 0, 0] },
      back: { position: [-3.2, 2.1, -4.2], target: [0, 0, 0] },
      left: { position: [-4.4, 1.8, 0], target: [0, 0, 0] },
      right: { position: [4.4, 1.8, 0], target: [0, 0, 0] },
    };
    const preset = presets[cameraView] || presets.front;
    const focusTargets = {
      chest: [0, 0.45, 0.15],
      triceps: [0.55, 0.25, 0],
      shoulders: [0.45, 0.55, 0],
      core: [0, 0.05, 0.12],
      back: [0, 0.35, -0.15],
      legs: [0, -0.45, 0],
      default: [0, 0, 0],
    };
    const target = selectedMuscle ? (focusTargets[selectedMuscle] || focusTargets.default) : preset.target;
    const destination = selectedMuscle
      ? [target[0] + 1.65, target[1] + 0.55, target[2] + 2.2]
      : preset.position;
    const start = camera.position.clone();
    const end = new THREE.Vector3(...destination);
    let started = performance.now();
    function move(now) {
      const t = Math.min((now - started) / 520, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(start, end, eased);
      camera.lookAt(...target);
      camera.updateProjectionMatrix();
      if (t < 1) requestAnimationFrame(move);
    }
    requestAnimationFrame(move);
  }, [camera, cameraView, selectedMuscle]);
  return null;
}

export default function ExerciseScene({ exercise, playing, slow, speed = 1, loop = true, restartKey = 0, musclesVisible = true, cameraView = "front", onTimeline, autoRotate = false, resetCameraKey = 0, timelineSeek = null, selectedMuscle = null, isolationMode = false, explodedView = false, autoTrack = false }) {
  const controls = useRef();
  const cameraPositions = {
    front: [3.2, 2.1, 4.2],
    back: [-3.2, 2.1, -4.2],
    left: [-4.4, 1.8, 0],
    right: [4.4, 1.8, 0],
  };

  useEffect(() => {
    if (controls.current) controls.current.reset();
  }, [cameraView, resetCameraKey]);

  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: cameraPositions[cameraView] || cameraPositions.front, fov: 38 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
      aria-label={`${exercise} 3D demonstration`}
    >
      <CameraRig cameraView={cameraView} selectedMuscle={selectedMuscle} autoTrack={autoTrack} />
      <color attach="background" args={["#b9cbd1"]} />
      <hemisphereLight intensity={1.2} groundColor="#5a666a" />
      <directionalLight position={[3, 5, 4]} intensity={1.3} />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#a7dbe4" />
      <Suspense fallback={null}>
        <PushUpModel exercise={exercise} playing={playing} slow={slow} speed={speed} loop={loop} restartKey={restartKey} musclesVisible={musclesVisible} cameraView={cameraView} onTimeline={onTimeline} timelineSeek={timelineSeek} selectedMuscle={selectedMuscle} isolationMode={isolationMode} explodedView={explodedView} />
      </Suspense>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.741, 0]} receiveShadow>
        <circleGeometry args={[2.35, 64]} />
        <meshStandardMaterial color="#252b2d" roughness={0.88} metalness={0.02} />
      </mesh>
      <Grid position={[0, -0.738, 0]} args={[5, 5]} cellColor="#46585c" sectionColor="#64787d" fadeDistance={5.5} fadeStrength={1} />
      <ContactShadows position={[0, -0.735, 0]} opacity={0.48} scale={3.2} blur={2.2} far={1.4} color="#07090a" />
      <OrbitControls ref={controls} makeDefault enablePan={false} enableRotate minDistance={3} maxDistance={7} autoRotate={autoRotate} autoRotateSpeed={1.1} />
    </Canvas>
  );
}
