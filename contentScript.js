(function () {
  if (window.__transparentRulerOverlayLoaded) {
    return;
  }
  window.__transparentRulerOverlayLoaded = true;

  const STORAGE_KEY = "transparentRulerConfigV1";
  const DEFAULT_PX_PER_CM = 37.7952755906;
  const SNAP_THRESHOLD = 10;

  const MIN_LENGTH = 120;
  const MAX_LENGTH = 2400;
  const MIN_THICKNESS = 32;
  const MAX_THICKNESS = 180;

  const DEFAULT_GLOBAL = {
    opacity: 0.45,
    density: "normal",
    pxPerCm: DEFAULT_PX_PER_CM,
    calibrated: false,
    theme: "steel",
    showPx: true,
    showCm: true,
    thickness: 72
  };

  const DEFAULT_SITE = {
    orientation: "horizontal",
    position: {
      x: 12,
      y: 12
    },
    length: 480,
    pinned: false,
    pinnedMode: "current",
    snap: true
  };

  const DENSITY_CONFIG = {
    sparse: {
      pxMinorStep: 10,
      pxMidStep: 50,
      pxMajorStep: 100,
      cmMinorDivisions: 2
    },
    normal: {
      pxMinorStep: 5,
      pxMidStep: 10,
      pxMajorStep: 50,
      cmMinorDivisions: 5
    },
    dense: {
      pxMinorStep: 2,
      pxMidStep: 10,
      pxMajorStep: 50,
      cmMinorDivisions: 10
    }
  };

  const COLOR_THEMES = {
    steel: {
      background: [245, 248, 252],
      frame: [28, 42, 58],
      marks: [15, 23, 32],
      accent: [15, 95, 214]
    },
    graphite: {
      background: [239, 242, 246],
      frame: [49, 61, 78],
      marks: [29, 35, 43],
      accent: [73, 87, 107]
    },
    ocean: {
      background: [235, 247, 250],
      frame: [24, 60, 71],
      marks: [16, 45, 58],
      accent: [12, 137, 168]
    },
    emerald: {
      background: [238, 249, 243],
      frame: [20, 75, 54],
      marks: [16, 57, 43],
      accent: [19, 160, 107]
    },
    amber: {
      background: [253, 247, 236],
      frame: [101, 73, 22],
      marks: [76, 53, 14],
      accent: [214, 139, 25]
    },
    rose: {
      background: [252, 242, 244],
      frame: [109, 39, 56],
      marks: [82, 30, 43],
      accent: [201, 76, 111]
    }
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function toNumber(value, fallback) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  }

  function normalizeDensity(density) {
    return DENSITY_CONFIG[density] ? density : "normal";
  }

  function normalizeTheme(theme) {
    return COLOR_THEMES[theme] ? theme : "steel";
  }

  function normalizePinnedMode(rawMode) {
    if (rawMode === "start" || rawMode === "end" || rawMode === "current") {
      return rawMode;
    }
    return "current";
  }

  function mixColor(rgbA, rgbB, ratio) {
    return [
      Math.round(rgbA[0] + (rgbB[0] - rgbA[0]) * ratio),
      Math.round(rgbA[1] + (rgbB[1] - rgbA[1]) * ratio),
      Math.round(rgbA[2] + (rgbB[2] - rgbA[2]) * ratio)
    ];
  }

  function toRgbString(rgb) {
    return `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
  }

  function getHostKey() {
    return window.location.hostname || "__default__";
  }

  function normalizeSiteConfig(rawSite) {
    const site = rawSite && typeof rawSite === "object" ? rawSite : {};
    const orientation = site.orientation === "vertical" ? "vertical" : "horizontal";
    const offsets = site.offsets && typeof site.offsets === "object" ? site.offsets : {};
    const positionRaw = site.position && typeof site.position === "object" ? site.position : {};

    let x = toNumber(positionRaw.x, DEFAULT_SITE.position.x);
    let y = toNumber(positionRaw.y, DEFAULT_SITE.position.y);

    const hasPosX = Number.isFinite(Number(positionRaw.x));
    const hasPosY = Number.isFinite(Number(positionRaw.y));

    // Migration from old site schema (single-axis offsets).
    if (!hasPosX && orientation === "vertical" && Number.isFinite(offsets.vertical)) {
      x = Number(offsets.vertical);
    }
    if (!hasPosY && orientation === "horizontal" && Number.isFinite(offsets.horizontal)) {
      y = Number(offsets.horizontal);
    }

    return {
      orientation,
      position: { x, y },
      length: clamp(toNumber(site.length, DEFAULT_SITE.length), MIN_LENGTH, MAX_LENGTH),
      pinned: Boolean(site.pinned),
      pinnedMode: normalizePinnedMode(site.pinnedMode || site.pinnedEdge),
      snap: site.snap !== false
    };
  }

  function normalizeConfig(rawConfig) {
    const cfg = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
    const global = {
      ...DEFAULT_GLOBAL,
      ...(cfg.global || {})
    };

    global.opacity = clamp(toNumber(global.opacity, DEFAULT_GLOBAL.opacity), 0.2, 0.9);
    global.density = normalizeDensity(global.density);
    global.pxPerCm = toNumber(global.pxPerCm, DEFAULT_PX_PER_CM);
    if (global.pxPerCm <= 0) {
      global.pxPerCm = DEFAULT_PX_PER_CM;
    }
    global.calibrated = Boolean(global.calibrated);
    global.theme = normalizeTheme(global.theme);
    global.showPx = global.showPx !== false;
    global.showCm = global.showCm !== false;
    if (!global.showPx && !global.showCm) {
      global.showPx = true;
    }
    global.thickness = clamp(toNumber(global.thickness, DEFAULT_GLOBAL.thickness), MIN_THICKNESS, MAX_THICKNESS);

    const sites = {};
    if (cfg.sites && typeof cfg.sites === "object") {
      for (const [key, value] of Object.entries(cfg.sites)) {
        sites[key] = normalizeSiteConfig(value);
      }
    }

    return {
      version: 1,
      global,
      sites
    };
  }

  class TransparentRulerOverlay {
    constructor() {
      this.hostKey = getHostKey();
      this.state = {
        visible: false,
        orientation: "horizontal",
        position: {
          x: DEFAULT_SITE.position.x,
          y: DEFAULT_SITE.position.y
        },
        length: DEFAULT_SITE.length,
        thickness: DEFAULT_GLOBAL.thickness,
        pinned: false,
        pinnedMode: "current",
        snap: true,
        opacity: DEFAULT_GLOBAL.opacity,
        density: DEFAULT_GLOBAL.density,
        theme: DEFAULT_GLOBAL.theme,
        showPx: true,
        showCm: true,
        pxPerCm: DEFAULT_PX_PER_CM,
        calibrated: false
      };

      this.root = null;
      this.canvas = null;
      this.ctx = null;

      this.isDragging = false;
      this.dragPointerId = null;
      this.dragStart = {
        mouseX: 0,
        mouseY: 0,
        x: 0,
        y: 0
      };

      this.calibrationOverlay = null;

      this.boundOnResize = this.onResize.bind(this);
      this.boundOnBlur = this.onBlur.bind(this);
      this.boundOnPointerDown = this.onPointerDown.bind(this);
      this.boundOnPointerMove = this.onPointerMove.bind(this);
      this.boundOnPointerUp = this.onPointerUp.bind(this);
    }

    getTheme() {
      return COLOR_THEMES[normalizeTheme(this.state.theme)];
    }

    getMainAxisLimit() {
      return this.state.orientation === "horizontal" ? window.innerWidth : window.innerHeight;
    }

    getCrossAxisLimit() {
      return this.state.orientation === "horizontal" ? window.innerHeight : window.innerWidth;
    }

    getEffectiveLength() {
      const maxAllowed = Math.max(40, this.getMainAxisLimit());
      const minAllowed = Math.min(MIN_LENGTH, maxAllowed);
      return clamp(this.state.length, minAllowed, maxAllowed);
    }

    getEffectiveThickness() {
      const maxAllowed = Math.max(20, Math.min(MAX_THICKNESS, this.getCrossAxisLimit()));
      const minAllowed = Math.min(MIN_THICKNESS, maxAllowed);
      return clamp(this.state.thickness, minAllowed, maxAllowed);
    }

    getRenderSize() {
      const length = this.getEffectiveLength();
      const thickness = this.getEffectiveThickness();
      this.state.length = length;
      this.state.thickness = thickness;

      if (this.state.orientation === "horizontal") {
        return { width: length, height: thickness };
      }
      return { width: thickness, height: length };
    }

    getMaxPosition(size) {
      return {
        x: Math.max(0, window.innerWidth - size.width),
        y: Math.max(0, window.innerHeight - size.height)
      };
    }

    clampPosition(position, maxPos) {
      return {
        x: clamp(position.x, 0, maxPos.x),
        y: clamp(position.y, 0, maxPos.y)
      };
    }

    getSnappedPosition(position, maxPos) {
      const bounded = this.clampPosition(position, maxPos);
      if (!this.state.snap) {
        return bounded;
      }

      let nextX = bounded.x;
      let nextY = bounded.y;

      if (nextX <= SNAP_THRESHOLD) {
        nextX = 0;
      } else if (nextX >= maxPos.x - SNAP_THRESHOLD) {
        nextX = maxPos.x;
      }

      if (nextY <= SNAP_THRESHOLD) {
        nextY = 0;
      } else if (nextY >= maxPos.y - SNAP_THRESHOLD) {
        nextY = maxPos.y;
      }

      return { x: nextX, y: nextY };
    }

    applyPinConstraints(maxPos) {
      if (!this.state.pinned) {
        return;
      }

      if (this.state.pinnedMode === "start") {
        if (this.state.orientation === "horizontal") {
          this.state.position.y = 0;
        } else {
          this.state.position.x = 0;
        }
      } else if (this.state.pinnedMode === "end") {
        if (this.state.orientation === "horizontal") {
          this.state.position.y = maxPos.y;
        } else {
          this.state.position.x = maxPos.x;
        }
      }
    }

    async init() {
      this.createDom();
      this.attachEvents();
      this.attachMessageListener();
      await this.loadStateFromStorage();
      this.applyState(false);
      this.draw();
    }

    async loadStateFromStorage() {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      const config = normalizeConfig(stored[STORAGE_KEY]);
      const site = normalizeSiteConfig(config.sites[this.hostKey]);

      this.state.orientation = site.orientation;
      this.state.position = { ...site.position };
      this.state.length = site.length;
      this.state.pinned = site.pinned;
      this.state.pinnedMode = site.pinnedMode;
      this.state.snap = site.snap;

      this.state.opacity = config.global.opacity;
      this.state.density = config.global.density;
      this.state.theme = config.global.theme;
      this.state.showPx = config.global.showPx;
      this.state.showCm = config.global.showCm;
      this.state.thickness = config.global.thickness;
      this.state.pxPerCm = config.global.pxPerCm;
      this.state.calibrated = config.global.calibrated;
    }

    async updateStoredConfig(mutator) {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      const config = normalizeConfig(stored[STORAGE_KEY]);
      mutator(config);
      await chrome.storage.local.set({ [STORAGE_KEY]: config });
      return config;
    }

    async persistSiteState() {
      const nextSite = normalizeSiteConfig({
        orientation: this.state.orientation,
        position: { ...this.state.position },
        length: this.state.length,
        pinned: this.state.pinned,
        pinnedMode: this.state.pinnedMode,
        snap: this.state.snap
      });

      await this.updateStoredConfig((config) => {
        config.sites[this.hostKey] = nextSite;
      });
    }

    async persistGlobalCalibration() {
      await this.updateStoredConfig((config) => {
        config.global.pxPerCm = this.state.pxPerCm;
        config.global.calibrated = this.state.calibrated;
      });
    }

    createDom() {
      this.root = document.createElement("div");
      this.root.setAttribute("data-transparent-ruler", "root");
      Object.assign(this.root.style, {
        position: "fixed",
        top: "0",
        left: "0",
        zIndex: "2147483646",
        pointerEvents: "none",
        boxSizing: "border-box",
        userSelect: "none",
        display: "none",
        touchAction: "none"
      });

      this.canvas = document.createElement("canvas");
      Object.assign(this.canvas.style, {
        width: "100%",
        height: "100%",
        display: "block"
      });

      this.root.appendChild(this.canvas);
      document.documentElement.appendChild(this.root);
      this.ctx = this.canvas.getContext("2d");
    }

    attachEvents() {
      window.addEventListener("resize", this.boundOnResize, { passive: true });
      window.addEventListener("blur", this.boundOnBlur, true);
      this.root.addEventListener("pointerdown", this.boundOnPointerDown);
      document.addEventListener("pointermove", this.boundOnPointerMove);
      document.addEventListener("pointerup", this.boundOnPointerUp);
      document.addEventListener("pointercancel", this.boundOnPointerUp);
    }

    attachMessageListener() {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        this.handleMessage(message)
          .then((response) => sendResponse(response))
          .catch((error) => sendResponse({ ok: false, error: error.message || "Unknown error." }));
        return true;
      });
    }

    onResize() {
      this.syncGeometry();
      this.draw();
    }

    onBlur() {
      this.finishDragging();
      this.updateInteractionState();
    }

    onPointerDown(event) {
      if (!this.state.visible || this.state.pinned) {
        return;
      }
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      this.isDragging = true;
      this.dragPointerId = event.pointerId;
      this.dragStart = {
        mouseX: event.clientX,
        mouseY: event.clientY,
        x: this.state.position.x,
        y: this.state.position.y
      };

      if (this.root.setPointerCapture) {
        try {
          this.root.setPointerCapture(event.pointerId);
        } catch (_error) {
          // Ignore pointer capture failures.
        }
      }

      this.updateInteractionState();
    }

    onPointerMove(event) {
      if (!this.isDragging || event.pointerId !== this.dragPointerId) {
        return;
      }

      const deltaX = event.clientX - this.dragStart.mouseX;
      const deltaY = event.clientY - this.dragStart.mouseY;
      const size = this.getRenderSize();
      const maxPos = this.getMaxPosition(size);

      const nextPosition = this.getSnappedPosition(
        {
          x: this.dragStart.x + deltaX,
          y: this.dragStart.y + deltaY
        },
        maxPos
      );

      this.state.position.x = nextPosition.x;
      this.state.position.y = nextPosition.y;
      this.syncGeometry();
    }

    onPointerUp(event) {
      if (!this.isDragging || event.pointerId !== this.dragPointerId) {
        return;
      }
      this.finishDragging();
      this.updateInteractionState();
    }

    finishDragging() {
      if (!this.isDragging) {
        return;
      }
      this.isDragging = false;
      this.dragPointerId = null;
      this.persistSiteState().catch(() => undefined);
    }

    pinToMode(mode) {
      this.state.pinned = true;
      this.state.pinnedMode = normalizePinnedMode(mode);
      this.syncGeometry();
    }

    syncGeometry() {
      if (!this.root) {
        return;
      }

      const size = this.getRenderSize();
      const maxPos = this.getMaxPosition(size);

      this.applyPinConstraints(maxPos);
      const bounded = this.clampPosition(this.state.position, maxPos);
      this.state.position.x = bounded.x;
      this.state.position.y = bounded.y;

      Object.assign(this.root.style, {
        width: `${Math.round(size.width)}px`,
        height: `${Math.round(size.height)}px`,
        left: `${Math.round(this.state.position.x)}px`,
        top: `${Math.round(this.state.position.y)}px`
      });
    }

    applyState(drawNow = true) {
      this.root.style.display = this.state.visible ? "block" : "none";
      this.syncGeometry();
      this.updateInteractionState();
      if (drawNow) {
        this.draw();
      }
    }

    updateInteractionState() {
      const theme = this.getTheme();
      const accentRgb = toRgbString(theme.accent);

      this.root.style.pointerEvents = this.state.visible ? "auto" : "none";
      this.root.style.cursor = this.state.pinned
        ? "default"
        : (this.isDragging ? "grabbing" : "grab");
      this.root.style.outline = this.state.visible && this.isDragging
        ? `1px dashed rgba(${accentRgb}, 0.85)`
        : "none";
    }

    resizeCanvas() {
      if (!this.canvas || !this.ctx) {
        return null;
      }

      const rect = this.root.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) {
        return null;
      }

      const dpr = window.devicePixelRatio || 1;
      const nextWidth = Math.max(1, Math.round(rect.width * dpr));
      const nextHeight = Math.max(1, Math.round(rect.height * dpr));

      if (this.canvas.width !== nextWidth || this.canvas.height !== nextHeight) {
        this.canvas.width = nextWidth;
        this.canvas.height = nextHeight;
      }

      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width: rect.width, height: rect.height };
    }

    computePxLabelStep(baseStep, minSpacingPx) {
      let step = Math.max(baseStep, 1);
      while (step < minSpacingPx) {
        step += baseStep;
      }
      return step;
    }

    computeCmLabelStep(minSpacingPx) {
      let cmStep = 1;
      while (cmStep * this.state.pxPerCm < minSpacingPx) {
        cmStep += 1;
      }
      return cmStep;
    }

    clipRect(ctx, x, y, width, height) {
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.clip();
    }

    draw() {
      if (!this.ctx || !this.root) {
        return;
      }

      const size = this.resizeCanvas();
      if (!size) {
        return;
      }

      const width = size.width;
      const height = size.height;
      const ctx = this.ctx;
      const theme = this.getTheme();
      const fontSize = this.state.thickness < 56 ? 10 : 11;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = `rgba(${toRgbString(theme.background)}, ${this.state.opacity})`;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = `rgba(${toRgbString(theme.frame)}, 0.7)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

      if (!this.state.showPx && !this.state.showCm) {
        ctx.fillStyle = `rgba(${toRgbString(theme.marks)}, 0.9)`;
        ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Enable PX or CM in popup", width / 2, height / 2);
        return;
      }

      ctx.fillStyle = `rgba(${toRgbString(theme.marks)}, 0.92)`;
      ctx.strokeStyle = `rgba(${toRgbString(theme.marks)}, 0.86)`;
      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      if (this.state.orientation === "horizontal") {
        this.drawHorizontal(ctx, width, height);
      } else {
        this.drawVertical(ctx, width, height);
      }
    }

    drawHorizontal(ctx, width, height) {
      const density = DENSITY_CONFIG[this.state.density] || DENSITY_CONFIG.normal;
      const showPx = this.state.showPx;
      const showCm = this.state.showCm;

      let pxBand = null;
      let cmBand = null;
      if (showPx && showCm) {
        const split = Math.max(16, Math.floor(height * 0.52));
        pxBand = { y0: 0, y1: split };
        cmBand = { y0: split, y1: height };
        ctx.beginPath();
        ctx.moveTo(0, split + 0.5);
        ctx.lineTo(width, split + 0.5);
        ctx.stroke();
      } else if (showPx) {
        pxBand = { y0: 0, y1: height };
      } else {
        cmBand = { y0: 0, y1: height };
      }

      if (pxBand) {
        this.drawHorizontalPxBand(ctx, width, pxBand.y0, pxBand.y1, density, showCm);
      }
      if (cmBand) {
        this.drawHorizontalCmBand(ctx, width, cmBand.y0, cmBand.y1, density, showPx);
      }
    }

    drawHorizontalPxBand(ctx, width, y0, y1, density, dualMode) {
      const bandHeight = Math.max(1, y1 - y0);
      const canDrawLabels = bandHeight >= 18;
      const labelZone = canDrawLabels ? 14 : 4;
      const maxTickLen = Math.max(4, bandHeight - labelZone - 2);
      const minorLen = clamp(Math.max(4, Math.floor(bandHeight * 0.2)), 4, maxTickLen);
      const midLen = clamp(Math.max(8, Math.floor(bandHeight * 0.44)), minorLen + 1, maxTickLen);
      const majorLen = clamp(Math.max(12, Math.floor(bandHeight * 0.68)), midLen + 1, maxTickLen);
      const labelMinSpacing = dualMode ? 86 : 64;
      const baseLabelStep = Math.max(100, density.pxMajorStep * (dualMode ? 2 : 1));
      const labelStep = this.computePxLabelStep(baseLabelStep, labelMinSpacing);

      ctx.save();
      this.clipRect(ctx, 0, y0, width, bandHeight);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      let lastLabelRight = 28;

      for (let x = 0; x <= width; x += density.pxMinorStep) {
        const intX = Math.round(x);
        const posX = intX + 0.5;
        let tickLen = minorLen;
        const isMajor = intX % density.pxMajorStep === 0;
        const isMid = intX % density.pxMidStep === 0;

        if (isMajor) {
          tickLen = majorLen;
        } else if (isMid) {
          tickLen = midLen;
        }

        ctx.beginPath();
        ctx.moveTo(posX, y0 + 0.5);
        ctx.lineTo(posX, y0 + tickLen);
        ctx.stroke();

        if (canDrawLabels && isMajor && intX !== 0 && intX % labelStep === 0) {
          const text = `${intX}px`;
          const textX = posX + 2;
          const textWidth = ctx.measureText(text).width;
          if (textX > lastLabelRight + 8 && textX + textWidth < width - 2) {
            const textY = y1 - 2;
            ctx.fillText(text, textX, textY);
            lastLabelRight = textX + textWidth;
          }
        }
      }

      if (bandHeight >= 13) {
        ctx.fillText("PX", 4, y1 - 2);
      }
      ctx.restore();
    }

    drawHorizontalCmBand(ctx, width, y0, y1, density, dualMode) {
      const bandHeight = Math.max(1, y1 - y0);
      const canDrawLabels = bandHeight >= 18;
      const labelZone = canDrawLabels ? 14 : 4;
      const maxTickLen = Math.max(4, bandHeight - labelZone - 2);
      const minorLen = clamp(Math.max(4, Math.floor(bandHeight * 0.2)), 4, maxTickLen);
      const midLen = clamp(Math.max(8, Math.floor(bandHeight * 0.44)), minorLen + 1, maxTickLen);
      const majorLen = clamp(Math.max(12, Math.floor(bandHeight * 0.68)), midLen + 1, maxTickLen);
      const cmDivisions = density.cmMinorDivisions;
      const cmStepPx = this.state.pxPerCm / cmDivisions;
      const cmLabelEvery = this.computeCmLabelStep(dualMode ? 86 : 64);
      const midDivision = cmDivisions % 2 === 0 ? cmDivisions / 2 : null;

      ctx.save();
      this.clipRect(ctx, 0, y0, width, bandHeight);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      let lastLabelRight = 28;

      for (let i = 0; ; i += 1) {
        const x = i * cmStepPx;
        if (x > width) {
          break;
        }

        const posX = Math.round(x) + 0.5;
        let tickLen = minorLen;
        const isMajor = i % cmDivisions === 0;
        const isMid = Boolean(midDivision && i % midDivision === 0);

        if (isMajor) {
          tickLen = majorLen;
        } else if (isMid) {
          tickLen = midLen;
        }

        ctx.beginPath();
        ctx.moveTo(posX, y0 + 0.5);
        ctx.lineTo(posX, y0 + tickLen);
        ctx.stroke();

        if (canDrawLabels && isMajor && i !== 0) {
          const cmValue = Math.round(i / cmDivisions);
          if (cmValue % cmLabelEvery === 0) {
            const text = `${cmValue}cm`;
            const textX = posX + 2;
            const textWidth = ctx.measureText(text).width;
            if (textX > lastLabelRight + 8 && textX + textWidth < width - 2) {
              const textY = y1 - 2;
              ctx.fillText(text, textX, textY);
              lastLabelRight = textX + textWidth;
            }
          }
        }
      }

      if (bandHeight >= 13) {
        ctx.fillText("CM", 4, y1 - 3);
      }
      ctx.restore();
    }

    drawVertical(ctx, width, height) {
      const density = DENSITY_CONFIG[this.state.density] || DENSITY_CONFIG.normal;
      const showPx = this.state.showPx;
      const showCm = this.state.showCm;

      let pxBand = null;
      let cmBand = null;
      if (showPx && showCm) {
        const split = Math.max(16, Math.floor(width * 0.52));
        pxBand = { x0: 0, x1: split };
        cmBand = { x0: split, x1: width };
        ctx.beginPath();
        ctx.moveTo(split + 0.5, 0);
        ctx.lineTo(split + 0.5, height);
        ctx.stroke();
      } else if (showPx) {
        pxBand = { x0: 0, x1: width };
      } else {
        cmBand = { x0: 0, x1: width };
      }

      if (pxBand) {
        this.drawVerticalPxBand(ctx, pxBand.x0, pxBand.x1, height, density, showCm);
      }
      if (cmBand) {
        this.drawVerticalCmBand(ctx, cmBand.x0, cmBand.x1, height, density, showPx);
      }
    }

    drawVerticalPxBand(ctx, x0, x1, height, density, dualMode) {
      const bandWidth = Math.max(1, x1 - x0);
      const canDrawLabels = bandWidth >= 36;
      const labelZone = canDrawLabels ? 34 : 6;
      const maxTickLen = Math.max(4, bandWidth - labelZone - 2);
      const minorLen = clamp(Math.max(4, Math.floor(bandWidth * 0.2)), 4, maxTickLen);
      const midLen = clamp(Math.max(8, Math.floor(bandWidth * 0.44)), minorLen + 1, maxTickLen);
      const majorLen = clamp(Math.max(12, Math.floor(bandWidth * 0.68)), midLen + 1, maxTickLen);
      const labelMinSpacing = dualMode ? 86 : 68;
      const baseLabelStep = Math.max(100, density.pxMajorStep * (dualMode ? 2 : 1));
      const labelStep = this.computePxLabelStep(baseLabelStep, labelMinSpacing);

      ctx.save();
      this.clipRect(ctx, x0, 0, bandWidth, height);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      let lastLabelY = 14;

      for (let y = 0; y <= height; y += density.pxMinorStep) {
        const intY = Math.round(y);
        const posY = intY + 0.5;
        let tickLen = minorLen;
        const isMajor = intY % density.pxMajorStep === 0;
        const isMid = intY % density.pxMidStep === 0;

        if (isMajor) {
          tickLen = majorLen;
        } else if (isMid) {
          tickLen = midLen;
        }

        ctx.beginPath();
        ctx.moveTo(x0 + 0.5, posY);
        ctx.lineTo(x0 + tickLen, posY);
        ctx.stroke();

        if (canDrawLabels && isMajor && intY !== 0 && intY % labelStep === 0) {
          const text = `${intY}px`;
          if (posY > lastLabelY + 10 && posY < height - 4) {
            ctx.fillText(text, x1 - 2, posY);
            lastLabelY = posY;
          }
        }
      }

      if (bandWidth >= 24) {
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("PX", x0 + 4, 2);
      }
      ctx.restore();
    }

    drawVerticalCmBand(ctx, x0, x1, height, density, dualMode) {
      const bandWidth = Math.max(1, x1 - x0);
      const canDrawLabels = bandWidth >= 36;
      const labelZone = canDrawLabels ? 32 : 6;
      const maxTickLen = Math.max(4, bandWidth - labelZone - 2);
      const minorLen = clamp(Math.max(4, Math.floor(bandWidth * 0.2)), 4, maxTickLen);
      const midLen = clamp(Math.max(8, Math.floor(bandWidth * 0.44)), minorLen + 1, maxTickLen);
      const majorLen = clamp(Math.max(12, Math.floor(bandWidth * 0.68)), midLen + 1, maxTickLen);
      const cmDivisions = density.cmMinorDivisions;
      const cmStepPx = this.state.pxPerCm / cmDivisions;
      const cmLabelEvery = this.computeCmLabelStep(dualMode ? 86 : 70);
      const midDivision = cmDivisions % 2 === 0 ? cmDivisions / 2 : null;

      ctx.save();
      this.clipRect(ctx, x0, 0, bandWidth, height);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      let lastLabelY = 14;

      for (let i = 0; ; i += 1) {
        const y = i * cmStepPx;
        if (y > height) {
          break;
        }

        const posY = Math.round(y) + 0.5;
        let tickLen = minorLen;
        const isMajor = i % cmDivisions === 0;
        const isMid = Boolean(midDivision && i % midDivision === 0);

        if (isMajor) {
          tickLen = majorLen;
        } else if (isMid) {
          tickLen = midLen;
        }

        ctx.beginPath();
        ctx.moveTo(x1 - 0.5, posY);
        ctx.lineTo(x1 - tickLen, posY);
        ctx.stroke();

        if (canDrawLabels && isMajor && i !== 0) {
          const cmValue = Math.round(i / cmDivisions);
          if (cmValue % cmLabelEvery === 0) {
            if (posY > lastLabelY + 10 && posY < height - 4) {
              ctx.fillText(`${cmValue}cm`, x0 + 2, posY);
              lastLabelY = posY;
            }
          }
        }
      }

      if (bandWidth >= 24) {
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("CM", x0 + 4, 2);
      }
      ctx.restore();
    }

    getStateSnapshot() {
      return {
        visible: this.state.visible,
        orientation: this.state.orientation,
        position: { ...this.state.position },
        length: this.state.length,
        thickness: this.state.thickness,
        pinned: this.state.pinned,
        pinnedMode: this.state.pinnedMode,
        snap: this.state.snap,
        opacity: this.state.opacity,
        density: this.state.density,
        theme: this.state.theme,
        showPx: this.state.showPx,
        showCm: this.state.showCm,
        pxPerCm: this.state.pxPerCm,
        calibrated: this.state.calibrated
      };
    }

    closeCalibration() {
      if (!this.calibrationOverlay) {
        return;
      }
      this.calibrationOverlay.remove();
      this.calibrationOverlay = null;
    }

    startCalibration() {
      if (this.calibrationOverlay) {
        return;
      }

      const theme = this.getTheme();
      const accentRgb = toRgbString(theme.accent);
      const accentLightRgb = toRgbString(mixColor(theme.accent, [255, 255, 255], 0.62));

      const overlay = document.createElement("div");
      Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483647",
        background: "rgba(18, 27, 35, 0.35)",
        display: "grid",
        placeItems: "center",
        pointerEvents: "auto"
      });

      const panel = document.createElement("div");
      Object.assign(panel.style, {
        width: "min(560px, calc(100vw - 24px))",
        background: "#ffffff",
        border: "1px solid rgba(20, 32, 45, 0.2)",
        borderRadius: "12px",
        padding: "16px",
        boxSizing: "border-box",
        fontFamily: "Segoe UI, Helvetica Neue, Arial, sans-serif",
        color: "#14202d",
        display: "grid",
        gap: "10px"
      });

      const title = document.createElement("h2");
      title.textContent = "Calibrate centimeters";
      Object.assign(title.style, {
        margin: "0",
        fontSize: "18px"
      });

      const description = document.createElement("p");
      description.textContent = "Place a bank card or ruler against the screen and adjust the width.";
      Object.assign(description.style, {
        margin: "0",
        fontSize: "13px",
        color: "#30465e"
      });

      const modeRow = document.createElement("label");
      modeRow.textContent = "Reference:";
      Object.assign(modeRow.style, {
        display: "grid",
        gap: "6px",
        fontSize: "13px",
        fontWeight: "600"
      });

      const modeSelect = document.createElement("select");
      modeSelect.innerHTML = [
        "<option value='8.56'>Bank card width (85.60 mm)</option>",
        "<option value='5'>Custom ruler (5 cm)</option>"
      ].join("");
      Object.assign(modeSelect.style, {
        border: "1px solid rgba(20, 32, 45, 0.25)",
        borderRadius: "8px",
        padding: "8px",
        fontSize: "13px"
      });

      const previewWrap = document.createElement("div");
      Object.assign(previewWrap.style, {
        border: "1px dashed rgba(20, 32, 45, 0.35)",
        borderRadius: "8px",
        padding: "10px",
        overflow: "hidden"
      });

      const previewBar = document.createElement("div");
      Object.assign(previewBar.style, {
        height: "54px",
        width: "324px",
        borderRadius: "8px",
        background: `linear-gradient(90deg, rgba(${accentLightRgb}, 0.95) 0%, rgba(${accentRgb}, 0.42) 100%)`,
        border: `1px solid rgba(${accentRgb}, 0.55)`,
        boxSizing: "border-box",
        transition: "width 0.05s linear"
      });

      const widthRange = document.createElement("input");
      widthRange.type = "range";
      widthRange.min = "100";
      widthRange.max = String(Math.max(200, Math.floor(window.innerWidth * 0.95)));
      widthRange.step = "1";

      const status = document.createElement("p");
      Object.assign(status.style, {
        margin: "0",
        fontSize: "12px",
        color: "#30465e"
      });

      const buttonRow = document.createElement("div");
      Object.assign(buttonRow.style, {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px"
      });

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "Save calibration";
      Object.assign(saveBtn.style, {
        border: `1px solid rgba(${accentRgb}, 1)`,
        background: `rgba(${accentRgb}, 1)`,
        color: "#ffffff",
        borderRadius: "8px",
        padding: "10px",
        cursor: "pointer",
        fontWeight: "700"
      });

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      Object.assign(cancelBtn.style, {
        border: "1px solid rgba(20, 32, 45, 0.25)",
        background: "#ffffff",
        color: "#14202d",
        borderRadius: "8px",
        padding: "10px",
        cursor: "pointer"
      });

      modeRow.appendChild(modeSelect);
      previewWrap.appendChild(previewBar);
      buttonRow.append(saveBtn, cancelBtn);
      panel.append(title, description, modeRow, previewWrap, widthRange, status, buttonRow);
      overlay.appendChild(panel);
      document.documentElement.appendChild(overlay);

      const recalc = () => {
        const refCm = Number(modeSelect.value);
        const widthPx = clamp(Number(widthRange.value) || 0, 1, Number(widthRange.max));
        previewBar.style.width = `${widthPx}px`;
        status.textContent = `Width: ${Math.round(widthPx)}px | ${(widthPx / refCm).toFixed(2)} px/cm`;
      };

      const resetWidthForMode = () => {
        const refCm = Number(modeSelect.value);
        const suggestedWidth = clamp(
          Math.round(this.state.pxPerCm * refCm),
          Number(widthRange.min),
          Number(widthRange.max)
        );
        widthRange.value = String(suggestedWidth);
        recalc();
      };

      modeSelect.addEventListener("change", resetWidthForMode);
      widthRange.addEventListener("input", recalc);

      saveBtn.addEventListener("click", async () => {
        const refCm = Number(modeSelect.value);
        const widthPx = Number(widthRange.value);
        if (!Number.isFinite(refCm) || !Number.isFinite(widthPx) || refCm <= 0 || widthPx <= 0) {
          return;
        }

        this.state.pxPerCm = widthPx / refCm;
        this.state.calibrated = true;
        await this.persistGlobalCalibration();
        this.draw();
        this.closeCalibration();
        chrome.runtime.sendMessage({
          type: "CALIBRATION_UPDATED",
          state: this.getStateSnapshot()
        }).catch(() => undefined);
      });

      cancelBtn.addEventListener("click", () => this.closeCalibration());
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          this.closeCalibration();
        }
      });
      panel.addEventListener("click", (event) => event.stopPropagation());

      this.calibrationOverlay = overlay;
      resetWidthForMode();
    }

    async handleMessage(message) {
      if (!message || typeof message !== "object") {
        return { ok: false, error: "Invalid message." };
      }

      switch (message.type) {
        case "PING":
          return { ok: true };

        case "GET_STATE":
          return { ok: true, state: this.getStateSnapshot() };

        case "TOGGLE_VISIBILITY":
          this.state.visible = !this.state.visible;
          this.applyState(true);
          return { ok: true, state: this.getStateSnapshot() };

        case "SET_ORIENTATION":
          if (message.orientation === "horizontal" || message.orientation === "vertical") {
            this.state.orientation = message.orientation;
            this.syncGeometry();
            this.draw();
            await this.persistSiteState();
          }
          return { ok: true, state: this.getStateSnapshot() };

        case "TOGGLE_ORIENTATION":
          this.state.orientation = this.state.orientation === "horizontal" ? "vertical" : "horizontal";
          if (message.forceVisible) {
            this.state.visible = true;
          }
          this.applyState(true);
          await this.persistSiteState();
          return { ok: true, state: this.getStateSnapshot() };

        case "SET_OPACITY":
          if (Number.isFinite(message.opacity)) {
            this.state.opacity = clamp(Number(message.opacity), 0.2, 0.9);
            this.draw();
          }
          return { ok: true, state: this.getStateSnapshot() };

        case "SET_DENSITY":
          this.state.density = normalizeDensity(message.density);
          this.draw();
          return { ok: true, state: this.getStateSnapshot() };

        case "SET_THEME":
          this.state.theme = normalizeTheme(message.theme);
          this.updateInteractionState();
          this.draw();
          return { ok: true, state: this.getStateSnapshot() };

        case "SET_SCALE_VISIBILITY": {
          let showPx = message.showPx !== false;
          let showCm = message.showCm !== false;
          if (!showPx && !showCm) {
            showPx = true;
          }
          this.state.showPx = showPx;
          this.state.showCm = showCm;
          this.draw();
          return { ok: true, state: this.getStateSnapshot() };
        }

        case "SET_LENGTH":
          if (Number.isFinite(message.length)) {
            this.state.length = clamp(Number(message.length), MIN_LENGTH, MAX_LENGTH);
            this.syncGeometry();
            this.draw();
            await this.persistSiteState();
          }
          return { ok: true, state: this.getStateSnapshot() };

        case "SET_THICKNESS":
          if (Number.isFinite(message.thickness)) {
            this.state.thickness = clamp(Number(message.thickness), MIN_THICKNESS, MAX_THICKNESS);
            this.syncGeometry();
            this.draw();
          }
          return { ok: true, state: this.getStateSnapshot() };

        case "SET_SNAP":
          this.state.snap = Boolean(message.snap);
          await this.persistSiteState();
          return { ok: true, state: this.getStateSnapshot() };

        case "PIN_CURRENT":
          this.pinToMode("current");
          this.applyState(true);
          await this.persistSiteState();
          return { ok: true, state: this.getStateSnapshot() };

        case "PIN_EDGE":
          this.pinToMode(message.edge === "end" ? "end" : "start");
          this.applyState(true);
          await this.persistSiteState();
          return { ok: true, state: this.getStateSnapshot() };

        case "UNPIN":
          this.state.pinned = false;
          this.applyState(true);
          await this.persistSiteState();
          return { ok: true, state: this.getStateSnapshot() };

        case "START_CALIBRATION":
          this.startCalibration();
          return { ok: true, state: this.getStateSnapshot() };

        case "RESET_CALIBRATION":
          this.state.pxPerCm = DEFAULT_PX_PER_CM;
          this.state.calibrated = false;
          await this.persistGlobalCalibration();
          this.draw();
          return { ok: true, state: this.getStateSnapshot() };

        default:
          return { ok: false, error: "Unsupported command." };
      }
    }
  }

  const overlay = new TransparentRulerOverlay();
  overlay.init().catch(() => undefined);
})();
