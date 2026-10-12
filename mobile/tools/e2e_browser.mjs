// Percorre o fluxo mockado inteiro num navegador real (Chromium/Edge/Chrome) e
// salva uma captura por tela. Não é dependência do projeto: instale só quando
// for usar, sem alterar o lockfile.
//
//   npm i --no-save playwright-core
//   npm run export:web && python tools/serve_catalog.py     (outro terminal)
//   node tools/e2e_browser.mjs [pastaDeCapturas] [largura] [baseUrl] [nophoton]
//
// BROWSER_PATH aponta para o executável (padrão: Edge no Windows). "nophoton"
// bloqueia o geocoder e escolhe origem/destino tocando no mapa.
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { chromium } from "playwright-core";

const OUT = process.argv[2] || path.join(os.tmpdir(), "divide-ai-e2e");
fs.mkdirSync(OUT, { recursive: true });
const WIDTH = Number(process.argv[3] || 390);
const BASE = process.argv[4] || "http://127.0.0.1:8081";
const BLOCK_PHOTON = process.argv[5] === "nophoton";
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_PATH ??
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const ctx = await browser.newContext({
  viewport: { width: WIDTH, height: 800 },
  geolocation: { latitude: -19.9391, longitude: -43.9386 },
  permissions: ["geolocation"],
});
const page = await ctx.newPage();
if (BLOCK_PHOTON) await page.route("**/photon.komoot.io/**", (r) => r.abort());
let errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160));
});
let n = 0;
const shot = (name) =>
  page.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${name}.png` });
let failed = false;
const step = async (name, fn) => {
  if (failed) return;
  errors = [];
  try {
    await fn();
    console.log("OK  ", name, errors.length ? "| errs: " + errors.join(" ; ") : "");
  } catch (e) {
    failed = true;
    console.log("FAIL", name, "-", e.message.split("\n")[0]);
    await shot("FAIL-" + name.replace(/\W+/g, "_"));
  }
};
const btn = (name, exact = false) => page.getByRole("button", { name, exact }).first();
const txt = (t) => page.getByText(t, { exact: false }).first();
const click = async (name) => {
  await btn(name).waitFor({ timeout: 8000 });
  await btn(name).click();
};
// Texto visível da página (o primeiro nó com o texto pode ser só para leitor de tela).
const seen = (text) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), text, {
    timeout: 10000,
  });
const body = () => page.locator("body").innerText();
const url = () => new URL(page.url()).pathname;

async function pickPlace(label, query, optionRe) {
  await page.getByLabel(label).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel(label).fill(query);
  await dlg.getByRole("button", { name: optionRe }).first().waitFor({ timeout: 15000 });
  await dlg.getByRole("button", { name: optionRe }).first().click();
}

await step("home", async () => {
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.getByLabel("Local de partida").waitFor({ timeout: 20000 });
});

await step("GPS preenche a partida sem mexer no destino", async () => {
  await page.getByLabel("Local de partida").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Minha localização" })
    .click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("input")].some(
        (e) => e.value === "Minha localização atual",
      ),
    null,
    { timeout: 15000 },
  );
  await shot("gps");
  console.log("   texto:", (await body()).replace(/\s+/g, " ").slice(0, 200));
  await page.reload({ waitUntil: "load" });
  await page.getByLabel("Local de partida").waitFor({ timeout: 20000 });
});

if (BLOCK_PHOTON) {
  await step("pontos pelo mapa (sem Photon)", async () => {
    await page.getByLabel("Local de partida").click();
    await shot("dialog-sem-photon");
    await click("Escolher no mapa");
    await shot("escolher-mapa");
  });
  await step("tocar origem e destino no mapa", async () => {
    const map = page.frameLocator("iframe").locator("#map");
    await map.click({ position: { x: 150, y: 420 } });
    await page.waitForTimeout(1500);
    await shot("origem-mapa");
    await page.getByText("escolher o destino").first().waitFor({ timeout: 4000 });
    await map.click({ position: { x: 300, y: 480 } });
    await page.waitForTimeout(1500);
    await shot("destino-mapa");
    const vals = await page.locator("input").evaluateAll((els) => els.map((e) => e.value));
    console.log("   campos:", JSON.stringify(vals));
    if (vals.filter(Boolean).length < 2) throw new Error("campo vazio após toque no mapa");
  });
} else {
  await step("origem", async () => {
    await pickPlace("Local de partida", "Rua da Bahia Belo Horizonte", /Lourdes/);
    await shot("apos-origem");
  });
  await step("destino", async () => {
    const dlgOpen = await page.getByRole("dialog").count();
    if (!dlgOpen) await page.getByLabel("Para onde?").click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Para onde?").fill("Praça da Liberdade Belo Horizonte");
    await dlg.getByRole("button", { name: /Savassi|Funcion|Liberdade/ }).first().waitFor({ timeout: 15000 });
    await shot("destino-sugestoes");
    await dlg.getByRole("button", { name: /Funcion|Savassi|Liberdade/ }).first().click();
    await shot("apos-destino");
  });
}

await step("fechar dialog e buscar", async () => {
  if (await page.getByRole("dialog").count()) {
    console.log("   dialog ainda aberto após destino; botões:", JSON.stringify(await page.getByRole("dialog").getByRole("button").allInnerTexts()));
    await page.getByRole("dialog").getByRole("button", { name: /Conferir|Fechar|Concluir|Confirmar/ }).first().click();
  }
  await shot("home-preenchida");
  await click("Buscar companhia");
  await page.waitForURL(/busca/, { timeout: 8000 });
  await shot("busca-ativa");
});

await step("ver sugestões", async () => {
  await click("Ver sugestões");
  await page.waitForURL(/sugestoes/);
  await seen("Evandro");
  await shot("sugestao-evandro");
});

await step("pular todos e rever as puladas", async () => {
  for (let i = 0; i < 4; i++) {
    const skip = btn("Pular");
    if (!(await skip.count())) break;
    await skip.click();
  }
  await shot("sugestoes-esgotadas");
  await click("Rever sugestões puladas");
  await seen("Evandro");
  await shot("sugestoes-revistas");
});

await step("aceitar Evandro e trocar por Bruno", async () => {
  await seen("Evandro");
  await click("Aceitar");
  await page.waitForURL(/espera/);
  await shot("espera-evandro");
  await click("Continuar vendo sugestões");
  await page.waitForURL(/sugestoes/);
  await seen("Bruno");
  await click("Aceitar");
  await page.getByRole("dialog").waitFor({ timeout: 5000 });
  await shot("troca-modal");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Cancelar com Evandro e aceitar Bruno/ })
    .click();
  await page.waitForURL(/espera/);
  await seen("Bruno");
  if (await page.getByRole("dialog").count()) throw new Error("diálogo de troca reabriu");
  await shot("espera-bruno");
});

await step("simular aceite", async () => {
  await click("Demo: simular aceite da companhia");
  await page.waitForURL(/proposta/, { timeout: 8000 });
  await shot("proposta");
});

await step("chat", async () => {
  const tab = page.getByRole("tab", { name: /Chat/ }).first();
  if (await tab.count()) await tab.click();
  else await click("Chat");
  await page.waitForURL(/chat/);
  await shot("chat");
  const input = page.getByRole("textbox").first();
  await input.fill("Oi! Combinamos na entrada principal?");
  await click("Enviar");
  await txt("Combinamos na entrada").waitFor();
  await click("Demo: simular resposta da companhia");
  await shot("chat-resposta");
});

await step("resumo", async () => {
  await click("Ver resumo");
  await page.waitForURL(/resumo/);
  await shot("resumo");
});

await step("confirmar nos dois lados", async () => {
  await click("Confirmar esta proposta");
  await shot("resumo-eu-confirmei");
  await btn("Demo: simular confirmação").click();
  await page.waitForURL(/viagem/, { timeout: 8000 });
  await shot("viagem-combinada");
});

await step("alterar detalhes -> versão 2", async () => {
  await click("Alterar detalhes");
  await page.waitForURL(/proposta/);
  await click("Meu trajeto");
  await page.waitForFunction(() => /proposta 2/.test(document.body.innerText), null, { timeout: 5000 });
  await shot("proposta-v2");
  await click("Conferir resumo");
  await page.waitForURL(/resumo/);
  const t = await body();
  if (/confirmou/i.test(t) && /Você: confirmou/.test(t)) throw new Error("confirmação antiga sobreviveu");
  await shot("resumo-v2");
});

await step("reconfirmar nos dois lados", async () => {
  await btn("Demo: simular confirmação").click();
  await shot("resumo-companhia-primeiro");
  await click("Confirmar esta proposta");
  await page.waitForURL(/viagem/, { timeout: 8000 });
  await shot("viagem-v2");
});

await step("aba Viagens com acordo", async () => {
  await click("Voltar");
  await page.waitForURL(/viagens/);
  await shot("viagens-ativa");
});

await step("aba Perfil", async () => {
  await page.getByRole("tab", { name: /Perfil/ }).first().click();
  await page.waitForURL(/perfil/);
  await shot("perfil");
});

await step("retomar e cancelar", async () => {
  await page.getByRole("tab", { name: /Viagens/ }).first().click();
  await page.waitForURL(/viagens/);
  const retomar = page.getByRole("button", { name: /Ver detalhes|Retomar/ }).first();
  console.log("   botões viagens:", JSON.stringify(await page.getByRole("button").allInnerTexts()));
  await retomar.click();
  await page.waitForURL(/viagem|proposta|chat|resumo/);
  await click("Cancelar minha participação");
  await shot("cancelar-modal");
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar minha participação" }).click();
  await page.waitForURL(/viagens/);
  await shot("apos-cancelar");
  console.log("   texto:", (await body()).replace(/\s+/g, " ").slice(0, 160));
});

await browser.close();
console.log(failed ? "RESULT: FAILED" : "RESULT: PASSED");
