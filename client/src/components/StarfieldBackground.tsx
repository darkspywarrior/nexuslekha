import { useEffect, useRef } from "react";

export default function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2");
    if (!gl) {
      console.error("WebGL2 not supported");
      return;
    }

    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    };
    resize();
    window.addEventListener("resize", resize);

    // Shader source
    const vertexSrc = `#version 300 es
    precision highp float;
    in vec4 position;
    void main() { gl_Position = position; }`;

    const fragmentSrc = `#version 300 es
    precision highp float;
    out vec4 O;
    uniform float time;
    uniform vec2 resolution;
    uniform vec2 touch;
    uniform int pointerCount;
    #define mouse (touch / R)
    #define P pointerCount
    #define FC gl_FragCoord.xy
    #define R resolution
    #define T time
    #define rot(a) mat2(cos(a - vec4(0,11,33,0)))

    vec3 stars(vec2 uv) {
      vec3 col = vec3(0.0);
      vec3 ro = vec3(0.2 + sin(T * 0.2) * 0.1, 1.0, T * 0.1);
      vec3 rd = vec3(uv, 0.2);
      float d = 0.0, e = 0.0;
      for (int i = 0; i < 40; i++) {
        vec3 p = ro + rd * d;
        p.z = fract(p.z);
        for (int j = 0; j < 10; j++) {
          p = abs(p) / dot(p, p * 0.5) - 0.8;
        }
        e += (1.0 - e) * dot(p, p) * 0.002;
        col += vec3(e * 0.8, 0.5 - d, d * 0.5) * e * 0.05;
        d += 0.01;
      }
      return col;
    }

    void cam(inout vec3 p) {
      if (P > 0) {
        p.yz *= rot(-mouse.y * 3.14 + 1.57);
        p.xz *= rot(1.57 - mouse.x * 3.14);
      } else {
        p.xz *= rot(sin(T * 0.125) * 0.75);
      }
    }

    void main() {
      vec2 uv = (FC - 0.5 * R) / min(R.x, R.y);
      vec3 col = vec3(0.0);
      vec3 p = vec3(sin(T), cos(T), T * 0.5);
      vec3 rd = normalize(vec3(uv, 1.0));
      cam(p);
      cam(rd);
      col = stars(rd.xy);
      col = mix(col, vec3(0.3, 0.6, 0.9), pow(abs(rd.y), 1.4));
      O = vec4(col, 1.0);
    }`;

    // Compile shader
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
      }
      return shader;
    };

    const vs = compile(gl.VERTEX_SHADER, vertexSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const vertices = new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(program, "resolution");
    const timeLoc = gl.getUniformLocation(program, "time");

    const render = (t: number) => {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, t * 0.001);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full -z-10"
      style={{ background: "black" }}
    />
    ++
  );
}