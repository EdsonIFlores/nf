const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "server.js",
  "package.json",
  "render.yaml",
];

const problems = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    problems.push(`Arquivo obrigatorio ausente: ${file}`);
  }
}

for (const file of ["index.html", "app.js", "server.js", "styles.css"]) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) continue;
  const text = fs.readFileSync(fullPath, "utf8");
  if (/<<<<<<<|=======|>>>>>>>/.test(text)) {
    problems.push(`Marcador de conflito Git encontrado em: ${file}`);
  }
}

const server = fs.existsSync(path.join(root, "server.js"))
  ? fs.readFileSync(path.join(root, "server.js"), "utf8")
  : "";

[
  "imap.gmail.com",
  "outlook.office365.com",
  "imappro.zoho.com",
  "/api/email/test",
  "/api/email/import",
  "/api/catalog",
  "/api/export/vobi",
].forEach((needle) => {
  if (!server.includes(needle)) {
    problems.push(`Servidor nao contem configuracao esperada: ${needle}`);
  }
});

if (problems.length) {
  console.error("Preflight falhou:");
  problems.forEach((problem) => console.error(`- ${problem}`));
  process.exit(1);
}

console.log("Preflight OK: arquivos, conflitos e rotas principais conferidos.");
