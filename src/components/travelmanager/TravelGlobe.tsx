'use client';

import { useRef, useState, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// ─── Types ───

interface GlobeTrip {
  id: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
}

interface TravelGlobeProps {
  trips: GlobeTrip[];
}

// ─── Helpers ───

const EARTH_RADIUS = 2;

const STATUS_COLORS: Record<string, string> = {
  PLANNED: '#f59e0b',
  COMPLETED: '#22c55e',
  IN_PROGRESS: '#3b82f6',
  DRAFT: '#64748b',
  CANCELLED: '#ef4444',
};

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function createArc(start: THREE.Vector3, end: THREE.Vector3, radius: number): THREE.Vector3[] {
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  mid.normalize().multiplyScalar(radius * 1.5);
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  return curve.getPoints(50);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Earth ───

function Earth() {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const [earthMap, setEarthMap] = useState<THREE.Texture | null>(null);
  const [cloudsMap, setCloudsMap] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load('/textures/earth_daymap.jpg', setEarthMap, undefined, () => {});
    loader.load('/textures/earth_clouds.png', setCloudsMap, undefined, () => {});
  }, []);

  useFrame(() => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += 0.00002;
    }
  });

  return (
    <group>
      <mesh ref={earthRef}>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        {earthMap ? (
          <meshStandardMaterial map={earthMap} roughness={0.8} />
        ) : (
          <meshStandardMaterial color="#1a3a5c" roughness={0.8} />
        )}
      </mesh>
      {cloudsMap && (
        <mesh ref={cloudsRef}>
          <sphereGeometry args={[EARTH_RADIUS * 1.005, 48, 48]} />
          <meshStandardMaterial map={cloudsMap} transparent opacity={0.25} depthWrite={false} />
        </mesh>
      )}
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS * 1.04, 32, 32]} />
        <meshBasicMaterial color="#4da6ff" transparent opacity={0.04} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

// ─── Pin Marker ───

interface PinProps {
  trip: GlobeTrip;
  position: THREE.Vector3;
  onSelect: (trip: GlobeTrip | null) => void;
  isSelected: boolean;
}

function Pin({ trip, position, onSelect, isSelected }: PinProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = STATUS_COLORS[trip.status] || '#64748b';

  useFrame(() => {
    if (meshRef.current) {
      const scale = isSelected ? 1.4 : hovered ? 1.2 : 1;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => { e.stopPropagation(); onSelect(isSelected ? null : trip); }}
      >
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered || isSelected ? 0.8 : 0.4} />
      </mesh>
      {/* Glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 0.07, 32]} />
        <meshBasicMaterial color={color} transparent opacity={hovered || isSelected ? 0.6 : 0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Tooltip */}
      {(hovered || isSelected) && (
        <Html center style={{ pointerEvents: isSelected ? 'auto' : 'none' }} distanceFactor={5}>
          <div className="bg-slate-900/95 backdrop-blur border border-white/15 text-white px-3 py-2 rounded-lg shadow-xl min-w-[160px] -translate-y-8">
            <div className="font-semibold text-xs truncate max-w-[200px]">{trip.title}</div>
            {trip.destination && (
              <div className="text-[10px] text-white/60 mt-0.5">{trip.destination}</div>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] text-white/70">{trip.status.replace('_', ' ')}</span>
            </div>
            {(trip.startDate || trip.endDate) && (
              <div className="text-[10px] text-white/50 mt-1">
                {formatDate(trip.startDate)}
                {trip.endDate && ` - ${formatDate(trip.endDate)}`}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Arcs ───

interface ArcsProps {
  trips: GlobeTrip[];
}

function ArcLine({ points }: { points: THREE.Vector3[] }) {
  const lineRef = useRef<THREE.Line>(null);

  useEffect(() => {
    if (lineRef.current) {
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      lineRef.current.geometry = geometry;
    }
  }, [points]);

  return (
    <primitive
      ref={lineRef}
      object={new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.4 })
      )}
    />
  );
}

function Arcs({ trips }: ArcsProps) {
  const arcs = useMemo(() => {
    const geoTrips = trips
      .filter(t => t.latitude !== null && t.longitude !== null)
      .sort((a, b) => {
        if (!a.startDate || !b.startDate) return 0;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });

    const result: { points: THREE.Vector3[]; key: string }[] = [];
    for (let i = 0; i < geoTrips.length - 1; i++) {
      const a = geoTrips[i];
      const b = geoTrips[i + 1];
      const start = latLngToVector3(a.latitude!, a.longitude!, EARTH_RADIUS * 1.01);
      const end = latLngToVector3(b.latitude!, b.longitude!, EARTH_RADIUS * 1.01);
      result.push({
        points: createArc(start, end, EARTH_RADIUS),
        key: `${a.id}-${b.id}`,
      });
    }
    return result;
  }, [trips]);

  return (
    <>
      {arcs.map(arc => (
        <ArcLine key={arc.key} points={arc.points} />
      ))}
    </>
  );
}

// ─── Scene ───

interface SceneProps {
  trips: GlobeTrip[];
}

function Scene({ trips }: SceneProps) {
  const [selectedTrip, setSelectedTrip] = useState<GlobeTrip | null>(null);

  const geoTrips = useMemo(
    () => trips.filter(t => t.latitude !== null && t.longitude !== null),
    [trips]
  );

  const pinPositions = useMemo(
    () => geoTrips.map(t => ({
      trip: t,
      position: latLngToVector3(t.latitude!, t.longitude!, EARTH_RADIUS * 1.02),
    })),
    [geoTrips]
  );

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
      <directionalLight position={[-5, -1, -3]} intensity={0.3} />

      <Earth />

      {pinPositions.map(({ trip, position }) => (
        <Pin
          key={trip.id}
          trip={trip}
          position={position}
          onSelect={setSelectedTrip}
          isSelected={selectedTrip?.id === trip.id}
        />
      ))}

      <Arcs trips={geoTrips} />

      <OrbitControls
        enableZoom
        enablePan={false}
        minDistance={2.8}
        maxDistance={8}
      />
    </>
  );
}

// ─── Main Component ───

export function TravelGlobe({ trips }: TravelGlobeProps) {
  return (
    <Canvas
      camera={{ position: [0, 1.5, 4.5], fov: 45 }}
      style={{ background: 'linear-gradient(to bottom, #0f172a, #020617)' }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <Scene trips={trips} />
      </Suspense>
    </Canvas>
  );
}
