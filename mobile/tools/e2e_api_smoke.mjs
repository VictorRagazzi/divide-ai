// Fumaça do MODO API: o app exportado com .env.mock.example conversando com o
// backend falso (tools/mock_backend.mjs) num navegador real. Prova que login por
// código, perfil, busca, pedido, acordo, chat e falha de rede passam pela camada
// de serviços (nada de reducer local), e que a interface não mostra itens de demo.
//
//   (bash) set -a; . ./.env.mock.example; set +a
//   npx expo export --platform web --output-dir dist/web-api --clear
//   npm i --no-save playwright-core
//   node tools/e2e_api_smoke.mjs [pastaDeCapturas] [largura]
//
// Sobe sozinho o backend falso (8787) e o servidor estático (8082).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const OUT = process.argv[2] || path.join(os.tmpdir(), "divide-ai-e2e-api");
const WIDTH = Number(process.argv[3] || 390);
const BASE = "http://127.0.0.1:8082";
fs.mkdirSync(OUT, { recursive: true });

const children = [];
const start = (cmd, args, ready) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: path.resolve(import.meta.dirname, ".."), stdio: ["ignore", "pipe", "pipe"] });
    children.push(child);
    const timer = setTimeout(() => reject(new Error(`${cmd} não iniciou`)), 15000);
    const onData = (chunk) => {
      if (ready.test(String(chunk))) {
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", reject);
  });
const backend = await start(
  process.execPath,
  ["--experimental-strip-types", "--no-warnings", "tools/mock_backend.mjs"],
  /Backend falso/,
);
await start("python", ["tools/serve_catalog.py", "dist/web-api", "8082"], /App:/);

const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_PATH ??
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const page = await (await browser.newContext({ viewport: { width: WIDTH, height: 800 } })).newPage();
let errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
let failed = false;
let n = 0;
const shot = (name) => page.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${name}.png` });
const step = async (name, fn) => {
  if (failed) return;
  errors = [];
  try {
    await fn();
    console.log("OK  ", name, errors.length ? "| errs: " + errors.join(" ; ") : "");
  } catch (e) {
    failed = true;
    console.log("FAIL", name, "-", e.message.split("\n")[0]);
    await shot("FAIL-" + name.replace(/\W+/g, "_")).catch(() => {});
  }
};
const btn = (name) => page.getByRole("button", { name }).first();
const click = async (name) => {
  await btn(name).waitFor({ timeout: 8000 });
  await btn(name).click();
};
const seen = (text, timeout = 10000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), text, { timeout });
const body = () => page.locator("body").innerText();
const noDemo = async () => {
  const text = await body();
  for (const word of ["DEMO", "Demo:", "Demo ·", "demonstração", "simulad", "fictício"])
    if (text.includes(word)) throw new Error(`texto de demo visível: "${word}"`);
};

async function pickPlace(label, query, optionRe) {
  await page.getByRole("textbox", { name: label }).first().click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel(label).fill(query);
  await dlg.getByRole("button", { name: optionRe }).first().waitFor({ timeout: 8000 });
  await dlg.getByRole("button", { name: optionRe }).first().click();
}

await step("login: e-mail, código errado e certo (servidor decide)", async () => {
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.getByLabel("E-mail").waitFor({ timeout: 20000 });
  await noDemo();
  await page.getByLabel("E-mail").fill("ana@exemplo.com");
  await click("Enviar código");
  await seen("Digite o código");
  if ((await body()).includes("Nenhum e-mail foi enviado")) throw new Error("aviso de demo no login real");
  await page.getByLabel(/^Código/).fill("000000");
  await click("Entrar");
  await seen("Código incorreto ou expirado");
  await shot("codigo-errado");
  await page.getByLabel(/^Código/).fill("123456");
  await click("Entrar");
  await page.waitForURL(/cadastro/, { timeout: 8000 });
});

await step("cadastro grava o perfil no servidor", async () => {
  await page.getByLabel(/^Nome/).first().fill("Ana Souza");
  await page.getByLabel("Dia de nascimento").fill("05");
  await page.getByLabel("Mês de nascimento").fill("03");
  await page.getByLabel("Ano de nascimento").fill("1998");
  await click("Criar perfil");
  await page.getByLabel("Local de partida").waitFor({ timeout: 20000 });
  await shot("home");
});

await step("recarregar a página pede login de novo (sessão só em memória)", async () => {
  await page.reload({ waitUntil: "load" });
  await page.getByLabel("E-mail").waitFor({ timeout: 20000 });
  await page.getByLabel("E-mail").fill("ana@exemplo.com");
  await click("Enviar código");
  await seen("Digite o código");
  await page.getByLabel(/^Código/).fill("123456");
  await click("Entrar");
  // Perfil já existe no servidor: vai direto ao início, sem passar pelo cadastro.
  await page.getByLabel("Local de partida").waitFor({ timeout: 20000 });
  if (page.url().includes("cadastro")) throw new Error("cadastro repetido para quem já tem perfil");
});

await step("endereços vêm do backend (geocoder api)", async () => {
  await pickPlace("Local de partida", "Rua da Bahia", /Bahia/);
  if (!(await page.getByRole("dialog").count()))
    await page.getByRole("textbox", { name: "Para onde?" }).first().click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Para onde?").fill("Afonso Pena");
  await dlg.getByRole("button", { name: /Afonso Pena/ }).first().waitFor({ timeout: 8000 });
  await dlg.getByRole("button", { name: /Afonso Pena/ }).first().click();
  if (await page.getByRole("dialog").count())
    await page.getByRole("dialog").getByRole("button", { name: /Conferir|Fechar|Concluir|Confirmar/ }).first().click();
  await shot("home-preenchida");
});

await step("busca e pedido passam pelo servidor", async () => {
  await click("Buscar companhia");
  await page.waitForURL(/busca/, { timeout: 8000 });
  await noDemo();
  await click(/^Ver \d+ pesso/);
  await page.waitForURL(/sugestoes/);
  await seen("Evandro");
  await click("Aceitar");
  await page.waitForURL(/espera/, { timeout: 8000 });
  await noDemo();
  await shot("espera");
});

await step("o aceite da outra pessoa chega por atualização automática", async () => {
  await page.waitForURL(/proposta/, { timeout: 20000 });
  await noDemo();
  await shot("proposta");
});

await step("chat: mensagem só aparece depois do servidor confirmar", async () => {
  const tab = page.getByRole("tab", { name: /Chat/ }).first();
  if (await tab.count()) await tab.click();
  else await click("Chat");
  await page.waitForURL(/chat/);
  await page.getByRole("textbox").first().fill("Oi! Combinamos na entrada?");
  await click("Enviar");
  await seen("Combinamos na entrada");
  await noDemo();
  await shot("chat");
});

await step("escolher a opção fecha o acordo (servidor aplica a escolha da outra pessoa)", async () => {
  await click("Proposta");
  await page.waitForURL(/proposta/);
  await click("Sugestão do app");
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 5000 });
  await dialog.getByRole("button", { name: "Escolher esta opção" }).click();
  await seen("Vocês escolheram a mesma opção");
  await click("Ver viagem combinada");
  await page.waitForURL(/viagem/, { timeout: 8000 });
  await noDemo();
  await shot("viagem-combinada");
});

await step("sem rede: aviso claro e a tela continua usável", async () => {
  backend.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await click("Mudar a escolha");
  await page.waitForURL(/proposta/);
  await click("Meu trajeto");
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 5000 });
  await dialog.getByRole("button", { name: "Escolher esta opção" }).click();
  await seen("Sem conexão com o servidor", 15000);
  await shot("sem-rede");
});

await browser.close();
for (const child of children) child.kill();
console.log(failed ? "RESULT: FAILED" : "RESULT: PASSED");
process.exit(failed ? 1 : 0);
