"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Living background for the hero: hand-written WebGL fragment shader
 * painting dappled sunlight — the moving shadow pattern a tree canopy
 * throws when sun filters through leaves. Two domain-warped noise layers
 * sway like branches in wind; where the "canopy" thins, warm gold light
 * pools. The foliage parts and brightens around the pointer. No three.js;
 * a fullscreen triangle and ~70 lines of GLSL keep it at zero bundle cost.
 *
 * Degrades to nothing (the CSS texture remains) when WebGL is missing,
 * and renders a single static frame under prefers-reduced-motion.
 */

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 aspect = vec2(u_res.x / u_res.y, 1.0);
  vec2 p = uv * aspect * 2.4;
  float t = u_time * 0.12;

  // Pointer in the same space (u_mouse arrives as 0–1 canvas UV)
  vec2 m = u_mouse * aspect * 2.4;
  float md = distance(p, m);

  // Foliage parts around the pointer: push the pattern radially outward.
  // Scales with the offset itself (no normalization) so there's no
  // singularity spike at the pointer position.
  vec2 part = (p - m) * smoothstep(0.9, 0.0, md) * 0.45;

  // Wind: slow sway plus a gentler counter-phase flutter
  vec2 sway = vec2(
    sin(t + p.y * 0.8) + 0.35 * sin(t * 2.3 + p.y * 2.1),
    cos(t * 0.8 + p.x * 0.7) + 0.35 * cos(t * 1.9 + p.x * 1.7)
  ) * 0.16;

  // Two canopy layers at different scales, drifting like high branches
  float c1 = fbm(p * 1.1 + sway + part + vec2(0.0, t * 0.05));
  float c2 = fbm(p * 2.4 - sway * 1.4 + part * 1.5 + vec2(t * 0.04, 0.0) + 4.7);
  float canopy = c1 * 0.62 + c2 * 0.38;

  // Mostly sunlit: shadow only where the canopy is dense, extra warmth
  // following the pointer
  float light = smoothstep(0.38, 0.72, canopy);
  light += smoothstep(0.7, 0.0, md) * 0.2;

  vec3 shade = vec3(0.918, 0.910, 0.868);  // sage-tinged leaf shadow
  vec3 cream = vec3(0.980, 0.965, 0.945);
  vec3 sun   = vec3(1.000, 0.972, 0.894);  // warm gold where sun breaks through

  vec3 col = mix(shade, cream, smoothstep(0.0, 0.55, light));
  col = mix(col, sun, smoothstep(0.55, 1.0, light));

  // Fine grain keeps it organic instead of airbrushed
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.012;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    // One triangle that covers the viewport
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uMouse = gl.getUniformLocation(program, "u_mouse");

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Pointer as canvas UV (0–1, y up to match gl_FragCoord); starts centered
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - rect.left) / rect.width;
      mouse.ty = 1 - (e.clientY - rect.top) / rect.height;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();

    let frame = 0;
    let visible = true;
    const start = performance.now();

    const draw = (now: number) => {
      mouse.x += (mouse.tx - mouse.x) * 0.07;
      mouse.y += (mouse.ty - mouse.y) * 0.07;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      draw(now);
      frame = requestAnimationFrame(loop);
    };

    setReady(true);

    if (reducedMotion) {
      draw(start);
    } else {
      // Only burn GPU while the hero is actually on screen
      const observer = new IntersectionObserver(([entry]) => {
        const shouldRun = entry.isIntersecting;
        if (shouldRun && !visible) frame = requestAnimationFrame(loop);
        if (!shouldRun && visible) cancelAnimationFrame(frame);
        visible = shouldRun;
      });
      observer.observe(canvas);
      frame = requestAnimationFrame(loop);
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("resize", resize);

      // No loseContext() here: getContext() would hand the same dead context
      // back on remount (StrictMode re-runs effects), silently no-op'ing all
      // GL calls. The context is reclaimed with the canvas element.
      return () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("resize", resize);
      };
    }

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ${
        ready ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
