import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export default function ExerciseModel({ exercise, playing, slow, speed, loop, restartKey, musclesVisible, onTimeline, timelineSeek, selectedMuscle, isolationMode, palette }) {
  const group = useRef();
  const { scene, animations } = useGLTF("/models/push-up.glb");
  const animationPhase = useRef(0);
  const jointRig = useMemo(() => {
    const bones = {};
    scene.traverse((child) => { if (child.isBone) bones[child.name.toLowerCase()] = child; });
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
  useEffect(() => { if (mixer) mixer.timeScale = speed * (slow ? 0.45 : 1); }, [mixer, speed, slow]);
  useEffect(() => { if (mixer) mixer.setTime(0); }, [mixer, restartKey]);
  useEffect(() => {
    if (!mixer || timelineSeek === null) return;
    const action = mixer.existingAction(animations[0]);
    if (action) action.time = THREE.MathUtils.clamp(timelineSeek, 0, 1) * (action.getClip().duration || 1);
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
    group.current?.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const phaseMultiplier = progress > 0.18 && progress < 0.66
        ? 0.12 + (progress - 0.18) / 0.48 * 0.18
        : progress >= 0.66 && progress < 0.96 ? 0.30 - (progress - 0.66) / 0.30 * 0.12 : 0.10;
      child.material.emissiveIntensity = musclesVisible ? phaseMultiplier : 0;
    });

    if (exercise === "Push-ups") {
      const depth = Math.sin(progress * Math.PI);
      if (group.current) {
        group.current.position.y = -depth * 0.12;
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, depth * 0.025, 0.08);
      }
      [["mixamorigspine", "x", depth * 0.012], ["mixamorigspine1", "x", depth * 0.018], ["mixamorigspine2", "x", depth * 0.018], ["mixamorigleftshoulder", "z", -depth * 0.035], ["mixamorigrightshoulder", "z", depth * 0.035], ["mixamorigleftforearm", "z", -depth * 0.025], ["mixamorigrightforearm", "z", depth * 0.025]].forEach(([name, axis, target]) => {
        const bone = jointRig[name];
        if (bone) bone.rotation[axis] = THREE.MathUtils.lerp(bone.rotation[axis], target, 0.08);
      });
    } else if (group.current) {
      const motion = Math.sin(progress * Math.PI * 2);
      const half = progress * 2 * Math.PI;
      const profiles = {
        "Pull-ups": { y: 0.12 * (0.5 - motion * 0.5) }, "Table rows": { y: 0.025 * motion, z: -0.04 * motion }, "Chair dips": { y: -0.04 * motion, x: 0.02 * motion }, "Split squats": { y: -0.08 * (0.5 - Math.cos(half) * 0.5), z: -0.04 * motion }, "Plank": { z: 0.015 * motion }, "Bench Press": { y: -0.025 * motion, z: 0.015 * motion }, "Bicep Curls": { y: -0.02 * motion }, "Tricep Extensions": { z: -0.018 * motion }, "Shoulder Press": { y: 0.04 * (0.5 - Math.cos(half) * 0.5) }, "Lateral Raises": { y: 0.02 * motion, z: 0.06 * motion }, "Squats": { y: -0.10 * (0.5 - Math.cos(half) * 0.5), x: 0.025 * motion }, "Lunges": { y: -0.07 * (0.5 - Math.cos(half) * 0.5), z: 0.06 * motion }, "Deadlifts": { y: -0.04 * motion, x: -0.025 * motion }, "Calf Raises": { y: 0.05 * (0.5 - Math.cos(half) * 0.5) }, "Leg Extensions": { z: 0.03 * motion }, "Crunches": { y: 0.03 * (0.5 - Math.cos(half) * 0.5), x: -0.06 * motion }, "Leg Raises": { y: 0.02 * motion, z: 0.05 * motion }, "Russian Twists": { yRotation: 0.12 * motion },
      };
      const pose = profiles[exercise] || {};
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, pose.y || 0, 0.12);
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, pose.x || 0, 0.12);
      group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, pose.z || 0, 0.12);
      if (pose.yRotation !== undefined) group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, pose.yRotation, 0.12);
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
        const boneColors = { primary: new THREE.Color(palette.primary), secondary: new THREE.Color(palette.secondary), stabilizing: new THREE.Color(palette.stabilizing), neutral: new THREE.Color(palette.neutral) };
        for (let vertex = 0; vertex < child.geometry.attributes.position.count; vertex += 1) {
          let strongestBone = 0; let strongestWeight = 0;
          for (let lane = 0; lane < 4; lane += 1) { const weight = skinWeight.getComponent(vertex, lane); if (weight > strongestWeight) { strongestWeight = weight; strongestBone = skinIndex.getComponent(vertex, lane); } }
          const boneName = boneNames[strongestBone] || "";
          let groupColor = boneColors.neutral;
          if (/chest|spine2|shoulder/.test(boneName)) groupColor = boneColors.primary;
          if (/arm|forearm/.test(boneName)) groupColor = boneColors.secondary;
          if (/spine|hips|upleg|leg|foot|toe/.test(boneName) && !/spine2/.test(boneName)) groupColor = boneColors.stabilizing;
          if (/hand|thumb|index|middle|ring|pinky/.test(boneName)) groupColor = boneColors.neutral;
          if (isolationMode && selectedMuscle) {
            const selectedRegion = selectedMuscle === "chest" ? /chest|spine2/ : selectedMuscle === "triceps" ? /arm|forearm/ : selectedMuscle === "shoulders" ? /shoulder/ : selectedMuscle === "core" ? /spine|hips/ : selectedMuscle === "back" ? /spine|back/ : /upleg|leg|foot|toe/;
            groupColor = selectedRegion.test(boneName) ? boneColors.primary.clone().lerp(new THREE.Color("#ffffff"), 0.18) : boneColors.neutral.clone().multiplyScalar(0.38);
          }
          vertexColors[vertex * 3] = groupColor.r; vertexColors[vertex * 3 + 1] = groupColor.g; vertexColors[vertex * 3 + 2] = groupColor.b;
        }
        child.geometry.setAttribute("color", new THREE.BufferAttribute(vertexColors, 3));
      }
      child.material = new THREE.MeshPhysicalMaterial({ map: null, vertexColors: !!child.geometry.attributes.color, roughness: 0.52, metalness: 0, clearcoat: 0.08, clearcoatRoughness: 0.7, emissive: new THREE.Color(musclesVisible ? palette.primary : "#000000"), emissiveIntensity: musclesVisible ? 0.12 : 0, transparent: isolationMode && selectedMuscle, opacity: isolationMode && selectedMuscle ? 0.62 : 1 });
      child.castShadow = true; child.receiveShadow = true;
    });
    scene.updateMatrixWorld(true);
    const originalBox = new THREE.Box3().setFromObject(scene);
    const originalSize = originalBox.getSize(new THREE.Vector3());
    scene.position.sub(originalBox.getCenter(new THREE.Vector3()));
    scene.scale.setScalar(2 / Math.max(originalSize.x, originalSize.y, originalSize.z));
    scene.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(scene);
    scene.position.y += -0.74 - scaledBox.min.y;
  }, [scene, exercise, musclesVisible, selectedMuscle, isolationMode, palette]);

  return <primitive ref={group} object={scene} position={[0, 0, 0]} />;
}

