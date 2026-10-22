"use client";

// The basin, in three dimensions, as an abstraction.
//
// Cultural-safety rules this component is built around:
//   · the terrain is synthetic. It is generated from a fixed sum of sines over the register's
//     own 12×8 zone grid — there is no basemap, no tiles, no projection and no real-world
//     coordinates anywhere in this file or in the data it renders;
//   · a place is drawn as a generalized zone: a soft disc covering whole grid cells, sized to
//     the cells it was recorded against. There are no pins, and no point a visitor could read
//     a location off;
//   · nothing drawn here imitates Aboriginal art. The palette is earth and the forms are
//     landform.
//
// Interaction is deliberate rather than flashy: slow idle drift, drag to look around, click a
// zone to select it. If WebGL is unavailable the caller falls back to the flat survey map.

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { COLS, ROWS, cellToIndex } from "@/lib/grid";

const CELL = 1;
const W = COLS.length * CELL;
const D = ROWS.length * CELL;

export interface BasinZone {
  id: string;
  publicRef: string;
  publicName: string;
  cells: string[];
  status: "WORKS_PROPOSED" | "UNDER_WATCH" | "QUIET" | string;
}

const ZONE_COLOR: Record<string, string> = {
  WORKS_PROPOSED: "#b4452c",
  UNDER_WATCH: "#b08a2c",
  QUIET: "#5d7a52",
};

/** Deterministic landform. Same every render, on every machine. */
function heightAt(x: number, z: number): number {
  const u = x / W;
  const v = z / D;
  return (
    0.95 * Math.sin(u * Math.PI * 1.15) * Math.cos(v * Math.PI * 0.85) +
    0.42 * Math.sin(u * 7.1 + 1.3) * Math.sin(v * 5.3 + 0.7) +
    0.22 * Math.sin(u * 13.7 + 2.1) * Math.cos(v * 11.3) +
    // a shallow trough across the middle: the watercourse the register refers to
    -0.55 * Math.exp(-Math.pow((v - 0.52 + 0.12 * Math.sin(u * 4.2)) * 7.5, 2))
  );
}

function Terrain() {
  const geometry = useMemo(() => {
    const segX = COLS.length * 6;
    const segZ = ROWS.length * 6;
    const geo = new THREE.PlaneGeometry(W, D, segX, segZ);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color("#8a5a33");
    const mid = new THREE.Color("#b4874f");
    const high = new THREE.Color("#d8c097");

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + W / 2;
      const z = pos.getZ(i) + D / 2;
      const h = heightAt(x, z);
      pos.setY(i, h);

      const t = THREE.MathUtils.clamp((h + 1.1) / 2.2, 0, 1);
      const c = t < 0.5 ? low.clone().lerp(mid, t * 2) : mid.clone().lerp(high, (t - 0.5) * 2);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
    </mesh>
  );
}

/** Faint grid lines, so a viewer can see that zones are cells and not coordinates. */
function ZoneGrid() {
  const geometry = useMemo(() => {
    const points: number[] = [];
    for (let c = 0; c <= COLS.length; c++) {
      for (let r = 0; r < ROWS.length * 6; r++) {
        const z0 = (r / (ROWS.length * 6)) * D;
        const z1 = ((r + 1) / (ROWS.length * 6)) * D;
        points.push(c * CELL - W / 2, heightAt(c * CELL, z0) + 0.02, z0 - D / 2);
        points.push(c * CELL - W / 2, heightAt(c * CELL, z1) + 0.02, z1 - D / 2);
      }
    }
    for (let r = 0; r <= ROWS.length; r++) {
      for (let c = 0; c < COLS.length * 6; c++) {
        const x0 = (c / (COLS.length * 6)) * W;
        const x1 = ((c + 1) / (COLS.length * 6)) * W;
        points.push(x0 - W / 2, heightAt(x0, r * CELL) + 0.02, r * CELL - D / 2);
        points.push(x1 - W / 2, heightAt(x1, r * CELL) + 0.02, r * CELL - D / 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#6b5236" transparent opacity={0.18} />
    </lineSegments>
  );
}

/** A soft radial disc, drawn from a generated texture so there is no hard outline. */
function useGlowTexture(): THREE.Texture | null {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,0.85)");
    g.addColorStop(0.55, "rgba(255,255,255,0.45)");
    g.addColorStop(0.82, "rgba(255,255,255,0.14)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function Zone({
  zone,
  selected,
  onSelect,
  glow,
}: {
  zone: BasinZone;
  selected: boolean;
  onSelect: (id: string) => void;
  glow: THREE.Texture | null;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);

  const { cx, cz, radius, top } = useMemo(() => {
    const idx = zone.cells.filter((c) => /^[A-L][1-8]$/.test(c)).map(cellToIndex);
    if (idx.length === 0) return { cx: 0, cz: 0, radius: 1, top: 0 };
    const xs = idx.map((i) => i.col + 0.5);
    const zs = idx.map((i) => i.row + 0.5);
    const cxLocal = xs.reduce((a, b) => a + b, 0) / xs.length;
    const czLocal = zs.reduce((a, b) => a + b, 0) / zs.length;
    const spread =
      Math.max(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...zs) - Math.min(...zs),
      ) / 2;
    // Generalized on purpose: never smaller than a cell and a half.
    const r = Math.max(1.5, spread + 1.2);
    let maxH = -Infinity;
    for (const i of idx) maxH = Math.max(maxH, heightAt(i.col + 0.5, i.row + 0.5));
    return { cx: cxLocal - W / 2, cz: czLocal - D / 2, radius: r, top: maxH };
  }, [zone.cells]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const base = selected ? 1.12 : hover ? 1.06 : 1;
    const breathe = selected ? 1 + Math.sin(t * 1.1) * 0.03 : 1;
    ref.current.scale.setScalar(base * breathe);
  });

  const color = ZONE_COLOR[zone.status] ?? "#6b6052";

  return (
    <group position={[cx, top + 0.35, cz]}>
      <mesh
        ref={ref}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(zone.id);
        }}
      >
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial
          color={color}
          map={glow ?? undefined}
          transparent
          opacity={selected ? 0.72 : hover ? 0.56 : 0.4}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* A thin ring, to read as an area rather than a point. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[radius * 0.96, radius, 64]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.75 : 0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Slow idle drift plus drag-to-look. No library, so there is nothing to fight. */
function Camera({ interactive }: { interactive: boolean }) {
  const { camera, gl } = useThree();
  const drag = useRef<{ x: number; y: number } | null>(null);
  const angle = useRef(-Math.PI / 2.35);
  const elev = useRef(0.62);
  const idle = useRef(true);

  useEffect(() => {
    if (!interactive) return;
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      drag.current = { x: e.clientX, y: e.clientY };
      idle.current = false;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      angle.current -= (e.clientX - drag.current.x) * 0.005;
      elev.current = THREE.MathUtils.clamp(elev.current + (e.clientY - drag.current.y) * 0.004, 0.22, 1.25);
      drag.current = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      drag.current = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl, interactive]);

  useFrame((_state, delta) => {
    if (idle.current) angle.current -= delta * 0.035;
    const r = 15.5;
    camera.position.set(
      Math.cos(angle.current) * r,
      6.2 + elev.current * 6,
      Math.sin(angle.current) * r,
    );
    camera.lookAt(0, -0.4, 0);
  });

  return null;
}

export function BasinMap({
  zones,
  selected,
  onSelect,
  height = 420,
}: {
  zones: BasinZone[];
  selected?: string;
  onSelect?: (id: string) => void;
  height?: number;
}) {
  const glow = useGlowTexture();
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="basin-fallback" style={{ height }}>
        This view needs WebGL, which this browser or machine is not providing. The flat survey
        map below shows the same generalized zones.
      </div>
    );
  }

  return (
    <div className="basin-wrap" style={{ height }}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 11, 15.5], fov: 42 }}
        onCreated={({ gl }) => {
          gl.setClearColor("#e9e2d4");
        }}
        onError={() => setFailed(true)}
      >
        {/* dawn light: low warm key, cool sky fill */}
        <hemisphereLight intensity={0.55} color="#f3e4c9" groundColor="#6b4a2c" />
        <directionalLight position={[-9, 9, 6]} intensity={1.15} color="#ffd9a6" />
        <directionalLight position={[8, 5, -7]} intensity={0.25} color="#9fb6c4" />
        <fog attach="fog" args={["#e9e2d4", 20, 44]} />

        <Terrain />
        <ZoneGrid />
        {zones.map((z) => (
          <Zone
            key={z.id}
            zone={z}
            glow={glow}
            selected={selected === z.id}
            onSelect={(id) => onSelect?.(id)}
          />
        ))}
        <Camera interactive />
      </Canvas>
      <div className="basin-note">
        Synthetic terrain · generalized zones · <strong>positions indicative only</strong> · drag to
        look, click a zone
      </div>
    </div>
  );
}
