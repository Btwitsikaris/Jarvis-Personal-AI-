import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  compact?: boolean;
  active?: boolean;
  background?: boolean;
};

const liquidVertex = `
varying vec2 vUv;
varying float vWave;
uniform float uTime;
uniform vec2 uPointer;

void main() {
  vUv = uv;
  vec3 p = position;
  float edge = smoothstep(0.0, 0.32, uv.y) * smoothstep(1.0, 0.68, uv.y);
  float waveA = sin(p.x * 2.0 + uTime * 0.65) * 0.12;
  float waveB = sin(p.x * 5.4 - uTime * 0.9 + p.y * 2.0) * 0.035;
  float hover = exp(-pow((p.x - uPointer.x * 3.8) * 0.75, 2.0) - pow((p.y - uPointer.y * 0.8) * 2.0, 2.0));
  p.z += (waveA + waveB) * edge + hover * 0.38;
  p.y += sin(p.x * 1.25 + uTime * 0.42) * 0.06 * edge + hover * 0.10;
  vWave = waveA + waveB + hover;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const liquidFragment = `
varying vec2 vUv;
varying float vWave;
uniform float uTime;
uniform vec2 uPointer;

void main() {
  vec2 p = vUv - 0.5;
  float edge = smoothstep(0.50, 0.24, abs(p.y));
  float sheen = pow(max(0.0, 1.0 - abs(p.y) * 2.0), 2.5);
  float flow = 0.5 + 0.5 * sin(vUv.x * 18.0 + vUv.y * 6.0 + uTime * 0.75 + vWave * 8.0);
  float highlight = smoothstep(0.74, 1.0, flow) * sheen;
  float pointerGlow = exp(-length((vUv - vec2(0.5 + uPointer.x * 0.16, 0.52 + uPointer.y * 0.08)) * vec2(2.0, 3.0)) * 5.0);
  vec3 base = vec3(0.012, 0.015, 0.018);
  vec3 silver = vec3(0.70, 0.75, 0.78);
  vec3 color = mix(base, silver, highlight * 0.30 + pointerGlow * 0.09);
  float alpha = edge * (0.74 + sheen * 0.14 + highlight * 0.22);
  gl_FragColor = vec4(color, alpha);
}
`;

const particleVertex = `
attribute float aSize;
attribute float aSeed;
varying float vAlpha;
uniform float uTime;
uniform vec2 uPointer;

void main() {
  vec3 p = position;
  float seed = aSeed;
  float radius = length(p.xz);
  float swirl = uTime * (0.10 + seed * 0.025) + radius * 0.18;
  float cs = cos(swirl), sn = sin(swirl);
  p.xz = mat2(cs, -sn, sn, cs) * p.xz;
  p.y += sin(uTime * (0.45 + seed * 0.08) + seed * 9.0 + radius) * 0.10;

  vec2 pointer = uPointer * 4.5;
  vec2 delta = pointer - p.xy;
  float dist = length(delta);
  float influence = exp(-dist * 0.85);
  p.xy += normalize(delta + vec2(0.0001)) * influence * 0.42;
  p.z += influence * 0.55;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = aSize * (95.0 / max(1.0, -mvPosition.z));
  vAlpha = (0.26 + 0.50 * influence) * (0.65 + 0.35 * sin(seed * 12.0 + uTime * 1.7));
}
`;

const particleFragment = `
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float alpha = smoothstep(0.50, 0.03, d) * vAlpha;
  vec3 c = vec3(0.78, 0.82, 0.84);
  gl_FragColor = vec4(c, alpha);
}
`;

export default function JarvisThreeScene({ compact = false, active = true, background = false }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(background ? 34 : 38, 1, 0.1, 100);
    camera.position.set(0, background ? 0.15 : 0.15, background ? 9.5 : compact ? 6.7 : 7.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, background ? 1.45 : 1.7));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    const onPointer = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      pointer.tx = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
      pointer.ty = THREE.MathUtils.clamp(-((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
    };
    mount.addEventListener("pointermove", onPointer, { passive: true });
    mount.addEventListener("pointerleave", () => { pointer.tx = 0; pointer.ty = 0; }, { passive: true });

    let raf = 0;
    let t = 0;

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    if (background) {
      // Landing-page scene: original real-time liquid sculpture inspired by the
      // interaction language of premium WebGL sites. It uses only Three.js,
      // custom shaders and procedural geometry — no external assets.
      const root = new THREE.Group();
      scene.add(root);

      const pointerVec = new THREE.Vector2();

      // Large deforming liquid forms.
      const blobVertex = `
        varying vec3 vNormal;
        varying float vDisplace;
        uniform float uTime;
        uniform vec2 uPointer;
        float wave(vec3 p) {
          return sin(p.x * 2.7 + uTime * 0.55)
            + 0.55 * sin(p.y * 4.1 - uTime * 0.8)
            + 0.35 * sin(p.z * 5.2 + p.x * 2.0 + uTime * 0.65);
        }
        void main() {
          vec3 p = position;
          float w = wave(normalize(p) * 1.4);
          vec3 n = normalize(normal);
          float hover = exp(-length((p.xy - vec2(uPointer.x * 1.6, uPointer.y * 0.9))) * 1.35);
          p += n * (w * 0.17 + hover * 0.24);
          p.x += sin(p.y * 2.5 + uTime * 0.55) * 0.10;
          p.y += cos(p.x * 2.2 - uTime * 0.42) * 0.07;
          vDisplace = w + hover;
          vNormal = normalize(normalMatrix * n);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `;
      const blobFragment = `
        varying vec3 vNormal;
        varying float vDisplace;
        uniform float uTime;
        void main() {
          vec3 lightDir = normalize(vec3(-0.45, 0.72, 1.0));
          float light = max(0.0, dot(normalize(vNormal), lightDir));
          float rim = pow(1.0 - max(0.0, vNormal.z), 2.2);
          float shimmer = 0.5 + 0.5 * sin(vDisplace * 7.0 + uTime * 1.2);
          vec3 dark = vec3(0.018, 0.021, 0.024);
          vec3 silver = vec3(0.82, 0.86, 0.88);
          vec3 color = mix(dark, silver, light * 0.92 + rim * 0.35 + shimmer * 0.06);
          gl_FragColor = vec4(color, 0.90);
        }
      `;

      const blobMaterial = new THREE.ShaderMaterial({
        vertexShader: blobVertex,
        fragmentShader: blobFragment,
        uniforms: { uTime: { value: 0 }, uPointer: { value: pointerVec } },
        transparent: true,
        side: THREE.DoubleSide,
      });
      const blobGeometry = new THREE.IcosahedronGeometry(2.05, 6);
      const blob = new THREE.Mesh(blobGeometry, blobMaterial);
      blob.scale.set(1.65, 0.72, 0.62);
      blob.position.set(0, -0.15, 0.35);
      root.add(blob);

      const blob2 = new THREE.Mesh(blobGeometry.clone(), blobMaterial.clone());
      (blob2.material as THREE.ShaderMaterial).uniforms.uTime.value = 0;
      blob2.scale.set(1.05, 0.48, 0.42);
      blob2.position.set(-1.05, 0.38, 0.62);
      blob2.rotation.z = -0.32;
      root.add(blob2);

      // Curved 3D liquid tubes crossing the central form.
      const tubeVertex = `
        varying vec2 vUv;
        varying vec3 vNormal;
        uniform float uTime;
        void main() {
          vUv = uv;
          vec3 p = position;
          float wave = sin(p.x * 2.0 + uTime * 0.7) * 0.055 + sin(p.y * 4.0 - uTime * 0.55) * 0.028;
          p += normal * wave;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `;
      const tubeFragment = `
        varying vec2 vUv;
        varying vec3 vNormal;
        uniform float uTime;
        void main() {
          float light = max(0.0, dot(normalize(vNormal), normalize(vec3(-0.5, 0.65, 1.0))));
          float band = 0.5 + 0.5 * sin(vUv.x * 18.0 + uTime * 1.1);
          vec3 c = mix(vec3(0.035), vec3(0.72,0.76,0.79), light * 0.8 + band * 0.12);
          gl_FragColor = vec4(c, 0.52);
        }
      `;
      const tubeMat = new THREE.ShaderMaterial({
        vertexShader: tubeVertex,
        fragmentShader: tubeFragment,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const tubeCurves = [
        [new THREE.Vector3(-4.8, -0.2, 0.0), new THREE.Vector3(-2.3, 0.15, 0.3), new THREE.Vector3(0, -0.55, 0.55), new THREE.Vector3(2.5, 0.18, 0.25), new THREE.Vector3(4.8, -0.15, -0.1)],
        [new THREE.Vector3(-4.4, 0.55, -0.25), new THREE.Vector3(-2.0, 0.9, 0.1), new THREE.Vector3(0, 0.35, 0.6), new THREE.Vector3(2.2, 0.85, 0.25), new THREE.Vector3(4.5, 0.42, -0.15)],
      ];
      const tubes = tubeCurves.map((pts, i) => {
        const curve = new THREE.CatmullRomCurve3(pts);
        const geo = new THREE.TubeGeometry(curve, 140, i === 0 ? 0.28 : 0.16, 18, false);
        const mat = tubeMat.clone();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = i * 0.38 - 0.25;
        mesh.rotation.z = i === 0 ? -0.02 : 0.05;
        root.add(mesh);
        return { mesh, geo, mat };
      });

      // Dense volumetric particle cloud, with cursor attraction/repulsion.
      const count = 6200;
      const positions = new Float32Array(count * 3);
      const seeds = new Float32Array(count);
      const sizes = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
        const shell = Math.pow(Math.random(), 0.52);
        const radius = 2.2 + shell * 3.2;
        const x = Math.sin(phi) * Math.cos(theta) * radius * 0.95;
        const y = Math.cos(phi) * radius * 0.72 + 1.0;
        const z = Math.sin(phi) * Math.sin(theta) * radius * 0.42;
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        seeds[i] = Math.random();
        sizes[i] = 0.018 + Math.pow(Math.random(), 2.6) * 0.095;
      }
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      particleGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
      particleGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
      const particleVertex = `
        attribute float aSeed;
        attribute float aSize;
        varying float vAlpha;
        varying float vGlow;
        uniform float uTime;
        uniform vec2 uPointer;
        void main() {
          vec3 p = position;
          float s = aSeed;
          float radius = length(p.xz);
          float swirl = uTime * (0.16 + s * 0.10) + radius * 0.22;
          float cs = cos(swirl), sn = sin(swirl);
          p.xz = mat2(cs, -sn, sn, cs) * p.xz;
          p.y += sin(uTime * (0.28 + s * 0.16) + s * 18.0 + radius) * 0.16;
          p.x += sin(p.y * 1.7 + uTime * 0.45 + s * 10.0) * 0.14;
          vec2 target = uPointer * vec2(4.2, 2.7);
          vec2 d = target - p.xy;
          float influence = exp(-dot(d,d) * 0.16);
          p.xy += normalize(d + vec2(0.0001)) * influence * 0.42;
          p.z += influence * 0.55;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * (190.0 / max(1.0, -mv.z));
          vGlow = influence;
          vAlpha = (0.16 + 0.55 * influence) * (0.58 + 0.42 * sin(s * 22.0 + uTime * 1.7));
        }
      `;
      const particleFragment = `
        varying float vAlpha;
        varying float vGlow;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float soft = smoothstep(0.5, 0.02, d);
          float core = smoothstep(0.18, 0.0, d);
          vec3 c = mix(vec3(0.38,0.43,0.46), vec3(0.96), core * 0.72 + vGlow * 0.28);
          gl_FragColor = vec4(c, soft * vAlpha);
        }
      `;
      const particleMaterial = new THREE.ShaderMaterial({
        vertexShader: particleVertex,
        fragmentShader: particleFragment,
        uniforms: { uTime: { value: 0 }, uPointer: { value: pointerVec } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      root.add(particles);

      // A few larger floating droplets create the chunky 3D depth seen in the reference language.
      const dropletGroup = new THREE.Group();
      root.add(dropletGroup);
      const dropletGeo = new THREE.SphereGeometry(1, 20, 20);
      const dropletMat = new THREE.MeshStandardMaterial({ color: 0xbfc5c8, roughness: 0.24, metalness: 0.12, transparent: true, opacity: 0.68 });
      for (let i = 0; i < 36; i++) {
        const d = new THREE.Mesh(dropletGeo, dropletMat.clone());
        const a = Math.random() * Math.PI * 2;
        const r = 1.3 + Math.random() * 3.7;
        d.position.set(Math.cos(a) * r, 0.65 + Math.random() * 3.6, Math.sin(a) * r * 0.42);
        const sc = 0.035 + Math.pow(Math.random(), 1.7) * 0.22;
        d.scale.set(sc * (0.65 + Math.random()), sc * (0.65 + Math.random()), sc * (0.65 + Math.random()));
        dropletGroup.add(d);
      }

      const ambient = new THREE.HemisphereLight(0xffffff, 0x080808, 1.25);
      scene.add(ambient);
      const key = new THREE.DirectionalLight(0xffffff, 3.2);
      key.position.set(-3, 5, 6);
      scene.add(key);
      const fill = new THREE.PointLight(0xffffff, 2.5, 16);
      fill.position.set(2.5, 1.8, 4.5);
      scene.add(fill);

      const animate = () => {
        raf = requestAnimationFrame(animate);
        if (!reduced) t += active ? 0.009 : 0.004;
        pointer.x += (pointer.tx - pointer.x) * 0.045;
        pointer.y += (pointer.ty - pointer.y) * 0.045;
        pointerVec.set(pointer.x, pointer.y);

        root.rotation.y += (pointer.x * 0.13 - root.rotation.y) * 0.018;
        root.rotation.x += (-pointer.y * 0.07 - root.rotation.x) * 0.018;
        root.position.x += (pointer.x * 0.28 - root.position.x) * 0.022;
        root.position.y += (pointer.y * 0.16 - root.position.y) * 0.022;

        blob.rotation.z = Math.sin(t * 0.32) * 0.10;
        blob.rotation.y += 0.0018;
        blob2.rotation.y -= 0.0022;
        blob2.rotation.x = Math.sin(t * 0.45) * 0.07;
        blobMaterial.uniforms.uTime.value = t;
        (blob2.material as THREE.ShaderMaterial).uniforms.uTime.value = t + 1.7;
        (blob2.material as THREE.ShaderMaterial).uniforms.uPointer.value = pointerVec;
        blobMaterial.uniforms.uPointer.value = pointerVec;

        tubes.forEach((item, i) => {
          item.mesh.rotation.y = Math.sin(t * (0.18 + i * 0.04)) * 0.12;
          item.mesh.position.z = Math.sin(t * 0.35 + i) * 0.18;
          item.mat.uniforms.uTime.value = t + i * 1.2;
        });
        particleMaterial.uniforms.uTime.value = t;
        particleMaterial.uniforms.uPointer.value = pointerVec;
        particles.rotation.y += 0.0008;
        particles.rotation.x = Math.sin(t * 0.16) * 0.025;
        dropletGroup.rotation.y = t * 0.035;
        dropletGroup.rotation.x = Math.sin(t * 0.2) * 0.035;

        camera.position.x += (pointer.x * 0.42 - camera.position.x) * 0.018;
        camera.position.y += (0.2 + pointer.y * 0.22 - camera.position.y) * 0.018;
        camera.lookAt(0, 0.55, 0);
        renderer.render(scene, camera);
      };
      animate();

      return () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
        mount.removeEventListener("pointermove", onPointer);
        blobGeometry.dispose(); blobMaterial.dispose();
        blob2.geometry.dispose(); (blob2.material as THREE.Material).dispose();
        tubes.forEach((item) => { item.geo.dispose(); item.mat.dispose(); });
        tubeMat.dispose();
        particleGeometry.dispose(); particleMaterial.dispose();
        dropletGeo.dispose();
        dropletGroup.children.forEach((child: THREE.Object3D) => {
          const material = (child as THREE.Mesh).material;
          if (material) (material as THREE.Material).dispose();
        });
        dropletMat.dispose();
        renderer.dispose(); renderer.domElement.remove();
      };
    }

    // Compact / chat visual: keep the 3D neural core used by the chat experience.
    const root = new THREE.Group();
    scene.add(root);
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(compact ? 0.7 : 1.0, 3),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: compact ? 0.2 : 0.24 })
    );
    root.add(core);
    const inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(compact ? 0.46 : 0.68, 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.025, side: THREE.DoubleSide })
    );
    root.add(inner);
    const rings: THREE.Mesh[] = [];
    [1.35, 1.68, 2.02].forEach((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(compact ? radius * 0.62 : radius * 0.78, compact ? 0.008 : 0.012, 8, 180),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 - index * 0.014 })
      );
      ring.rotation.set(index * 0.64 + 0.55, index * 0.86, index * 0.3);
      root.add(ring); rings.push(ring);
    });
    const count = compact ? 180 : 520;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = (0.9 + Math.pow(Math.random(), 0.65) * 2.5) * (compact ? 0.62 : 0.78);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: compact ? 0.018 : 0.028, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    root.add(particles);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(compact ? 0.8 : 1.2, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.012, blending: THREE.AdditiveBlending }));
    root.add(halo);

    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (!reduced) t += active ? 0.008 : 0.003;
      pointer.x += (pointer.tx - pointer.x) * 0.035;
      pointer.y += (pointer.ty - pointer.y) * 0.035;
      root.rotation.y = t * 0.55 + pointer.x * 0.08;
      root.rotation.x = Math.sin(t * 0.35) * 0.05 + pointer.y * 0.045;
      core.rotation.x += 0.0018 * (active ? 1.8 : 0.6);
      core.rotation.y -= 0.0025 * (active ? 1.4 : 0.5);
      inner.rotation.x -= 0.0012; inner.rotation.z += 0.0016;
      halo.scale.setScalar(1 + Math.sin(t * 2.1) * (active ? 0.08 : 0.025));
      rings.forEach((ring, i) => { ring.rotation.x += (0.0008 + i * 0.0003) * (active ? 1.8 : 0.7); ring.rotation.z -= (0.0011 + i * 0.00025) * (active ? 1.3 : 0.6); });
      particles.rotation.y -= active ? 0.0017 : 0.0006;
      particleMaterial.opacity = active ? 0.52 + Math.sin(t * 2.4) * 0.1 : 0.34;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      mount.removeEventListener("pointermove", onPointer);
      particleGeometry.dispose(); particleMaterial.dispose();
      core.geometry.dispose(); (core.material as THREE.Material).dispose();
      inner.geometry.dispose(); (inner.material as THREE.Material).dispose();
      rings.forEach((ring) => { ring.geometry.dispose(); (ring.material as THREE.Material).dispose(); });
      halo.geometry.dispose(); (halo.material as THREE.Material).dispose();
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [compact, active, background]);

  return <div ref={mountRef} className={`jarvis-three-scene ${compact ? "compact" : ""}`} aria-hidden="true" />;
}
