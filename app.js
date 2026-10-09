(() => {
  const folderInput = document.querySelector("#folder-input");
  const filesInput = document.querySelector("#files-input");
  const audio = document.querySelector("#audio-element");
  const songList = document.querySelector("#song-list");
  const songListWrap = document.querySelector("#song-list-wrap");
  const emptyState = document.querySelector("#empty-state");
  const searchInput = document.querySelector("#search-input");
  const toastElement = document.querySelector("#toast");
  const quickPicks = document.querySelector("#quick-picks");
  const quickPicksGrid = document.querySelector("#quick-picks-grid");
  const youtubeView = document.querySelector("#youtube-view");
  const youtubeResultsGrid = document.querySelector("#youtube-results-grid");
  const youtubeArtistsGrid = document.querySelector("#youtube-artists-grid");
  const youtubePlaylistsGrid = document.querySelector("#youtube-playlists-grid");
  const youtubeStatus = document.querySelector("#youtube-status");
  const modeWheelItems = document.querySelector("#mode-wheel-items");
  const liquidCanvas = document.querySelector("#liquid-background");
  const matrixCanvas = document.querySelector("#matrix-background");
  const trackingEyes = document.querySelectorAll(".tracking-eye");
  const modes = [
    { id: "violet", name: "Lines Talks", glyph: "✳", colors: ["#7560d9", "#b29aff"], description: "Violet magnetic lines bend and dance around your cursor." },
    { id: "ocean", name: "DOT ME", glyph: "◒", colors: ["#257d9b", "#70c9d1"], description: "A cool blue field of shifting, dithered light." },
    { id: "forest", name: "Moss Garden", glyph: "❋", colors: ["#477a54", "#a7c978"], description: "A lush green spiral folds into a living 3D field." },
    { id: "sunset", name: "Golden Hour", glyph: "☼", colors: ["#c96945", "#f1b36a"], description: "Slow-moving amber gradients glow like the last sun." },
    { id: "rose", name: "Rose Radio", glyph: "✿", colors: ["#c35179", "#f0a5b5"], description: "Soft aurora ribbons drift through a rose-lit sky." },
    { id: "midnight", name: "After Hours", glyph: "☾", colors: ["#4a4b91", "#9890e2"], description: "A cinematic violet plasma field for late listening." },
    { id: "mono", name: "Soft Focus", glyph: "◉", colors: ["#134d93", "#8cecff"], description: "A deep-blue liquid field with a calm, luminous drift." },
    { id: "citrus", name: "MATRIX", glyph: "✦", colors: ["#167b45", "#a2ffb2"], description: "Emerald digital rain falling through the dark." }
  ];
  const palette = [
    ["#75434d", "#e39483"], ["#315f76", "#75c3c2"], ["#603d7c", "#db91c7"],
    ["#a25b48", "#e8bb89"], ["#394c72", "#8a9cec"], ["#79506b", "#e6a6b0"],
    ["#455b52", "#a1cba8"], ["#59475f", "#ba9ac4"], ["#986838", "#ecc475"]
  ];
  const state = {
    songs: [],
    filteredSongs: [],
    currentIndex: -1,
    wheelIndex: 0,
    liked: new Set(),
    shuffle: false,
    repeat: 0,
    toastTimer: null,
    currentView: "home",
    lastVolume: 0.78,
    youtubeVideos: [],
    youtubeTrendingVideos: [],
    youtubePlaylists: [],
    youtubeLoaded: false,
    youtubeRequest: 0
  };

  const $ = (selector) => document.querySelector(selector);
  let modePickerIndex = 0;
  let eyeFrame = 0;
  let eyePointerX = window.innerWidth / 2;
  let eyePointerY = 0;
  let liquidRenderer = null;
  let matrixRenderer = null;
  const icon = (name, className = "") => {
    const paths = {
      play: '<path d="m8 5 12 7-12 7z"/>',
      pause: '<path d="M8 5h3v14H8zM15 5h3v14h-3z"/>',
      heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>'
    };
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
  };

  function showToast(message) {
    toastElement.textContent = message;
    toastElement.classList.add("visible");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => toastElement.classList.remove("visible"), 2800);
  }

  function normalizeModeIndex(index) {
    return (index + modes.length) % modes.length;
  }

  function renderModeWheel() {
    modeWheelItems.replaceChildren();
    const compactWheel = window.matchMedia("(max-width: 600px)").matches;
    const arcPositions = compactWheel
      ? [{ left: 0, y: -112 }, { left: 7, y: -74 }, { left: 15, y: -37 }, { left: 22, y: 0 }, { left: 15, y: 37 }, { left: 7, y: 74 }, { left: 0, y: 112 }]
      : [{ left: 0, y: -144 }, { left: 7, y: -96 }, { left: 15, y: -48 }, { left: 22, y: 0 }, { left: 15, y: 48 }, { left: 7, y: 96 }, { left: 0, y: 144 }];
    for (let offset = -3; offset <= 3; offset += 1) {
      const modeIndex = normalizeModeIndex(modePickerIndex + offset);
      const mode = modes[modeIndex];
      const position = arcPositions[offset + 3];
      const option = document.createElement("button");
      option.type = "button";
      option.className = `mode-option${offset === 0 ? " is-selected" : ""}`;
      option.dataset.modeOffset = String(offset);
      option.setAttribute("aria-pressed", String(offset === 0));
      option.setAttribute("aria-label", `${mode.name}${offset === 0 ? ", selected" : ""}`);
      option.style.setProperty("--arc-left", `${position.left}%`);
      option.style.setProperty("--arc-y", `${position.y}px`);
      option.style.setProperty("--mode-color-one", mode.colors[0]);
      option.style.setProperty("--mode-color-two", mode.colors[1]);
      option.innerHTML = `<span class="mode-option-swatch"><span>${mode.glyph}</span></span><span class="mode-option-name">${mode.name}</span>${offset === 0 ? '<span class="mode-selected-mark" aria-hidden="true">●</span>' : ""}`;
      option.addEventListener("click", () => {
        modePickerIndex = normalizeModeIndex(modePickerIndex + offset);
        renderModeWheel();
      });
      modeWheelItems.append(option);
    }
    const selectedMode = modes[modePickerIndex];
    const previewArt = $("#mode-preview-art");
    previewArt.style.setProperty("--preview-color-one", selectedMode.colors[0]);
    previewArt.style.setProperty("--preview-color-two", selectedMode.colors[1]);
    $("#mode-preview-glyph").textContent = selectedMode.glyph;
    $("#mode-preview-name").textContent = selectedMode.name;
    $("#mode-preview-description").textContent = selectedMode.description;
    const isCurrentMode = document.body.dataset.mode === selectedMode.id;
    $("#mode-preview-kicker").textContent = isCurrentMode ? "CURRENTLY ACTIVE" : "YOUR NEXT ATMOSPHERE";
    $("#mode-preview-apply").disabled = isCurrentMode;
    $("#mode-preview-apply").firstChild.textContent = isCurrentMode ? "Mode is active " : "Use this mode ";
    $("#mode-count").textContent = `${String(modePickerIndex + 1).padStart(2, "0")}  /  ${String(modes.length).padStart(2, "0")}`;
  }

  function stepModeWheel(direction) {
    modePickerIndex = normalizeModeIndex(modePickerIndex + direction);
    renderModeWheel();
  }

  function applyMode(modeId) {
    const modeIndex = modes.findIndex((mode) => mode.id === modeId);
    if (modeIndex < 0) return;
    const mode = modes[modeIndex];
    document.body.dataset.mode = mode.id;
    $("#change-mode-button").setAttribute("aria-label", `Change mode. Current mode: ${mode.name}`);
    syncLiquidBackground();
    try {
      window.localStorage.setItem("sonora-mode", mode.id);
    } catch {
      showToast("Mode changed for this session; browser storage is unavailable.");
      return;
    }
    showToast(`${mode.name} mode is on.`);
  }

  function restoreMode() {
    let savedMode = "violet";
    try {
      savedMode = window.localStorage.getItem("sonora-mode") || savedMode;
    } catch {
      savedMode = "violet";
    }
    const mode = modes.find((item) => item.id === savedMode) || modes[0];
    document.body.dataset.mode = mode.id;
    $("#change-mode-button").setAttribute("aria-label", `Change mode. Current mode: ${mode.name}`);
    syncLiquidBackground();
  }

  function initializeLiquidBackground() {
    const context = liquidCanvas.getContext("webgl", { alpha: true, antialias: false, powerPreference: "low-power" });
    if (!context) {
      console.warn("Animated theme backgrounds are using their static fallback because WebGL is unavailable.");
      return;
    }

    const vertexSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    let fragmentSource = `
      precision highp float;
      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_effect;
      uniform vec2 u_pointer;
      uniform float u_speed;
      uniform float u_flow_strength;
      uniform float u_grain;
      uniform float u_contrast;
      uniform float u_opacity;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
          value += noise(p) * amplitude;
          p = p * 2.03 + vec2(17.1, 9.2);
          amplitude *= 0.5;
        }
        return value;
      }
      void main() {
        vec2 uv = v_uv;
        vec2 p = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
        float t = u_time * 0.22 * u_speed;
        if (u_effect > 2.5 && u_effect < 3.5) {
          vec2 cells = uv * u_resolution / 9.0;
          vec2 cell = floor(cells);
          vec2 local = fract(cells) - 0.5;
          vec2 sampleUv = (cell * 9.0 + 4.5) / u_resolution;
          vec2 ditherPoint = (sampleUv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
          vec2 drift = vec2(t * 0.24, -t * 0.17);
          float field = fbm(ditherPoint * 2.5 + drift);
          float halo = exp(-length((ditherPoint - vec2(sin(t * 0.65) * 0.22, cos(t * 0.48) * 0.18)) * vec2(0.82, 1.2)) * 2.8);
          float logoField = 1.0 - smoothstep(0.12, 0.68, length(ditherPoint * vec2(0.78, 1.12)));
          float orbit = 0.5 + 0.5 * sin(length(ditherPoint) * 18.0 - t * 1.25);
          float threshold = clamp(field * 0.28 + halo * 0.28 + logoField * 0.36 + orbit * 0.12, 0.0, 1.0);
          float radius = mix(0.035, 0.45, smoothstep(0.12, 0.88, threshold));
          float dot = 1.0 - smoothstep(radius - 0.045, radius + 0.025, length(local));
          vec3 color = mix(vec3(0.003, 0.009, 0.018), vec3(0.008, 0.045, 0.07), field * 0.62);
          color += dot * mix(vec3(0.012, 0.12, 0.2), vec3(0.08, 0.58, 0.78), smoothstep(0.2, 0.9, threshold));
          color += dot * halo * vec3(0.045, 0.2, 0.24);
          gl_FragColor = vec4(color, u_opacity);
          return;
        }
        if (u_effect > 3.5 && u_effect < 4.5) {
          float radius = length(p);
          float angle = atan(p.y, p.x);
          float twist = angle * 3.0 - log(radius + 0.075) * 5.1 + t * 0.62;
          float spiral = exp(-abs(sin(twist)) * 7.2);
          float secondSpiral = exp(-abs(sin(twist + 1.35)) * 9.0) * 0.55;
          float rings = exp(-abs(sin(radius * 31.0 - angle * 2.0 - t * 0.75)) * 8.5);
          float depth = exp(-radius * 1.12);
          float lightSweep = 0.5 + 0.5 * sin(angle * 2.0 - t * 0.55 + radius * 4.0);
          vec3 color = vec3(0.004, 0.016, 0.009);
          color += vec3(0.025, 0.12, 0.045) * depth;
          color += vec3(0.055, 0.34, 0.13) * spiral * (0.42 + depth * 0.75);
          color += vec3(0.12, 0.42, 0.16) * secondSpiral * depth;
          color += vec3(0.24, 0.62, 0.28) * rings * spiral * depth * 0.42;
          color += vec3(0.07, 0.22, 0.06) * lightSweep * (1.0 - smoothstep(0.08, 0.78, radius)) * 0.42;
          gl_FragColor = vec4(color, u_opacity);
          return;
        }
        if (u_effect > 4.5 && u_effect < 5.5) {
          vec2 warmUv = p * 1.35;
          vec2 warp = vec2(
            fbm(warmUv * 1.4 + vec2(t * 0.16, 2.1)),
            fbm(warmUv * 1.4 + vec2(7.4, -t * 0.14))
          ) - 0.5;
          vec2 flowUv = warmUv + warp * 0.62;
          float amberField = fbm(flowUv * 1.7 + vec2(t * 0.2, -t * 0.13));
          float amberFlow = fbm(flowUv * 2.2 + vec2(4.8 - t * 0.24, 2.6 + t * 0.18));
          float ribbonCenter = sin(p.x * 2.1 + t * 0.62) * 0.2 + sin(p.x * 4.0 - t * 0.38) * 0.07;
          float ribbon = exp(-abs(p.y - ribbonCenter) * 11.0);
          vec2 glowPointOne = vec2(sin(t * 0.42) * 0.42 - 0.34, sin(t * 0.32) * 0.25 + 0.12);
          vec2 glowPointTwo = vec2(cos(t * 0.36) * 0.4 + 0.3, cos(t * 0.3) * 0.24 - 0.13);
          vec2 glowPointThree = vec2(sin(t * 0.25) * 0.28, cos(t * 0.22) * 0.24 - 0.34);
          float glowOne = 1.0 - smoothstep(0.06, 0.58, length((p - glowPointOne) * vec2(0.82, 1.14)));
          float glowTwo = 1.0 - smoothstep(0.05, 0.56, length((p - glowPointTwo) * vec2(0.9, 1.08)));
          float glowThree = 1.0 - smoothstep(0.04, 0.48, length((p - glowPointThree) * vec2(0.9, 1.2)));
          float warmth = smoothstep(0.62, 0.9, amberField) * 0.18 + smoothstep(0.64, 0.92, amberFlow) * 0.12;
          float litGradient = clamp(glowOne * 0.56 + glowTwo * 0.5 + glowThree * 0.46 + ribbon * 0.28 + warmth, 0.0, 1.0);
          vec3 amber = mix(vec3(0.014, 0.006, 0.006), vec3(0.62, 0.18, 0.018), smoothstep(0.06, 0.94, litGradient));
          amber += vec3(0.24, 0.08, 0.01) * glowOne * glowTwo * 0.22;
          amber += vec3(1.0, 0.48, 0.1) * ribbon * smoothstep(0.22, 0.78, amberFlow) * 0.62;
          gl_FragColor = vec4(amber, u_opacity);
          return;
        }
        if (u_effect > 5.5 && u_effect < 6.5) {
          vec2 auroraUv = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
          float cloud = fbm(auroraUv * 1.7 + vec2(t * 0.24, -t * 0.12));
          float shimmer = 0.0;
          vec3 curtainColor = vec3(0.0);
          for (int i = 0; i < 5; i++) {
            float layer = float(i);
            float wave = sin(auroraUv.x * (1.65 + layer * 0.16) + t * (0.5 + layer * 0.06) + layer * 1.7) * 0.14;
            wave += sin(auroraUv.x * 3.9 - t * 0.38 + layer * 0.9) * 0.045;
            float center = -0.36 + layer * 0.18 + wave;
            float band = exp(-abs(auroraUv.y - center) * (18.0 + layer * 0.8));
            float colorPhase = sin(auroraUv.x * 1.25 + t * 0.18 + layer * 0.82);
            vec3 layerColor = mix(vec3(0.09, 0.78, 0.42), vec3(0.82, 0.16, 0.46), smoothstep(-0.62, 0.62, colorPhase));
            layerColor = mix(layerColor, vec3(0.29, 0.38, 0.94), smoothstep(0.15, 0.8, cloud) * 0.38);
            curtainColor += layerColor * band * (0.88 - layer * 0.06);
            shimmer += band * (0.1 + 0.08 * sin(auroraUv.x * 3.0 + t + layer));
          }
          vec3 sky = mix(vec3(0.014, 0.008, 0.026), vec3(0.08, 0.015, 0.075), smoothstep(0.25, 0.78, cloud) * 0.58);
          sky += curtainColor;
          sky += vec3(0.55, 0.24, 0.55) * shimmer * 0.48;
          gl_FragColor = vec4(sky, u_opacity);
          return;
        }
        if (u_effect > 1.5) {
          float aspect = u_resolution.x / u_resolution.y;
          vec2 linePoint = (uv - 0.5) * vec2(aspect, 1.0);
          vec2 magnetPoint = (u_pointer - 0.5) * vec2(aspect, 1.0);
          float magnet = exp(-abs(linePoint.x - magnetPoint.x) * 3.0);
          float glow = 0.0;
          for (int i = 0; i < 36; i++) {
            float row = (float(i) / 35.0 - 0.5) * 1.55;
            float wave = sin(linePoint.x * 4.2 + t * 0.8 + float(i) * 0.16) * 0.027
              + sin(linePoint.x * 9.0 - t * 0.5 + float(i) * 0.07) * 0.012
              + magnet * sin(float(i) * 0.21 + t * 0.65) * 0.19;
            float distanceToLine = abs(linePoint.y - row - wave);
            glow += exp(-distanceToLine * 170.0) + exp(-distanceToLine * 35.0) * 0.18;
          }
          vec3 lineColor = vec3(0.01, 0.006, 0.028);
          lineColor += vec3(0.26, 0.12, 0.72) * clamp(glow * 0.28, 0.0, 1.0);
          lineColor += vec3(0.42, 0.3, 0.95) * clamp(glow * 0.08, 0.0, 1.0);
          lineColor += vec3(0.4, 0.25, 0.95) * exp(-length(linePoint - magnetPoint) * 2.4) * 0.42;
          gl_FragColor = vec4(lineColor, u_opacity);
          return;
        }

        vec2 q = vec2(
          fbm(p * 1.35 + vec2(t * 0.35, -t * 0.18)),
          fbm(p * 1.35 + vec2(5.2 - t * 0.21, 1.7 + t * 0.28))
        );
        vec2 r = vec2(
          fbm(p * 2.1 + q * 2.15 * u_flow_strength + vec2(1.7, 9.2) + t * 0.24),
          fbm(p * 2.1 + q * 2.15 * u_flow_strength + vec2(8.3, 2.8) - t * 0.19)
        );
        float field = fbm(p * 2.45 + r * 2.35 * u_flow_strength + vec2(t * 0.17, -t * 0.13));
        float ridge = 1.0 - smoothstep(0.02, 0.19, abs(field - 0.52));
        if (u_effect > 0.5) {
          float plasma = fbm(p * 2.2 + r * 3.4 + vec2(t * 0.34, -t * 0.21));
          float plasmaRidge = 1.0 - smoothstep(0.015, 0.16, abs(plasma - 0.48));
          float halo = pow(max(0.0, 1.0 - length(p * vec2(0.78, 1.12)) * 0.76), 2.2);
          vec3 deepViolet = vec3(0.012, 0.009, 0.034);
          vec3 plasmaMid = vec3(0.24, 0.075, 0.58);
          vec3 plasmaLight = vec3(0.82, 0.34, 0.94);
          vec3 plasmaColor = mix(deepViolet, plasmaMid, smoothstep(0.2, 0.77, plasma));
          plasmaColor = mix(plasmaColor, plasmaLight, plasmaRidge * 0.67);
          plasmaColor += vec3(0.22, 0.055, 0.42) * halo;
          plasmaColor = clamp((plasmaColor - 0.5) * u_contrast + 0.5, 0.0, 1.0);
          gl_FragColor = vec4(plasmaColor, u_opacity);
          return;
        }
        float depth = clamp((field - 0.20) * u_contrast + 0.30, 0.0, 1.0);
        vec3 deep = vec3(0.016, 0.020, 0.043);
        vec3 mid = vec3(0.075, 0.302, 0.576);
        vec3 highlight = vec3(0.549, 0.925, 1.0);
        vec3 color = mix(deep, mid, smoothstep(0.20, 0.78, depth));
        color = mix(color, highlight, ridge * smoothstep(0.42, 0.78, depth) * 0.66);
        color += vec3(0.04, 0.22, 0.34) * pow(max(0.0, 1.0 - length(q - 0.5) * 1.8), 3.0);
        float grain = (hash(uv * u_resolution + u_time) - 0.5) * u_grain;
        color = clamp((color - 0.5) * 1.10 + 0.5 + grain, 0.0, 1.0);
        gl_FragColor = vec4(color, u_opacity);
      }
    `;

    if (context.getShaderPrecisionFormat(context.FRAGMENT_SHADER, context.HIGH_FLOAT).precision === 0) {
      fragmentSource = fragmentSource.replace("precision highp float;", "precision mediump float;");
    }

    const compileShader = (type, source) => {
      const shader = context.createShader(type);
      if (!shader) throw new Error("Unable to allocate a WebGL shader.");
      context.shaderSource(shader, source);
      context.compileShader(shader);
      if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
        const message = context.getShaderInfoLog(shader) || "Unknown shader compilation error.";
        context.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };

    let program;
    try {
      const vertexShader = compileShader(context.VERTEX_SHADER, vertexSource);
      const fragmentShader = compileShader(context.FRAGMENT_SHADER, fragmentSource);
      program = context.createProgram();
      if (!program) throw new Error("Unable to allocate a WebGL program.");
      context.attachShader(program, vertexShader);
      context.attachShader(program, fragmentShader);
      context.linkProgram(program);
      context.deleteShader(vertexShader);
      context.deleteShader(fragmentShader);
      if (!context.getProgramParameter(program, context.LINK_STATUS)) {
        throw new Error(context.getProgramInfoLog(program) || "Unknown shader link error.");
      }
    } catch (error) {
      console.error("Animated theme shader could not be initialized; using its static fallback.", error);
      liquidCanvas.hidden = true;
      return;
    }

    const vertices = context.createBuffer();
    if (!vertices) {
      console.error("Soft Focus liquid background could not allocate its WebGL buffer.");
      liquidCanvas.hidden = true;
      return;
    }
    context.bindBuffer(context.ARRAY_BUFFER, vertices);
    context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), context.STATIC_DRAW);
    context.useProgram(program);
    context.enable(context.BLEND);
    context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA);
    context.clearColor(0, 0, 0, 0);
    const position = context.getAttribLocation(program, "a_position");
    context.enableVertexAttribArray(position);
    context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);

    const uniforms = {
      resolution: context.getUniformLocation(program, "u_resolution"),
      time: context.getUniformLocation(program, "u_time"),
      effect: context.getUniformLocation(program, "u_effect"),
      pointer: context.getUniformLocation(program, "u_pointer"),
      speed: context.getUniformLocation(program, "u_speed"),
      flowStrength: context.getUniformLocation(program, "u_flow_strength"),
      grain: context.getUniformLocation(program, "u_grain"),
      contrast: context.getUniformLocation(program, "u_contrast"),
      opacity: context.getUniformLocation(program, "u_opacity")
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let startTime = 0;
    let lastFrameTime = 0;
    let lastWidth = 0;
    let lastHeight = 0;
    let paused = true;
    let contextLost = false;
    let pointerX = 0.5;
    let pointerY = 0.5;

    const draw = (timestamp) => {
      frame = 0;
      if (paused || document.hidden) return;
      if (!startTime) startTime = timestamp;
      if (timestamp - lastFrameTime < 33 && !reducedMotion.matches) {
        frame = window.requestAnimationFrame(draw);
        return;
      }
      lastFrameTime = timestamp;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(liquidCanvas.clientWidth * pixelRatio));
      const height = Math.max(1, Math.round(liquidCanvas.clientHeight * pixelRatio));
      if (width !== lastWidth || height !== lastHeight) {
        lastWidth = width;
        lastHeight = height;
        liquidCanvas.width = width;
        liquidCanvas.height = height;
        context.viewport(0, 0, width, height);
      }
      context.uniform2f(uniforms.resolution, width, height);
      context.uniform1f(uniforms.time, reducedMotion.matches ? 0 : (timestamp - startTime) / 1000);
      const mode = document.body.dataset.mode;
      const effects = { midnight: 1, violet: 2, ocean: 3, forest: 4, sunset: 5, rose: 6 };
      context.uniform1f(uniforms.effect, effects[mode] || 0);
      context.uniform2f(uniforms.pointer, pointerX, 1 - pointerY);
      context.uniform1f(uniforms.speed, 1);
      context.uniform1f(uniforms.flowStrength, 1);
      context.uniform1f(uniforms.grain, 0.05);
      context.uniform1f(uniforms.contrast, 1.1);
      context.uniform1f(uniforms.opacity, 0.95);
      context.clear(context.COLOR_BUFFER_BIT);
      context.drawArrays(context.TRIANGLES, 0, 6);
      if (!reducedMotion.matches) frame = window.requestAnimationFrame(draw);
    };

    const sync = () => {
      if (contextLost) return;
      const mode = document.body.dataset.mode;
      const animatedModes = ["mono", "midnight", "violet", "ocean", "forest", "sunset", "rose"];
      const shouldRun = animatedModes.includes(mode) && !document.hidden;
      liquidCanvas.hidden = !animatedModes.includes(mode);
      if (shouldRun && paused) {
        paused = false;
        startTime = 0;
        frame = window.requestAnimationFrame(draw);
      } else if (!shouldRun && !paused) {
        paused = true;
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
      } else if (shouldRun && !frame) {
        frame = window.requestAnimationFrame(draw);
      }
    };

    document.addEventListener("visibilitychange", sync);
    reducedMotion.addEventListener("change", sync);
    window.addEventListener("pointermove", (event) => {
      pointerX = event.clientX / window.innerWidth;
      pointerY = event.clientY / window.innerHeight;
    }, { passive: true });
    liquidCanvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      contextLost = true;
      paused = true;
      liquidCanvas.hidden = true;
      if (frame) window.cancelAnimationFrame(frame);
      console.error("Animated theme background lost its WebGL context; the static theme background remains active.");
    });
    liquidRenderer = sync;
    sync();
  }

  function initializeMatrixBackground() {
    const context = matrixCanvas.getContext("2d", { alpha: true });
    if (!context) {
      console.warn("MATRIX background could not create a 2D canvas context.");
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const glyphs = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン012345789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let drops = [];
    let frame = 0;
    let paused = true;
    let lastFrameTime = 0;
    let lastWidth = 0;
    let lastHeight = 0;
    let fontSize = 17;

    const resize = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
      const width = Math.max(1, Math.round(matrixCanvas.clientWidth * pixelRatio));
      const height = Math.max(1, Math.round(matrixCanvas.clientHeight * pixelRatio));
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;
      matrixCanvas.width = width;
      matrixCanvas.height = height;
      fontSize = Math.max(14, Math.round(17 * pixelRatio));
      const columns = Math.ceil(width / fontSize);
      drops = Array.from({ length: columns }, () => Math.random() * (height / fontSize));
    };

    const draw = (timestamp) => {
      frame = 0;
      if (paused || document.hidden) return;
      if (timestamp - lastFrameTime < 40 && !reducedMotion.matches) {
        frame = window.requestAnimationFrame(draw);
        return;
      }
      lastFrameTime = timestamp;
      resize();
      context.fillStyle = "rgba(2, 7, 5, 0.14)";
      context.fillRect(0, 0, lastWidth, lastHeight);
      context.font = `${fontSize}px monospace`;
      context.textAlign = "center";
      for (let column = 0; column < drops.length; column += 1) {
        const x = column * fontSize + fontSize / 2;
        const y = drops[column] * fontSize;
        const character = glyphs[Math.floor(Math.random() * glyphs.length)];
        const brightHead = Math.random() > 0.975;
        context.fillStyle = brightHead ? "#dcffe5" : Math.random() > 0.88 ? "#53ff91" : "#16c75d";
        context.shadowColor = brightHead ? "#9affba" : "#16c75d";
        context.shadowBlur = brightHead ? 12 : 4;
        context.fillText(character, x, y);
        context.shadowBlur = 0;
        drops[column] += reducedMotion.matches ? 0 : 0.48 + Math.random() * 0.65;
        if (y > lastHeight && Math.random() > 0.975) drops[column] = 0;
      }
      if (!reducedMotion.matches) frame = window.requestAnimationFrame(draw);
    };

    const sync = () => {
      const isMatrix = document.body.dataset.mode === "citrus";
      matrixCanvas.hidden = !isMatrix;
      const shouldRun = isMatrix && !document.hidden;
      if (shouldRun && paused) {
        paused = false;
        resize();
        context.clearRect(0, 0, lastWidth, lastHeight);
        lastFrameTime = 0;
        frame = window.requestAnimationFrame(draw);
      } else if (!shouldRun && !paused) {
        paused = true;
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
      } else if (shouldRun && !frame) {
        frame = window.requestAnimationFrame(draw);
      }
    };

    document.addEventListener("visibilitychange", sync);
    reducedMotion.addEventListener("change", sync);
    matrixRenderer = sync;
    sync();
  }

  function syncLiquidBackground() {
    if (liquidRenderer) liquidRenderer();
    if (matrixRenderer) matrixRenderer();
  }

  function updateEyeTracking() {
    eyeFrame = 0;
    trackingEyes.forEach((eye) => {
      const bounds = eye.getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const angle = Math.atan2(eyePointerY - centerY, eyePointerX - centerX);
      const distance = Math.min(3.5, Math.hypot(eyePointerX - centerX, eyePointerY - centerY) / 45);
      eye.style.setProperty("--pupil-x", `${Math.cos(angle) * distance}px`);
      eye.style.setProperty("--pupil-y", `${Math.sin(angle) * distance}px`);
    });
  }

  function trackPointer(event) {
    eyePointerX = event.clientX;
    eyePointerY = event.clientY;
    if (!eyeFrame) eyeFrame = window.requestAnimationFrame(updateEyeTracking);
  }

  function renderYoutubeCollections() {
    const artists = [];
    const artistIds = new Set();
    for (const video of state.youtubeTrendingVideos) {
      const id = video.channelId || video.channel;
      if (!id || artistIds.has(id)) continue;
      artistIds.add(id);
      artists.push({
        id,
        name: video.channel || "YouTube artist",
        thumbnail: video.thumbnail,
        videos: state.youtubeTrendingVideos.filter((item) => (item.channelId || item.channel) === id)
      });
      if (artists.length === 8) break;
    }

    youtubeArtistsGrid.replaceChildren();
    artists.forEach((artist) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "youtube-artist-card";
      card.dataset.artistId = artist.id;
      card.setAttribute("aria-label", `Explore ${artist.name}`);
      const avatar = document.createElement("span");
      avatar.className = "youtube-artist-avatar";
      if (artist.thumbnail) {
        const image = document.createElement("img");
        image.src = artist.thumbnail;
        image.alt = "";
        image.loading = "lazy";
        image.addEventListener("error", () => image.remove(), { once: true });
        avatar.append(image);
      } else {
        avatar.textContent = artist.name.slice(0, 1).toUpperCase();
      }
      const name = document.createElement("strong");
      name.textContent = artist.name;
      const count = document.createElement("span");
      count.textContent = `${artist.videos.length} ${artist.videos.length === 1 ? "video" : "videos"}`;
      card.append(avatar, name, count);
      youtubeArtistsGrid.append(card);
    });

    const trending = state.youtubeTrendingVideos.slice(0, 10);
    const latest = [...state.youtubeTrendingVideos]
      .sort((first, second) => Date.parse(second.publishedAt) - Date.parse(first.publishedAt))
      .slice(0, 10);
    state.youtubePlaylists = [
      { id: "trending", name: "Trending essentials", description: "Popular music videos right now", videos: trending },
      { id: "latest", name: "Freshly released", description: "The latest tracks to land", videos: latest }
    ];
    artists.filter((artist) => artist.videos.length > 1).slice(0, 4).forEach((artist, index) => {
      state.youtubePlaylists.push({
        id: `artist-${index}`,
        name: `${artist.name} radio`,
        description: `${artist.videos.length} tracks from this channel`,
        videos: artist.videos
      });
    });

    youtubePlaylistsGrid.replaceChildren();
    state.youtubePlaylists.forEach((playlist) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "youtube-playlist-card";
      card.dataset.playlistId = playlist.id;
      card.setAttribute("aria-label", `Open playlist ${playlist.name}, ${playlist.videos.length} tracks`);
      const cover = document.createElement("span");
      cover.className = "youtube-playlist-cover";
      if (playlist.videos[0]?.thumbnail) {
        const image = document.createElement("img");
        image.src = playlist.videos[0].thumbnail;
        image.alt = "";
        image.loading = "lazy";
        image.addEventListener("error", () => image.remove(), { once: true });
        cover.append(image);
      }
      const play = document.createElement("span");
      play.className = "youtube-playlist-play";
      play.setAttribute("aria-hidden", "true");
      play.innerHTML = '<svg viewBox="0 0 24 24"><path d="m8 5 12 7-12 7z"/></svg>';
      cover.append(play);
      const details = document.createElement("span");
      details.className = "youtube-playlist-details";
      const name = document.createElement("strong");
      name.textContent = playlist.name;
      const description = document.createElement("span");
      description.textContent = playlist.description;
      details.append(name, description);
      card.append(cover, details);
      youtubePlaylistsGrid.append(card);
    });
  }

  function showYoutubeCollection(title, videos) {
    if (!videos.length) return;
    state.youtubeVideos = videos;
    $("#youtube-results-title").textContent = title;
    $("#youtube-show-trending").hidden = false;
    renderYoutubeVideos();
    $("#youtube-results-section").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  }

  function displayName(file) {
    return file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || file.name;
  }

  function sortSongs(songs) {
    return songs.sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true, sensitivity: "base" }));
  }

  function makeSongs(files) {
    const supported = files.filter((file) => file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac|opus|wma|aiff?)$/i.test(file.name));
    const urls = new Set(state.songs.map((song) => song.url));
    for (const url of urls) URL.revokeObjectURL(url);
    return sortSongs(supported.map((file, index) => {
      const relativePath = file.webkitRelativePath || file.name;
      const folder = relativePath.includes("/") ? relativePath.slice(0, relativePath.lastIndexOf("/")) : "Local music";
      const color = palette[hashString(relativePath) % palette.length];
      return {
        file,
        url: URL.createObjectURL(file),
        title: displayName(file),
        relativePath,
        folder,
        album: "—",
        artist: "Local track",
        duration: 0,
        colors: color,
        loadToken: 0
      };
    }));
  }

  function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    return hash;
  }

  function coverStyle(song) {
    return `background: linear-gradient(145deg, ${song.colors[0]}, ${song.colors[1]});`;
  }

  function renderSongs() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const isFavorites = state.currentView === "favorites";
    state.filteredSongs = state.songs.filter((song, index) => {
      const matchesQuery = !query || `${song.title} ${song.relativePath}`.toLocaleLowerCase().includes(query);
      return matchesQuery && (!isFavorites || state.liked.has(index));
    });
    youtubeResultsGrid.addEventListener("click", (event) => {
      const card = event.target.closest("[data-video-id]");
      if (card) playYoutubeVideo(card.dataset.videoId);
    });
    youtubeArtistsGrid.addEventListener("click", (event) => {
      const card = event.target.closest("[data-artist-id]");
      if (!card) return;
      const artist = state.youtubeTrendingVideos.find((video) => (video.channelId || video.channel) === card.dataset.artistId);
      if (!artist) return;
      const videos = state.youtubeTrendingVideos.filter((video) => (video.channelId || video.channel) === card.dataset.artistId);
      showYoutubeCollection(`${artist.channel} videos`, videos);
    });
    youtubePlaylistsGrid.addEventListener("click", (event) => {
      const card = event.target.closest("[data-playlist-id]");
      if (!card) return;
      const playlist = state.youtubePlaylists.find((item) => item.id === card.dataset.playlistId);
      if (playlist) showYoutubeCollection(playlist.name, playlist.videos);
    });
    $("#youtube-show-trending").addEventListener("click", () => {
      state.youtubeVideos = state.youtubeTrendingVideos;
      $("#youtube-results-title").textContent = "Trending music";
      $("#youtube-show-trending").hidden = true;
      renderYoutubeVideos();
    });
    $("#youtube-search-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const query = $("#youtube-search-input").value.trim();
      if (query.length < 2) {
        $("#youtube-status").textContent = "Enter at least two characters to search for music.";
        $("#youtube-status").hidden = false;
        $("#youtube-status").classList.add("youtube-status-error");
        return;
      }
      loadYoutubeVideos(`/api/youtube/search?q=${encodeURIComponent(query)}&region=${encodeURIComponent(getRegionCode())}`, `New music for “${query}”`);
    });
    songList.replaceChildren();
    songListWrap.hidden = state.filteredSongs.length === 0;
    emptyState.hidden = state.songs.length > 0;
    if (state.songs.length > 0 && state.filteredSongs.length === 0) {
      emptyState.hidden = false;
      const heading = emptyState.querySelector("h3");
      const description = emptyState.querySelector("p");
      const browseButton = emptyState.querySelector("button");
      if (isFavorites && !query) {
        heading.textContent = "Your liked songs live here.";
        description.textContent = "Tap the heart beside a song to keep it close.";
        browseButton.hidden = true;
      } else if (query) {
        heading.textContent = "No songs found.";
        description.textContent = "Try a different song title or folder name.";
        browseButton.hidden = true;
      }
    } else if (state.songs.length === 0) {
      const heading = emptyState.querySelector("h3");
      const description = emptyState.querySelector("p");
      const browseButton = emptyState.querySelector("button");
      heading.textContent = "Your library is all yours.";
      description.textContent = "Choose a music folder to find the songs waiting for you.";
      browseButton.hidden = false;
    }
    state.filteredSongs.forEach((song) => {
      const index = state.songs.indexOf(song);
      const row = document.createElement("div");
      row.className = `song-row${index === state.currentIndex ? " is-playing" : ""}`;
      row.setAttribute("role", "listitem");
      row.tabIndex = 0;
      row.dataset.songIndex = String(index);
      const number = state.songs.indexOf(song) + 1;
      const playMark = '<svg class="row-play-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 12 7-12 7z"/></svg>';
      const liked = state.liked.has(index);
      row.innerHTML = `<span class="row-number">${number}${playMark}</span><span class="row-title"><span class="track-art" style="${coverStyle(song)}"><span>${escapeHtml(song.title.slice(0, 1).toUpperCase())}</span></span><span class="row-text"><strong>${escapeHtml(song.title)}</strong><small>${escapeHtml(song.artist)}</small></span></span><span class="row-album">${escapeHtml(song.album)}</span><span class="row-folder" title="${escapeHtml(song.folder)}">${escapeHtml(song.folder)}</span><span class="row-duration">${formatTime(song.duration)}</span><button class="song-like-button${liked ? " liked" : ""}" type="button" aria-label="${liked ? "Unlike" : "Like"} ${escapeHtml(song.title)}" aria-pressed="${liked}">${icon("heart")}</button>`;
      songList.append(row);
    });
    $("#favorite-count").textContent = state.liked.size || "";
    renderQuickPicks();
    updatePlayer();
  }

  function renderQuickPicks() {
    const visible = state.songs.length > 0 && state.currentView === "home";
    quickPicks.hidden = !visible;
    quickPicksGrid.replaceChildren();
    if (!visible) return;

    const songCount = state.songs.length;
    const activeIndex = ((state.wheelIndex % songCount) + songCount) % songCount;
    state.wheelIndex = activeIndex;
    $("#music-wheel").classList.toggle("is-compact", songCount <= 2);
    const activeSong = state.songs[activeIndex];
    $("#wheel-feature-cover").style.setProperty("--cover-one", activeSong.colors[0]);
    $("#wheel-feature-cover").style.setProperty("--cover-two", activeSong.colors[1]);
    $("#wheel-feature-cover").innerHTML = `<span class="wheel-cover-edition">SONORA ORIGINALS&nbsp; · &nbsp;VOL. 01</span><span class="wheel-cover-glyph" aria-hidden="true">${["✳", "☾", "♫", "◒"][activeIndex % 4]}</span><span class="wheel-cover-title">${escapeHtml(activeSong.title)}</span><span class="wheel-cover-artist">${escapeHtml(activeSong.artist)}</span><span class="wheel-cover-inner-disc" aria-hidden="true"></span>`;
    $("#wheel-track-number").textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(songCount).padStart(2, "0")}`;
    $("#wheel-position-label").innerHTML = `<strong>${String(activeIndex + 1).padStart(2, "0")}</strong> <i>—</i> ${String(songCount).padStart(2, "0")}`;
    $("#wheel-album-name").textContent = activeSong.folder.toLocaleUpperCase();
    $("#wheel-track-status").textContent = activeIndex === state.currentIndex && !audio.paused ? "NOW PLAYING" : "READY WHEN YOU ARE";
    $("#wheel-feature-play").setAttribute("aria-label", `${activeIndex === state.currentIndex && !audio.paused ? "Pause" : "Play"} ${activeSong.title}`);
    $("#wheel-feature-play").classList.toggle("is-playing", activeIndex === state.currentIndex && !audio.paused);
    $("#wheel-feature-play svg").innerHTML = activeIndex === state.currentIndex && !audio.paused
      ? '<path d="M8 5h3v14H8zM15 5h3v14h-3z"/>'
      : '<path d="m8 5 12 7-12 7z"/>';

    const visibleItems = [];
    const visibleSongIndices = new Set();
    for (const offset of [0, -1, 1, -2, 2]) {
      const index = (activeIndex + offset + songCount) % songCount;
      if (visibleSongIndices.has(index)) continue;
      visibleSongIndices.add(index);
      visibleItems.push([state.songs[index], offset]);
    }

    visibleItems.forEach(([song, offset]) => {
      const index = state.songs.indexOf(song);
      const card = document.createElement("button");
      card.type = "button";
      card.className = `wheel-track-option${offset === 0 ? " is-selected" : ""}${index === state.currentIndex ? " is-playing" : ""}`;
      card.setAttribute("aria-pressed", String(offset === 0));
      card.setAttribute("aria-label", `${offset === 0 ? "Selected" : "Select"} ${song.title}`);
      card.style.setProperty("--wheel-offset", String(offset));
      card.style.setProperty("--wheel-depth", String(Math.abs(offset)));
      card.dataset.wheelOffset = String(offset);
      card.innerHTML = `<span class="wheel-track-index">${String(index + 1).padStart(2, "0")}</span><span class="wheel-track-copy"><strong>${escapeHtml(song.title)}</strong><span>${escapeHtml(song.artist)}${index === state.currentIndex && !audio.paused ? " · NOW PLAYING" : ""}</span></span><span class="wheel-track-glyph" style="${coverStyle(song)}" aria-hidden="true">${["✳", "☾", "♫", "◒"][index % 4]}</span><span class="wheel-track-hint">${offset === 0 ? '<svg viewBox="0 0 24 24"><path d="m8 5 12 7-12 7z"/></svg>' : ""}</span>`;
      quickPicksGrid.append(card);
    });

    $("#wheel-indicators").replaceChildren();
    const indicatorCount = Math.min(songCount, 9);
    const indicatorWindow = Math.floor(activeIndex / songCount * indicatorCount);
    for (let index = 0; index < indicatorCount; index += 1) {
      const indicator = document.createElement("button");
      indicator.type = "button";
      indicator.className = `wheel-indicator${index === indicatorWindow ? " is-active" : ""}`;
      indicator.setAttribute("aria-label", `Show tracks ${Math.floor(index * songCount / indicatorCount) + 1}–${Math.floor((index + 1) * songCount / indicatorCount)}`);
      indicator.addEventListener("click", () => setWheelIndex(Math.floor(index * songCount / indicatorCount)));
      $("#wheel-indicators").append(indicator);
    }
    $("#wheel-previous").disabled = songCount <= 1;
    $("#wheel-next").disabled = songCount <= 1;
  }

  function setWheelIndex(index) {
    if (state.songs.length === 0) return;
    state.wheelIndex = (index + state.songs.length) % state.songs.length;
    renderQuickPicks();
  }

  function stepWheel(direction) {
    setWheelIndex(state.wheelIndex + direction);
  }

  function playWheelSelection() {
    if (state.wheelIndex === state.currentIndex) togglePlay();
    else playIndex(state.wheelIndex);
  }

  function openYoutubeView() {
    document.querySelector(".main-content").classList.add("youtube-mode");
    document.querySelector(".content-scroll").classList.add("youtube-mode");
    youtubeView.hidden = false;
    $("#top-folder-button").hidden = true;
    $(".local-indicator").hidden = true;
    $("#youtube-region-label").textContent = `POPULAR IN ${getRegionCode()}`;
    if (location.protocol === "file:") {
      $("#youtube-status").textContent = "YouTube Music needs Sonora's local server. Run python server.py, then open http://127.0.0.1:8000.";
      $("#youtube-status").classList.add("youtube-status-error");
      $("#youtube-status").hidden = false;
      return;
    }
    if (!state.youtubeLoaded) loadYoutubeVideos(`/api/youtube/trending?region=${encodeURIComponent(getRegionCode())}`, "Trending music");
  }

  function closeYoutubeView() {
    document.querySelector(".main-content").classList.remove("youtube-mode");
    document.querySelector(".content-scroll").classList.remove("youtube-mode");
    youtubeView.hidden = true;
    $("#top-folder-button").hidden = false;
    $(".local-indicator").hidden = false;
  }

  function getRegionCode() {
    const localeParts = navigator.language.split("-");
    const localeRegion = localeParts.length > 1 ? localeParts[localeParts.length - 1].toUpperCase() : "";
    return /^[A-Z]{2}$/.test(localeRegion) ? localeRegion : "US";
  }

  async function loadYoutubeVideos(url, title) {
    const requestId = ++state.youtubeRequest;
    const isSearch = url.includes("/search?");
    $("#youtube-show-trending").hidden = !isSearch;
    $("#youtube-results-title").textContent = title;
    $("#youtube-status").textContent = isSearch ? "Finding fresh music..." : "Loading what's popular right now...";
    youtubeStatus.hidden = false;
    youtubeResultsGrid.replaceChildren();
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Couldn't load YouTube music right now.");
      if (requestId !== state.youtubeRequest) return;
      state.youtubeVideos = Array.isArray(payload.videos) ? payload.videos : [];
      if (!isSearch) {
        state.youtubeTrendingVideos = state.youtubeVideos;
        state.youtubeLoaded = true;
        renderYoutubeCollections();
      }
      renderYoutubeVideos();
    } catch (error) {
      if (requestId !== state.youtubeRequest) return;
      youtubeStatus.textContent = error.message || "Couldn't load YouTube music right now.";
      youtubeStatus.classList.add("youtube-status-error");
    }
  }

  function renderYoutubeVideos() {
    youtubeResultsGrid.replaceChildren();
    youtubeStatus.classList.remove("youtube-status-error");
    if (state.youtubeVideos.length === 0) {
      youtubeStatus.textContent = "No music videos found. Try another artist or song.";
      youtubeStatus.hidden = false;
      return;
    }
    youtubeStatus.hidden = true;
    state.youtubeVideos.forEach((video) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "youtube-video-card";
      card.dataset.videoId = video.id;
      card.setAttribute("aria-label", `Play ${video.title} by ${video.channel}`);
      const thumbnail = document.createElement("span");
      thumbnail.className = "youtube-thumbnail";
      const image = document.createElement("img");
      image.src = video.thumbnail;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", () => image.remove(), { once: true });
      thumbnail.append(image);
      const play = document.createElement("span");
      play.className = "youtube-thumbnail-play";
      play.setAttribute("aria-hidden", "true");
      play.innerHTML = '<svg viewBox="0 0 24 24"><path d="m9 6 10 6-10 6z"/></svg>';
      thumbnail.append(play);
      const details = document.createElement("span");
      details.className = "youtube-video-details";
      const name = document.createElement("strong");
      name.textContent = video.title;
      const meta = document.createElement("span");
      meta.textContent = `${video.channel} · ${formatPublishedAt(video.publishedAt)}`;
      details.append(name, meta);
      card.append(thumbnail, details);
      youtubeResultsGrid.append(card);
    });
  }

  function formatPublishedAt(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "YouTube music";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  function playYoutubeVideo(videoId) {
    const video = state.youtubeVideos.find((item) => item.id === videoId);
    if (!video) return;
    audio.pause();
    const watchUrl = `https://music.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
    window.open(watchUrl, "_blank", "noopener,noreferrer");
    showToast("Opening this track on YouTube Music. Allow pop-ups if it doesn’t open.");
    youtubeResultsGrid.querySelectorAll(".youtube-video-card").forEach((card) => {
      card.classList.toggle("is-active", card.dataset.videoId === videoId);
    });
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function setFolderLabel(files, isFolder) {
    const location = $("#folder-location");
    const locationText = $("#folder-name");
    const topButton = $("#top-folder-button");
    if (isFolder) {
      const firstPath = files.find((file) => file.webkitRelativePath)?.webkitRelativePath || "";
      const name = firstPath.split("/")[0] || "Selected music folder";
      locationText.textContent = `${name} · ${state.songs.length} ${state.songs.length === 1 ? "song" : "songs"}`;
      location.title = name;
      location.hidden = false;
      topButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/></svg>Change folder';
    } else {
      location.hidden = true;
      topButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/></svg>Choose folder';
    }
  }

  async function loadFiles(fileList, isFolder) {
    const files = Array.from(fileList);
    const songs = makeSongs(files);
    if (songs.length === 0) {
      showToast("No supported audio files found. Try MP3, WAV, FLAC, or M4A.");
      return;
    }
    audio.pause();
    audio.removeAttribute("src");
    state.currentIndex = -1;
    state.songs = songs;
    state.wheelIndex = 0;
    state.liked.clear();
    state.shuffle = false;
    $("#shuffle-button").classList.remove("toggled");
    if (state.currentView === "favorites") state.currentView = "home";
    searchInput.value = "";
    setFolderLabel(files, isFolder);
    renderSongs();
    $("#section-title").textContent = "Your music, together";
    $("#section-description").textContent = `${songs.length} ${songs.length === 1 ? "song is" : "songs are"} ready when you are.`;
    showToast(`Found ${songs.length} ${songs.length === 1 ? "song" : "songs"} in your music ${isFolder ? "folder" : "selection"}.`);
  }

  function playIndex(index) {
    const song = state.songs[index];
    if (!song) return;
    state.currentIndex = index;
    state.wheelIndex = index;
    audio.src = song.url;
    audio.load();
    const token = ++song.loadToken;
    audio.play().then(() => {
      if (song.loadToken !== token) return;
      updatePlayer();
      renderSongs();
    }).catch((error) => {
      if (error.name !== "AbortError") showToast("This audio file could not be played. Try another song.");
      updatePlayer();
    });
    $("#player-title").textContent = song.title;
    $("#player-artist").textContent = song.folder;
    $("#player-cover").setAttribute("style", coverStyle(song));
    $("#player-cover").classList.add("track-cover-active");
    $("#player-cover").innerHTML = `<span>${escapeHtml(song.title.slice(0, 1).toUpperCase())}</span>`;
    $("#player-like").disabled = false;
    if (state.currentView === "home") renderQuickPicks();
    updatePlayer();
  }

  function nextSong(direction = 1) {
    if (state.songs.length === 0) return;
    if (state.shuffle && state.songs.length > 1) {
      let next = state.currentIndex;
      while (next === state.currentIndex) next = Math.floor(Math.random() * state.songs.length);
      playIndex(next);
      return;
    }
    const nextIndex = state.currentIndex < 0
      ? (direction > 0 ? 0 : state.songs.length - 1)
      : (state.currentIndex + direction + state.songs.length) % state.songs.length;
    playIndex(nextIndex);
  }

  function updatePlayer() {
    const isPlaying = !audio.paused && !audio.ended;
    $("#play-button").classList.toggle("is-playing", isPlaying);
    $("#play-button").setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    $("#play-icon").innerHTML = isPlaying ? '<path d="M7 5h4v14H7zM15 5h4v14h-4z"/>' : '<path d="m8 5 12 7-12 7z"/>';
    $("#player-like").classList.toggle("liked", state.liked.has(state.currentIndex));
    $("#player-like").setAttribute("aria-pressed", String(state.liked.has(state.currentIndex)));
    $("#current-time").textContent = formatTime(audio.currentTime);
    $("#total-time").textContent = formatTime(audio.duration);
    const progress = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration * 100 : 0;
    $("#seek-slider").value = String(Math.round(progress * 10));
    $("#seek-slider").style.setProperty("--range-progress", `${progress}%`);
    $("#volume-slider").style.setProperty("--range-progress", `${audio.volume * 100}%`);
    if (state.currentIndex >= 0 && Number.isFinite(audio.duration) && audio.duration > 0) {
      state.songs[state.currentIndex].duration = audio.duration;
      const durationElement = songList.querySelector(`[data-song-index="${state.currentIndex}"] .row-duration`);
      if (durationElement) durationElement.textContent = formatTime(audio.duration);
    }
  }

  function toggleLike(index) {
    if (index < 0 || index >= state.songs.length) return;
    if (state.liked.has(index)) state.liked.delete(index);
    else state.liked.add(index);
    renderSongs();
  }

  function togglePlay() {
    if (state.currentIndex < 0) {
      if (state.songs.length) nextSong(1);
      else folderInput.click();
      return;
    }
    if (audio.paused) audio.play().catch(() => showToast("This audio file could not be played. Try another song."));
    else audio.pause();
    updatePlayer();
  }

  folderInput.addEventListener("change", () => {
    if (folderInput.files.length) loadFiles(folderInput.files, true);
    folderInput.value = "";
  });
  filesInput.addEventListener("change", () => {
    if (filesInput.files.length) loadFiles(filesInput.files, false);
    filesInput.value = "";
  });
  ["#top-folder-button", "#empty-folder-button", "#change-folder-button"].forEach((selector) => {
    $(selector).addEventListener("click", () => folderInput.click());
  });
  window.addEventListener("pointermove", trackPointer, { passive: true });
  window.addEventListener("resize", () => {
    if (!eyeFrame) eyeFrame = window.requestAnimationFrame(updateEyeTracking);
    if (state.currentView === "mode") renderModeWheel();
    syncLiquidBackground();
  }, { passive: true });
  const modeView = $("#mode-view");
  const modeButton = $("#change-mode-button");
  const openModeView = () => {
    state.currentView = "mode";
    document.querySelectorAll(".nav-link[data-view]").forEach((item) => item.classList.remove("active"));
    modeButton.classList.add("active");
    modeView.hidden = false;
    document.querySelector(".content-scroll").classList.add("mode-picker-mode");
    closeYoutubeView();
    const currentModeIndex = modes.findIndex((mode) => mode.id === document.body.dataset.mode);
    modePickerIndex = currentModeIndex < 0 ? 0 : currentModeIndex;
    renderModeWheel();
    document.querySelector(".content-scroll").scrollTo({ top: 0, behavior: "smooth" });
    modeView.focus({ preventScroll: true });
  };
  modeButton.addEventListener("click", openModeView);
  $("#mode-back-button").addEventListener("click", () => $('[data-view="home"]').click());
  $("#mode-previous").addEventListener("click", () => stepModeWheel(-1));
  $("#mode-next").addEventListener("click", () => stepModeWheel(1));
  $("#mode-preview-apply").addEventListener("click", () => {
    applyMode(modes[modePickerIndex].id);
    renderModeWheel();
  });
  modeView.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      stepModeWheel(-1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      stepModeWheel(1);
    }
  });
  let modePointerStart = null;
  modeWheelItems.addEventListener("pointerdown", (event) => {
    modePointerStart = event.clientY;
  });
  modeWheelItems.addEventListener("pointerup", (event) => {
    if (modePointerStart === null) return;
    const movement = event.clientY - modePointerStart;
    modePointerStart = null;
    if (Math.abs(movement) > 45) {
      event.preventDefault();
      stepModeWheel(movement < 0 ? 1 : -1);
    }
  });
  modeWheelItems.addEventListener("pointercancel", () => {
    modePointerStart = null;
  });
  $("#queue-button").addEventListener("click", () => {
    openCollectionView("folders");
    $("#library-section").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  songList.addEventListener("click", (event) => {
    const row = event.target.closest(".song-row");
    if (!row) return;
    if (event.target.closest(".song-like-button")) {
      toggleLike(Number(row.dataset.songIndex));
      return;
    }
    playIndex(Number(row.dataset.songIndex));
  });
  songList.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.classList.contains("song-row")) {
      event.preventDefault();
      playIndex(Number(event.target.dataset.songIndex));
    }
  });
  quickPicksGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-wheel-offset]");
    if (card) stepWheel(Number(card.dataset.wheelOffset));
  });
  $("#wheel-previous").addEventListener("click", () => stepWheel(-1));
  $("#wheel-next").addEventListener("click", () => stepWheel(1));
  $("#wheel-feature-play").addEventListener("click", playWheelSelection);
  let wheelPointerStart = null;
  quickPicksGrid.addEventListener("pointerdown", (event) => {
    wheelPointerStart = event.clientY;
  });
  quickPicksGrid.addEventListener("pointerup", (event) => {
    if (wheelPointerStart === null) return;
    const movement = event.clientY - wheelPointerStart;
    wheelPointerStart = null;
    if (Math.abs(movement) > 48) {
      event.preventDefault();
      stepWheel(movement < 0 ? 1 : -1);
    }
  });
  quickPicksGrid.addEventListener("pointercancel", () => {
    wheelPointerStart = null;
  });
  searchInput.addEventListener("input", renderSongs);

  function openCollectionView(view, activeButton = null) {
    state.currentView = view;
    document.querySelectorAll(".nav-link[data-view]").forEach((item) => item.classList.toggle("active", item === activeButton));
    modeButton.classList.remove("active");
    modeView.hidden = true;
    document.querySelector(".content-scroll").classList.remove("mode-picker-mode");
    if (view === "youtube") {
      openYoutubeView();
      return;
    }
    closeYoutubeView();
    $("#section-kicker").textContent = view === "favorites" ? "YOUR FAVORITES" : view === "search" ? "FIND YOUR NEXT FAVORITE" : "YOUR COLLECTION";
    $("#section-title").textContent = view === "favorites" ? "Songs you love" : view === "search" ? "Find a song" : view === "folders" ? "Your music files" : state.songs.length ? "Your music, together" : "Made for your ears";
    $("#section-description").textContent = view === "favorites" ? "The ones you want to come back to." : view === "search" ? "Search by song title or folder name." : view === "folders" ? `${state.songs.length} ${state.songs.length === 1 ? "song" : "songs"} in your music library.` : state.songs.length ? `${state.songs.length} ${state.songs.length === 1 ? "song is" : "songs are"} ready when you are.` : "Your next favorite is already in your library.";
    if (view === "search") {
      searchInput.focus();
      $("#search-box").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    renderSongs();
  }

  document.querySelectorAll(".nav-link[data-view]").forEach((button) => {
    button.addEventListener("click", () => openCollectionView(button.dataset.view, button));
  });

  $("#play-button").addEventListener("click", togglePlay);
  $("#previous-button").addEventListener("click", () => {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    nextSong(-1);
  });
  $("#next-button").addEventListener("click", () => nextSong(1));
  $("#shuffle-button").addEventListener("click", (event) => {
    state.shuffle = !state.shuffle;
    event.currentTarget.classList.toggle("toggled", state.shuffle);
    showToast(state.shuffle ? "Shuffle is on." : "Shuffle is off.");
  });
  $("#repeat-button").addEventListener("click", (event) => {
    state.repeat = (state.repeat + 1) % 3;
    const button = event.currentTarget;
    button.classList.toggle("toggled", state.repeat !== 0);
    button.setAttribute("aria-label", ["Repeat off", "Repeat all songs", "Repeat current song"][state.repeat]);
    button.title = ["Repeat off", "Repeat all", "Repeat one"][state.repeat];
    button.querySelector("svg").innerHTML = state.repeat === 2
      ? '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/><path d="M11 9h3v6h-3z"/>'
      : '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>';
    showToast(["Repeat is off.", "Repeating all songs.", "Repeating this song."][state.repeat]);
  });
  $("#player-like").addEventListener("click", () => toggleLike(state.currentIndex));
  $("#seek-slider").addEventListener("input", (event) => {
    if (Number.isFinite(audio.duration)) audio.currentTime = Number(event.target.value) / 1000 * audio.duration;
  });
  $("#volume-slider").addEventListener("input", (event) => {
    audio.volume = Number(event.target.value) / 100;
    if (audio.volume > 0) state.lastVolume = audio.volume;
    $("#volume-button").setAttribute("aria-label", audio.volume ? "Mute" : "Unmute");
    $("#volume-icon").innerHTML = audio.volume
      ? '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13"/>'
      : '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6m0-6-5 6"/>';
    updatePlayer();
  });
  $("#volume-button").addEventListener("click", () => {
    const nextVolume = audio.volume === 0 ? state.lastVolume : 0;
    audio.volume = nextVolume;
    $("#volume-slider").value = String(Math.round(nextVolume * 100));
    $("#volume-slider").dispatchEvent(new Event("input", { bubbles: true }));
  });

  audio.addEventListener("timeupdate", updatePlayer);
  audio.addEventListener("durationchange", updatePlayer);
  audio.addEventListener("play", () => {
    updatePlayer();
    renderQuickPicks();
  });
  audio.addEventListener("pause", () => {
    updatePlayer();
    renderQuickPicks();
  });
  audio.addEventListener("ended", () => {
    if (state.repeat === 2) {
      audio.currentTime = 0;
      audio.play().catch(() => showToast("This audio file could not be played. Try another song."));
    } else if (state.repeat === 1 || state.currentIndex < state.songs.length - 1 || state.shuffle) {
      nextSong(1);
    } else {
      updatePlayer();
    }
  });
  audio.addEventListener("error", () => {
    if (state.currentIndex >= 0) showToast("This audio file could not be read by your browser.");
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    if (event.key === "/" && !isTyping) {
      event.preventDefault();
      $("#search-box").scrollIntoView({ behavior: "smooth", block: "nearest" });
      searchInput.focus();
    } else if (event.code === "Space" && !isTyping) {
      event.preventDefault();
      togglePlay();
    } else if (event.key === "ArrowRight" && !isTyping && state.currentIndex !== -1) {
      audio.currentTime = Math.min(audio.duration || audio.currentTime + 5, audio.currentTime + 5);
    } else if (event.key === "ArrowLeft" && !isTyping && state.currentIndex !== -1) {
      audio.currentTime = Math.max(0, audio.currentTime - 5);
    }
  });

  if (!("webkitdirectory" in folderInput) && !("directory" in folderInput)) {
    folderInput.addEventListener("click", (event) => {
      event.preventDefault();
      filesInput.click();
      showToast("Your browser doesn't support folder selection; choose your music files instead.");
    });
  }
  window.addEventListener("pagehide", () => {
    for (const song of state.songs) URL.revokeObjectURL(song.url);
  });
  restoreMode();
  initializeLiquidBackground();
  initializeMatrixBackground();
  updateEyeTracking();
  renderSongs();
})();
