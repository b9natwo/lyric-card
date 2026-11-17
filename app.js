/**
 * Lyric Card Studio
 * Preview scale matches 1080 export proportions.
 */

const $ = (sel) => document.querySelector(sel);

const lyricsInput = $("#lyricsInput");
const titleInput = $("#titleInput");
const artistInput = $("#artistInput");
const bgLinkInput = $("#bgLinkInput");
const bgFileInput = $("#bgFileInput");
const uploadBgBtn = $("#uploadBgBtn");
const clearBgBtn = $("#clearBgBtn");
const useLinkBtn = $("#useLinkBtn");
const bgWarning = $("#bgWarning");
const downloadBtn = $("#downloadBtn");
const exportStatus = $("#exportStatus");
const overlayRange = $("#overlayRange");
const themeGrid = $("#themeGrid");

const lyricCard = $("#lyricCard");
const cardScrim = $("#cardScrim");
const cardLinesEl = $("#cardLines");
const cardLinesBox = $("#cardLinesBox");
const cardCredit = $("#cardCredit");
const cardLogo = $("#cardLogo");

let backgroundUrl = "";
let exporting = false;
let currentTheme = "classic";

const THEMES = {
  classic: {
    pillBg: "#ffffff", pillFg: "#111111",
    footerBg: "#000000", footerFg: "#ffffff",
    footerLine: "rgba(255,255,255,0.18)", logoFg: "#ffffff",
  },
  midnight: {
    pillBg: "#e8eaf6", pillFg: "#0d1025",
    footerBg: "#0a0a14", footerFg: "#c5c8e0",
    footerLine: "rgba(120,130,200,0.35)", logoFg: "#a8b0ff",
  },
  paper: {
    pillBg: "#1a1a1a", pillFg: "#f5f0e8",
    footerBg: "#111111", footerFg: "#f0ebe3",
    footerLine: "rgba(255,255,255,0.15)", logoFg: "#f0ebe3",
  },
  neon: {
    pillBg: "#00ff9d", pillFg: "#04140e",
    footerBg: "#050805", footerFg: "#b8ffd9",
    footerLine: "rgba(0,255,157,0.35)", logoFg: "#00ff9d",
  },
  gold: {
    pillBg: "#f5e6b8", pillFg: "#1a1508",
    footerBg: "#120e06", footerFg: "#e8d48b",
    footerLine: "rgba(201,162,39,0.4)", logoFg: "#c9a227",
  },
  rose: {
    pillBg: "#ffd6e0", pillFg: "#2a0e16",
    footerBg: "#14080c", footerFg: "#ffb3c4",
    footerLine: "rgba(232,90,122,0.35)", logoFg: "#e85a7a",
  },
};

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "lyric-card";
}

function sanitizeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : "";
  } catch {
    return "";
  }
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image."));
    img.src = src;
  });
}

function drawImageCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function layoutCardLines(ctx, rawLines, maxWidth, maxHeight, maxFont, minFont, fontStack) {
  const padXRatio = 0.38;
  const padYRatio = 0.26;
  const gapRatio = 0.18;
  const lineHeightRatio = 1.08;

  function measure(size) {
    ctx.font = `700 ${size}px ${fontStack}`;
    const padX = size * padXRatio;
    const rows = [];
    rawLines.forEach((line) => {
      const width = ctx.measureText(line).width;
      if (width + padX * 2 <= maxWidth) {
        rows.push(line);
      } else {
        wrapCanvasText(ctx, line, Math.max(20, maxWidth - padX * 2)).forEach((seg) =>
          rows.push(seg)
        );
      }
    });
    const rowHeight = size * lineHeightRatio + size * padYRatio * 2;
    const gap = size * gapRatio;
    const totalHeight = rows.length * rowHeight + Math.max(0, rows.length - 1) * gap;
    return { rows, rowHeight, gap, padX, totalHeight };
  }

  for (let size = maxFont; size >= minFont; size -= 1) {
    const layout = measure(size);
    if (layout.totalHeight <= maxHeight) {
      return { size, ...layout };
    }
  }
  return { size: minFont, ...measure(minFont) };
}

function getLines() {
  return (lyricsInput.value || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function formatCredit(artist, title) {
  const a = (artist || "ARTIST").toUpperCase();
  const t = (title || "SONG TITLE").toUpperCase();
  return `${a}, "${t}"`;
}

function getOverlay() {
  return (Number(overlayRange.value) || 0) / 100;
}

function updatePreview() {
  const lines = getLines();
  const title = titleInput.value.trim();
  const artist = artistInput.value.trim();

  cardLinesEl.innerHTML = "";
  lines.forEach((line) => {
    const span = document.createElement("span");
    span.className = "lyric-card-line";
    span.textContent = line;
    cardLinesEl.appendChild(span);
  });

  cardCredit.textContent = formatCredit(artist, title);
  cardLogo.textContent = "DISTROUBLED";

  lyricCard.style.setProperty("--overlay", String(getOverlay()));

  if (backgroundUrl) {
    lyricCard.style.backgroundImage = `url(${backgroundUrl})`;
    cardScrim.hidden = false;
  } else {
    lyricCard.style.backgroundImage = "";
    cardScrim.hidden = true;
  }

  requestAnimationFrame(fitPreviewFont);
  downloadBtn.disabled = !lines.length && !title && !artist;
}

/**
 * Scale preview font relative to the card's rendered width so it matches
 * the 1080px export proportions (max ~36px at 1080 → ~3.33% of width).
 * Then shrink further if anything still overflows the quote box.
 */
function fitPreviewFont() {
  const linesNode = cardLinesEl;
  const boxNode = cardLinesBox;
  const cardNode = lyricCard;
  if (!linesNode || !boxNode || !cardNode) return;

  const cardW = cardNode.clientWidth || 480;
  // 36px at 1080 wide ≈ 3.33% of card width
  const maxPx = Math.max(11, Math.round(cardW * 0.0333));
  const minPx = Math.max(9, Math.round(cardW * 0.016));

  let size = maxPx;

  function overflows() {
    if (linesNode.scrollHeight > boxNode.clientHeight + 1) return true;
    return Array.from(linesNode.children).some(
      (child) => child.scrollWidth > boxNode.clientWidth + 1
    );
  }

  linesNode.style.fontSize = size + "px";
  while (size > minPx && overflows()) {
    size -= 1;
    linesNode.style.fontSize = size + "px";
  }
}

function showWarning(msg) {
  if (!msg) {
    bgWarning.hidden = true;
    bgWarning.textContent = "";
    return;
  }
  bgWarning.hidden = false;
  bgWarning.textContent = msg;
}

function setBackground(url) {
  backgroundUrl = url || "";
  clearBgBtn.hidden = !backgroundUrl;
  updatePreview();
}

function setTheme(name) {
  if (!THEMES[name]) return;
  currentTheme = name;
  Object.keys(THEMES).forEach((t) => {
    lyricCard.classList.toggle("theme-" + t, t === name);
  });
  themeGrid.querySelectorAll(".theme-swatch").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === name);
  });
  updatePreview();
}

function embedImageForCard(url, corsWarning) {
  showWarning("Loading image…");
  fetch(url, { mode: "cors", credentials: "omit", cache: "reload" })
    .then((res) => {
      if (!res.ok) throw new Error("fetch failed");
      return res.blob();
    })
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error());
          reader.readAsDataURL(blob);
        })
    )
    .then((dataUrl) => {
      setBackground(dataUrl);
      showWarning("");
    })
    .catch(() => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext("2d").drawImage(img, 0, 0);
          setBackground(c.toDataURL("image/jpeg", 0.92));
          showWarning("");
        } catch (e) {
          setBackground(url);
          showWarning(corsWarning);
        }
      };
      img.onerror = () => {
        setBackground(url);
        showWarning(corsWarning);
      };
      const sep = url.includes("?") ? "&" : "?";
      img.src = url + sep + "t=" + Date.now();
    });
}

function handleUpload(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    setBackground(String(reader.result));
    showWarning("");
  };
  reader.onerror = () => showWarning("Could not read that image file.");
  reader.readAsDataURL(file);
}

function useLink() {
  const url = sanitizeUrl(bgLinkInput.value.trim());
  if (!url) {
    showWarning("Enter a valid image link starting with http:// or https://.");
    return;
  }
  embedImageForCard(
    url,
    "This host may block export. Upload the image file for a guaranteed result."
  );
}

async function toDataUrl(src) {
  if (!src) return "";
  if (src.startsWith("data:")) return src;
  try {
    const res = await fetch(src, { mode: "cors", credentials: "omit", cache: "reload" });
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch (_) {}
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth || img.width;
          c.height = img.naturalHeight || img.height;
          c.getContext("2d").drawImage(img, 0, 0);
          resolve(c.toDataURL("image/jpeg", 0.92));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      const sep = src.includes("?") ? "&" : "?";
      img.src = src + sep + "t=" + Date.now();
    });
  } catch (_) {}
  return "";
}

async function downloadCard() {
  if (exporting) return;
  exporting = true;
  downloadBtn.disabled = true;
  exportStatus.textContent = "Rendering…";
  showWarning("");

  try {
    const canvas = document.createElement("canvas");
    const width = 1080;
    const height = 1080;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");

    const theme = THEMES[currentTheme] || THEMES.classic;
    const footerH = 124;
    const sidePad = 48;
    const bottomPad = 36;
    const textMaxWidth = width - sidePad * 2;
    const textMaxHeight = height - footerH - bottomPad - 140;
    const fontStack = "Inter, Arial, Helvetica, sans-serif";
    const overlay = getOverlay();

    // Background
    let exportBg = backgroundUrl;
    if (exportBg && !exportBg.startsWith("data:")) {
      const converted = await toDataUrl(exportBg);
      if (converted) {
        exportBg = converted;
        backgroundUrl = converted;
      }
    }

    if (exportBg) {
      try {
        const img = await loadImageElement(exportBg);
        drawImageCover(ctx, img, 0, 0, width, height);
        if (overlay > 0) {
          ctx.fillStyle = `rgba(0,0,0,${overlay})`;
          ctx.fillRect(0, 0, width, height);
        }
      } catch {
        ctx.fillStyle = "#111111";
        ctx.fillRect(0, 0, width, height);
        showWarning("Couldn't load image for export. Upload the file instead.");
      }
    } else {
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, width, height);
    }

    try {
      await document.fonts.load(`700 36px ${fontStack}`);
      await document.fonts.ready;
    } catch (_) {}

    const title = titleInput.value.trim() || "Song Title";
    const artist = artistInput.value.trim() || "Artist";
    const sourceLines = getLines().length ? getLines() : [title];

    // Lyric pills
    const layout = layoutCardLines(
      ctx, sourceLines, textMaxWidth, textMaxHeight, 34, 15, fontStack
    );
    ctx.font = `700 ${layout.size}px ${fontStack}`;
    ctx.textBaseline = "middle";

    let y = height - footerH - bottomPad - layout.totalHeight;
    layout.rows.forEach((rowText) => {
      const textWidth = ctx.measureText(rowText).width;
      const pillWidth = Math.min(textMaxWidth, textWidth + layout.padX * 2);
      const pillHeight = layout.rowHeight;
      ctx.fillStyle = theme.pillBg;
      ctx.fillRect(sidePad, y, pillWidth, pillHeight);
      ctx.fillStyle = theme.pillFg;
      ctx.fillText(rowText, sidePad + layout.padX, y + pillHeight / 2);
      y += pillHeight + layout.gap;
    });

    // Separator + footer
    ctx.fillStyle = theme.footerLine;
    ctx.fillRect(0, height - footerH - 1, width, 1);
    ctx.fillStyle = theme.footerBg;
    ctx.fillRect(0, height - footerH, width, footerH);

    const credit = formatCredit(artist, title);
    ctx.fillStyle = theme.footerFg;
    ctx.font = `600 22px ${fontStack}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(credit, sidePad, height - footerH / 2);

    // DISTROUBLED with 45° black drop shadow
    const logo = "DISTROUBLED";
    ctx.font = `800 22px ${fontStack}`;
    ctx.textAlign = "right";
    const logoX = width - sidePad;
    const logoY = height - footerH / 2;
    // 45° shadow: offset equally in x and y
    ctx.fillStyle = "#000000";
    ctx.fillText(logo, logoX + 2, logoY + 2);
    ctx.fillText(logo, logoX + 1, logoY + 1);
    ctx.fillStyle = theme.logoFg;
    ctx.fillText(logo, logoX, logoY);
    ctx.textAlign = "left";

    const link = document.createElement("a");
    link.download = `${slug(artist)}-${slug(title)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

    exportStatus.textContent = "Downloaded 1080 × 1080 PNG";
    setTimeout(() => {
      if (exportStatus.textContent.startsWith("Downloaded")) exportStatus.textContent = "";
    }, 2500);
  } catch (err) {
    console.error(err);
    showWarning("Export failed. Try uploading the image file.");
    exportStatus.textContent = "";
  } finally {
    exporting = false;
    downloadBtn.disabled = false;
    updatePreview();
  }
}

// Events
[lyricsInput, titleInput, artistInput].forEach((el) => {
  el.addEventListener("input", updatePreview);
});
overlayRange.addEventListener("input", updatePreview);

themeGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".theme-swatch");
  if (btn?.dataset.theme) setTheme(btn.dataset.theme);
});

uploadBgBtn.addEventListener("click", () => bgFileInput.click());
bgFileInput.addEventListener("change", handleUpload);
clearBgBtn.addEventListener("click", () => {
  setBackground("");
  bgLinkInput.value = "";
  showWarning("");
});
useLinkBtn.addEventListener("click", useLink);
bgLinkInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    useLink();
  }
});
downloadBtn.addEventListener("click", downloadCard);
window.addEventListener("resize", () => requestAnimationFrame(fitPreviewFont));

// Seed
lyricsInput.value = "";
titleInput.value = "Untitled";
artistInput.value = "";
setTheme("classic");
updatePreview();
