const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || path.join(ROOT, "NotasFiscais"));
const INDEX_FILE = path.join(OUTPUT_DIR, ".arquivo-claro-index.json");
const APP_USER = process.env.APP_USER || "";
const APP_PASSWORD = process.env.APP_PASSWORD || "";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".xml": "application/xml; charset=utf-8",
};

const PROVIDERS = {
  gmail: { host: "imap.gmail.com", port: 993, secure: true },
  outlook: { host: "outlook.office365.com", port: 993, secure: true },
  hotmail: { host: "outlook.office365.com", port: 993, secure: true },
  live: { host: "outlook.office365.com", port: 993, secure: true },
  yahoo: { host: "imap.mail.yahoo.com", port: 993, secure: true },
  uol: { host: "imap.uol.com.br", port: 993, secure: true },
  bol: { host: "imap.bol.com.br", port: 993, secure: true },
  terra: { host: "imap.terra.com.br", port: 993, secure: true },
  locaweb: { host: "email-ssl.com.br", port: 993, secure: true },
  kinghost: { host: "imap.kinghost.net", port: 993, secure: true },
  zoho: { host: "imap.zoho.com", port: 993, secure: true },
  zohopro: { host: "imap.zoho.com", port: 993, secure: true },
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  if (Buffer.isBuffer(body)) {
    res.end(body);
  } else {
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  }
}

function sanitizeFolderName(value, fallback) {
  return String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90) || fallback;
}

function sanitizeFileName(value) {
  return String(value || "anexo")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 130);
}

async function uniquePath(folder, fileName) {
  const parsed = path.parse(sanitizeFileName(fileName));
  let candidate = path.join(folder, `${parsed.name}${parsed.ext}`);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(folder, `${parsed.name} (${index})${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

function textMatch(text, pattern) {
  const match = String(text || "").match(pattern);
  return match ? match[1].trim() : "";
}

function readXmlMetadata(buffer) {
  const text = buffer.toString("utf8");
  const emitBlock = textMatch(text, /<emit\b[^>]*>([\s\S]*?)<\/emit>/i);
  const destBlock = textMatch(text, /<dest\b[^>]*>([\s\S]*?)<\/dest>/i);
  const ideBlock = textMatch(text, /<ide\b[^>]*>([\s\S]*?)<\/ide>/i);
  const infId = textMatch(text, /<infNFe\b[^>]*\bId=["']NFe([^"']+)["']/i);

  const client =
    textMatch(emitBlock, /<xNome>([\s\S]*?)<\/xNome>/i) ||
    textMatch(destBlock, /<xNome>([\s\S]*?)<\/xNome>/i);
  const cnpj =
    textMatch(emitBlock, /<CNPJ>([\s\S]*?)<\/CNPJ>/i) ||
    textMatch(destBlock, /<CNPJ>([\s\S]*?)<\/CNPJ>/i);
  const dateText =
    textMatch(ideBlock, /<dhEmi>([\s\S]*?)<\/dhEmi>/i) ||
    textMatch(ideBlock, /<dEmi>([\s\S]*?)<\/dEmi>/i);
  const key = infId || textMatch(text, /<chNFe>([\s\S]*?)<\/chNFe>/i);

  return {
    client,
    cnpj,
    key,
    period: dateText ? dateText.slice(0, 7) : "",
  };
}

function providerFromEmail(email) {
  const domain = String(email || "").split("@")[1]?.toLowerCase() || "";
  if (domain.includes("gmail")) return PROVIDERS.gmail;
  if (domain.includes("outlook")) return PROVIDERS.outlook;
  if (domain.includes("hotmail")) return PROVIDERS.hotmail;
  if (domain.includes("live.")) return PROVIDERS.live;
  if (domain.includes("yahoo")) return PROVIDERS.yahoo;
  if (domain.includes("uol")) return PROVIDERS.uol;
  if (domain.includes("bol")) return PROVIDERS.bol;
  if (domain.includes("terra")) return PROVIDERS.terra;
  if (domain.includes("zoho")) return PROVIDERS.zoho;
  return null;
}

function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isAuthorized(req) {
  if (!APP_USER || !APP_PASSWORD) return true;
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    const user = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return timingSafeEqualText(user, APP_USER) && timingSafeEqualText(password, APP_PASSWORD);
  } catch {
    return false;
  }
}

function requireAuth(res) {
  res.writeHead(401, {
    "WWW-Authenticate": 'Basic realm="Arquivo Claro"',
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end("Acesso protegido.");
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function makeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name.replace(/\\/g, "/"), "utf8");
    const data = entry.data;
    const checksum = crc32(data);
    const { dosTime, dosDate } = dosDateTime(entry.date || new Date());

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + data.length;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

async function readIndex() {
  try {
    return JSON.parse(await fsp.readFile(INDEX_FILE, "utf8"));
  } catch {
    return { hashes: {} };
  }
}

async function writeIndex(index) {
  await fsp.mkdir(OUTPUT_DIR, { recursive: true });
  await fsp.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

function detectDocumentKind({ fileName, subject, type, xmlMetadata }) {
  const text = `${fileName || ""} ${subject || ""}`.toLowerCase();
  if (text.includes("boleto") || text.includes("fatura") || text.includes("cobranca") || text.includes("cobrança") || text.includes("pix")) {
    return { kind: "Boleto", category: "Financeiro", folder: "Boletos" };
  }
  if (type === "xml" || xmlMetadata?.key || text.includes("nfe") || text.includes("nf-e") || text.includes("nota")) {
    return { kind: "Nota fiscal", category: "Fiscal", folder: "Notas Fiscais" };
  }
  return { kind: "Documento", category: "Outros", folder: "Outros" };
}

function dayFromDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function resolveConfig(input) {
  const preset = PROVIDERS[input.provider] || providerFromEmail(input.email) || {};
  return {
    host: input.host || preset.host,
    port: Number(input.port || preset.port || 993),
    secure: input.secure !== false,
    email: input.email,
    password: input.password,
    mailbox: input.mailbox || "INBOX",
    limit: Math.min(Math.max(Number(input.limit || 50), 1), 300),
    unreadOnly: Boolean(input.unreadOnly),
    markSeen: Boolean(input.markSeen),
  };
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function toFileUrl(filePath) {
  return `/api/file?path=${encodeURIComponent(filePath)}`;
}

async function saveAttachment(attachment, mail, config) {
  const ext = path.extname(attachment.filename || "").toLowerCase();
  if (![".pdf", ".xml"].includes(ext)) return null;

  const type = ext.slice(1);
  const xmlMetadata = type === "xml" ? readXmlMetadata(attachment.content) : {};
  const hash = crypto.createHash("sha256").update(attachment.content).digest("hex");
  const index = await readIndex();
  if (index.hashes[hash]) {
    return { duplicate: true, existing: index.hashes[hash] };
  }

  const supplier =
    xmlMetadata.client ||
    mail.from?.value?.[0]?.name ||
    mail.from?.value?.[0]?.address ||
    "Fornecedor sem nome";
  const messageDate = mail.date ? new Date(mail.date) : new Date();
  const receivedDay = dayFromDate(messageDate);
  const period =
    xmlMetadata.period ||
    `${messageDate.getFullYear()}-${String(messageDate.getMonth() + 1).padStart(2, "0")}`;
  const document = detectDocumentKind({
    fileName: attachment.filename,
    subject: mail.subject,
    type,
    xmlMetadata,
  });
  const folder = path.join(
    OUTPUT_DIR,
    sanitizeFolderName(supplier, "Fornecedor sem nome"),
    sanitizeFolderName(period, "Sem data"),
    document.folder,
  );
  await fsp.mkdir(folder, { recursive: true });

  const baseName = sanitizeFileName(attachment.filename || `${document.folder}.${type}`);
  const filePath = await uniquePath(folder, `${receivedDay} - ${baseName}`);
  await fsp.writeFile(filePath, attachment.content);

  const record = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: path.basename(filePath),
    type,
    documentKind: document.kind,
    size: attachment.size || attachment.content.length,
    importedAt: new Date().toISOString(),
    receivedAt: receivedDay,
    originalPath: filePath,
    fileUrl: toFileUrl(filePath),
    client: supplier,
    period,
    category: document.category,
    status: "pendente",
    tags: `email, ${document.kind.toLowerCase()}, ${type}`,
    cnpj: xmlMetadata.cnpj || "",
    key: xmlMetadata.key || "",
    hash,
    vobiReady: true,
    notes: `Importado do e-mail ${config.email}. Assunto: ${mail.subject || "sem assunto"}`,
  };

  index.hashes[hash] = {
    name: record.name,
    path: filePath,
    importedAt: record.importedAt,
  };
  await writeIndex(index);
  return record;
}

async function importFromEmail(input) {
  const config = resolveConfig(input);
  if (!config.host || !config.email || !config.password) {
    throw new Error("Informe e-mail, senha e servidor IMAP.");
  }

  const client = createImapClient(config);

  const records = [];
  let duplicates = 0;
  let checked = 0;
  let available = 0;
  let scannedAttachments = 0;
  let acceptedAttachments = 0;
  let ignoredAttachments = 0;

  await client.connect();
  try {
    const lock = await client.getMailboxLock(config.mailbox);
    try {
      const search = config.unreadOnly ? { unseen: true } : {};
      const uids = await client.search(search);
      available = uids.length;
      const latest = uids.slice(-config.limit);
      if (latest.length) {
        for await (const message of client.fetch(latest, { source: true, envelope: true, flags: true, uid: true })) {
          if (config.unreadOnly && message.flags?.has("\\Seen")) {
            continue;
          }
          checked += 1;
          const mail = await simpleParser(message.source);
          for (const attachment of mail.attachments || []) {
            scannedAttachments += 1;
            if (!isSupportedAttachment(attachment)) {
              ignoredAttachments += 1;
              continue;
            }
            acceptedAttachments += 1;
            const record = await saveAttachment(attachment, mail, config);
            if (record?.duplicate) duplicates += 1;
            else if (record) records.push(record);
          }
          if (config.markSeen) {
            await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return {
    ok: true,
    outputDir: OUTPUT_DIR,
    mode: config.unreadOnly ? "Somente nao lidos" : "Todos os e-mails recentes",
    available,
    checked,
    scannedAttachments,
    acceptedAttachments,
    ignoredAttachments,
    imported: records.length,
    duplicates,
    files: records,
  };
}

function publicEmailError(error) {
  const message = String(error?.message || "Erro desconhecido");
  const technical = message.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, "[email]");
  if (/command failed/i.test(message)) {
    return {
      error: "O servidor IMAP recusou a operacao.",
      hint: "No Zoho, confirme se IMAP esta ativado para esta conta e se o administrador do dominio permite acesso IMAP. Use Manual: imap.zoho.com, porta 993, SSL ativo.",
      technical,
    };
  }
  if (/auth|login|credentials|password|authentication|invalid/i.test(message)) {
    return {
      error: "O servidor recusou o login.",
      hint: "Confira o e-mail completo, IMAP ativado no Zoho e uma senha de aplicativo gerada para esta mesma conta.",
      technical,
    };
  }
  if (/certificate|self.signed|ssl|tls/i.test(message)) {
    return { error: "Falha de seguranca SSL/TLS ao conectar no IMAP.", hint: "Confira servidor imap.zoho.com, porta 993 e SSL ativo.", technical };
  }
  if (/timeout|timed out|etimedout/i.test(message)) {
    return { error: "Tempo esgotado ao conectar no IMAP.", hint: "Confira servidor, porta e se o Zoho permite acesso IMAP externo.", technical };
  }
  if (/ENOTFOUND|getaddrinfo|dns/i.test(message)) {
    return { error: "Servidor IMAP nao encontrado.", hint: "Para este Zoho use imap.zoho.com na porta 993.", technical };
  }
  if (/ECONNREFUSED|ECONNRESET|socket/i.test(message)) {
    return { error: "Conexao recusada ou interrompida pelo servidor IMAP.", hint: "Confira porta 993, SSL e liberacao de IMAP no Zoho.", technical };
  }
  return { error: message, hint: "Confira servidor IMAP, porta, SSL, senha de aplicativo e permissao IMAP da conta.", technical };
}

function createImapClient(config) {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.email,
      pass: config.password,
    },
    logger: false,
  });
}

function isSupportedAttachment(attachment) {
  const ext = path.extname(attachment.filename || "").toLowerCase();
  return [".pdf", ".xml"].includes(ext);
}

async function exportVobiPackage(input) {
  const files = Array.isArray(input.files) ? input.files : [];
  const entries = [];
  const manifest = [];

  for (const file of files) {
    const requested = path.resolve(file.originalPath || "");
    if (!requested.startsWith(OUTPUT_DIR)) continue;
    try {
      const data = await fsp.readFile(requested);
      const supplier = sanitizeFolderName(file.client, "Fornecedor sem nome");
      const period = sanitizeFolderName(file.period, "Sem data");
      const kind = sanitizeFolderName(file.documentKind || file.category || "Documento", "Documento");
      const name = sanitizeFileName(path.basename(requested));
      const zipPath = `${supplier}/${period}/${kind}/${name}`;
      entries.push({ name: zipPath, data, date: new Date(file.importedAt || Date.now()) });
      manifest.push({
        arquivo: name,
        fornecedor: file.client || "",
        periodo: file.period || "",
        tipo: file.type || "",
        documento: file.documentKind || "",
        cnpj: file.cnpj || "",
        chave: file.key || "",
        caminho: zipPath,
      });
    } catch {
      // Ignore files that are no longer present on the server.
    }
  }

  entries.push({
    name: "manifesto-vobi.json",
    data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
    date: new Date(),
  });

  return makeZip(entries);
}

async function testEmailAccess(input) {
  const config = resolveConfig(input);
  if (!config.host || !config.email || !config.password) {
    throw new Error("Informe e-mail, senha e servidor IMAP.");
  }

  const client = createImapClient(config);
  await client.connect();
  try {
    const status = await client.status(config.mailbox, { messages: true, unseen: true });
    return {
      ok: true,
      email: config.email,
      host: config.host,
      mailbox: config.mailbox,
      totalMessages: status.messages ?? 0,
      unreadMessages: status.unseen ?? 0,
      mode: config.unreadOnly ? "Pronto para buscar apenas nao lidos" : "Pronto para buscar e-mails recentes",
    };
  } finally {
    await client.logout().catch(() => {});
  }
}

async function serveStatic(req, res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.resolve(ROOT, `.${pathname}`);
  if (!filePath.startsWith(ROOT)) return send(res, 403, "Acesso negado", "text/plain; charset=utf-8");

  try {
    const data = await fsp.readFile(filePath);
    send(res, 200, data, MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream");
  } catch {
    send(res, 404, "Arquivo não encontrado", "text/plain; charset=utf-8");
  }
}

async function handle(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, "");
  if (!isAuthorized(req)) return requireAuth(res);
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (url.pathname === "/api/status") {
      return send(res, 200, { ok: true, outputDir: OUTPUT_DIR });
    }

    if (url.pathname === "/api/email/import" && req.method === "POST") {
      const body = await parseBody(req);
      const result = await importFromEmail(body);
      return send(res, 200, result);
    }

    if (url.pathname === "/api/email/test" && req.method === "POST") {
      const body = await parseBody(req);
      const result = await testEmailAccess(body);
      return send(res, 200, result);
    }

    if (url.pathname === "/api/export/vobi" && req.method === "POST") {
      const body = await parseBody(req);
      const zip = await exportVobiPackage(body);
      res.writeHead(200, {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=\"pacote-vobi.zip\"",
        "Access-Control-Allow-Origin": "*",
      });
      return res.end(zip);
    }

    if (url.pathname === "/api/file") {
      const requested = path.resolve(url.searchParams.get("path") || "");
      if (!requested.startsWith(OUTPUT_DIR)) return send(res, 403, "Acesso negado", "text/plain; charset=utf-8");
      const data = await fsp.readFile(requested);
      return send(res, 200, data, MIME[path.extname(requested).toLowerCase()] || "application/octet-stream");
    }

    return serveStatic(req, res, url);
  } catch (error) {
    return send(res, 500, { ok: false, ...publicEmailError(error) });
  }
}

fsp.mkdir(OUTPUT_DIR, { recursive: true }).then(() => {
  http.createServer(handle).listen(PORT, HOST, () => {
    console.log(`Arquivo Claro aberto na porta ${PORT}`);
    console.log(`Pasta das notas: ${OUTPUT_DIR}`);
  });
});
