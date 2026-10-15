"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Pause, Play, RotateCcw } from "lucide-react";
import { riskColor, VESSEL_META, type VesselKey } from "@/lib/constants";

export interface VesselRisk {
  probability: number | null;
  available: boolean;
}

/**
 * Schematic coronary tree (NOT a medically accurate reconstruction).
 * Main trunk + one named branch per vessel to give a recognisable 3D tree:
 *  LAD + diagonal branch, LCX + obtuse marginal, RCA + posterior descending.
 */
const VESSEL_PATHS: Record<VesselKey, { main: [number, number, number][]; branch: [number, number, number][] }> = {
  lad: {
    main: [
      [0.05, 1.02, 0.45],
      [-0.1, 0.72, 0.82],
      [-0.22, 0.28, 0.95],
      [-0.3, -0.18, 0.84],
      [-0.3, -0.62, 0.56],
      [-0.22, -1.04, 0.22],
    ],
    branch: [
      [-0.2, 0.38, 0.93],
      [-0.52, 0.12, 0.84],
      [-0.78, -0.22, 0.6],
    ],
  },
  lcx: {
    main: [
      [0.05, 1.02, 0.42],
      [-0.42, 0.8, 0.52],
      [-0.84, 0.4, 0.2],
      [-0.96, -0.08, -0.26],
      [-0.76, -0.52, -0.62],
      [-0.4, -0.8, -0.74],
    ],
    branch: [
      [-0.9, 0.18, 0.0],
      [-1.08, -0.18, 0.22],
      [-1.0, -0.56, 0.36],
    ],
  },
  rca: {
    main: [
      [0.2, 1.0, 0.3],
      [0.64, 0.76, 0.34],
      [0.92, 0.3, 0.12],
      [0.9, -0.2, -0.22],
      [0.62, -0.64, -0.52],
      [0.18, -0.88, -0.62],
    ],
    branch: [
      [0.52, -0.72, -0.56],
      [0.3, -0.96, -0.2],
      [0.12, -1.08, 0.1],
    ],
  },
};

function useTube(points: [number, number, number][], radius: number) {
  return useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return new THREE.TubeGeometry(curve, 48, radius, 10, false);
  }, [points, radius]);
}

function Vessel({
  vesselKey,
  risk,
  selected,
  onSelect,
}: {
  vesselKey: VesselKey;
  risk: VesselRisk;
  selected: boolean;
  onSelect: (v: VesselKey) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const matRefs = useRef<THREE.MeshStandardMaterial[]>([]);
  const color = risk.available ? riskColor(risk.probability) : "#64748b";
  const active = selected || hovered;
  const paths = VESSEL_PATHS[vesselKey];

  const mainGeom = useTube(paths.main, active ? 0.068 : 0.052);
  const branchGeom = useTube(paths.branch, active ? 0.045 : 0.034);
  const haloGeom = useTube(paths.main, 0.11);

  // Gentle emissive pulse on the selected vessel so it reads as "live" in 3D.
  useFrame(({ clock }) => {
    const base = selected ? 0.85 : hovered ? 0.55 : 0.2;
    const pulse = selected ? 0.25 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.2)) : 0;
    for (const m of matRefs.current) if (m) m.emissiveIntensity = base + pulse;
  });

  const handlers = {
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHovered(true);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      setHovered(false);
      document.body.style.cursor = "auto";
    },
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onSelect(vesselKey);
    },
  };

  return (
    <group>
      <mesh geometry={mainGeom} {...handlers}>
        <meshStandardMaterial
          ref={(m) => {
            if (m) matRefs.current[0] = m;
          }}
          color={color}
          emissive={color}
          emissiveIntensity={0.2}
          roughness={0.3}
          metalness={0.15}
        />
      </mesh>
      <mesh geometry={branchGeom} {...handlers}>
        <meshStandardMaterial
          ref={(m) => {
            if (m) matRefs.current[1] = m;
          }}
          color={color}
          emissive={color}
          emissiveIntensity={0.2}
          roughness={0.3}
          metalness={0.15}
        />
      </mesh>
      {/* Soft halo around the selected vessel for extra depth */}
      {selected && (
        <mesh geometry={haloGeom}>
          <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} />
        </mesh>
      )}
      
    </group>
  );
}

/** Schematic beating heart assembled from primitives (authored for this project). */
function HeartBody() {
  const beat = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!beat.current) return;
    // ~64 bpm two-phase beat: quick systolic contraction, slower relaxation.
    const t = (clock.elapsedTime * 1.07) % 1;
    const envelope = Math.exp(-6 * t) * Math.sin(Math.PI * Math.min(t * 3, 1));
    const s = 1 + 0.035 * envelope;
    beat.current.scale.setScalar(s);
  });

  return (
    <group ref={beat}>
      {/* left ventricle */}
      <mesh position={[-0.18, 0.08, 0]} scale={[0.8, 0.95, 0.74]}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial color="#8b2230" roughness={0.42} metalness={0.08} />
      </mesh>
      {/* right ventricle */}
      <mesh position={[0.44, 0.14, -0.04]} scale={[0.62, 0.78, 0.62]}>
        <sphereGeometry args={[1, 40, 28]} />
        <meshStandardMaterial color="#9b3340" roughness={0.45} metalness={0.06} />
      </mesh>
      {/* left atrium */}
      <mesh position={[-0.42, 0.92, -0.18]} scale={[0.42, 0.36, 0.4]}>
        <sphereGeometry args={[1, 28, 20]} />
        <meshStandardMaterial color="#a04452" roughness={0.5} />
      </mesh>
      {/* right atrium */}
      <mesh position={[0.6, 0.86, -0.1]} scale={[0.4, 0.36, 0.38]}>
        <sphereGeometry args={[1, 28, 20]} />
        <meshStandardMaterial color="#aa4d58" roughness={0.5} />
      </mesh>
      {/* apex */}
      <mesh position={[-0.22, -0.88, 0.04]} rotation={[Math.PI, 0, 0.14]} scale={[0.6, 0.66, 0.56]}>
        <coneGeometry args={[1, 1.25, 32]} />
        <meshStandardMaterial color="#7f1d2b" roughness={0.48} />
      </mesh>
      {/* aortic root + arch */}
      <mesh position={[0.1, 1.18, 0.08]} rotation={[0.08, 0, -0.1]}>
        <cylinderGeometry args={[0.2, 0.26, 0.7, 24]} />
        <meshStandardMaterial color="#b45f6a" roughness={0.45} />
      </mesh>
      <mesh position={[0.08, 1.52, 0.02]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.3, 0.17, 18, 28, Math.PI]} />
        <meshStandardMaterial color="#b45f6a" roughness={0.45} />
      </mesh>
      {/* pulmonary trunk */}
      <mesh position={[-0.28, 1.12, 0.3]} rotation={[0.3, 0, 0.35]}>
        <cylinderGeometry args={[0.14, 0.18, 0.6, 20]} />
        <meshStandardMaterial color="#5b7fb8" roughness={0.5} />
      </mesh>
      {/* superior vena cava */}
      <mesh position={[0.72, 1.3, -0.12]} rotation={[0, 0, -0.12]}>
        <cylinderGeometry args={[0.11, 0.13, 0.8, 18]} />
        <meshStandardMaterial color="#4f6fa8" roughness={0.55} />
      </mesh>
    </group>
  );
}

function Torso({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <group position={[0, -0.1, 0]}>
      <mesh scale={[2.35, 2.9, 1.5]}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshPhysicalMaterial color="#38bdf8" transparent opacity={0.06} roughness={0.2} transmission={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh scale={[2.35, 2.9, 1.5]}>
        <sphereGeometry args={[1, 18, 12]} />
        <meshBasicMaterial color="#5eead4" wireframe transparent opacity={0.07} depthWrite={false} />
      </mesh>
      <mesh position={[0, 2.95, 0]} scale={[0.62, 0.72, 0.62]}>
        <sphereGeometry args={[1, 20, 16]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.05} depthWrite={false} />
      </mesh>
      {/* shoulders hint */}
      <mesh position={[0, 1.9, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.8]}>
        <capsuleGeometry args={[0.5, 2.6, 8, 18]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.04} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Subtle ground disc + rings for spatial grounding while the scene rotates. */
function GroundStage() {
  return (
    <group position={[0, -2.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <circleGeometry args={[3.4, 64]} />
        <meshBasicMaterial color="#0c1626" transparent opacity={0.85} />
      </mesh>
      {[1.4, 2.2, 3.0].map((r) => (
        <mesh key={r}>
          <ringGeometry args={[r - 0.012, r, 96]} />
          <meshBasicMaterial color="#1e3a5f" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

export function Heart3D({
  risks,
  selected,
  onSelect,
  showTorso,
  height = 460,
}: {
  risks: Record<VesselKey, VesselRisk>;
  selected: VesselKey | null;
  onSelect: (v: VesselKey) => void;
  showTorso: boolean;
  height?: number;
}) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls> | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [interacting, setInteracting] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStart = () => {
    setInteracting(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  };
  const handleEnd = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    // resume the turntable a few seconds after the user lets go
    resumeTimer.current = setTimeout(() => setInteracting(false), 3000);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900" style={{ height }}>
      <Canvas camera={{ position: [1.6, 0.9, 5.0], fov: 42 }} dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: "default" }}>
        <color attach="background" args={["#060b16"]} />
        <fog attach="fog" args={["#060b16", 7.5, 14]} />

        {/* three-point lighting for stronger depth perception */}
        <hemisphereLight args={["#7dd3fc", "#0f172a", 0.5]} />
        <directionalLight position={[4, 6, 6]} intensity={1.25} color="#fff7ed" />
        <directionalLight position={[-6, 2, -4]} intensity={0.5} color="#38bdf8" />
        <directionalLight position={[0, -4, 2]} intensity={0.25} color="#f0abfc" />

        <Suspense fallback={null}>
          <group rotation={[0, 0.35, 0]}>
            <Torso visible={showTorso} />
            <HeartBody />
            {(Object.keys(VESSEL_META) as VesselKey[]).map((v) => (
              <Vessel key={v} vesselKey={v} risk={risks[v]} selected={selected === v} onSelect={onSelect} />
            ))}
          </group>
          <GroundStage />
        </Suspense>

        <OrbitControls
          ref={controls}
          enablePan={false}
          minDistance={2.6}
          maxDistance={9}
          minPolarAngle={0.35}
          maxPolarAngle={Math.PI - 0.5}
          enableDamping
          dampingFactor={0.08}
          autoRotate={autoRotate && !interacting}
          autoRotateSpeed={1.1}
          onStart={handleStart}
          onEnd={handleEnd}
        />
      </Canvas>

      <div className="absolute right-3 top-3 flex gap-2">
        <button
          onClick={() => setAutoRotate((v) => !v)}
          aria-pressed={autoRotate}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs backdrop-blur transition ${
            autoRotate
              ? "border-teal-400/60 bg-teal-400/10 text-teal-200"
              : "border-slate-700 bg-slate-900/80 text-slate-200 hover:border-teal-400/60 hover:text-teal-200"
          }`}
        >
          {autoRotate ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {autoRotate ? "Rotating" : "Rotate"}
        </button>
        <button
          onClick={() => controls.current?.reset()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-200 backdrop-blur hover:border-teal-400/60 hover:text-teal-200"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset camera
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-slate-700/70 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
        <p className="mb-1 font-medium text-slate-200">Legend — schematic coronary tree</p>
        {(Object.keys(VESSEL_META) as VesselKey[]).map((v) => (
          <p key={v} className="flex items-center gap-2">
            <span className="h-2 w-5 rounded-full" style={{ background: risks[v].available ? riskColor(risks[v].probability) : "#64748b" }} />
            {VESSEL_META[v].short} — {risks[v].available && risks[v].probability !== null ? `${(risks[v].probability * 100).toFixed(1)}%` : "unavailable"}
          </p>
        ))}
        <p className="mt-1 text-[10px] text-slate-500">Colour: teal &lt;34% · amber 34–66% · red ≥67%</p>
      </div>
    </div>
  );
}
