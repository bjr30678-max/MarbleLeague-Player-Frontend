// live-player.js
// ====== OvenPlayer x LIFF 直播播放器 ======
// 支援從網址帶入 cam / stream / host / app 參數

let op; // OvenPlayer instance
let visibilityHandlerRegistered = false;

// 從網址取得參數，沒有就用預設值
const qs = new URLSearchParams(location.search);
const STREAM_HOST = qs.get("host")   || "stream.bjr8888.com";
const APP         = qs.get("app")    || "app";
const STREAM      = qs.get("cam")    || qs.get("stream") || "tapo1"; // ← 支援 ?cam=tapo1

const isMobileOrLIFF = /Line\//i.test(navigator.userAgent) || /iPhone|Android/i.test(navigator.userAgent);

const SRC_WEBRTC = { type: "webrtc", file: `wss://${STREAM_HOST}/${APP}/${STREAM}?direction=play` };
// const SRC_LLHLS  = { type: "llhls",  file: `https://${STREAM_HOST}/${APP}/${STREAM}/llhls.m3u8` };
// const SRC_HLS    = { type: "hls",    file: `https://${STREAM_HOST}/${APP}/${STREAM}/master.m3u8` };

// LIFF
const SOURCES = [SRC_WEBRTC];
// const SOURCES = isMobileOrLIFF
//   ? [SRC_LLHLS, SRC_WEBRTC, SRC_HLS]
//   : [SRC_WEBRTC, SRC_LLHLS, SRC_HLS];

function normalizePlayerState(state) {
  if (!state) return "";
  const s = String(state).toLowerCase();
  switch (s) {
    case "play":
    case "playing":
      return "playing";
    case "pause":
    case "paused":
      return "paused";
    case "buffering":
    case "loading":
      return "loading";
    case "ended":
    case "complete":
      return "complete";
    default:
      return s;
  }
}

function initLivePlayer() {
  const targetId = "livePlayer";

  // 如果先前已建立，先移除舊的
  try {
    if (op && typeof op.remove === "function") {
      op.remove();
    }
  } catch (err) {
    console.warn("remove player failed", err);
  }

  op = OvenPlayer.create(targetId, {
    autoStart: true,
    mute: true,
    playsinline: true,
    controls: true,
    sources: SOURCES
  });
  // === 只在 LIFF（桌機/手機）執行：1.5s 後只嘗試一次升級到 WebRTC，失敗 2s 內回退 ===
  const inLiff =
    (!!window.liff && typeof liff.isInClient === 'function' && liff.isInClient()) ||
    /Line\//i.test(navigator.userAgent);

  if (inLiff) {
    let triedUpgrade = false;
    let upgrading = false;

    const upgradeTimer = setTimeout(() => {
      if (triedUpgrade || upgrading) return;
      triedUpgrade = true;

      try {
        const state = normalizePlayerState(op?.getState?.());
        const curType = op?.getCurrentSource?.()?.type;

        // 只有「正在播放、且目前不是 WebRTC」才升級
        if (state === "playing" && curType !== "webrtc") {
          upgrading = true;
          setLoading?.(true); // 可選：顯示小遮罩，避免注意到 0.x 秒重緩衝

          // 嘗試切到 WebRTC；失敗就回退
          op.setSource([SRC_WEBRTC]);

          // 2 秒內沒成功切成 WebRTC，就視為失敗並回退
          const failback = setTimeout(() => {
            if (upgrading) {
              // op.setSource([SRC_LLHLS, SRC_HLS]);
              upgrading = false;
              setLoading?.(false);
            }
          }, 2000);

          // 成功切到 WebRTC
          const onSC = (e) => {
            if (e?.type === "webrtc") {
              clearTimeout(failback);
              upgrading = false;
              setLoading?.(false);
            }
            try { op?.off?.("sourceChanged", onSC); } catch {}
          };
          op.once?.("sourceChanged", onSC) || op.on?.("sourceChanged", onSC);

          // 切換過程出錯 → 立刻回退
          const onErr = () => {
            clearTimeout(failback);
            // op.setSource([SRC_LLHLS, SRC_HLS]);
            upgrading = false;
            setLoading?.(false);
            try { op?.off?.("error", onErr); } catch {}
          };
          op.once?.("error", onErr) || op.on?.("error", onErr);
        }
      } catch {
        setLoading?.(false);
      }
    }, 1500);

    // 一旦進入 playing，就把 1.5s 的計時器清掉（避免重複觸發）
    op.on?.("stateChanged", (s) => {
      if (normalizePlayerState(s) === "playing") {
        try { clearTimeout(upgradeTimer); } catch {}
      }
    });
  }
  // === end ===

  let webrtcKick = null;
  if (SOURCES.length && SOURCES[0].type === "webrtc") {
    webrtcKick = setTimeout(() => {
      try {
        if (op && typeof op.getState === "function" && normalizePlayerState(op.getState()) !== "playing") {
          // setLoading(true);
          // op.setSource([SRC_LLHLS, SRC_HLS]);
        }
      } catch (err) {
        console.warn("webrtc fallback failed", err);
      }
    }, 3000);
  }

  op.on("ready", () => {
    setLoading(false);
  });

  op.on("stateChanged", (state) => {
    const normalizedState = normalizePlayerState(state);
    if (normalizedState === "playing" && webrtcKick) {
      clearTimeout(webrtcKick);
      webrtcKick = null;
    }
    const playIcon = document.getElementById("playIcon");
    if (!playIcon) return;
    playIcon.textContent = normalizedState === "playing" ? "\u23F8" : "\u25B6";

    // 更新直播狀態顯示
    updateLiveStatus(normalizedState);
  });

  op.on("error", (err) => {
    console.warn("Player error:", err);
    setLoading(false);
    // 發生錯誤時顯示離線
    updateLiveStatus("error");
  });

  if (!visibilityHandlerRegistered) {
    document.addEventListener("visibilitychange", () => {
      if (!op) return;
      if (document.hidden) {
        try {
          op.mute(true);
        } catch (err) {
          console.warn("mute on hidden failed", err);
        }
      }
    });
    visibilityHandlerRegistered = true;
  }

  setLoading(true);
}

function setLoading(show) {
  const loading = document.querySelector("#livePlayer .player-loading");
  if (!loading) return;
  loading.style.display = show ? "block" : "none";
}

// ==== 控制按鈕提供給 HTML ====
window.togglePlay = function () {
  if (!op) return;
  const rawState = typeof op.getState === "function" ? op.getState() : "";
  const state = normalizePlayerState(rawState);
  if (state === "playing") {
    op.pause();
  } else {
    op.play();
  }
};

window.toggleMute = function () {
  if (!op) return;
  const muted = typeof op.isMuted === "function" ? op.isMuted() : false;
  op.mute(!muted);
  const icon = document.getElementById("muteIcon");
  if (icon) {
    icon.textContent = muted ? "🔊" : "🔈";
  }
};

window.toggleFullscreen = function () {
  if (!op) return;
  try {
    if (typeof op.setFullscreen === "function") {
      op.setFullscreen(true);
    }
  } catch (err) {
    console.warn("fullscreen failed", err);
  }
};

window.refreshStream = function () {
  initLivePlayer();
};

window.initLivePlayer = initLivePlayer;

// ===== 更新直播狀態顯示 =====
function updateLiveStatus(state) {
  const statusText = document.getElementById("liveStatusText");
  const liveDot = document.querySelector(".live-dot");

  if (!statusText || !liveDot) return;

  const normalizedState = normalizePlayerState(state);

  console.log("播放器狀態變更:", normalizedState);

  // 根據播放器狀態更新顯示
  switch (normalizedState) {
    case "playing":
      // 正在播放 - 顯示「直播中」
      statusText.textContent = "直播中";
      statusText.style.color = "#fff";
      liveDot.style.animation = "blink 1.5s infinite";
      liveDot.style.background = "#ff0000";
      break;

    case "paused":
      // 暫停 - 顯示「已暫停」
      statusText.textContent = "已暫停";
      statusText.style.color = "#ffd700";
      liveDot.style.animation = "none";
      liveDot.style.background = "#ffd700";
      break;

    case "loading":
    case "stalled":
      // 載入中 - 顯示「連接中」
      statusText.textContent = "連接中...";
      statusText.style.color = "#87ceeb";
      liveDot.style.animation = "pulse 1s infinite";
      liveDot.style.background = "#87ceeb";
      break;

    case "idle":
    case "complete":
      // 閒置或完成 - 顯示「離線」
      statusText.textContent = "離線";
      statusText.style.color = "#999";
      liveDot.style.animation = "none";
      liveDot.style.background = "#666";
      break;

    case "error":
      // 錯誤 - 顯示「連接失敗」
      statusText.textContent = "連接失敗";
      statusText.style.color = "#ff6b6b";
      liveDot.style.animation = "none";
      liveDot.style.background = "#ff6b6b";
      break;

    default:
      // 其他狀態 - 顯示「準備中」
      statusText.textContent = "準備中";
      statusText.style.color = "#ccc";
      liveDot.style.animation = "none";
      liveDot.style.background = "#999";
  }
}

