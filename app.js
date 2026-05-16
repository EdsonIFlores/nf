const STORAGE_KEY = "arquivo-claro-catalog-v1";
const EMAIL_CONFIG_KEY = "arquivo-claro-email-config-v1";
const API_BASE = location.protocol === "file:" ? "http://localhost:8787" : "";

const state = {
  files: [],
  selectedId: null,
  objectUrls: new Map(),
  filters: {
    search: "",
    type: "all",
    status: "all",
    category: "all",
  },
};

const els = {
  dropZone: document.querySelector("#dropZone"),
  fileInput: document.querySelector("#fileInput"),
  folderInput: document.querySelector("#folderInput"),
  pickFilesBtn: document.querySelector("#pickFilesBtn"),
  pickFolderBtn: document.querySelector("#pickFolderBtn"),
  totalCount: document.querySelector("#totalCount"),
  pdfCount: document.querySelector("#pdfCount"),
  xmlCount: document.querySelector("#xmlCount"),
  pendingCount: document.querySelector("#pendingCount"),
  resultCount: document.querySelector("#resultCount"),
  tableBody: document.querySelector("#fileTableBody"),
  emptyState: document.querySelector("#emptyState"),
  searchInput: document.querySelector("#searchInput"),
  typeFilter: document.querySelector("#typeFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  saveStatus: document.querySelector("#saveStatus"),
  noSelection: document.querySelector("#noSelection"),
  detailForm: document.querySelector("#detailForm"),
  detailType: document.querySelector("#detailType"),
  detailName: document.querySelector("#detailName"),
  detailMeta: document.querySelector("#detailMeta"),
  clientInput: document.querySelector("#clientInput"),
  periodInput: document.querySelector("#periodInput"),
  statusInput: document.querySelector("#statusInput"),
  categoryInput: document.querySelector("#categoryInput"),
  tagsInput: document.querySelector("#tagsInput"),
  cnpjInput: document.querySelector("#cnpjInput"),
  keyInput: document.querySelector("#keyInput"),
  notesInput: document.querySelector("#notesInput"),
  pathPreview: document.querySelector("#pathPreview"),
  openFileLink: document.querySelector("#openFileLink"),
  duplicateBtn: document.querySelector("#duplicateBtn"),
  deleteBtn: document.querySelector("#deleteBtn"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  exportJsonBtn: document.querySelector("#exportJsonBtn"),
  importJsonInput: document.querySelector("#importJsonInput"),
  copyPlanBtn: document.querySelector("#copyPlanBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  emailProvider: document.querySelector("#emailProvider"),
  emailAddress: document.querySelector("#emailAddress"),
  emailPassword: document.querySelector("#emailPassword"),
  imapHost: document.querySelector("#imapHost"),
  imapPort: document.querySelector("#imapPort"),
  manualImap: document.querySelector("#manualImap"),
  unreadOnly: document.querySelector("#unreadOnly"),
  markSeen: document.querySelector("#markSeen"),
  emailLimit: document.querySelector("#emailLimit"),
  importEmailBtn: document.querySelector("#importEmailBtn"),
  emailStatus: document.querySelector("#emailStatus"),
  toast: document.querySelector("#toast"),
};

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    state.files = Array.isArray(saved) ? saved : [];
  } catch {
    state.files = [];
  }
}

function saveState() {
  const cleanFiles = state.files.map(({ objectUrl, ...file }) => file);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanFiles));
  els.saveStatus.textContent = "Salvo no navegador";
}

function loadEmailConfig() {
  try {
    const config = JSON.parse(localStorage.getItem(EMAIL_CONFIG_KEY) || "{}");
    if (config.provider) els.emailProvider.value = config.provider;
    if (config.email) els.emailAddress.value = config.email;
    if (config.host) els.imapHost.value = config.host;
    if (config.port) els.imapPort.value = config.port;
    if (typeof config.unreadOnly === "boolean") els.unreadOnly.checked = config.unreadOnly;
    if (typeof config.markSeen === "boolean") els.markSeen.checked = config.markSeen;
    if (config.limit) els.emailLimit.value = config.limit;
  } catch {
    localStorage.removeItem(EMAIL_CONFIG_KEY);
  }
  renderEmailMode();
}

function saveEmailConfig() {
  localStorage.setItem(
    EMAIL_CONFIG_KEY,
    JSON.stringify({
      provider: els.emailProvider.value,
      email: els.emailAddress.value,
      host: els.imapHost.value,
      port: els.imapPort.value,
      unreadOnly: els.unreadOnly.checked,
      markSeen: els.markSeen.checked,
      limit: els.emailLimit.value,
    }),
  );
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function formatBytes(bytes = 0) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function cleanFolderName(value, fallback) {
  return (value || fallback)
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function inferType(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xml") || file.type.includes("xml")) return "xml";
  return "pdf";
}

function inferCategory(file, type) {
  const name = file.name.toLowerCase();
  if (type === "xml" || name.includes("nfe") || name.includes("nf-e") || name.includes("nota")) return "Fiscal";
  if (name.includes("contrato")) return "Contratos";
  if (name.includes("boleto") || name.includes("recibo") || name.includes("fatura")) return "Financeiro";
  if (name.includes("folha") || name.includes("rh")) return "Pessoal";
  return "Outros";
}

function inferPeriodFromDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function readXmlMetadata(xmlText) {
  const metadata = {};
  try {
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    const parserError = doc.querySelector("parsererror");
    if (parserError) return metadata;

    const emit = doc.querySelector("emit");
    const dest = doc.querySelector("dest");
    const ide = doc.querySelector("ide");
    const inf = doc.querySelector("infNFe");

    metadata.client = emit?.querySelector("xNome")?.textContent?.trim() || dest?.querySelector("xNome")?.textContent?.trim() || "";
    metadata.cnpj = emit?.querySelector("CNPJ")?.textContent?.trim() || dest?.querySelector("CNPJ")?.textContent?.trim() || "";
    metadata.period = inferPeriodFromDate(ide?.querySelector("dhEmi")?.textContent || ide?.querySelector("dEmi")?.textContent);
    metadata.key = inf?.getAttribute("Id")?.replace(/^NFe/i, "") || doc.querySelector("chNFe")?.textContent?.trim() || "";
  } catch {
    return metadata;
  }
  return metadata;
}

async function buildRecord(file) {
  const type = inferType(file);
  const record = {
    id: uid(),
    name: file.name,
    type,
    size: file.size,
    importedAt: new Date().toISOString(),
    originalPath: file.webkitRelativePath || file.name,
    client: "",
    period: "",
    category: inferCategory(file, type),
    status: "pendente",
    tags: type === "xml" ? "xml" : "pdf",
    cnpj: "",
    key: "",
    notes: "",
  };

  if (type === "xml") {
    const metadata = readXmlMetadata(await file.text());
    Object.assign(record, {
      client: metadata.client || record.client,
      period: metadata.period || record.period,
      cnpj: metadata.cnpj || record.cnpj,
      key: metadata.key || record.key,
    });
  }

  const objectUrl = URL.createObjectURL(file);
  state.objectUrls.set(record.id, objectUrl);
  return record;
}

async function addFiles(fileList) {
  const accepted = [...fileList].filter((file) => /\.(pdf|xml)$/i.test(file.name));
  if (!accepted.length) {
    showToast("Nenhum PDF ou XML encontrado.");
    return;
  }

  els.saveStatus.textContent = "Importando...";
  const records = await Promise.all(accepted.map(buildRecord));
  state.files = [...records, ...state.files];
  state.selectedId = records[0]?.id || state.selectedId;
  saveState();
  render();
  showToast(`${records.length} arquivo(s) adicionados.`);
}

function suggestedPath(file) {
  if (file.originalPath && /^[A-Z]:\\/i.test(file.originalPath)) {
    return file.originalPath;
  }
  const client = cleanFolderName(file.client, "Sem cliente");
  const period = cleanFolderName(file.period, "Sem periodo");
  const category = cleanFolderName(file.category, "Outros");
  const status = cleanFolderName(file.status, "pendente");
  const type = file.type.toUpperCase();
  return `${client}/${period}/${category}/${type}/${status}/${file.name}`;
}

function filteredFiles() {
  const query = state.filters.search.toLowerCase().trim();
  return state.files.filter((file) => {
    const text = [
      file.name,
      file.client,
      file.period,
      file.category,
      file.status,
      file.tags,
      file.cnpj,
      file.key,
      file.notes,
      file.originalPath,
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!query || text.includes(query)) &&
      (state.filters.type === "all" || file.type === state.filters.type) &&
      (state.filters.status === "all" || file.status === state.filters.status) &&
      (state.filters.category === "all" || file.category === state.filters.category)
    );
  });
}

function renderSummary(files) {
  els.totalCount.textContent = state.files.length;
  els.pdfCount.textContent = state.files.filter((file) => file.type === "pdf").length;
  els.xmlCount.textContent = state.files.filter((file) => file.type === "xml").length;
  els.pendingCount.textContent = state.files.filter((file) => file.status === "pendente").length;
  els.resultCount.textContent = `${files.length} encontrado${files.length === 1 ? "" : "s"}`;
}

function renderTable(files) {
  els.tableBody.innerHTML = "";
  els.emptyState.classList.toggle("hidden", state.files.length > 0);

  const fragment = document.createDocumentFragment();
  files.forEach((file) => {
    const tr = document.createElement("tr");
    tr.className = file.id === state.selectedId ? "selected" : "";
    tr.dataset.id = file.id;
    tr.innerHTML = `
      <td>
        <div class="file-cell">
          <span class="type-chip ${file.type}">${file.type.toUpperCase()}</span>
          <div>
            <span class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
            <span class="file-size">${formatBytes(file.size)}</span>
          </div>
        </div>
      </td>
      <td>${escapeHtml(file.client || "Sem cliente")}</td>
      <td>${escapeHtml(file.period || "Sem periodo")}</td>
      <td>${escapeHtml(file.category || "Outros")}</td>
      <td><span class="status-chip ${file.status}">${escapeHtml(labelStatus(file.status))}</span></td>
      <td class="path-cell">${escapeHtml(suggestedPath(file))}</td>
    `;
    fragment.appendChild(tr);
  });
  els.tableBody.appendChild(fragment);
}

function labelStatus(status) {
  return {
    pendente: "Pendente",
    conferido: "Conferido",
    arquivado: "Arquivado",
  }[status] || status;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function selectedFile() {
  return state.files.find((file) => file.id === state.selectedId);
}

function renderDetail() {
  const file = selectedFile();
  els.noSelection.classList.toggle("hidden", Boolean(file));
  els.detailForm.classList.toggle("hidden", !file);
  if (!file) return;

  els.detailType.textContent = file.type.toUpperCase();
  els.detailType.className = `file-badge ${file.type}`;
  els.detailName.textContent = file.name;
  els.detailMeta.textContent = `${formatBytes(file.size)} - importado em ${new Date(file.importedAt).toLocaleDateString("pt-BR")}`;
  els.clientInput.value = file.client || "";
  els.periodInput.value = file.period || "";
  els.statusInput.value = file.status || "pendente";
  els.categoryInput.value = file.category || "Outros";
  els.tagsInput.value = file.tags || "";
  els.cnpjInput.value = file.cnpj || "";
  els.keyInput.value = file.key || "";
  els.notesInput.value = file.notes || "";
  els.pathPreview.textContent = suggestedPath(file);

  const objectUrl = state.objectUrls.get(file.id);
  els.openFileLink.classList.toggle("hidden", !objectUrl);
  if (objectUrl) {
    els.openFileLink.href = objectUrl;
  } else if (file.fileUrl) {
    els.openFileLink.classList.remove("hidden");
    els.openFileLink.href = `${API_BASE}${file.fileUrl}`;
  }
}

function render() {
  const files = filteredFiles();
  renderSummary(files);
  renderTable(files);
  renderDetail();
}

function updateSelected(patch) {
  const file = selectedFile();
  if (!file) return;
  Object.assign(file, patch);
  saveState();
  render();
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportCsv() {
  const headers = ["Arquivo", "Tipo", "Tamanho", "Cliente", "Periodo", "Categoria", "Status", "Tags", "CNPJ", "Chave", "Origem", "Destino sugerido", "Observacoes"];
  const rows = state.files.map((file) => [
    file.name,
    file.type.toUpperCase(),
    formatBytes(file.size),
    file.client,
    file.period,
    file.category,
    labelStatus(file.status),
    file.tags,
    file.cnpj,
    file.key,
    file.originalPath,
    suggestedPath(file),
    file.notes,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(toCsvValue).join(";")).join("\n");
  downloadText("catalogo-arquivo-claro.csv", csv, "text/csv;charset=utf-8");
}

function exportJson() {
  downloadText("backup-arquivo-claro.json", JSON.stringify(state.files, null, 2), "application/json;charset=utf-8");
}

async function importJson(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error("Formato invalido");
    state.files = data.map((item) => ({ ...item, id: item.id || uid() }));
    state.selectedId = state.files[0]?.id || null;
    saveState();
    render();
    showToast("Backup restaurado.");
  } catch {
    showToast("Não consegui restaurar esse backup.");
  }
}

function renderEmailMode() {
  const isManual = els.emailProvider.value === "manual";
  els.manualImap.classList.toggle("show", isManual);
}

async function checkServerStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/status`);
    if (!response.ok) throw new Error("Servidor local indisponivel");
    const data = await response.json();
    els.emailStatus.textContent = `Pronto para salvar em: ${data.outputDir}`;
    els.importEmailBtn.disabled = false;
  } catch {
    els.emailStatus.textContent = "Servidor indisponível. Publique online ou execute com npm start.";
    els.importEmailBtn.disabled = false;
  }
}

function emailPayload() {
  const provider = els.emailProvider.value;
  return {
    provider: provider === "auto" ? "" : provider,
    email: els.emailAddress.value.trim(),
    password: els.emailPassword.value,
    host: provider === "manual" ? els.imapHost.value.trim() : "",
    port: provider === "manual" ? Number(els.imapPort.value || 993) : 993,
    secure: true,
    mailbox: "INBOX",
    unreadOnly: els.unreadOnly.checked,
    markSeen: els.markSeen.checked,
    limit: Number(els.emailLimit.value || 50),
  };
}

async function importFromEmail() {
  const payload = emailPayload();
  if (!payload.email || !payload.password || (els.emailProvider.value === "manual" && !payload.host)) {
    showToast("Preencha e-mail, senha e servidor quando for manual.");
    return;
  }

  saveEmailConfig();
  els.importEmailBtn.disabled = true;
  els.importEmailBtn.textContent = "Buscando...";
  els.emailStatus.textContent = "Conectando ao e-mail e procurando anexos PDF/XML.";

  try {
    const response = await fetch(`${API_BASE}/api/email/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Falha ao importar e-mail");

    const incoming = data.files || [];
    state.files = [...incoming, ...state.files];
    state.selectedId = incoming[0]?.id || state.selectedId;
    saveState();
    render();
    els.emailStatus.textContent = `Verificadas ${data.checked} mensagens. Importados ${data.imported} anexos em ${data.outputDir}.`;
    showToast(`${data.imported} anexo(s) de nota fiscal importado(s).`);
  } catch (error) {
    els.emailStatus.textContent = error.message || "Não consegui conectar ao e-mail.";
    showToast("Não consegui importar do e-mail. Confira IMAP e senha de app.");
  } finally {
    els.importEmailBtn.disabled = false;
    els.importEmailBtn.textContent = "Buscar notas fiscais";
    els.emailPassword.value = "";
  }
}

async function copyPlan() {
  const text = state.files.map((file) => suggestedPath(file)).join("\n");
  if (!text) {
    showToast("Adicione arquivos antes de copiar o plano.");
    return;
  }
  await navigator.clipboard.writeText(text);
  showToast("Plano de pastas copiado.");
}

function bindEvents() {
  els.pickFilesBtn.addEventListener("click", () => els.fileInput.click());
  els.pickFolderBtn.addEventListener("click", () => els.folderInput.click());
  els.fileInput.addEventListener("change", (event) => addFiles(event.target.files));
  els.folderInput.addEventListener("change", (event) => addFiles(event.target.files));

  ["dragenter", "dragover"].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("drag-over");
    });
  });

  els.dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));

  els.tableBody.addEventListener("click", (event) => {
    const row = event.target.closest("tr");
    if (!row) return;
    state.selectedId = row.dataset.id;
    render();
  });

  els.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    render();
  });
  els.typeFilter.addEventListener("change", (event) => {
    state.filters.type = event.target.value;
    render();
  });
  els.statusFilter.addEventListener("change", (event) => {
    state.filters.status = event.target.value;
    render();
  });
  els.categoryFilter.addEventListener("change", (event) => {
    state.filters.category = event.target.value;
    render();
  });

  els.clientInput.addEventListener("input", (event) => updateSelected({ client: event.target.value }));
  els.periodInput.addEventListener("input", (event) => updateSelected({ period: event.target.value }));
  els.statusInput.addEventListener("change", (event) => updateSelected({ status: event.target.value }));
  els.categoryInput.addEventListener("change", (event) => updateSelected({ category: event.target.value }));
  els.tagsInput.addEventListener("input", (event) => updateSelected({ tags: event.target.value }));
  els.cnpjInput.addEventListener("input", (event) => updateSelected({ cnpj: event.target.value }));
  els.keyInput.addEventListener("input", (event) => updateSelected({ key: event.target.value }));
  els.notesInput.addEventListener("input", (event) => updateSelected({ notes: event.target.value }));

  els.duplicateBtn.addEventListener("click", () => {
    const file = selectedFile();
    if (!file) return;
    const copy = { ...file, id: uid(), name: `${file.name} (copia)`, importedAt: new Date().toISOString() };
    state.files.unshift(copy);
    state.selectedId = copy.id;
    saveState();
    render();
    showToast("Registro duplicado.");
  });

  els.deleteBtn.addEventListener("click", () => {
    const file = selectedFile();
    if (!file) return;
    const url = state.objectUrls.get(file.id);
    if (url) URL.revokeObjectURL(url);
    state.objectUrls.delete(file.id);
    state.files = state.files.filter((item) => item.id !== file.id);
    state.selectedId = state.files[0]?.id || null;
    saveState();
    render();
    showToast("Arquivo removido do catálogo.");
  });

  els.exportCsvBtn.addEventListener("click", exportCsv);
  els.exportJsonBtn.addEventListener("click", exportJson);
  els.copyPlanBtn.addEventListener("click", copyPlan);
  els.importJsonInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importJson(file);
  });

  els.clearBtn.addEventListener("click", () => {
    if (!state.files.length) return;
    const ok = window.confirm("Limpar todo o catálogo salvo neste navegador?");
    if (!ok) return;
    state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    state.objectUrls.clear();
    state.files = [];
    state.selectedId = null;
    saveState();
    render();
    showToast("Catálogo limpo.");
  });

  els.emailProvider.addEventListener("change", () => {
    renderEmailMode();
    saveEmailConfig();
  });
  [els.emailAddress, els.imapHost, els.imapPort, els.emailLimit].forEach((input) => {
    input.addEventListener("input", saveEmailConfig);
  });
  [els.unreadOnly, els.markSeen].forEach((input) => {
    input.addEventListener("change", saveEmailConfig);
  });
  els.importEmailBtn.addEventListener("click", importFromEmail);
}

loadState();
loadEmailConfig();
bindEvents();
render();
checkServerStatus();
