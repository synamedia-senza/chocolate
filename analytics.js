// either import the Senza SDK using a script tag, or call
// `import * as senza from "senza-sdk"` before importing this file

window.dataLayer = window.dataLayer || [];

function gtag() {
  dataLayer.push(arguments);
}

class SenzaAnalytics {
  ipData = {};
  config = {
    google: {gtag: null, debug: false},
    ipdata: {apikey: null},
    userInfo: {},
    lifecycle: {raw: false, summary: true},
    player: {raw: false, summary: true}
  };

  constructor() {
    this.banner = null;
    this.interval = null;
    this.restoreLifecycleState();
    this.restorePlayerState();

    senza.lifecycle.addEventListener("beforestatechange", async (event) => {
      if (event.state === "background") {
        await this.willMoveToBackground();
      }
    });

    senza.lifecycle.addEventListener("onstatechange", (event) => {
      if (event.state === "background") {
        this.movedToBackground();
      } else if (event.state === "foreground") {
        this.movedToForeground();
      }
    });

    senza.lifecycle.addEventListener("userdisconnected", async () => {
      await this.playerSessionEnd("session_end", { awaitDelivery: true });
      await this.lifecycleSessionEnd();
    });

    this.createBanner();
    this.startLifecycleTimer();
  }

  async init(app, sparseConfig = {}) {
    this.configure(sparseConfig);

    console.log("analytics.config", this.config);

    if (this.config.google.gtag) {
      const gtagScript = document.createElement("script");
      gtagScript.async = true;
      gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${this.config.google.gtag}`;
      document.head.appendChild(gtagScript);
    }

    let props = { app };
    copyValues(props, this.config.userInfo);

    if (senza.isRunningE2E()) {
      const deviceInfo = senza.deviceManager.deviceInfo;
      copyValues(props, deviceInfo, ["countryCode", "tenant", "community", "connectionType"]);
      props["user_id"] = deviceInfo.deviceId;
    } else {
      props["connection_type"] = "browser";
    }

    if (this.config.ipdata.apikey) {
      this.ipData = await this.getLocation(this.config.ipdata.apikey);
      copyValues(props, this.ipData, ["city", "region", "country_code"]);
    }

    gtag('js', new Date());
    gtag('config', this.config.google.gtag);
    gtag('set', 'user_properties', props);
    gtag('set', 'debug_mode', this.config.google.debug);

    console.log('analytics.init', props);
  }

  configure(sparseConfig) {
    deepMerge(this.config, sparseConfig);
  }

  async getLocation(ipDataAPIKey) {
    let ipAddress = senza.isRunningE2E() ? senza.deviceManager.deviceInfo.clientIp : "";
    let json = await (await fetch(`https://api.ipdata.co/${ipAddress}?api-key=${ipDataAPIKey}`)).json();
    return json;
  }

  logEvent(eventName, data = {}) {
    data = {...data,
      debug_mode: this.config.google.debug,
      transport_type: 'beacon',
    };
    gtag('event', eventName, data)
    console.log('event', eventName, data);
  }

  //// LIFECYCLE ////

  restoreLifecycleState() {
    this.foreground = parseInt(sessionStorage.getItem("stopwatch/foreground")) || 0;
    this.background = parseInt(sessionStorage.getItem("stopwatch/background")) || 0;
    this.backgroundTime = parseInt(sessionStorage.getItem("stopwatch/backgroundTime")) || 0;
  }

  saveLifecycleState() {
    sessionStorage.setItem("stopwatch/foreground", `${this.foreground}`);
    sessionStorage.setItem("stopwatch/background", `${this.background}`);
    sessionStorage.setItem("stopwatch/backgroundTime", `${this.backgroundTime}`);
  }

  startLifecycleTimer() {
    this.updateBanner();
    clearInterval(this.interval);
    this.interval = setInterval(() => {
      this.foreground++;
      this.updateBanner();
      this.saveLifecycleState();
    }, 1000);
  }

  stopLifecycleTimer() {
    clearInterval(this.interval);
  }

  movedToForeground() {
    setTimeout(() => this.banner.style.color = 'white', 500);
    if (this.backgroundTime) {
      this.background += Math.ceil((Date.now() - this.backgroundTime) / 1000);
    }
    this.startLifecycleTimer();
    this.logLifecycleEvent("foreground");
  }

  async willMoveToBackground() {
    this.banner.style.color = 'red';
    await this.sleep(0.025);
  }

  movedToBackground() {
    this.banner.style.color = 'red';
    this.backgroundTime = Date.now();
    this.stopLifecycleTimer();
    this.saveLifecycleState();
    this.savePlayerState();
    this.logLifecycleEvent("background");
  }

  lifecycleState() {
    return {
      foreground: this.foreground,
      background: this.background,
      total: this.foreground + this.background,
      ratio: Math.floor(this.foreground / (this.foreground + this.background) * 1000) / 1000
    };
  }

  logLifecycleEvent(state) {
    if (this.config.lifecycle.raw) {
      let message = this.lifecycleState();
      message.state = state;
      this.logEvent("lifecycle", message);
    }
  }

  lifecycleSessionEnd() {
    return new Promise((resolve) => {
      if (this.config.lifecycle.summary) {
        let message = this.lifecycleState();
        message.event_callback = () => {
          setTimeout(resolve, 3000);
        };
        message.event_timeout = 5000;
        this.logEvent("lifecycle_session_end", message);
      } else {
        resolve();
      }
    });
  }

  createBanner() {
    this.banner = document.createElement('div');
    this.banner.style.position = 'fixed';
    this.banner.style.top = '100px';
    this.banner.style.left = '0';
    this.banner.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
    this.banner.style.color = 'white';
    this.banner.style.fontFamily = 'monospace';
    this.banner.style.fontWeight = '500';
    this.banner.style.fontSize = '24px';
    this.banner.style.padding = '22px';
    this.banner.style.display = 'flex';
    this.banner.style.zIndex = '1000';
    this.banner.style.pointerEvents = 'none';
    this.banner.style.opacity = 0;
    document.body.appendChild(this.banner);
  }

  updateBanner() {
    if (this.banner) {
      let ratio = this.foreground ? Math.floor(this.foreground /
        (this.foreground + this.background) * 10000) / 100 : 100;
      this.banner.innerHTML =  `Foreground: ${formatTime(this.foreground)}<br>`;
      this.banner.innerHTML += `Background: ${formatTime(this.background)}<br>`;
      this.banner.innerHTML += `${'&nbsp;'.repeat(4)} Ratio: ${ratio.toFixed(2)}%`;
    }
  }

  showStopwatch() {
    this.banner.style.opacity = 1;
  }

  hideStopwatch() {
    this.banner.style.opacity = 0;
  }

  async sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  //// PLAYER ////

  playerStorageKey = "player/session";

  restorePlayerState() {
    try {
      const raw = sessionStorage.getItem(this.playerStorageKey);
      this._restoredPlayerCore = raw ? JSON.parse(raw) : null;
    } catch (_) {
      this._restoredPlayerCore = null;
    }
  }

  savePlayerState() {
    const s = this._playerSession;
    if (!s) return;

    const core = {
      src: s.url?.() || s.meta?.src || "",
      startedAt: s.startedAt,
      watchedMs: s.watchedMs,
      lastPlayStart: s.lastPlayStart,
      lastTime: s.lastTime,
      metaSnapshot: s.meta || {},
      sent: s.sent,
      active: s.active,
    };

    try {
      sessionStorage.setItem(this.playerStorageKey, JSON.stringify(core));
    } catch (_) {}
  }

  clearPlayerState() {
    try {
      sessionStorage.removeItem(this.playerStorageKey);
    } catch (_) {}
    this._restoredPlayerCore = null;
  }

 /** Track events in the Shaka player and the media element.
  * The third argument can be either an object with media properties,
  * or an (async) function that takes the URL of a stream and returns its properties.
  *
  * If config.player.raw, sends all low-level events (play, pause, skip, etc.)
  * If config.player.summary, sends just one player_session_end event per stream watched.
  *
  * Works equally well with regular Shaka or the Senza Shaka subclass.
  * In the latter case it is sufficient to follow the local player because
  * we know the remote player is simply following what hte local player is doing.
  *
  * If using the remote player directly without a local player, use trackRemotePlayerEvents() instead.
  **/
  trackPlayerEvents(player, media, metaOrFn = {}) {
    // --- helpers (same semantics as your current version) ---
    const enterPlaying = () => {
      if (!this._playerSession?.active) return;
      if (this._playerSession.lastPlayStart == null) {
        this._playerSession.lastPlayStart = Date.now();
      }
      this.savePlayerState();
      if (this.config.player.raw) {
        this.logEvent("player_state", {
          state: "playing",
          current_time: media.currentTime || 0,
          src: this._playerSession.url(),
          ...snakeMeta(this._playerSession.meta),
        });
      }
    };

    const leavePlaying = (state) => {
      if (!this._playerSession?.active) return;
      if (this._playerSession.lastPlayStart != null) {
        this._playerSession.watchedMs += Date.now() - this._playerSession.lastPlayStart;
        this._playerSession.lastPlayStart = null;
      }
      this.savePlayerState();
      if (this.config.player.raw && state) {
        this.logEvent("player_state", {
          state,
          current_time: media.currentTime || 0,
          src: this._playerSession.url(),
          ...snakeMeta(this._playerSession.meta),
        });
      }
    };

    const onSeeking = () => {
      leavePlaying("seeking");
      this.savePlayerState();
      if (this.config.player.raw) {
        this.logEvent("player_seek", {
          current_time: media.currentTime || 0,
          src: this._playerSession.url(),
          ...snakeMeta(this._playerSession.meta),
        });
      }
    };

    const onSeeked = () => {
      if (this.config.player.raw) {
        this.logEvent("player_seeked", {
          current_time: media.currentTime || 0,
          src: this._playerSession.url(),
          ...snakeMeta(this._playerSession.meta),
        });
      }
    };

    const onEnded = () => {
      leavePlaying("ended");
      this.playerSessionEnd("ended");
    };

    const beginSession = (initialMeta = {}, urlHint = "") => {
      this._playerSession = {
        active: true,
        media,
        remote: null,
        sent: false,
        url: () =>
          media.currentSrc ||
          initialMeta.src ||
          initialMeta.url ||
          urlHint ||
          "",
        meta: { ...initialMeta },
        startedAt: Date.now(),
        lastPlayStart: null,
        watchedMs: 0,
        lastTime: 0,
        metaProvider: metaOrFn,
        player,
      };
    };

    const onPause   = () => leavePlaying("pause");
    const onWaiting = () => leavePlaying("waiting");
    const onStalled = () => leavePlaying("stalled");

    media.addEventListener("playing", enterPlaying);
    media.addEventListener("pause",   onPause);
    media.addEventListener("waiting", onWaiting);
    media.addEventListener("stalled", onStalled);
    media.addEventListener("seeking", onSeeking);
    media.addEventListener("seeked",  onSeeked);
    media.addEventListener("ended",   onEnded);

    try {
      player.addEventListener("unloading", () => {
        this.playerSessionEnd("unload");
      });
    } catch (_) {}

    const __origLoad = player.load.bind(player);

    player.load = async (url, ...rest) => {
      const restored = this._restoredPlayerCore;
      const isContinuation =
        restored &&
        restored.active &&
        !restored.sent &&
        restored.src === url;

      if (!isContinuation) {
        if (restored && restored.active && !restored.sent) {
          this.logEvent("player_session_end", {
            src: restored.src,
            reason: "restart_abandoned",
            started_at_ms: restored.startedAt,
            watched_ms: restored.watchedMs || 0,
            watched_sec: Math.round((restored.watchedMs || 0) / 1000),
            ...snakeMeta(restored.metaSnapshot || {}),
          });
        }
        await this.playerSessionEnd("load_new_url");
      }

      const initialMeta = (typeof metaOrFn === "function")
        ? await resolveMeta(metaOrFn, { url, player, media })
        : (metaOrFn || {});
      if (!initialMeta.src) initialMeta.src = url;

      const result = await __origLoad(url, ...rest);

      beginSession(initialMeta, url);

      if (isContinuation) {
        this._playerSession.startedAt = restored.startedAt;
        this._playerSession.watchedMs = restored.watchedMs || 0;
        this._playerSession.lastPlayStart = restored.lastPlayStart;
        this._playerSession.lastTime = restored.lastTime || 0;
        if (!Object.keys(this._playerSession.meta || {}).length) {
          this._playerSession.meta = restored.metaSnapshot || {};
        }
      }

      this._restoredPlayerCore = null;
      this.savePlayerState();

      // backfill duration when metadata becomes available
      const onLoadedMeta = () => {
        if (!this._playerSession?.active) return;
        const d = media.duration;
        if (Number.isFinite(d) && d > 0 && this._playerSession.meta.durationSec == null) {
          this._playerSession.meta.durationSec = Math.round(d);
        }
        media.removeEventListener("loadedmetadata", onLoadedMeta);
      };
      media.addEventListener("loadedmetadata", onLoadedMeta, { once: true, passive: true });

      // prefer canonical asset URI if Shaka provides one
      try {
        const finalUri = typeof player.getAssetUri === "function" ? player.getAssetUri() : null;
        if (finalUri) this._playerSession.meta.src = finalUri;
      } catch (_) {}

      this.savePlayerState();

      return result;
    };

    // Stash a detach to remove media listeners if you later dispose
    this._playerSession = this._playerSession || { active: false };
    this._playerSession.detach = () => {
      media.removeEventListener("playing", enterPlaying);
      media.removeEventListener("pause",   onPause);
      media.removeEventListener("waiting", onWaiting);
      media.removeEventListener("stalled", onStalled);
      media.removeEventListener("seeking", onSeeking);
      media.removeEventListener("seeked",  onSeeked);
      media.removeEventListener("ended",   onEnded);
    };
  }

 /** Track events in the Remote Player when using it direclty.
  * The single argument can be either an object with media properties,
  * or an (async) function that takes the URL of a stream and returns its properties.
  *
  * If config.player.raw, sends all low-level events (play, pause, skip, etc.)
  * If config.player.summary, sends just one player_session_end event per stream watched.
  *
  * If using the (Senza) Shaka player, use trackPlayerEvents() instead.
  **/
  trackRemotePlayerEvents(metaOrFn = {}) {
    const player = senza?.remotePlayer;
    if (!player) throw new Error("remotePlayer not available");

    const beginSession = (initialMeta = {}, urlHint = "") => {
      this._playerSession = {
        active: true,
        media: null,
        remote: player,
        sent: false,
        url: () =>
          initialMeta.src ||
          initialMeta.url ||
          player.getAssetUri?.() ||
          urlHint ||
          "",
        meta: { ...initialMeta },
        startedAt: Date.now(),
        lastPlayStart: null,
        watchedMs: 0,
        lastTime: 0,
        metaProvider: metaOrFn,
        player,
      };
    };

    const enterPlaying = () => {
      if (!this._playerSession?.active) return;
      if (this._playerSession.lastPlayStart == null) {
        this._playerSession.lastPlayStart = Date.now();
      }
      this.savePlayerState();
      if (this.config.player.raw) {
        this.logEvent("player_state", {
          state: "playing",
          current_time: this._safeMediaTime(),
          src: this._playerSession.url(),
          ...snakeMeta(this._playerSession.meta),
        });
      }
    };

    const leavePlaying = (state) => {
      if (!this._playerSession?.active) return;
      if (this._playerSession.lastPlayStart != null) {
        this._playerSession.watchedMs += Date.now() - this._playerSession.lastPlayStart;
        this._playerSession.lastPlayStart = null;
      }
      this.savePlayerState();
      if (this.config.player.raw && state) {
        this.logEvent("player_state", {
          state,
          current_time: this._safeMediaTime(),
          src: this._playerSession.url(),
          ...snakeMeta(this._playerSession.meta),
        });
      }
    };

    const onEnded = () => {
      leavePlaying("ended");
      this.playerSessionEnd("ended");
    };

    const onLoadedMeta = () => {
      if (!this._playerSession?.active) return;
      const d = player.duration;
      if (Number.isFinite(d) && d > 0 && this._playerSession.meta.durationSec == null) {
        this._playerSession.meta.durationSec = Math.round(d);
      }
    };

    const onLoadModeChange = () => {
      this.playerSessionEnd("load_new_url");
    };

    player.addEventListener("loadedmetadata", onLoadedMeta, { passive: true });
    player.addEventListener("playing",        enterPlaying,  { passive: true });
    player.addEventListener("ended",          onEnded,       { passive: true });
    player.addEventListener("onloadmodechange", onLoadModeChange, { passive: true });

    const __orig = {
      load:   player.load.bind(player),
      unload: player.unload.bind(player),
      stop:   player.stop.bind(player),
      detach: player.detach.bind(player),
      pause:  player.pause.bind(player),
    };

    player.load = async (url, ...rest) => {
      const restored = this._restoredPlayerCore;
      const isContinuation =
        restored &&
        restored.active &&
        !restored.sent &&
        restored.src === url;

      if (!isContinuation) {
        if (restored && restored.active && !restored.sent) {
          this.logEvent("player_session_end", {
            src: restored.src,
            reason: "restart_abandoned",
            started_at_ms: restored.startedAt,
            watched_ms: restored.watchedMs || 0,
            watched_sec: Math.round((restored.watchedMs || 0) / 1000),
            ...snakeMeta(restored.metaSnapshot || {}),
          });
        }
        await this.playerSessionEnd("load_new_url");
      }

      const initialMeta = (typeof metaOrFn === "function")
        ? await resolveMeta(metaOrFn, { url, player })
        : (metaOrFn || {});
      if (!initialMeta.src) initialMeta.src = url;

      const r = await __orig.load(url, ...rest);

      beginSession(initialMeta, url);

      if (isContinuation) {
        this._playerSession.startedAt = restored.startedAt;
        this._playerSession.watchedMs = restored.watchedMs || 0;
        this._playerSession.lastPlayStart = restored.lastPlayStart;
        this._playerSession.lastTime = restored.lastTime || 0;
        if (!Object.keys(this._playerSession.meta || {}).length) {
          this._playerSession.meta = restored.metaSnapshot || {};
        }
      }

      this._restoredPlayerCore = null;
      this.savePlayerState();

      try {
        const finalUri = player.getAssetUri?.();
        if (finalUri) this._playerSession.meta.src = finalUri;
      } catch (_) {}

      return r;
    };

    player.pause  = async (...args) => { const r = await __orig.pause(...args); leavePlaying("pause"); return r; };
    player.stop   = async (...args) => { leavePlaying("unload"); await this.playerSessionEnd("unload"); return __orig.stop(...args); };
    player.unload = async (...args) => { leavePlaying("unload"); await this.playerSessionEnd("unload"); return __orig.unload(...args); };
    player.detach = async (...args) => { leavePlaying("unload"); await this.playerSessionEnd("unload", { awaitDelivery: true }); return __orig.detach(...args); };

    this._playerSession = this._playerSession || { active: false };
    this._playerSession.detach = () => {
      try {
        player.removeEventListener("loadedmetadata", onLoadedMeta);
        player.removeEventListener("playing", enterPlaying);
        player.removeEventListener("ended", onEnded);
        player.removeEventListener("onloadmodechange", onLoadModeChange);
      } catch (_) {}
    };
  }

  _beginPlayerSession(player, media, initialMeta = {}, urlHint = "") {
    this._playerSession = {
      active: true,
      media,

      remote: media ? null : player,
      sent: false,
      url: () =>
        (media && media.currentSrc) ||
        initialMeta.src || initialMeta.url ||
        urlHint || "",
      meta: { ...initialMeta },
      startedAt: Date.now(),
      lastPlayStart: null,
      watchedMs: 0,
      lastTime: 0,
    };
  }

  // Return a Promise; resolve immediately unless caller opts to await delivery.
  playerSessionEnd(reason = "unknown", { awaitDelivery = false, detachListeners = false } = {}) {
    return new Promise((resolve) => {
      const s = this._playerSession;
      if (!s?.active) return resolve();

      if (s.lastPlayStart != null) {
        s.watchedMs += Date.now() - s.lastPlayStart;
        s.lastPlayStart = null;
      }

      if (this.config.player.raw) {
        this.logEvent("player_state", {
          state: "closing",
          reason,
          current_time: (typeof document !== "undefined" && this._safeMediaTime()) || 0,
          src: s.url(),
          ...snakeMeta(this._playerSession.meta),
        });
      }

      if (this.config.player.summary && !s.sent) {
        const mediaDurationSec = (s.meta?.durationSec != null ? s.meta.durationSec : null);
        const watchedMs = Math.max(0, Math.round(s.watchedMs));
        const watchedSec = Math.round(watchedMs / 1000);
        const payload = {
          src: s.url(),
          reason,
          started_at_ms: s.startedAt,
          watched_ms: watchedMs,
          watched_sec: watchedSec,
          ...snakeMeta(this._playerSession.meta),
        };
        if (typeof mediaDurationSec === "number" && isFinite(mediaDurationSec) && mediaDurationSec > 0) {
          payload.duration_sec = Math.round(mediaDurationSec);
          payload.watch_ratio = Math.min(1, Math.round((watchedSec / mediaDurationSec) * 1000) / 1000);
        }

        if (awaitDelivery) {
          payload.event_callback = () => { setTimeout(resolve, 3000); };
          payload.event_timeout  = 5000;
          this.logEvent("player_session_end", payload);
        } else {
          this.logEvent("player_session_end", payload);
          resolve();
        }
      } else {
        resolve();
      }

      s.sent = true;
      s.active = false;
      if (detachListeners) {
        try { s.detach?.(); } catch (_) {}
      }
      // Persist or clear depending on whether this is a terminal end.
      if (reason === "ended" || reason === "session_end" || reason === "userdisconnected") {
        this.clearPlayerState();
      } else {
        this.savePlayerState();
      }
    });
  }

  _safeMediaTime() {
    const s = this._playerSession;
    try {
      if (s?.media && typeof s.media.currentTime === "number") return s.media.currentTime;
      if (s?.remote && typeof s.remote.currentTime === "number") return s.remote.currentTime;
    } catch (_) {}
    return 0;
  }

  sendPlayerSummary(reason) {
    const s = this._playerSession;
    if (!s) return;

    const mediaDurationSec =
      (s.meta?.durationSec != null ? s.meta.durationSec : null);
    const watchedMs = Math.max(0, Math.round(s.watchedMs));
    const watchedSec = Math.round(watchedMs / 1000);
    const payload = {
      src: s.url(),
      reason, // ended | unload | load_new_url | session_end | unknown
      started_at_ms: s.startedAt,
      watched_ms: watchedMs,
      watched_sec: watchedSec,
      ...snakeMeta(this._playerSession.meta),
    };

    if (typeof mediaDurationSec === "number" && isFinite(mediaDurationSec) && mediaDurationSec > 0) {
      payload.duration_sec = Math.round(mediaDurationSec);
      payload.watch_ratio = Math.min(
        1,
        Math.round((watchedSec / mediaDurationSec) * 1000) / 1000
      );
    }

    this.logEvent("player_session_end", payload);
  }

  /**
   * Mark a logical content/program change on the same manifest/stream.
   *
   * Ends the current player session (sending a summary if enabled),
   * then starts a new one with new metadata.
   *
   * @param {Object|Function} [metaOrFn] - Optional new meta provider,
   *   same semantics as trackPlayerEvents/trackRemotePlayerEvents:
   *   - object: used directly as meta
   *   - function: called (possibly async) with { url, player, media }
   *   - omitted: reuse previous metaProvider (if any)
   */
  async contentChanged(metaOrFn) {
    const s = this._playerSession;
    if (!s || !s.active) {
      console.warn("contentChanged() called with no active player session");
      return;
    }

    const provider = typeof metaOrFn !== "undefined" ? metaOrFn : s.metaProvider;

    await this.playerSessionEnd("content_change", {
      awaitDelivery: false,
      detachListeners: false,
    });

    let initialMeta = {};
    if (typeof provider === "function") {
      const ctx = {
        url: s.url(),
        player: s.remote || s.player || null,
        media: s.media || null,
      };
      initialMeta = await resolveMeta(provider, ctx);
    } else if (provider && typeof provider === "object") {
      initialMeta = provider;
    }

    if (!initialMeta.src) {
      initialMeta.src = s.url();
    }

    this._playerSession = {
      active: true,
      media: s.media,
      remote: s.remote,
      sent: false,
      url: s.url,
      meta: { ...initialMeta },
      startedAt: Date.now(),
      lastPlayStart: null,
      watchedMs: 0,
      lastTime: 0,
      metaProvider: provider,
      player: s.player || s.remote || null,
      detach: s.detach,
    };
  }
}

const analytics = new SenzaAnalytics();
export default analytics;

// copies values with certain keys from one object to another
function copyValues(to, from, keys = null) {
  if (!(keys instanceof Array)) keys = Object.keys(from);
  for (const key of keys) {
    if (key in from) {
      to[camelToSnake(key)] = from[key];
    }
  }
}

// all Google Analytics properties should be in snake case
function camelToSnake(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function snakeMeta(meta = {}) {
  const out = {};
  for (const k of Object.keys(meta)) {
    out[camelToSnake(k)] = meta[k];
  }
  return out;
}

// merge a sparse object's properties into another object
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const k of Object.keys(source)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    const s = source[k], t = target[k];
    if (Array.isArray(s)) {
      target[k] = s.slice();
    } else if (s && typeof s === 'object') {
      target[k] = deepMerge((t && typeof t === 'object' && !Array.isArray(t)) ? t : {}, s);
    } else {
      target[k] = s;
    }
  }
  return target;
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return String(hours) + ':' +
    String(minutes).padStart(2, '0') + ':' +
    String(secs).padStart(2, '0');
}

// Helper: run metaForLoad safely (sync or async), always returns an object
async function resolveMeta(metaForLoad, ctx) {
  if (typeof metaForLoad !== 'function') return {};
  try {
    const maybe = metaForLoad(ctx);
    const meta = (maybe && typeof maybe.then === 'function') ? await maybe : maybe;
    return (meta && typeof meta === 'object') ? meta : {};
  } catch (e) {
    return {};
  }
}
