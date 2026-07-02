const yieldToMain = typeof scheduler !== 'undefined' && scheduler.yield
    ? () => scheduler.yield()
    : () => new Promise(r => setTimeout(r, 0));

// ── Theme toggle ────────────────────────────────────────────────
(function initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();

document.getElementById('theme-toggle').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
});

const store = new Map();
let doneCount = 0;
let runId = 0;

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const addInput = document.getElementById('add-input');
const results = document.getElementById('results');
const grid = document.getElementById('grid');
const qslider = document.getElementById('qslider');
const qlabel = document.getElementById('ql');
const fmtSel = document.getElementById('fmt');
const progWrap = document.getElementById('prog-wrap');
const progFill = document.getElementById('prog-f');
const progTxt = document.getElementById('prog-t');
const progPct = document.getElementById('prog-p');
const dlAllBtn = document.getElementById('dl-all');
const resetBtn = document.getElementById('reset-btn');
const stN = document.getElementById('st-n');
const stO = document.getElementById('st-o');
const stC = document.getElementById('st-c');
const stS = document.getElementById('st-s');
const compressBtn = document.getElementById('compress-btn');
const pendingHint = document.getElementById('pending-hint');

// Sincronizar etiqueta de calidad con el valor del deslizador (evita fallos de caché/auto-completado al recargar la página)
qlabel.textContent = qslider.value + '%';

['dragenter', 'dragover'].forEach(ev =>
    dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev =>
    dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('over'); }));
dropZone.addEventListener('drop', e => {
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', e => handleFiles(e.target.files));
addInput.addEventListener('change', e => handleFiles(e.target.files));
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
    e.preventDefault();
    if (results.style.display !== 'none') handleFiles(e.dataTransfer.files);
});

let debounceTimer;
qslider.addEventListener('input', () => {
    qlabel.textContent = qslider.value + '%';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        recompressAll();
    }, 300);
});

fmtSel.addEventListener('change', () => {
    recompressAll();
});

compressBtn.addEventListener('click', () => {
    if (!store.size) return;
    pendingHint.style.display = 'none';
    recompressAll();
});

async function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    dropZone.style.display = 'none';
    results.style.display = 'block';
    const frag = document.createDocumentFragment();
    const newEntries = [];
    for (const file of files) {
        const id = Math.random().toString(36).slice(2);
        const entry = { id, file, bitmap: null, compBlob: null, compUrl: null, thumbUrl: null, ext: 'jpg', mime: 'image/jpeg' };
        store.set(id, entry);
        newEntries.push(entry);
        frag.appendChild(makeCard(entry));
    }
    grid.appendChild(frag);
    stN.textContent = store.size;
    await loadPreviews(newEntries);
    recompressAll();
}

async function loadPreviews(entries) {
    for (const entry of entries) {
        try {
            entry.bitmap = await createImageBitmap(entry.file);
            const bmp = entry.bitmap;
            const scale = Math.min(1, 280 / Math.max(bmp.width, bmp.height));
            const tw = Math.max(1, Math.round(bmp.width * scale));
            const th = Math.max(1, Math.round(bmp.height * scale));
            const tc = new OffscreenCanvas(tw, th);
            tc.getContext('2d').drawImage(bmp, 0, 0, tw, th);
            const thumb = await tc.convertToBlob({ type: 'image/jpeg', quality: 0.6 });
            if (entry.thumbUrl) URL.revokeObjectURL(entry.thumbUrl);
            entry.thumbUrl = URL.createObjectURL(thumb);
            const p = document.getElementById('p-' + entry.id);
            if (p) p.innerHTML = '<img src="' + entry.thumbUrl + '" loading="lazy" decoding="async">';
        } catch (err) {
            console.error('Error preview', entry.file.name, err);
            setCardError(entry.id);
        }
        await yieldToMain();
    }
}

async function compressOne(entry, mime, quality, ext) {
    try {
        if (!entry.bitmap) entry.bitmap = await createImageBitmap(entry.file);
        const bmp = entry.bitmap;
        const fc = new OffscreenCanvas(bmp.width, bmp.height);
        fc.getContext('2d').drawImage(bmp, 0, 0);
        const compressed = await fc.convertToBlob({ type: mime, quality });
        const scale = Math.min(1, 280 / Math.max(bmp.width, bmp.height));
        const tw = Math.max(1, Math.round(bmp.width * scale));
        const th = Math.max(1, Math.round(bmp.height * scale));
        const tc = new OffscreenCanvas(tw, th);
        tc.getContext('2d').drawImage(bmp, 0, 0, tw, th);
        const thumb = await tc.convertToBlob({ type: 'image/jpeg', quality: 0.55 });
        if (entry.compUrl) URL.revokeObjectURL(entry.compUrl);
        if (entry.thumbUrl) URL.revokeObjectURL(entry.thumbUrl);
        entry.compBlob = compressed;
        entry.compUrl = URL.createObjectURL(compressed);
        entry.thumbUrl = URL.createObjectURL(thumb);
        entry.ext = ext;
        entry.mime = mime;
    } catch (err) {
        console.error('Error en', entry.file.name, err);
        setCardError(entry.id);
    }
}

async function recompressAll() {
    if (!store.size) return;
    const thisRun = ++runId;
    doneCount = 0;
    const mime = fmtSel.value;
    const quality = parseInt(qslider.value) / 100;
    const ext = mimeToExt(mime);
    const entries = [...store.values()];
    compressBtn.disabled = true;
    progWrap.style.display = 'block';
    entries.forEach(e => showSpinner(e.id));
    for (let i = 0; i < entries.length; i++) {
        if (runId !== thisRun) return;
        await compressOne(entries[i], mime, quality, ext);
        doneCount++;
        setProgress(doneCount, entries.length);
        updateCard(entries[i]);
        await yieldToMain();
    }
    if (runId === thisRun) {
        progWrap.style.display = 'none';
        updateStats();
        compressBtn.disabled = false;
        compressBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Recomprimir';
        document.getElementById('foot').style.display = 'flex';
    }
}

function setProgress(done, total) {
    const pct = total ? Math.round(done / total * 100) : 0;
    progFill.style.width = pct + '%';
    progPct.textContent = pct + '%';
    progTxt.textContent = 'Procesando\u2026 (' + done + '/' + total + ')';
}

function updateStats() {
    let orig = 0, comp = 0, done = 0;
    store.forEach(e => {
        orig += e.file.size;
        if (e.compBlob) { comp += e.compBlob.size; done++; }
    });
    stN.textContent = store.size;
    stO.textContent = fmt(orig);
    if (done) {
        stC.textContent = fmt(comp);
        stS.textContent = ((1 - comp / orig) * 100).toFixed(1) + '%';
    }
}

function makeCard(entry) {
    const el = document.createElement('div');
    el.className = 'ic';
    el.id = 'c-' + entry.id;
    const safeName = entry.file.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    el.innerHTML =
        '<div class="ip" id="p-' + entry.id + '"><div class="spin"></div></div>' +
        '<div class="ii">' +
        '<div class="in" title="' + safeName + '">' + safeName + '</div>' +
        '<div class="isz"><span>' + fmt(entry.file.size) + '</span><span id="cs-' + entry.id + '">\u2026</span></div>' +
        '<div id="sv-' + entry.id + '"></div>' +
        '</div>' +
        '<a class="dl" id="dl-' + entry.id + '" href="#">Descargar</a>';
    return el;
}

function updateCard(entry) {
    if (!entry.compBlob) return;
    const p = document.getElementById('p-' + entry.id);
    const cs = document.getElementById('cs-' + entry.id);
    const sv = document.getElementById('sv-' + entry.id);
    const dl = document.getElementById('dl-' + entry.id);
    if (!p) return;
    p.style.opacity = '1';
    p.innerHTML = '<img src="' + entry.thumbUrl + '" loading="lazy" decoding="async">';
    cs.textContent = fmt(entry.compBlob.size);
    const r = (1 - entry.compBlob.size / entry.file.size) * 100;
    sv.innerHTML = '<span class="savings-badge ' + (r >= 0 ? 'pos' : 'neg') + '">' + (r >= 0 ? '\u2193' : '\u2191') + ' ' + Math.abs(r).toFixed(1) + '%</span>';
    const base = entry.file.name.replace(/\.[^.]+$/, '');
    dl.href = entry.compUrl;
    dl.download = base + '-comprimido.' + entry.ext;
    dl.className = 'dl ok';
    dl.style.pointerEvents = '';
    dl.textContent = 'Descargar';
}

function showSpinner(id) {
    const p = document.getElementById('p-' + id);
    const dl = document.getElementById('dl-' + id);
    const cs = document.getElementById('cs-' + id);
    const sv = document.getElementById('sv-' + id);
    if (p) {
        if (!p.querySelector('img')) {
            p.innerHTML = '<div class="spin"></div>';
        } else {
            p.style.opacity = '0.5';
        }
    }
    if (cs) cs.textContent = '\u2014';
    if (sv) sv.innerHTML = '';
    if (dl) {
        dl.className = 'dl';
        dl.textContent = '\u2026';
        dl.style.pointerEvents = 'none';
    }
}

function setCardError(id) {
    const p = document.getElementById('p-' + id);
    if (p) p.innerHTML = '<span style="color:var(--danger);font-size:.72rem;font-weight:600">Error</span>';
}

dlAllBtn.addEventListener('click', async () => {
    if ([...store.values()].some(e => !e.compBlob)) { alert('Espera a que terminen todas las im\u00e1genes.'); return; }
    dlAllBtn.textContent = 'Generando ZIP\u2026';
    dlAllBtn.disabled = true;
    const zip = new JSZip();
    store.forEach(e => {
        const base = e.file.name.replace(/\.[^.]+$/, '');
        zip.file(base + '-comprimido.' + e.ext, e.compBlob);
    });
    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = 'imagenes-comprimidas.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    dlAllBtn.textContent = '\u2b07 Descargar todo como ZIP';
    dlAllBtn.disabled = false;
});

resetBtn.addEventListener('click', () => {
    runId++;
    store.forEach(e => {
        if (e.compUrl) URL.revokeObjectURL(e.compUrl);
        if (e.thumbUrl) URL.revokeObjectURL(e.thumbUrl);
        if (e.bitmap) e.bitmap.close();
    });
    store.clear();
    grid.innerHTML = '';
    fileInput.value = '';
    addInput.value = '';
    doneCount = 0;
    qslider.value = '85';
    qlabel.textContent = '85%';
    fmtSel.value = 'image/jpeg';
    dropZone.style.display = '';
    results.style.display = 'none';
    progWrap.style.display = 'none';
    pendingHint.style.display = 'none';
    document.getElementById('foot').style.display = 'none';
    compressBtn.disabled = false;
    compressBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Comprimir im\u00e1genes';
    [stN, stO, stC, stS].forEach(el => el.textContent = '\u2014');
});

function fmt(b) {
    if (!b) return '0 B';
    const k = 1024, u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return (b / Math.pow(k, i)).toFixed(1) + ' ' + u[i];
}
function mimeToExt(m) {
    return m === 'image/jpeg' ? 'jpg' : m === 'image/webp' ? 'webp' : 'png';
}