// ==UserScript==
// @name         Wplace Overlay Multi-chunk + HUD By Zary
// @namespace    http://tampermonkey.net/
// @version      0.8.2
// @description  Overlay multi-chunk para Wplace.live com HUD, seletor de overlay, botão "Ir para Overlay", cache local e alerta de atualização automática.
// @author       Zary
// @match        https://wplace.live/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=zarystore.net
// @license      MIT
// @grant        none
// @connect      raw.githubusercontent.com
// @connect      i.imgur.com
// @connect      i.ibb.co
// @updateURL    https://raw.githubusercontent.com/ZaryImortal/wplace.live-overlay-multi-chunk/refs/heads/main/overlay.js
// @downloadURL  https://raw.githubusercontent.com/ZaryImortal/wplace.live-overlay-multi-chunk/refs/heads/main/overlay.js
// ==/UserScript==

(async function () {
    'use strict';

    const CURRENT_VERSION = "0.8.2";
    const CACHE_KEY = "wplace_overlay_cache_v1";
    const CACHE_TIME = 24 * 60 * 60 * 1000; // 24h
    const CACHE_VERSION_KEY = "wplace_overlay_script_version";

    // 🧹 Limpa cache se a versão local mudou
    const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (cachedVersion !== CURRENT_VERSION) {
        console.log(`[Overlay] Nova versão detectada (${CURRENT_VERSION}), limpando cache local...`);
        localStorage.removeItem(CACHE_KEY);
        localStorage.setItem(CACHE_VERSION_KEY, CURRENT_VERSION);
    }

    // 🔍 Função utilitária para comparar versões sem erro (ex: 0.7.13 < 0.7.14)
    function compareVersions(v1, v2) {
        const a = v1.split('.').map(Number);
        const b = v2.split('.').map(Number);
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i++) {
            const diff = (a[i] || 0) - (b[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    }

    // 🔍 Checa se há nova versão (apenas se maior)
    async function checkForUpdate() {
        try {
            const meta = await fetch("https://raw.githubusercontent.com/ZaryImortal/wplace.live-overlay-multi-chunk/refs/heads/main/overlay.js?" + Date.now());
            const text = await meta.text();
            const match = text.match(/@version\s+([\d.]+)/);
            if (!match) return;

            const remoteVersion = match[1];
            if (compareVersions(remoteVersion, CURRENT_VERSION) > 0) {
                const updateMsg = document.createElement("div");
                updateMsg.textContent = `Nova versão ${remoteVersion} disponível! Atualize o script.`;
                updateMsg.style.position = "fixed";
                updateMsg.style.top = "15px";
                updateMsg.style.right = "15px";
                updateMsg.style.zIndex = "999999";
                updateMsg.style.background = "linear-gradient(90deg, #ff9800, #ff5722)";
                updateMsg.style.color = "white";
                updateMsg.style.padding = "10px 16px";
                updateMsg.style.borderRadius = "8px";
                updateMsg.style.boxShadow = "0 0 8px rgba(0,0,0,0.4)";
                updateMsg.style.fontFamily = "monospace";
                updateMsg.style.fontSize = "14px";
                updateMsg.style.transition = "opacity 1s";
                document.body.appendChild(updateMsg);
                setTimeout(() => updateMsg.style.opacity = "0", 4000);
                setTimeout(() => updateMsg.remove(), 5000);
            }
        } catch (err) {
            console.warn("Falha ao checar atualização:", err);
        }
    }

    await checkForUpdate();

    // 🧠 Busca imagens.js com cache local de 24h
    async function fetchData() {
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
            const now = Date.now();

            if (cached && (now - cached.timestamp < CACHE_TIME) && cached.data?.length) {
                console.log("[Overlay] Usando cache local de imagens.js");
                return cached.data;
            }

            console.log("[Overlay] Baixando novo imagens.js do GitHub...");
            const res = await fetch("https://raw.githubusercontent.com/ZaryImortal/wplace.live-overlay-multi-chunk/refs/heads/main/imagens.js?" + now);
            const json = await res.json();

            localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, data: json }));
            localStorage.setItem(CACHE_VERSION_KEY, CURRENT_VERSION);
            return json;
        } catch (err) {
            console.error("Erro ao buscar imagens.js:", err);
            const fallback = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
            if (fallback?.data) {
                console.warn("[Overlay] Usando cache anterior por erro de rede.");
                return fallback.data;
            }
            throw err;
        }
    }

    const CHUNK_WIDTH = 1000;
    const CHUNK_HEIGHT = 1000;

    const overlaysRaw = await fetchData();
    let currentOverlayId = null;
    let overlayProgress = {};
    const selectedColors = [];

    const overlayNames = [
        "Onça",
        "Pardo Moggada",
        "Base Imperial",
        "Base Imperial 2",
        "Evil Morty",
        "Evil Morty 2",
        "Anti-Comuna",
        "Yellow space",
        "Sonic",
        "Creative Space",
        "Mini Cristo",
        "Ger Patrioten",
        "Valete"
    ];
    const overlayCoords = [
        { lat: -23.6260, lng: -46.8656 },
        { lat: -23.0914, lng: -46.0435 },
        { lat: -23.4968, lng: -47.0192 },
        { lat: -22.5089, lng: -43.1814 },
        { lat: -24.1511, lng: -46.0176 },
        { lat: -26.3508, lng: -45.8199 },
        { lat: -23.7265, lng: -47.1685 },
        { lat: -23.7276, lng: -46.8653 },
        { lat: -23.6880, lng: -46.9285 },
        { lat: -23.5834, lng: -46.9270 },
        { lat: -23.6679, lng: -46.8382 },
        { lat: 52.0277, lng: 12.6946 },
        { lat: -24.0308, lng: -46.9558 }
    ];

    function resetProgress() {
        overlayProgress = {};
        updateHUD();
    }

    // 🔧 Prepara overlays como canvas únicos
    for (const obj of overlaysRaw) {
        const { img, width, height } = await loadImage(obj.url);
        const startX = obj.chunk[0] * CHUNK_WIDTH + obj.coords[0];
        const startY = obj.chunk[1] * CHUNK_HEIGHT + obj.coords[1];

        const sourceCanvas = new OffscreenCanvas(width, height);
        const sourceCtx = sourceCanvas.getContext("2d");
        sourceCtx.drawImage(img, 0, 0, width, height);

        obj.startX = startX;
        obj.startY = startY;
        obj.width = width;
        obj.height = height;
        obj.sourceCanvas = sourceCanvas;
        obj.sourceCtx = sourceCtx;
    }

    // 🧭 HUD
    const hud = document.createElement("div");
    hud.style.position = "fixed";
    hud.style.top = "50px";
    hud.style.right = "10px";
    hud.style.zIndex = 99999;
    hud.style.backgroundColor = "rgba(0,0,0,0.75)";
    hud.style.color = "white";
    hud.style.padding = "10px";
    hud.style.fontFamily = "monospace, monospace";
    hud.style.fontSize = "13px";
    hud.style.borderRadius = "8px";
    hud.style.maxHeight = "600px";
    hud.style.overflowY = "auto";
    hud.style.userSelect = "none";
    hud.style.cursor = "move";
    hud.style.boxShadow = "0 0 8px rgba(255,212,0,0.7)";
    hud.style.width = "200px";
    hud.style.minWidth = "150px";
    hud.style.minHeight = "80px";
    hud.style.resize = "both";
    document.body.appendChild(hud);

    const hudHeader = document.createElement("div");
    hudHeader.style.display = "flex";
    hudHeader.style.justifyContent = "space-between";
    hudHeader.style.alignItems = "center";
    hudHeader.style.marginBottom = "6px";
    hud.appendChild(hudHeader);

    const hudTitle = document.createElement("div");
    hudTitle.textContent = "Overlay HUD - By Zary";
    hudTitle.style.fontWeight = "bold";
    hudHeader.appendChild(hudTitle);

    const minimizeBtn = document.createElement("button");
    minimizeBtn.textContent = "–";
    minimizeBtn.title = "Minimizar/Restaurar HUD";
    minimizeBtn.style.background = "transparent";
    minimizeBtn.style.color = "white";
    minimizeBtn.style.border = "none";
    minimizeBtn.style.fontSize = "18px";
    minimizeBtn.style.cursor = "pointer";
    minimizeBtn.style.userSelect = "none";
    minimizeBtn.style.marginLeft = "10px";
    hudHeader.appendChild(minimizeBtn);

    const hudContent = document.createElement("pre");
    hudContent.style.margin = 0;
    hudContent.style.whiteSpace = "pre-wrap";
    hud.appendChild(hudContent);

    let hudMinimized = false;
    let prevWidth = hud.style.width;
    let prevHeight = hud.style.height;

    minimizeBtn.onclick = () => {
        hudMinimized = !hudMinimized;
        if (hudMinimized) {
            prevWidth = hud.style.width;
            prevHeight = hud.style.height;
            hud.style.width = "200px";
            hud.style.height = "80px";
            hudContent.style.display = "none";
            minimizeBtn.textContent = "+";
        } else {
            hud.style.width = prevWidth;
            hud.style.height = prevHeight;
            hudContent.style.display = "block";
            minimizeBtn.textContent = "–";
        }
    };

    function createColorBox(color) {
        const box = document.createElement("span");
        box.style.display = "inline-block";
        box.style.width = "14px";
        box.style.height = "14px";
        box.style.backgroundColor = color;
        box.style.border = "1px solid #aaa";
        box.style.marginRight = "6px";
        box.style.verticalAlign = "middle";
        box.style.borderRadius = "3px";
        return box;
    }

    function updateHUD() {
        if (currentOverlayId === null) {
            hud.style.display = "none";
            return;
        }
        hud.style.display = "block";

        let totalGreenPixels = 0;
        let totalOverlayPixels = 0;
        const missingColorsCount = {};

        for (const key in overlayProgress) {
            const { greenPixels, totalOverlayPixels: chunkOverlayPixels, missingColorsCount: chunkColors } = overlayProgress[key];
            totalGreenPixels += greenPixels;
            totalOverlayPixels += chunkOverlayPixels;
            for (const color in chunkColors) {
                missingColorsCount[color] = (missingColorsCount[color] || 0) + chunkColors[color];
            }
        }

        const percent = totalOverlayPixels ? ((totalGreenPixels / totalOverlayPixels) * 100).toFixed(2) : "0.00";
        const missingPixels = totalOverlayPixels - totalGreenPixels;

        hudContent.innerHTML = '';

        if (missingPixels === 0 && totalOverlayPixels > 0) {
            hudContent.textContent = "✔️ Completo!";
        } else {
            const text = `Pixels Totais: ${totalOverlayPixels.toLocaleString()}\nPixels Faltando: ${missingPixels.toLocaleString()}\nProgresso: ${percent}%\n\nCores Faltando:\n`;
            hudContent.textContent = text;

            for (const [color, count] of Object.entries(missingColorsCount).sort((a,b)=>b[1]-a[1])) {
                const line = document.createElement("div");
                const box = createColorBox(color);
                const label = document.createElement("label");
                label.style.cursor = "pointer";
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.value = color;
                checkbox.checked = selectedColors.includes(color);
                checkbox.style.marginRight = "4px";
                checkbox.addEventListener("change", () => {
                    if (checkbox.checked) {
                        if (!selectedColors.includes(color)) selectedColors.push(color);
                    } else {
                        const idx = selectedColors.indexOf(color);
                        if (idx !== -1) selectedColors.splice(idx,1);
                    }
                    updateHUD();
                });
                label.appendChild(checkbox);
                label.appendChild(box);
                label.appendChild(document.createTextNode(count.toLocaleString()));
                line.appendChild(label);
                hudContent.appendChild(line);
            }
        }
    }

    setInterval(updateHUD, 30000);

    function rgbaToCss(r,g,b,a){ return `rgba(${r},${g},${b},${a/255})`; }

    function blobToImage(blob){
        return new Promise((resolve,reject)=>{
            const img = new Image();
            img.onload=()=>resolve(img);
            img.onerror=reject;
            img.src=URL.createObjectURL(blob);
        });
    }

    function loadImage(src){
        return new Promise((resolve,reject)=>{
            const img = new Image();
            img.crossOrigin="anonymous";
            img.onload=()=>resolve({img,width:img.naturalWidth,height:img.naturalHeight});
            img.onerror=reject;
            img.src=src;
        });
    }

    // Intercepta fetch
    fetch = new Proxy(fetch, {
        apply: async (target, thisArg, argList) => {
            const urlString = typeof argList[0] === "object" ? argList[0].url : argList[0];
            let url;
            try {
                url = new URL(urlString);
            } catch {
                return target.apply(thisArg, argList);
            }

            if (currentOverlayId !== null && url.hostname === "backend.wplace.live" && url.pathname.startsWith("/files/")) {
                const overlay = overlaysRaw[currentOverlayId];
                if (!overlay.sourceCanvas) return target.apply(thisArg, argList);

                const match = url.pathname.match(/\/(\d+)\/(\d+)\.png$/);
                if (!match) return target.apply(thisArg, argList);
                const [cx, cy] = [parseInt(match[1]), parseInt(match[2])];
                const chunkOffsetX = cx * CHUNK_WIDTH;
                const chunkOffsetY = cy * CHUNK_HEIGHT;

                const overlayStartX = overlay.chunk[0] * CHUNK_WIDTH + overlay.coords[0];
                const overlayStartY = overlay.chunk[1] * CHUNK_HEIGHT + overlay.coords[1];
                const overlayEndX = overlayStartX + overlay.width;
                const overlayEndY = overlayStartY + overlay.height;

                const chunkEndX = chunkOffsetX + CHUNK_WIDTH;
                const chunkEndY = chunkOffsetY + CHUNK_HEIGHT;

                if (chunkOffsetX >= overlayEndX || chunkEndX <= overlayStartX ||
                    chunkOffsetY >= overlayEndY || chunkEndY <= overlayStartY) {
                    return target.apply(thisArg, argList);
                }

                const originalResponse = await target.apply(thisArg, argList);
                const originalBlob = await originalResponse.blob();
                const originalImage = await blobToImage(originalBlob);
                const canvas = new OffscreenCanvas(CHUNK_WIDTH, CHUNK_HEIGHT);
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                ctx.drawImage(originalImage, 0, 0);
                const originalData = ctx.getImageData(0, 0, CHUNK_WIDTH, CHUNK_HEIGHT);
                const resultData = ctx.getImageData(0, 0, CHUNK_WIDTH, CHUNK_HEIGHT);

                const d1 = originalData.data;
                const dr = resultData.data;

                const srcX = Math.max(0, chunkOffsetX - overlayStartX);
                const srcY = Math.max(0, chunkOffsetY - overlayStartY);
                const drawX = Math.max(0, overlayStartX - chunkOffsetX);
                const drawY = Math.max(0, overlayStartY - chunkOffsetY);
                const drawW = Math.min(CHUNK_WIDTH - drawX, overlay.width - srcX);
                const drawH = Math.min(CHUNK_HEIGHT - drawY, overlay.height - srcY);

                const overlayPart = overlay.sourceCtx.getImageData(srcX, srcY, drawW, drawH).data;

                let greenPixels = 0;
                let totalOverlayPixels = 0;
                const missingColorsCount = {};

                for (let row = 0; row < drawH; row++) {
                    for (let col = 0; col < drawW; col++) {
                        const srcIndex = (row * drawW + col) * 4;
                        const destIndex = ((row + drawY) * CHUNK_WIDTH + (col + drawX)) * 4;

                        const r = overlayPart[srcIndex];
                        const g = overlayPart[srcIndex + 1];
                        const b = overlayPart[srcIndex + 2];
                        const a = overlayPart[srcIndex + 3];

                        const samePixel = (d1[destIndex] === r && d1[destIndex + 1] === g &&
                                           d1[destIndex + 2] === b && d1[destIndex + 3] === a);

                        if (a !== 0) {
                            if (samePixel) {
                                dr[destIndex] = 0;
                                dr[destIndex + 1] = 255;
                                dr[destIndex + 2] = 0;
                                dr[destIndex + 3] = 255;
                                greenPixels++;
                            } else {
                                const rgbaColor = rgbaToCss(r,g,b,a);
                                if (selectedColors.length === 0 || selectedColors.includes(rgbaColor)) {
                                    dr[destIndex] = r;
                                    dr[destIndex + 1] = g;
                                    dr[destIndex + 2] = b;
                                    dr[destIndex + 3] = a;
                                } else {
                                    dr[destIndex + 3] = 0;
                                }
                                missingColorsCount[rgbaColor] = (missingColorsCount[rgbaColor] || 0) + 1;
                            }
                            totalOverlayPixels++;
                        }
                    }
                }

                ctx.putImageData(resultData, 0, 0);
                const mergedBlob = await canvas.convertToBlob();
                overlayProgress[`${cx}/${cy}`] = { greenPixels, totalOverlayPixels, missingColorsCount };
                updateHUD();
                return new Response(mergedBlob, { headers: { "Content-Type": "image/png" } });
            }

            return target.apply(thisArg, argList);
        }
    });

    // Patch da UI (seletores e botão "Ir para Overlay")
    function patchUI() {
        const buttonContainer = document.querySelector("div.gap-4:nth-child(1) > div:nth-child(2)");
        if (!buttonContainer) return;

        let overlaySelector = document.getElementById("overlay-selector");
        if (!overlaySelector) {
            overlaySelector = document.createElement("select");
            overlaySelector.id = "overlay-selector";
            overlaySelector.style.marginTop = "6px";
            overlaySelector.style.padding = "4px 6px";
            overlaySelector.style.backgroundColor = "#222";
            overlaySelector.style.color = "white";
            overlaySelector.style.border = "none";
            overlaySelector.style.borderRadius = "4px";
            overlaySelector.style.fontSize = "13px";
            overlaySelector.title = "Selecione o overlay";

            const noneOption = document.createElement("option");
            noneOption.value = "";
            noneOption.textContent = "Nenhum overlay";
            overlaySelector.appendChild(noneOption);

            overlaysRaw.forEach((overlay, idx) => {
                const opt = document.createElement("option");
                opt.value = idx;
                const name = overlayNames[idx] ?? `Overlay #${idx + 1}`;
                opt.textContent = name;
                overlaySelector.appendChild(opt);
            });

            overlaySelector.value = currentOverlayId !== null ? currentOverlayId : "";

            overlaySelector.addEventListener("change", (e) => {
                const val = e.target.value;
                if (val === "") {
                    currentOverlayId = null;
                } else {
                    currentOverlayId = Number(val);
                    resetProgress();
                    updateHUD();
                    patchGoToOverlayButton();
                }
            });

            buttonContainer.appendChild(overlaySelector);
        }

        patchGoToOverlayButton();
    }

    function patchGoToOverlayButton() {
        let gotoButton = document.getElementById("goto-overlay-btn");
        if (!gotoButton) {
            gotoButton = document.createElement("button");
            gotoButton.id = "goto-overlay-btn";
            gotoButton.textContent = "Ir para Overlay";
            gotoButton.style.marginLeft = "6px";
            gotoButton.style.padding = "4px 8px";
            gotoButton.style.borderRadius = "4px";
            gotoButton.style.border = "none";
            gotoButton.style.backgroundColor = "#0e0e0e7f";
            gotoButton.style.color = "white";
            gotoButton.style.cursor = "pointer";
            document.querySelector("#overlay-selector").after(gotoButton);

            gotoButton.addEventListener("click", () => {
                if (currentOverlayId === null) return;
                const coords = overlayCoords[currentOverlayId] ?? { lat: 0, lng: 0 };
                window.location.href = `https://wplace.live/?lat=${coords.lat}&lng=${coords.lng}`;
            });
        }
    }

    // HUD arrastável
    hudHeader.style.cursor = "move";
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    hudHeader.addEventListener("mousedown", (e) => {
        if (e.target === minimizeBtn) return;
        isDragging = true;
        dragOffsetX = e.clientX - hud.getBoundingClientRect().left;
        dragOffsetY = e.clientY - hud.getBoundingClientRect().top;
        document.body.style.userSelect = "none";
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
        document.body.style.userSelect = "";
    });

    window.addEventListener("mousemove", (e) => {
        if (isDragging) {
            hud.style.left = (e.clientX - dragOffsetX) + "px";
            hud.style.top = (e.clientY - dragOffsetY) + "px";
        }
    });

    const targetNode = document.querySelector("div.gap-4:nth-child(1)");
    if (targetNode) {
        const observer = new MutationObserver(() => {
            patchUI();
        });
        observer.observe(targetNode, { childList: true, subtree: true });
    }

    patchUI();
})();
