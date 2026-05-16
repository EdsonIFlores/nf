const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || path.join(ROOT, "NotasFiscais"));

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
  zohopro: { host: "imappro.zoho.com", port: 993, secure: true },
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
  const supplier =
    xmlMetadata.client ||
    mail.from?.value?.[0]?.name ||
    mail.from?.value?.[0]?.address ||
    "Fornecedor sem nome";
  const messageDate = mail.date ? new Date(mail.date) : new Date();
  const period =
    xmlMetadata.period ||
    `${messageDate.getFullYear()}-${String(messageDate.getMonth() + 1).padStart(2, "0")}`;
  const folder = path.join(OUTPUT_DIR, sanitizeFolderName(supplier, "Fornecedor sem nome"), sanitizeFolderName(period, "Sem data"));
  await fsp.mkdir(folder, { recursive: true });

  const filePath = await uniquePath(folder, attachment.filename || `nota-fiscal.${type}`);
  await fsp.writeFile(filePath, attachment.content);

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: path.basename(filePath),
    type,
    size: attachment.size || attachment.content.length,
    importedAt: new Date().toISOString(),
    originalPath: filePath,
    fileUrl: toFileUrl(filePath),
    client: supplier,
    period,
    category: "Fiscal",
    status: "pendente",
    tags: `email, nota fiscal, ${type}`,
    cnpj: xmlMetadata.cnpj || "",
    key: xmlMetadata.key || "",
    notes: `Importado do e-mail ${config.email}. Assunto: ${mail.subject || "sem assunto"}`,
  };
}

async function importFromEmail(input) {
  const config = resolveConfig(input);
  if (!config.host || !config.email || !config.password) {
    throw new Error("Informe e-mail, senha e servidor IMAP.");
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.email,
      pass: config.password,
    },
    logger: false,
  });

  const records = [];
  let checked = 0;

  await client.connect();
  try {
    const lock = await client.getMailboxLock(config.mailbox);
    try {
      const search = config.unreadOnly ? { seen: false } : {};
      const uids = await client.search(search);
      const latest = uids.slice(-config.limit);
      if (latest.length) {
        for await (const message of client.fetch(latest, { source: true, envelope: true, uid: true })) {
          checked += 1;
          const mail = await simpleParser(message.source);
          for (const attachment of mail.attachments || []) {
            const record = await saveAttachment(attachment, mail, config);
            if (record) records.push(record);
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
    checked,
    imported: records.length,
    files: records,
  };
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

    if (url.pathname === "/api/file") {
      const requested = path.resolve(url.searchParams.get("path") || "");
      if (!requested.startsWith(OUTPUT_DIR)) return send(res, 403, "Acesso negado", "text/plain; charset=utf-8");
      const data = await fsp.readFile(requested);
      return send(res, 200, data, MIME[path.extname(requested).toLowerCase()] || "application/octet-stream");
    }

    return serveStatic(req, res, url);
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message || "Erro inesperado" });
  }
}

fsp.mkdir(OUTPUT_DIR, { recursive: true }).then(() => {
  http.createServer(handle).listen(PORT, HOST, () => {
    console.log(`Arquivo Claro aberto na porta ${PORT}`);
    console.log(`Pasta das notas: ${OUTPUT_DIR}`);
  });
});
