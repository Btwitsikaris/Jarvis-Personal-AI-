import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * "Signal Horizon" — landing background for Jarvis.
 *
 * A silver-on-black scene made only of procedural geometry + custom shaders:
 *  1. A receding point-field terrain that behaves like a voice waveform / sonar sea.
 *     The cursor sends ripples through it.
 *  2. A neural constellation of drifting nodes, links and travelling signal pulses.
 *  3. Rising data motes that drift up out of the terrain.
 *  4. Scroll parallax: scrolling the page dives the camera toward the horizon.
 */
export default function LandingBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 800px)").matches;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.045);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
    camera.position.set(0, 2.4, 11);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setClearColor(0x000000, 1);
    mount.appendChild(renderer.domElement);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const ripple = { x: 0, z: 0, tx: 0, tz: 0, strength: 0 };
    const onPointer = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = -((e.clientY / window.innerHeight - 0.5) * 2);
      // map the cursor onto the terrain plane (rough, but feels right)
      ripple.tx = pointer.tx * 14;
      ripple.tz = -2 - (1 - (pointer.ty * 0.5 + 0.5)) * 18;
      ripple.strength = 1;
    };
    const onLeave = () => { pointer.tx = 0; pointer.ty = 0; };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });

    let scrollY = 0;
    let scrollSmooth = 0;
    const onScroll = () => { scrollY = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });

    /* ---------------------------------------------------------------- */
    /* 1. Terrain of points                                              */
    /* ---------------------------------------------------------------- */
    const cols = isMobile ? 120 : 220;
    const rows = isMobile ? 70 : 120;
    const width = 46;
    const depth = 52;
    const tPos = new Float32Array(cols * rows * 3);
    const tSeed = new Float32Array(cols * rows);
    let k = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = c / (cols - 1);
        const v = r / (rows - 1);
        // tighter spacing toward the horizon for a nicer perspective density
        const z = -Math.pow(v, 1.35) * depth + 6;
        tPos[k * 3] = (u - 0.5) * width + (Math.random() - 0.5) * 0.08;
        tPos[k * 3 + 1] = 0;
        tPos[k * 3 + 2] = z + (Math.random() - 0.5) * 0.08;
        tSeed[k] = Math.random();
        k++;
      }
    }
    const terrainGeo = new THREE.BufferGeometry();
    terrainGeo.setAttribute("position", new THREE.BufferAttribute(tPos, 3));
    terrainGeo.setAttribute("aSeed", new THREE.BufferAttribute(tSeed, 1));

    const terrainMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uRipple: { value: new THREE.Vector3() },
        uPx: { value: renderer.getPixelRatio() },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform vec3 uRipple;   // x, z, strength
        uniform float uPx;
        varying float vAlpha;
        varying float vLift;

        void main() {
          vec3 p = position;

          // layered "voice" waves: long swells + fast fine ridges
          float swell = sin(p.x * 0.22 + uTime * 0.5) * 0.9
                      + sin(p.z * 0.30 - uTime * 0.7) * 0.7;
          float ridge = sin(p.x * 0.9 + p.z * 0.55 + uTime * 1.2) * 0.22
                      + sin(p.x * 1.7 - p.z * 0.8 - uTime * 0.9) * 0.12;
          // a calm channel down the middle so the hero text stays readable
          float channel = smoothstep(0.0, 9.0, abs(p.x));
          float h = (swell * 0.55 + ridge) * (0.25 + 0.75 * channel);

          // cursor ripple: concentric rings expanding outward
          float d = distance(p.xz, uRipple.xy);
          float ring = sin(d * 2.2 - uTime * 4.0) * exp(-d * 0.38) * uRipple.z;
          h += ring * 0.85;

          p.y = h - 3.2;

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float size = (0.9 + aSeed * 1.6) * uPx;
          gl_PointSize = size * (26.0 / max(1.0, -mv.z));

          float fade = smoothstep(58.0, 8.0, -mv.z);
          vLift = clamp(h * 0.9 + 0.35, 0.0, 1.0);
          vAlpha = fade * (0.28 + vLift * 0.7) * (0.6 + 0.4 * sin(aSeed * 40.0 + uTime * 1.3));
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        varying float vLift;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float a = smoothstep(0.5, 0.05, d) * vAlpha;
          vec3 base = vec3(0.50, 0.55, 0.60);
          vec3 hi = vec3(0.96, 0.98, 1.0);
          gl_FragColor = vec4(mix(base, hi, vLift), a);
        }
      `,
    });
    const terrain = new THREE.Points(terrainGeo, terrainMat);
    scene.add(terrain);

    /* ---------------------------------------------------------------- */
    /* 2. Neural constellation: drifting nodes, links and signal pulses  */
    /* ---------------------------------------------------------------- */
    const net = new THREE.Group();
    scene.add(net);

    const nodeCount = isMobile ? 46 : 86;
    const base: THREE.Vector3[] = [];
    while (base.length < nodeCount) {
      const x = (Math.random() - 0.5) * 34;
      const y = Math.random() * 9.5 - 0.8;
      const z = -5 - Math.random() * 19;
      // keep most nodes away from the centre so the headline stays clean
      if (Math.abs(x) < 5.5 && y > 0.2 && y < 7 && Math.random() < 0.88) continue;
      base.push(new THREE.Vector3(x, y, z));
    }
    const phase = base.map(() => new THREE.Vector3(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28));
    const cur = base.map((v) => v.clone());

    // links between near neighbours (max 3 each so it reads as a clean graph)
    const edges: [number, number][] = [];
    const degree = new Array(nodeCount).fill(0);
    const maxLink = isMobile ? 7.5 : 6.2;
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        if (degree[i] >= 3 || degree[j] >= 3) continue;
        if (base[i].distanceTo(base[j]) < maxLink) {
          edges.push([i, j]);
          degree[i]++; degree[j]++;
        }
      }
    }

    // nodes
    const nodePos = new Float32Array(nodeCount * 3);
    const nodeSeed = new Float32Array(nodeCount);
    for (let i = 0; i < nodeCount; i++) nodeSeed[i] = Math.random();
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodePos, 3));
    nodeGeo.setAttribute("aSeed", new THREE.BufferAttribute(nodeSeed, 1));
    const pointerW = new THREE.Vector3(0, 2.5, -14);
    const nodeMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPointer: { value: pointerW },
        uPx: { value: renderer.getPixelRatio() },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform vec3 uPointer;
        uniform float uPx;
        varying float vAlpha;
        varying float vGlow;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          vec2 dv = position.xy - uPointer.xy;
          float glow = exp(-dot(dv, dv) * 0.045);
          float twinkle = 0.7 + 0.3 * sin(uTime * 1.4 + aSeed * 40.0);
          gl_PointSize = (4.0 + aSeed * 5.0 + glow * 9.0) * uPx * (26.0 / max(1.0, -mv.z));
          vGlow = glow;
          vAlpha = smoothstep(46.0, 8.0, -mv.z) * (0.45 + glow * 0.55) * twinkle;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        varying float vGlow;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float halo = smoothstep(0.5, 0.1, d) * 0.35;
          float core = smoothstep(0.17, 0.0, d);
          vec3 c = mix(vec3(0.62, 0.68, 0.74), vec3(1.0), core + vGlow * 0.4);
          gl_FragColor = vec4(c, (halo + core) * vAlpha);
        }
      `,
    });
    const nodes = new THREE.Points(nodeGeo, nodeMat);
    net.add(nodes);

    // links
    const linkPos = new Float32Array(edges.length * 6);
    const linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute("position", new THREE.BufferAttribute(linkPos, 3));
    const linkMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uPointer: { value: pointerW } },
      vertexShader: /* glsl */ `
        uniform vec3 uPointer;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          vec2 dv = position.xy - uPointer.xy;
          float glow = exp(-dot(dv, dv) * 0.04);
          vAlpha = smoothstep(46.0, 8.0, -mv.z) * (0.10 + glow * 0.45);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() { gl_FragColor = vec4(vec3(0.78, 0.84, 0.9), vAlpha); }
      `,
    });
    const links = new THREE.LineSegments(linkGeo, linkMat);
    net.add(links);

    // signal pulses travelling along the links
    const pulseCount = Math.min(edges.length, isMobile ? 14 : 30);
    const pulses = Array.from({ length: pulseCount }, () => ({
      e: Math.floor(Math.random() * edges.length),
      t: Math.random(),
      speed: 0.18 + Math.random() * 0.35,
    }));
    const pulsePos = new Float32Array(pulseCount * 3);
    const pulseGeo = new THREE.BufferGeometry();
    pulseGeo.setAttribute("position", new THREE.BufferAttribute(pulsePos, 3));
    const pulseMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uPx: { value: renderer.getPixelRatio() } },
      vertexShader: /* glsl */ `
        uniform float uPx;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = 7.0 * uPx * (26.0 / max(1.0, -mv.z));
          vAlpha = smoothstep(46.0, 8.0, -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vec3(1.0), a * a * vAlpha);
        }
      `,
    });
    const pulsePoints = new THREE.Points(pulseGeo, pulseMat);
    net.add(pulsePoints);

    const updateNetwork = (time: number, dt: number) => {
      for (let i = 0; i < nodeCount; i++) {
        const b = base[i], ph = phase[i], c = cur[i];
        c.set(
          b.x + Math.sin(time * 0.30 + ph.x) * 0.55,
          b.y + Math.sin(time * 0.25 + ph.y) * 0.45,
          b.z + Math.sin(time * 0.20 + ph.z) * 0.55
        );
        nodePos[i * 3] = c.x; nodePos[i * 3 + 1] = c.y; nodePos[i * 3 + 2] = c.z;
      }
      for (let e = 0; e < edges.length; e++) {
        const a = cur[edges[e][0]], b = cur[edges[e][1]];
        linkPos.set([a.x, a.y, a.z, b.x, b.y, b.z], e * 6);
      }
      for (let i = 0; i < pulseCount; i++) {
        const p = pulses[i];
        p.t += p.speed * dt;
        if (p.t >= 1) { p.t = 0; p.e = Math.floor(Math.random() * edges.length); }
        const a = cur[edges[p.e][0]], b = cur[edges[p.e][1]];
        pulsePos[i * 3] = a.x + (b.x - a.x) * p.t;
        pulsePos[i * 3 + 1] = a.y + (b.y - a.y) * p.t;
        pulsePos[i * 3 + 2] = a.z + (b.z - a.z) * p.t;
      }
      nodeGeo.attributes.position.needsUpdate = true;
      linkGeo.attributes.position.needsUpdate = true;
      pulseGeo.attributes.position.needsUpdate = true;
    };
    updateNetwork(0, 0);

    /* ---------------------------------------------------------------- */
    /* 3. Rising data motes                                              */
    /* ---------------------------------------------------------------- */
    const moteCount = isMobile ? 260 : 620;
    const mPos = new Float32Array(moteCount * 3);
    const mSeed = new Float32Array(moteCount);
    for (let i = 0; i < moteCount; i++) {
      mPos[i * 3] = (Math.random() - 0.5) * 34;
      mPos[i * 3 + 1] = Math.random() * 14;
      mPos[i * 3 + 2] = -Math.random() * 34 + 4;
      mSeed[i] = Math.random();
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(mPos, 3));
    moteGeo.setAttribute("aSeed", new THREE.BufferAttribute(mSeed, 1));
    const moteMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform float uPx;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float life = fract(p.y / 14.0 + uTime * (0.015 + aSeed * 0.03));
          p.y = life * 14.0 - 3.0;
          p.x += sin(uTime * 0.4 + aSeed * 30.0 + p.y * 0.4) * 0.5;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.2 + aSeed * 2.4) * uPx * (22.0 / max(1.0, -mv.z));
          vAlpha = sin(life * 3.14159) * smoothstep(48.0, 6.0, -mv.z) * (0.25 + aSeed * 0.55);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vAlpha;
          gl_FragColor = vec4(vec3(0.92, 0.96, 1.0), a);
        }
      `,
    });
    const motes = new THREE.Points(moteGeo, moteMat);
    scene.add(motes);

    /* ---------------------------------------------------------------- */
    /* Loop                                                              */
    /* ---------------------------------------------------------------- */
    const resize = () => {
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 0.8 ? 62 : 50; // wider FOV on portrait phones
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let raf = 0;
    let t = 0;
    let last = performance.now();
    let running = true;

    const animate = (now: number) => {
      raf = requestAnimationFrame(animate);
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduced) t += dt;

      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      ripple.x += (ripple.tx - ripple.x) * 0.12;
      ripple.z += (ripple.tz - ripple.z) * 0.12;
      ripple.strength *= 0.985;
      scrollSmooth += (scrollY - scrollSmooth) * 0.06;

      terrainMat.uniforms.uTime.value = t;
      terrainMat.uniforms.uRipple.value.set(ripple.x, ripple.z, ripple.strength);
      moteMat.uniforms.uTime.value = t;

      pointerW.set(pointer.x * 13, 2.5 + pointer.y * 4.5, -14);
      nodeMat.uniforms.uTime.value = t;
      updateNetwork(t, reduced ? 0 : dt);

      // camera: pointer parallax + scroll dive toward the horizon
      const dive = Math.min(scrollSmooth / 900, 1);
      camera.position.x = pointer.x * 0.9;
      camera.position.y = 2.4 + pointer.y * 0.45 - dive * 1.1;
      camera.position.z = 11 - dive * 6;
      camera.lookAt(pointer.x * 0.6, 1.6 + dive * 0.8, -14);

      net.rotation.y = pointer.x * 0.07;
      net.rotation.x = -pointer.y * 0.03;

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);

    const onVisibility = () => { running = !document.hidden; last = performance.now(); };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      terrainGeo.dispose(); terrainMat.dispose();
      moteGeo.dispose(); moteMat.dispose();
      nodeGeo.dispose(); nodeMat.dispose();
      linkGeo.dispose(); linkMat.dispose();
      pulseGeo.dispose(); pulseMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} className="landing-bg-canvas" aria-hidden="true" />;
}
