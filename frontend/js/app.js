/**
 * PDFMaster v1.0 - 全能PDF处理软件 前端逻辑
 */
const API = "/api";

// ========== 全局状态 ==========
const state = {
  currentFile: null,
  currentFid: null,
  currentFileName: "",
  totalPages: 0,
  currentPage: 1,
  zoom: 1.0,
  viewMode: "single",
  editMode: false,
  mergeFiles: [],
  mixedFiles: [],
  printMixedFiles: [],
};

// ========== 初始化 ==========
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initDragDrop();
  initToolSubtabs();
  initSecuritySubtabs();
  initInvoiceSubtabs();
  initSignatureCanvas();
  initSplitOptions();
  initWatermarkOptions();
  initSigTypeOptions();
  initMixedDragDrop();
  initPrintMixedDragDrop();
});

// ========== 导航 ==========
function initNavigation() {
  document.querySelectorAll(".menu-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  document.querySelectorAll(".sidetab").forEach(btn => {
    btn.addEventListener("click", () => switchSidePanel(btn.dataset.panel));
  });
}

function switchTab(tab) {
  document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".content-panel").forEach(p => p.classList.remove("active"));
  document.querySelector(`.menu-btn[data-tab="${tab}"]`)?.classList.add("active");
  document.getElementById(`panel-${tab}`)?.classList.add("active");
}

function switchSidePanel(panel) {
  document.querySelectorAll(".sidetab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelector(`.sidetab[data-panel="${panel}"]`)?.classList.add("active");
  document.getElementById(`panel-${panel}`)?.classList.add("active");
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
}

// ========== 文件操作 ==========
function openPDF() {
  document.getElementById("mainFileInput").click();
}

let _pendingAction = null;
function pickFileForAction(action) {
  _pendingAction = action;
  document.getElementById("mainFileInput").click();
}

function handleFileOpen(e) {
  const file = e.target.files[0];
  if (!file) return;
  state.currentFile = file;
  state.currentFileName = file.name;
  loadPDF(file);
  e.target.value = "";
}

async function loadPDF(file) {
  showToast("正在加载...", "info");
  const fd = new FormData();
  fd.append("file", file);

  try {
    const res = await fetch(`${API}/pdf/info`, { method: "POST", body: fd });
    const data = await res.json();
    if (data.code !== 0) { showToast(data.msg, "error"); return; }
    state.currentFid = data.data.fid;
    state.totalPages = data.data.pages;
    state.currentPage = 1;

    document.getElementById("totalPages").textContent = state.totalPages;
    document.getElementById("pageInput").value = 1;
    document.getElementById("pageInput").max = state.totalPages;

    switchTab("view");
    buildThumbnails(data.data);
    buildTOC(data.data.toc);
    renderViewer();
    setStatus(`📖 ${file.name} (${state.totalPages}页)`);
  } catch (err) {
    showToast("加载失败: " + err.message, "error");
  }
}

function setStatus(msg) {
  document.getElementById("statusBar").textContent = msg;
}

// ========== 查看器渲染 ==========
async function renderViewer() {
  const viewer = document.getElementById("viewer");
  viewer.innerHTML = "";
  if (!state.currentFid) return;

  const zoom = state.zoom;
  const start = state.viewMode === "single" ? state.currentPage - 1 : 0;
  const end = state.viewMode === "single" ? state.currentPage : state.totalPages;

  for (let i = start; i < end; i++) {
    const pageDiv = document.createElement("div");
    pageDiv.className = "viewer-page";
    pageDiv.id = `page-${i + 1}`;

    const img = document.createElement("img");
    img.src = `${API}/pdf/page/${state.currentFid}/${i}?zoom=${zoom * 1.5}`;
    img.alt = `Page ${i + 1}`;
    img.loading = "lazy";

    pageDiv.appendChild(img);
    viewer.appendChild(pageDiv);
  }

  document.getElementById("zoomLevel").textContent = Math.round(zoom * 100) + "%";

  // 滚动到当前页
  if (state.viewMode === "continuous") {
    setTimeout(() => {
      const target = document.getElementById(`page-${state.currentPage}`);
      if (target) {
        document.getElementById("viewerContainer").scrollTop = target.offsetTop - 20;
      }
    }, 300);
  }
}

function zoomIn() { state.zoom = Math.min(state.zoom * 1.2, 5.0); renderViewer(); }
function zoomOut() { state.zoom = Math.max(state.zoom / 1.2, 0.2); renderViewer(); }
function fitWidth() { state.zoom = 1.0; renderViewer(); }
function fitPage() { state.zoom = 0.75; renderViewer(); }

function prevPage() {
  if (state.currentPage > 1) { state.currentPage--; updatePageView(); }
}
function nextPage() {
  if (state.currentPage < state.totalPages) { state.currentPage++; updatePageView(); }
}
function goToPage() {
  const p = parseInt(document.getElementById("pageInput").value);
  if (p >= 1 && p <= state.totalPages) { state.currentPage = p; updatePageView(); }
}
function updatePageView() {
  document.getElementById("pageInput").value = state.currentPage;
  renderViewer();
}
function changeViewMode() {
  state.viewMode = document.getElementById("viewMode").value;
  renderViewer();
}

// ========== 缩略图 ==========
async function buildThumbnails(info) {
  const panel = document.getElementById("panel-thumbnails");
  panel.innerHTML = "";
  if (!info) return;
  for (let i = 0; i < info.pages; i++) {
    const item = document.createElement("div");
    item.className = "thumbnail-item";
    item.innerHTML = `<img src="${API}/pdf/page/${info.fid}/${i}?zoom=0.4" alt="P${i+1}"><div>第${i+1}页</div>`;
    item.onclick = () => { state.currentPage = i + 1; updatePageView(); };
    panel.appendChild(item);
  }
}

// ========== 目录 ==========
function buildTOC(toc) {
  const panel = document.getElementById("panel-toc");
  panel.innerHTML = "";
  if (!toc || toc.length === 0) {
    panel.innerHTML = "<p style='padding:10px;color:#999'>无目录</p>";
    return;
  }
  toc.forEach(item => {
    const div = document.createElement("div");
    div.style.cssText = `padding:6px 8px;cursor:pointer;font-size:13px;margin-left:${(item[0]-1)*16}px`;
    div.textContent = item[1];
    div.onclick = () => { state.currentPage = item[2]; updatePageView(); };
    panel.appendChild(div);
  });
}

// ========== 搜索 ==========
async function searchPDF() {
  const keyword = document.getElementById("searchInput").value.trim();
  if (!keyword || !state.currentFile) return;

  const fd = new FormData();
  fd.append("file", state.currentFile);
  fd.append("keyword", keyword);

  try {
    const res = await fetch(`${API}/pdf/search`, { method: "POST", body: fd });
    const data = await res.json();
    const container = document.getElementById("searchResults");
    container.innerHTML = "";

    if (data.code === 0 && data.data) {
      const r = data.data;
      container.innerHTML = `<p style='padding:8px;font-size:12px;color:#666'>找到 ${r.count} 处匹配</p>`;
      r.results.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "search-result-item";
        div.textContent = `第${item.page}页 - 匹配${idx + 1}`;
        div.onclick = () => { state.currentPage = item.page; updatePageView(); };
        container.appendChild(div);
      });
    }
  } catch (err) {
    showToast("搜索失败", "error");
  }
}

// ========== 保存 ==========
async function savePDF() {
  if (!state.currentFile) return;
  const fd = new FormData();
  fd.append("file", state.currentFile);
  // 触发下载
  const blob = new Blob([state.currentFile], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = state.currentFileName;
  a.click();
  URL.revokeObjectURL(url);
  showToast("已保存", "success");
}

// ========== 编辑 ==========
function startEditText() {
  if (!state.currentFile) { showToast("请先打开PDF", "error"); return; }
  showToast("编辑模式：点击页面可添加文字，输入坐标", "info");
  state.editMode = true;
}

function addTextBox() {
  const x = prompt("X坐标 (默认100):", "100");
  const y = prompt("Y坐标 (默认100):", "100");
  const text = prompt("文字内容:", "请输入文字");
  if (!text) return;

  const edits = [{
    page: state.currentPage,
    action: "add",
    x: parseFloat(x) || 100,
    y: parseFloat(y) || 100,
    text: text,
    fontsize: parseInt(document.getElementById("editFontSize").value) || 12,
    color: document.getElementById("editFontColor").value || "#000000",
    fontname: document.getElementById("editFontName").value || "china-s",
  }];

  applyEditToServer(edits);
}

function insertImage() {
  document.getElementById("imageInsertInput").click();
}

function handleImageInsert(e) {
  const imgFile = e.target.files[0];
  if (!imgFile || !state.currentFile) return;
  e.target.value = "";

  const x = prompt("X坐标 (默认100):", "100");
  const y = prompt("Y坐标 (默认100):", "100");
  const w = prompt("宽度 (默认100):", "100");
  const h = prompt("高度 (默认100):", "100");

  const fd = new FormData();
  fd.append("file", state.currentFile);
  fd.append("image", imgFile);
  fd.append("page", state.currentPage);
  fd.append("x", x || "100");
  fd.append("y", y || "100");
  fd.append("w", w || "100");
  fd.append("h", h || "100");

  fetch(`${API}/pdf/edit/image`, { method: "POST", body: fd })
    .then(r => r.blob())
    .then(blob => downloadBlob(blob, "img_" + state.currentFileName))
    .catch(err => showToast("插入失败", "error"));
}

async function applyEditToServer(edits) {
  if (!state.currentFile) return;
  const fd = new FormData();
  fd.append("file", state.currentFile);
  fd.append("edits", JSON.stringify(edits));

  try {
    const res = await fetch(`${API}/pdf/edit/text`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, "edited_" + state.currentFileName);
      showToast("编辑完成", "success");
    } else {
      showToast("编辑失败", "error");
    }
  } catch (err) {
    showToast("编辑失败: " + err.message, "error");
  }
}

function applyEdit() {
  if (!state.currentFile) { showToast("请先打开PDF", "error"); return; }
  addTextBox();
}

function downloadEdited() {
  if (!state.currentFile) { showToast("请先打开PDF", "error"); return; }
  showToast("编辑完成后会自动下载，或使用'添加文字'按钮", "info");
}

// ========== 注释 ==========
function addAnnotation(type) {
  if (!state.currentFile) { showToast("请先打开PDF", "error"); return; }
  const content = type === "text" ? prompt("注释内容:") : "";
  const annotations = [{
    page: state.currentPage,
    type: type,
    x1: 100, y1: 100, x2: 300, y2: 120,
    content: content || "",
    color: "#FFEB3B",
  }];
  addAnnotationToServer(annotations);
}

async function addAnnotationToServer(annotations) {
  const fd = new FormData();
  fd.append("file", state.currentFile);
  fd.append("annotations", JSON.stringify(annotations));
  try {
    const res = await fetch(`${API}/pdf/annotate`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, "annotated_" + state.currentFileName);
      showToast("注释已添加", "success");
    }
  } catch (err) { showToast("注释失败", "error"); }
}

// ========== 转换 ==========
function convertPDF(type) {
  document.getElementById("convertFileInput").dataset.convertType = type;
  document.getElementById("convertFileInput").click();
}

function handleConvertFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const type = e.target.dataset.convertType;
  e.target.value = "";
  performConvert(file, type);
}

async function performConvert(file, type) {
  const fd = new FormData();
  fd.append("file", file);

  const endpoints = {
    word: "to-word", excel: "to-excel", ppt: "to-ppt",
    image: "to-image", html: "to-html", txt: "to-txt",
  };

  const ep = endpoints[type];
  if (!ep) return;

  showToast(`正在转换为 ${type.toUpperCase()}...`, "info");
  try {
    const res = await fetch(`${API}/pdf/convert/${ep}`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      const ext = type === "image" ? "png" : type;
      downloadBlob(blob, file.name.replace(/\.pdf$/i, `.${ext}`));
      showToast("转换完成", "success");
    } else {
      const data = await res.json();
      showToast(data.msg || "转换失败", "error");
    }
  } catch (err) { showToast("转换失败", "error"); }
}

// ========== 各种格式 → PDF 转换 ==========

function pickAndConvertToPDF(type) {
  const inputId = "toPdfInput_" + type;
  const input = document.getElementById(inputId);
  if (input) {
    input.dataset.convertType = type;
    input.click();
  }
}

async function doConvertToPDF(e, type) {
  const files = e.target.files;
  if (!files.length) return;
  // 图片和自动识别支持多文件
  const isMulti = (type === "image");
  const filesArr = Array.from(files);
  e.target.value = ""; // reset

  showToast("正在转换为 PDF...", "info");
  const progressEl = document.getElementById("convertProgress");
  const progressText = document.getElementById("convertProgressText");

  try {
    for (let i = 0; i < filesArr.length; i++) {
      const file = filesArr[i];
      if (filesArr.length > 1) {
        progressText.textContent = `正在转换 (${i + 1}/${filesArr.length}): ${file.name}`;
      }
      // 自动识别：根据扩展名路由
      let realType = type;
      if (realType === "auto") {
        const ext = file.name.split(".").pop().toLowerCase();
        const typeMap = {
          docx: "word", doc: "word",
          xlsx: "excel", xls: "excel",
          pptx: "ppt", ppt: "ppt",
          html: "html", htm: "html",
          md: "markdown", markdown: "markdown", mdown: "markdown",
          txt: "txt", csv: "txt", log: "txt",
          png: "image", jpg: "image", jpeg: "image",
          bmp: "image", gif: "image", webp: "image", tiff: "image",
        };
        realType = typeMap[ext] || null;
        if (!realType) {
          showToast(`暂不支持 ${ext} 格式`, "error");
          continue;
        }
      }

      const ep = `to-pdf/${realType}`;
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/pdf/convert/${ep}`, { method: "POST", body: fd });
      if (res.ok) {
        const blob = await res.blob();
        const outName = file.name.replace(/\.[^.]+$/, "") + ".pdf";
        downloadBlob(blob, outName);
      } else {
        const data = await res.json();
        showToast(data.msg || `${file.name} 转换失败`, "error");
      }
    }
    if (filesArr.length > 1) {
      showToast(`全部 ${filesArr.length} 个文件转换完成`, "success");
    } else {
      showToast("转换完成", "success");
    }
  } catch (err) {
    showToast("转换失败", "error");
  }
}

// ========== 合并/拆分 ==========
function handleMergeFiles(e) {
  const files = Array.from(e.target.files);
  files.forEach(f => {
    if (!state.mergeFiles.find(x => x.name === f.name)) {
      state.mergeFiles.push(f);
    }
  });
  renderMergeList();
  e.target.value = "";
}

function renderMergeList() {
  const container = document.getElementById("mergeFileList");
  container.innerHTML = state.mergeFiles.map((f, i) =>
    `<div class="file-item">📄 ${f.name} <span class="remove" onclick="removeMergeFile(${i})">✕</span></div>`
  ).join("");
}

function removeMergeFile(idx) {
  state.mergeFiles.splice(idx, 1);
  renderMergeList();
}

async function mergePDFs() {
  if (state.mergeFiles.length < 2) { showToast("请至少添加2个PDF文件", "error"); return; }
  const fd = new FormData();
  state.mergeFiles.forEach(f => fd.append("files", f));

  showToast("正在合并...", "info");
  try {
    const res = await fetch(`${API}/pdf/merge`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, "merged.pdf");
      showToast("合并完成", "success");
    }
  } catch (err) { showToast("合并失败", "error"); }
}

// ========== 混合排版（图片+PDF） ==========
const _IMG_EXTS = new Set(['jpg','jpeg','png','webp','bmp','gif','tiff','tif']);

function handleMixedFiles(e) {
  const files = Array.from(e.target.files);
  files.forEach(f => {
    if (!state.mixedFiles.find(x => x.name === f.name && x.size === f.size)) {
      const ext = f.name.split('.').pop().toLowerCase();
      state.mixedFiles.push({ file: f, type: _IMG_EXTS.has(ext) ? 'img' : 'pdf' });
    }
  });
  renderMixedList();
  e.target.value = "";
}

function removeMixedFile(idx) {
  state.mixedFiles.splice(idx, 1);
  renderMixedList();
}

function clearMixedFiles() {
  state.mixedFiles = [];
  renderMixedList();
}

function renderMixedList() {
  const container = document.getElementById("mixedFileList");
  if (state.mixedFiles.length === 0) {
    container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">暂无文件，请添加图片或PDF</div>';
    return;
  }
  container.innerHTML = state.mixedFiles.map((item, i) => {
    const icon = item.type === 'img' ? '🖼' : '📄';
    const tagCls = item.type === 'img' ? 'img' : 'pdf';
    const tagText = item.type === 'img' ? '图片' : 'PDF';
    return `
      <div class="mixed-file-row" draggable="true" data-idx="${i}"
           ondragstart="mixDragStart(event)" ondragover="mixDragOver(event)"
           ondragleave="mixDragLeave(event)" ondrop="mixDrop(event)" ondragend="mixDragEnd(event)">
        <span class="drag-handle">⋮⋮</span>
        <span class="order-num">${i + 1}</span>
        <span class="file-icon">${icon}</span>
        <span class="file-name">${item.file.name}</span>
        <span class="file-type-tag ${tagCls}">${tagText}</span>
        <span class="remove" onclick="removeMixedFile(${i})">✕</span>
      </div>`;
  }).join("");
}

let _mixDragIdx = null;
function mixDragStart(e) {
  _mixDragIdx = parseInt(e.currentTarget.dataset.idx);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', _mixDragIdx);
}
function mixDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}
function mixDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
function mixDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const toIdx = parseInt(e.currentTarget.dataset.idx);
  if (_mixDragIdx === toIdx) return;
  const item = state.mixedFiles.splice(_mixDragIdx, 1)[0];
  state.mixedFiles.splice(toIdx, 0, item);
  renderMixedList();
}
function mixDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.mixed-file-row').forEach(r => r.classList.remove('drag-over'));
}

async function mixedMerge() {
  if (state.mixedFiles.length === 0) { showToast("请添加至少1个文件", "error"); return; }

  const fd = new FormData();
  state.mixedFiles.forEach(item => fd.append("files", item.file));
  fd.append("page_size", document.getElementById("mixedPageSize").value);
  fd.append("fit_mode", document.getElementById("mixedFitMode").value);
  const nupVal = document.getElementById("mixedNup").value;
  fd.append("n_up", nupVal);
  if (nupVal === "invoice") fd.append("layout", "invoice");

  showToast("正在排版合并...", "info");
  try {
    const res = await fetch(`${API}/pdf/mixed-merge`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, "mixed_merged.pdf");
      showToast("排版合并完成", "success");
    } else {
      const data = await res.json();
      showToast(data.msg || "排版失败", "error");
    }
  } catch (err) { showToast("排版失败", "error"); }
}

// 拖拽上传支持
function initMixedDragDrop() {
  const dz = document.getElementById("mixedDropZone");
  if (!dz) return;
  dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("drag-over"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
  dz.addEventListener("drop", e => {
    e.preventDefault();
    dz.classList.remove("drag-over");
    const files = Array.from(e.dataTransfer.files).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return _IMG_EXTS.has(ext) || ext === 'pdf';
    });
    if (files.length === 0) { showToast("请拖入图片或PDF文件", "error"); return; }
    files.forEach(f => {
      if (!state.mixedFiles.find(x => x.file.name === f.name && x.file.size === f.size)) {
        const ext = f.name.split('.').pop().toLowerCase();
        state.mixedFiles.push({ file: f, type: _IMG_EXTS.has(ext) ? 'img' : 'pdf' });
      }
    });
    renderMixedList();
  });
}

// ========== 打印面板 - 混合排版（图片+PDF） ==========
function handlePrintMixedFiles(e) {
  const files = Array.from(e.target.files);
  files.forEach(f => {
    if (!state.printMixedFiles.find(x => x.name === f.name && x.size === f.size)) {
      const ext = f.name.split('.').pop().toLowerCase();
      state.printMixedFiles.push({ file: f, type: _IMG_EXTS.has(ext) ? 'img' : 'pdf' });
    }
  });
  renderPrintMixedList();
  e.target.value = "";
}

function removePrintMixedFile(idx) {
  state.printMixedFiles.splice(idx, 1);
  renderPrintMixedList();
}

function clearPrintMixedFiles() {
  state.printMixedFiles = [];
  renderPrintMixedList();
}

function renderPrintMixedList() {
  const container = document.getElementById("printMixedFileList");
  if (!container) return;
  if (state.printMixedFiles.length === 0) {
    container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">暂无文件，请添加图片或PDF</div>';
    return;
  }
  container.innerHTML = state.printMixedFiles.map((item, i) => {
    const icon = item.type === 'img' ? '🖼' : '📄';
    const tagCls = item.type === 'img' ? 'img' : 'pdf';
    const tagText = item.type === 'img' ? '图片' : 'PDF';
    return `
      <div class="mixed-file-row" draggable="true" data-idx="${i}"
           ondragstart="printMixDragStart(event)" ondragover="printMixDragOver(event)"
           ondragleave="printMixDragLeave(event)" ondrop="printMixDrop(event)" ondragend="printMixDragEnd(event)">
        <span class="drag-handle">⋮⋮</span>
        <span class="order-num">${i + 1}</span>
        <span class="file-icon">${icon}</span>
        <span class="file-name">${item.file.name}</span>
        <span class="file-type-tag ${tagCls}">${tagText}</span>
        <span class="remove" onclick="removePrintMixedFile(${i})">✕</span>
      </div>`;
  }).join("");
}

let _printMixDragIdx = null;
function printMixDragStart(e) {
  _printMixDragIdx = parseInt(e.currentTarget.dataset.idx);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function printMixDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function printMixDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function printMixDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const toIdx = parseInt(e.currentTarget.dataset.idx);
  if (_printMixDragIdx === toIdx) return;
  const item = state.printMixedFiles.splice(_printMixDragIdx, 1)[0];
  state.printMixedFiles.splice(toIdx, 0, item);
  renderPrintMixedList();
}
function printMixDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('#printMixedFileList .mixed-file-row').forEach(r => r.classList.remove('drag-over'));
}

async function printMixedMerge() {
  if (state.printMixedFiles.length === 0) { showToast("请添加至少1个文件", "error"); return; }

  const fd = new FormData();
  state.printMixedFiles.forEach(item => fd.append("files", item.file));
  fd.append("page_size", document.getElementById("printMixedPageSize").value);
  fd.append("fit_mode", document.getElementById("printMixedFitMode").value);
  const printNupVal = document.getElementById("printMixedNup").value;
  fd.append("n_up", printNupVal);
  if (printNupVal === "invoice") fd.append("layout", "invoice");

  showToast("正在排版合并...", "info");
  try {
    const res = await fetch(`${API}/pdf/mixed-merge`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, "print_mixed.pdf");
      showToast("排版合并完成", "success");
    } else {
      const data = await res.json();
      showToast(data.msg || "排版失败", "error");
    }
  } catch (err) { showToast("排版失败", "error"); }
}

function initPrintMixedDragDrop() {
  const dz = document.getElementById("printMixedDropZone");
  if (!dz) return;
  dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("drag-over"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
  dz.addEventListener("drop", e => {
    e.preventDefault();
    dz.classList.remove("drag-over");
    const files = Array.from(e.dataTransfer.files).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return _IMG_EXTS.has(ext) || ext === 'pdf';
    });
    if (files.length === 0) { showToast("请拖入图片或PDF文件", "error"); return; }
    files.forEach(f => {
      if (!state.printMixedFiles.find(x => x.file.name === f.name && x.file.size === f.size)) {
        const ext = f.name.split('.').pop().toLowerCase();
        state.printMixedFiles.push({ file: f, type: _IMG_EXTS.has(ext) ? 'img' : 'pdf' });
      }
    });
    renderPrintMixedList();
  });
}

async function splitPDF() {
  if (!state.currentFile) { showToast("请先打开PDF", "error"); return; }

  const mode = document.getElementById("splitMode").value;
  const fd = new FormData();
  fd.append("file", state.currentFile);
  fd.append("mode", mode);

  if (mode === "every") {
    fd.append("n", document.getElementById("splitEveryN").value);
  } else if (mode === "range") {
    fd.append("ranges", document.getElementById("splitRanges").value);
  }

  showToast("正在拆分...", "info");
  try {
    const res = await fetch(`${API}/pdf/split`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, state.currentFileName.replace(".pdf", "_split.zip"));
      showToast("拆分完成", "success");
    }
  } catch (err) { showToast("拆分失败", "error"); }
}

async function compressPDF() {
  if (!state.currentFile) { showToast("请先打开PDF", "error"); return; }

  const level = document.getElementById("compressLevel").value;
  const fd = new FormData();
  fd.append("file", state.currentFile);
  fd.append("level", level);

  showToast("正在压缩...", "info");
  try {
    const res = await fetch(`${API}/pdf/compress`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      const origSize = state.currentFile.size;
      const newSize = blob.size;
      const ratio = ((1 - newSize / origSize) * 100).toFixed(1);
      const box = document.getElementById("compressResult");
      box.innerHTML = `原始: ${formatSize(origSize)} → 压缩后: ${formatSize(newSize)} ` +
        (ratio > 0 ? `(减少 ${ratio}%)` : "(已是最优大小)");
      box.classList.add("show");
      downloadBlob(blob, "compressed_" + state.currentFileName);
      showToast("压缩完成", "success");
    } else {
      showToast("压缩失败", "error");
    }
  } catch (err) { showToast("压缩失败", "error"); }
}

// ========== OCR ==========
async function runOCR() {
  if (!state.currentFile) { showToast("请先打开PDF", "error"); return; }

  const fd = new FormData();
  fd.append("file", state.currentFile);
  fd.append("lang", document.getElementById("ocrLang").value);

  showToast("正在OCR识别...", "info");
  try {
    const res = await fetch(`${API}/pdf/ocr`, { method: "POST", body: fd });
    const data = await res.json();
    if (data.code === 0) {
      const box = document.getElementById("ocrResult");
      const text = data.data.map(p => `=== 第${p.page}页 ===\n${p.text}`).join("\n");
      box.innerHTML = `<pre style="max-height:300px;overflow:auto;font-size:12px;white-space:pre-wrap">${text}</pre>`;
      box.classList.add("show");
      showToast("OCR完成", "success");
    } else {
      showToast(data.msg, "error");
    }
  } catch (err) { showToast("OCR失败", "error"); }
}

async function runOCRSave() {
  if (!state.currentFile) { showToast("请先打开PDF", "error"); return; }

  const fd = new FormData();
  fd.append("file", state.currentFile);

  showToast("正在生成可搜索PDF...", "info");
  try {
    const res = await fetch(`${API}/pdf/ocr/make-searchable`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, "ocr_" + state.currentFileName);
      showToast("可搜索PDF已生成", "success");
    }
  } catch (err) { showToast("OCR失败", "error"); }
}

// ========== 加密/解密 ==========
async function encryptPDF() {
  if (!state.currentFile) { showToast("请先打开PDF", "error"); return; }
  const pw = document.getElementById("encPassword").value;
  const pw2 = document.getElementById("encPassword2").value;
  if (!pw || pw !== pw2) { showToast("密码不一致", "error"); return; }

  const fd = new FormData();
  fd.append("file", state.currentFile);
  fd.append("password", pw);

  showToast("正在加密...", "info");
  try {
    const res = await fetch(`${API}/pdf/encrypt`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, "encrypted_" + state.currentFileName);
      showToast("加密完成", "success");
    }
  } catch (err) { showToast("加密失败", "error"); }
}

async function decryptPDF() {
  if (!state.currentFile) { showToast("请先打开PDF", "error"); return; }
  const pw = document.getElementById("decPassword").value;
  if (!pw) { showToast("请输入密码", "error"); return; }

  const fd = new FormData();
  fd.append("file", state.currentFile);
  fd.append("password", pw);

  showToast("正在解密...", "info");
  try {
    const res = await fetch(`${API}/pdf/decrypt`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, "decrypted_" + state.currentFileName);
      showToast("解密完成", "success");
    } else {
      const data = await res.json();
      showToast(data.msg || "解密失败", "error");
    }
  } catch (err) { showToast("解密失败", "error"); }
}

async function setPermissions() {
  if (!state.currentFile) { showToast("请先打开PDF", "error"); return; }
  const pw = document.getElementById("permPassword").value;
  if (!pw) { showToast("请设置所有者密码", "error"); return; }

  const fd = new FormData();
  fd.append("file", state.currentFile);
  fd.append("password", pw);
  fd.append("permissions", JSON.stringify({
    print: document.getElementById("permPrint").checked ? 1 : 0,
    modify: document.getElementById("permModify").checked ? 1 : 0,
    copy: document.getElementById("permCopy").checked ? 1 : 0,
    annotate: document.getElementById("permAnnotate").checked ? 1 : 0,
  }));

  showToast("正在设置权限...", "info");
  try {
    const res = await fetch(`${API}/pdf/protect`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, "protected_" + state.currentFileName);
      showToast("权限已设置", "success");
    }
  } catch (err) { showToast("权限设置失败", "error"); }
}

// ========== 水印 ==========
function initWatermarkOptions() {
  document.getElementById("wmType").addEventListener("change", function() {
    document.getElementById("wmTextOptions").style.display = this.value === "text" ? "" : "none";
    document.getElementById("wmImageOptions").style.display = this.value === "image" ? "" : "none";
  });
  document.getElementById("wmOpacity").addEventListener("input", function() {
    document.getElementById("wmOpacityVal").textContent = Math.round(this.value * 100) + "%";
  });
}

async function addWatermark() {
  if (!state.currentFile) { showToast("请先打开PDF", "error"); return; }

  const type = document.getElementById("wmType").value;
  const fd = new FormData();
  fd.append("file", state.currentFile);
  fd.append("type", type);

  if (type === "text") {
    fd.append("text", document.getElementById("wmText").value);
    fd.append("font_size", document.getElementById("wmFontSize").value);
    fd.append("opacity", document.getElementById("wmOpacity").value);
    fd.append("rotation", document.getElementById("wmRotation").value);
  } else {
    const wmFile = document.getElementById("wmImageFile").files[0];
    if (!wmFile) { showToast("请选择水印图片", "error"); return; }
    fd.append("watermark_image", wmFile);
  }

  showToast("正在添加水印...", "info");
  try {
    const res = await fetch(`${API}/pdf/watermark`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, "watermark_" + state.currentFileName);
      showToast("水印已添加", "success");
    }
  } catch (err) { showToast("水印添加失败", "error"); }
}

// ========== 签名 ==========
function initSignatureCanvas() {
  const canvas = document.getElementById("sigCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 300, 120);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  let drawing = false;
  canvas.addEventListener("mousedown", e => { drawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); });
  canvas.addEventListener("mousemove", e => {
    if (!drawing) return;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
  });
  canvas.addEventListener("mouseup", () => drawing = false);
  canvas.addEventListener("mouseleave", () => drawing = false);
}

function initSigTypeOptions() {
  document.getElementById("sigType").addEventListener("change", function() {
    document.getElementById("sigDrawArea").style.display = this.value === "draw" ? "" : "none";
    document.getElementById("sigTextInput").style.display = this.value === "text" ? "" : "none";
    document.getElementById("sigImageInput").style.display = this.value === "image" ? "" : "none";
  });
}

function clearSignature() {
  const canvas = document.getElementById("sigCanvas");
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 300, 120);
}

async function addSignature() {
  if (!state.currentFile) { showToast("请先打开PDF", "error"); return; }

  const type = document.getElementById("sigType").value;
  const fd = new FormData();
  fd.append("file", state.currentFile);
  fd.append("type", type);
  fd.append("page", document.getElementById("sigPage").value);
  fd.append("x", "100");
  fd.append("y", "100");
  fd.append("w", "150");
  fd.append("h", "60");

  if (type === "draw") {
    const canvas = document.getElementById("sigCanvas");
    fd.append("sig_data", canvas.toDataURL());
  } else if (type === "text") {
    fd.append("text", document.getElementById("sigText").value || "签名");
    fd.append("font_size", "24");
  } else if (type === "image") {
    const sigFile = document.getElementById("sigImageFile").files[0];
    if (!sigFile) { showToast("请选择签名图片", "error"); return; }
    fd.append("signature_image", sigFile);
  }

  showToast("正在添加签名...", "info");
  try {
    const res = await fetch(`${API}/pdf/signature`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, "signed_" + state.currentFileName);
      showToast("签名已添加", "success");
    }
  } catch (err) { showToast("签名添加失败", "error"); }
}

// ========== 页面管理 ==========
async function deletePages() {
  const pages = document.getElementById("deletePages").value;
  await doPageAction("delete", { pages });
}

async function rotatePages() {
  const angle = document.getElementById("rotateAngle").value;
  const pages = document.getElementById("rotatePagesInput").value;
  await doPageAction("rotate", { angle, pages });
}

async function extractPages() {
  const pages = document.getElementById("extractPages").value;
  await doPageAction("extract", { pages });
}

async function reorderPages() {
  const order = document.getElementById("reorderPages").value.split(",").map(s => parseInt(s.trim()));
  await doPageAction("reorder", { order: JSON.stringify(order) });
}

async function doPageAction(action, extra = {}) {
  if (!state.currentFile) { showToast("请先打开PDF", "error"); return; }

  const fd = new FormData();
  fd.append("file", state.currentFile);
  Object.entries(extra).forEach(([k, v]) => fd.append(k, String(v)));

  const endpoints = {
    delete: "pages/delete",
    rotate: "pages/rotate",
    extract: "extract",
    reorder: "pages/reorder",
  };

  showToast("处理中...", "info");
  try {
    const res = await fetch(`${API}/pdf/${endpoints[action]}`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, `${action}_` + state.currentFileName);
      showToast("操作完成", "success");
    }
  } catch (err) { showToast("操作失败", "error"); }
}

// ========== 打印 ==========
// 打印专用多文件状态
state.printFiles = [];

function pickPrintFile() {
  document.getElementById("printFileInput").click();
}

function handlePrintFile(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  state.printFiles = state.printFiles.concat(files);
  renderPrintFileList();
  e.target.value = "";
}

function removePrintFile(idx) {
  state.printFiles.splice(idx, 1);
  renderPrintFileList();
}

function clearPrintFiles() {
  state.printFiles = [];
  renderPrintFileList();
}

function renderPrintFileList() {
  const list = document.getElementById("printFileList");
  const btn = document.getElementById("btnClearPrint");
  if (!state.printFiles.length) {
    list.innerHTML = "";
    btn.style.display = "none";
    return;
  }
  btn.style.display = "";
  list.innerHTML = state.printFiles.map((f, i) =>
    `<span class="print-file-tag">📄<span class="name" title="${f.name}">${f.name}</span><span class="remove" onclick="removePrintFile(${i})">✕</span></span>`
  ).join("");
}

async function printLayout(perSheet) {
  if (!state.printFiles.length) { showToast("请先选择PDF文件", "error"); return; }

  const fd = new FormData();
  state.printFiles.forEach(f => fd.append("files", f));
  fd.append("per_sheet", perSheet);

  showToast("正在排版...", "info");
  try {
    const res = await fetch(`${API}/pdf/print/layout`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      const label = {2: "2up", 4: "4up", 6: "6up", 9: "9up"}[perSheet] || perSheet + "up";
      downloadBlob(blob, `print_${label}.pdf`);
      showToast("打印排版完成", "success");
    } else {
      const data = await res.json();
      showToast(data.msg || "排版失败", "error");
    }
  } catch (err) { showToast("排版失败", "error"); }
}

async function directPrint() {
  if (!state.printFiles.length) { showToast("请先选择PDF文件", "error"); return; }

  const fd = new FormData();
  state.printFiles.forEach(f => fd.append("files", f));

  showToast("正在准备打印...", "info");
  try {
    const res = await fetch(`${API}/pdf/print/direct`, { method: "POST", body: fd });
    if (!res.ok) {
      const data = await res.json();
      showToast(data.msg || "打印准备失败", "error");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const iframe = document.getElementById("printIframe");
    iframe.style.display = "";
    iframe.src = url;

    iframe.onload = function() {
      setTimeout(function() {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 500);
    };
    showToast("打印对话框已弹出", "success");
  } catch (err) { showToast("打印准备失败", "error"); }
}

// ========== 图片打印 ==========
state.printImages = [];

function pickPrintImage() {
  document.getElementById("printImageInput").click();
}

function handlePrintImage(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  state.printImages = state.printImages.concat(files);
  renderPrintImageList();
  e.target.value = "";
}

function removePrintImage(idx) {
  state.printImages.splice(idx, 1);
  renderPrintImageList();
}

function clearPrintImages() {
  state.printImages = [];
  renderPrintImageList();
}

function renderPrintImageList() {
  const list = document.getElementById("printImageList");
  const btn = document.getElementById("btnClearPrintImages");
  if (!state.printImages.length) {
    list.innerHTML = "";
    btn.style.display = "none";
    return;
  }
  btn.style.display = "";
  // 读取第一张图的缩略图
  list.innerHTML = "";
  state.printImages.forEach((f, i) => {
    const url = URL.createObjectURL(f);
    const div = document.createElement("div");
    div.className = "print-image-thumb";
    div.innerHTML = `<img src="${url}" onload="URL.revokeObjectURL('${url}')"><span class="img-label">${f.name}</span><span class="remove" onclick="removePrintImage(${i})">✕</span>`;
    list.appendChild(div);
  });
}

async function imageLayout(perSheet) {
  if (!state.printImages.length) { showToast("请先选择图片", "error"); return; }

  const fd = new FormData();
  state.printImages.forEach(f => fd.append("images", f));
  fd.append("per_sheet", perSheet);

  showToast("正在排版图片...", "info");
  try {
    const res = await fetch(`${API}/pdf/print/images`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, `image_print_${perSheet}up.pdf`);
      showToast("图片排版完成", "success");
    } else {
      const data = await res.json();
      showToast(data.msg || "排版失败", "error");
    }
  } catch (err) { showToast("排版失败", "error"); }
}

async function imageDirectPrint() {
  if (!state.printImages.length) { showToast("请先选择图片", "error"); return; }

  const fd = new FormData();
  state.printImages.forEach(f => fd.append("images", f));
  fd.append("per_sheet", 1);

  showToast("正在准备打印...", "info");
  try {
    const res = await fetch(`${API}/pdf/print/images`, { method: "POST", body: fd });
    if (!res.ok) {
      const data = await res.json();
      showToast(data.msg || "打印准备失败", "error");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const iframe = document.getElementById("printIframe");
    iframe.style.display = "";
    iframe.src = url;
    iframe.onload = function() {
      setTimeout(function() {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 500);
    };
    showToast("打印对话框已弹出", "success");
  } catch (err) { showToast("打印准备失败", "error"); }
}

// ========== 发票功能（共享文件选择） ==========
// 全局发票文件列表，4个子Tab共享
state.invoiceFiles = [];

function pickInvoiceFile() {
  document.getElementById("invoiceFileInput").click();
}
function handleInvoiceFile(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  state.invoiceFiles = state.invoiceFiles.concat(files);
  renderInvoiceFileList();
  e.target.value = "";
}
function removeInvoiceFile(idx) {
  state.invoiceFiles.splice(idx, 1);
  renderInvoiceFileList();
}
function clearInvoiceFiles() {
  state.invoiceFiles = [];
  renderInvoiceFileList();
}
function renderInvoiceFileList() {
  const list = document.getElementById("invoiceFileList");
  const btn = document.getElementById("btnClearInvoice");
  const count = document.getElementById("invoiceFileCount");
  if (!state.invoiceFiles.length) {
    list.innerHTML = "";
    btn.style.display = "none";
    count.textContent = "";
    return;
  }
  btn.style.display = "";
  count.textContent = `已选择 ${state.invoiceFiles.length} 个文件`;
  list.innerHTML = state.invoiceFiles.map((f, i) =>
    `<span class="print-file-tag">🧾<span class="name" title="${f.name}">${f.name}</span><span class="remove" onclick="removeInvoiceFile(${i})">✕</span></span>`
  ).join("");
}

// 发票打印
async function invoicePrint(perSheet) {
  if (!state.invoiceFiles.length) { showToast("请先选择发票文件", "error"); return; }
  const fd = new FormData();
  state.invoiceFiles.forEach(f => fd.append("files", f));
  fd.append("per_sheet", perSheet);
  showToast("正在排版发票...", "info");
  try {
    const res = await fetch(`${API}/invoice/print`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, `invoice_print_${perSheet}up.pdf`);
      showToast("发票打印排版完成", "success");
    } else {
      const data = await res.json();
      showToast(data.msg || "排版失败", "error");
    }
  } catch (err) { showToast("排版失败", "error"); }
}
async function invoiceDirectPrint() {
  if (!state.invoiceFiles.length) { showToast("请先选择发票文件", "error"); return; }
  const fd = new FormData();
  state.invoiceFiles.forEach(f => fd.append("files", f));
  fd.append("per_sheet", 1);
  showToast("正在准备打印...", "info");
  try {
    const res = await fetch(`${API}/invoice/print`, { method: "POST", body: fd });
    if (!res.ok) {
      const data = await res.json();
      showToast(data.msg || "打印准备失败", "error");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const iframe = document.getElementById("invoicePrintIframe");
    iframe.style.display = "";
    iframe.src = url;
    iframe.onload = function() {
      setTimeout(function() {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 500);
    };
    showToast("打印对话框已弹出", "success");
  } catch (err) { showToast("打印准备失败", "error"); }
}

// 发票合并
async function invoiceMerge() {
  if (!state.invoiceFiles.length) { showToast("请先选择发票文件", "error"); return; }
  const fd = new FormData();
  state.invoiceFiles.forEach(f => fd.append("files", f));
  showToast("正在合并发票...", "info");
  try {
    const res = await fetch(`${API}/invoice/merge`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, "invoices_merged.pdf");
      showToast("发票合并完成", "success");
    } else {
      const data = await res.json();
      showToast(data.msg || "合并失败", "error");
    }
  } catch (err) { showToast("合并失败", "error"); }
}

// 发票整理
async function invoiceOrganize(perSheet) {
  if (!state.invoiceFiles.length) { showToast("请先选择发票文件", "error"); return; }
  const fd = new FormData();
  state.invoiceFiles.forEach(f => fd.append("files", f));
  fd.append("per_sheet", perSheet);
  showToast("正在整理发票...", "info");
  try {
    const res = await fetch(`${API}/invoice/organize`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, `invoices_organized_${perSheet}up.pdf`);
      showToast("发票整理完成", "success");
    } else {
      const data = await res.json();
      showToast(data.msg || "整理失败", "error");
    }
  } catch (err) { showToast("整理失败", "error"); }
}

// 发票统计
async function invoiceStatistics() {
  if (!state.invoiceFiles.length) { showToast("请先选择发票文件", "error"); return; }
  const fd = new FormData();
  state.invoiceFiles.forEach(f => fd.append("files", f));
  showToast("正在统计发票信息...", "info");
  try {
    const res = await fetch(`${API}/invoice/statistics`, { method: "POST", body: fd });
    const data = await res.json();
    if (data.code === 0 && data.data) {
      renderInvoiceStats(data.data);
      showToast("统计完成", "success");
    } else {
      showToast(data.msg || "统计失败", "error");
    }
  } catch (err) { showToast("统计失败", "error"); }
}
function renderInvoiceStats(stats) {
  const el = document.getElementById("invoiceStatsResult");
  el.style.display = "block";
  // 汇总区
  let html = `<div class="stats-summary">
    <div class="stats-card"><div class="stats-num">${stats.total_count}</div><div class="stats-label">发票数量</div></div>
    <div class="stats-card"><div class="stats-num">¥${stats.total_amount.toLocaleString()}</div><div class="stats-label">金额合计</div></div>
    <div class="stats-card"><div class="stats-num">¥${stats.total_tax.toLocaleString()}</div><div class="stats-label">税额合计</div></div>
    <div class="stats-card stats-card-total"><div class="stats-num">¥${stats.total_total.toLocaleString()}</div><div class="stats-label">价税合计</div></div>
  </div>`;
  // 按月份分组
  if (Object.keys(stats.monthly).length > 0) {
    html += `<h3 style="margin:20px 0 10px">📅 按月份统计</h3>`;
    html += `<table class="stats-table"><thead><tr><th>月份</th><th>数量</th><th>金额</th><th>税额</th><th>价税合计</th></tr></thead><tbody>`;
    const months = Object.keys(stats.monthly).sort();
    months.forEach(m => {
      const d = stats.monthly[m];
      html += `<tr><td>${m}</td><td>${d.count}</td><td>¥${d.amount.toFixed(2)}</td><td>¥${d.tax.toFixed(2)}</td><td>¥${d.total.toFixed(2)}</td></tr>`;
    });
    html += `</tbody></table>`;
  }
  // 按类型分组
  if (Object.keys(stats.by_type).length > 0) {
    html += `<h3 style="margin:20px 0 10px">📂 按类型统计</h3>`;
    html += `<table class="stats-table"><thead><tr><th>发票类型</th><th>数量</th><th>金额</th><th>税额</th><th>价税合计</th></tr></thead><tbody>`;
    Object.entries(stats.by_type).forEach(([t, d]) => {
      html += `<tr><td>${t}</td><td>${d.count}</td><td>¥${d.amount.toFixed(2)}</td><td>¥${d.tax.toFixed(2)}</td><td>¥${d.total.toFixed(2)}</td></tr>`;
    });
    html += `</tbody></table>`;
  }
  // 发票明细
  if (stats.invoices && stats.invoices.length > 0) {
    html += `<h3 style="margin:20px 0 10px">📋 发票明细</h3>`;
    html += `<div class="stats-detail-list">`;
    stats.invoices.forEach((inv, idx) => {
      const warningIcon = (inv.amount === 0 && inv.total === 0) ? ' ⚠️' : '';
      const verifyBadge = inv.total_verified
        ? '<span class="verify-badge verify-ok">✅ 已验证</span>'
        : (inv.total_verify_msg
          ? `<span class="verify-badge verify-warn">${inv.total_verify_msg}</span>`
          : '');
      const ucText = inv.total_uppercase ? `<span class="detail-uppercase">大写: ${inv.total_uppercase}</span>` : '';
      const lcText = inv.total_lowercase ? `<span class="detail-lowercase">小写: ${inv.total_lowercase}</span>` : '';
      html += `<div class="stats-detail-item">
        <div class="detail-header">
          <span class="detail-num">${idx + 1}</span>
          <span class="detail-type">${inv.invoice_type || '未知类型'}</span>
          <span class="detail-total">¥${inv.total.toFixed(2)}${warningIcon}</span>
          ${verifyBadge}
        </div>
        <div class="detail-body">
          ${inv.invoice_code ? `<span>代码: ${inv.invoice_code}</span>` : ''}
          ${inv.invoice_number ? `<span>号码: ${inv.invoice_number}</span>` : ''}
          ${inv.invoice_date ? `<span>日期: ${inv.invoice_date}</span>` : ''}
          ${inv.seller ? `<span>销方: ${inv.seller}</span>` : ''}
          ${inv.buyer ? `<span>购方: ${inv.buyer}</span>` : ''}
          ${inv.amount > 0 ? `<span>金额: ¥${inv.amount.toFixed(2)}</span>` : ''}
          ${inv.tax > 0 ? `<span>税额: ¥${inv.tax.toFixed(2)}</span>` : ''}
          ${ucText}${lcText}
          <span class="detail-filename">${inv.filename}</span>
        </div>
      </div>`;
    });
    html += `</div>`;
  }
  el.innerHTML = html;
}

async function invoiceExportExcel() {
  if (!state.invoiceFiles.length) { showToast("请先选择发票文件", "error"); return; }
  const fd = new FormData();
  state.invoiceFiles.forEach(f => fd.append("files", f));
  showToast("正在生成Excel...", "info");
  try {
    const res = await fetch(`${API}/invoice/export`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, "发票统计明细.xlsx");
      showToast("Excel导出完成", "success");
    } else {
      const data = await res.json();
      showToast(data.msg || "导出失败", "error");
    }
  } catch (err) { showToast("导出失败", "error"); }
}

// ========== 创建PDF ==========
async function createPDF() {
  const width = prompt("页面宽度 (默认A4=595):", "595");
  const height = prompt("页面高度 (默认A4=842):", "842");
  const pages = prompt("页数:", "1");

  const fd = new FormData();
  fd.append("width", width || "595");
  fd.append("height", height || "842");
  fd.append("pages", pages || "1");

  try {
    const res = await fetch(`${API}/pdf/create`, { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, "new_document.pdf");
      showToast("PDF已创建", "success");
    }
  } catch (err) { showToast("创建失败", "error"); }
}

// ========== 拖拽支持 ==========
function initDragDrop() {
  const dropZone = document.getElementById("dropZone");
  if (!dropZone) return;

  dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".pdf")) {
      state.currentFile = file;
      state.currentFileName = file.name;
      loadPDF(file);
    }
  });
}

// ========== 工具面板切换 ==========
function initToolSubtabs() {
  document.querySelectorAll(".tooltab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tooltab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".subtool").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`subtab-${btn.dataset.subtab}`)?.classList.add("active");
    });
  });
}

function initSecuritySubtabs() {
  document.querySelectorAll(".sectab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sectab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".subsectab").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`sectab-${btn.dataset.sectab}`)?.classList.add("active");
    });
  });
}

function initInvoiceSubtabs() {
  document.querySelectorAll(".invtab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".invtab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".subinvtab").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`invtab-${btn.dataset.invtab}`)?.classList.add("active");
    });
  });
}

function initSplitOptions() {
  document.getElementById("splitMode").addEventListener("change", function() {
    document.getElementById("splitEveryOption").style.display = this.value === "every" ? "" : "none";
    document.getElementById("splitRangeOption").style.display = this.value === "range" ? "" : "none";
  });
}

// ========== 工具函数 ==========
function downloadBlob(blob, filename) {
  if (!blob || !filename) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function showToast(msg, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => toast.classList.remove("show"), 2500);
}

// 键盘快捷键
document.addEventListener("keydown", e => {
  if (e.ctrlKey) {
    switch (e.key) {
      case "o": e.preventDefault(); openPDF(); break;
      case "s": e.preventDefault(); savePDF(); break;
      case "=": case "+": e.preventDefault(); zoomIn(); break;
      case "-": e.preventDefault(); zoomOut(); break;
    }
  } else {
    switch (e.key) {
      case "ArrowLeft": prevPage(); break;
      case "ArrowRight": nextPage(); break;
      case "Home": state.currentPage = 1; updatePageView(); break;
      case "End": state.currentPage = state.totalPages; updatePageView(); break;
    }
  }
});
