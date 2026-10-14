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
const radio = (name) => page.getByRole("radio", { name }).first();
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
  await page.getByRole("textbox", { name: label }).first().click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel(label).fill(query);
  await dlg.getByRole("button", { name: optionRe }).first().waitFor({ timeout: 15000 });
  await dlg.getByRole("button", { name: optionRe }).first().click();
}

// O estado do app vive em memória: cada carregamento da página recomeça em /entrar.
async function onboard() {
  await page.getByLabel("E-mail").waitFor({ timeout: 20000 });
  await page.getByLabel("E-mail").fill("ana@exemplo.com");
  await click("Enviar código");
  await seen("Digite o código");
  await shot("codigo");
  await page.getByLabel(/^Código/).fill("000000");
  await click("Entrar");
  await seen("Código incorreto");
  await page.getByLabel(/^Código/).fill("123456");
  await click("Entrar");
  await page.waitForURL(/cadastro/, { timeout: 8000 });
  await click("Criar perfil");
  await seen("Informe como você quer ser chamado");
  await shot("cadastro-erros");
  await page.getByLabel(/^Nome/).first().fill("Ana Souza");
  await page.getByLabel("Dia de nascimento").fill("05");
  await page.getByLabel("Mês de nascimento").fill("03");
  await page.getByLabel("Ano de nascimento").fill("1998");
  await shot("cadastro");
  await click("Criar perfil");
  await page.getByLabel("Local de partida").waitFor({ timeout: 20000 });
}

await step("entrar e criar perfil", async () => {
  await page.goto(BASE + "/", { waitUntil: "load" });
  await onboard();
  await shot("home-logada");
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
  await onboard();
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
  await click(/^Ver \d+ pesso/);
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

const choose = async (tile) => {
  await click(tile);
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 5000 });
  await dialog.getByRole("button", { name: "Escolher esta opção" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 5000 });
};

await step("escolher uma opção e divergir", async () => {
  await click("Proposta");
  await page.waitForURL(/proposta/);
  await choose("Sugestão do app");
  await shot("proposta-minha-escolha");
  await click("Demo: Bruno prefere outra");
  await seen("Escolhas diferentes");
  await shot("proposta-divergiu");
});

await step("escolher a mesma e fechar a viagem", async () => {
  await click("Escolher a mesma de Bruno");
  await page.getByRole("dialog").getByRole("button", { name: "Escolher esta opção" }).click();
  await seen("Vocês escolheram a mesma opção");
  await shot("proposta-combinada");
  await click("Ver viagem combinada");
  await page.waitForURL(/viagem/, { timeout: 8000 });
  await shot("viagem-combinada");
});

await step("mudar a escolha desfaz o acordo", async () => {
  await click("Mudar a escolha");
  await page.waitForURL(/proposta/);
  await click("Meu trajeto");
  await seen("Isso desfaz a viagem combinada");
  await shot("proposta-desfazer");
  await page.getByRole("dialog").getByRole("button", { name: "Escolher esta opção" }).click();
  await seen("Escolhas diferentes");
  await shot("proposta-v2");
});

await step("parada só vale no mesmo local", async () => {
  await click("Adicionar parada");
  await page.getByRole("dialog").getByRole("button", { name: /Posto de combustível/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Escolher esta opção" }).click();
  await click("Demo: Bruno escolhe a mesma");
  await seen("Vocês escolheram a mesma opção");
  await click("Ver viagem combinada");
  await page.waitForURL(/viagem/, { timeout: 8000 });
  await seen("Posto de combustível");
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

// Escolhe partida e destino (Photon ou toque no mapa) e fecha qualquer diálogo.
async function setPlaces() {
  if (BLOCK_PHOTON) {
    await page.getByRole("textbox", { name: "Local de partida" }).first().click();
    await click("Escolher no mapa");
    const map = page.frameLocator("iframe").last().locator("#map");
    await map.click({ position: { x: 150, y: 420 } });
    await page.waitForTimeout(1500);
    await page.getByText("escolher o destino").first().waitFor({ timeout: 4000 });
    await map.click({ position: { x: 300, y: 480 } });
    await page.waitForTimeout(1500);
  } else {
    await pickPlace("Local de partida", "Rua da Bahia Belo Horizonte", /Lourdes/);
    if (!(await page.getByRole("dialog").count()))
      await page.getByRole("textbox", { name: "Para onde?" }).first().click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Para onde?").fill("Praça da Liberdade Belo Horizonte");
    await dlg.getByRole("button", { name: /Funcion|Savassi|Liberdade/ }).first().waitFor({ timeout: 15000 });
    await dlg.getByRole("button", { name: /Funcion|Savassi|Liberdade/ }).first().click();
  }
  if (await page.getByRole("dialog").count())
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Conferir|Fechar|Concluir|Confirmar/ })
      .first()
      .click();
}

// Busca, aceita a primeira sugestão e fecha a viagem combinada. Devolve o nome.
async function agreeTrip() {
  await page.getByRole("tab", { name: /Buscar/ }).first().click();
  await page.getByRole("textbox", { name: "Local de partida" }).first().waitFor({ timeout: 10000 });
  await setPlaces();
  await click("Buscar companhia");
  await page.waitForURL(/busca/, { timeout: 8000 });
  await click(/^Ver \d+ pesso/);
  await page.waitForURL(/sugestoes/);
  await page.waitForFunction(() => /Evandro|Bruno|Camila/.test(document.body.innerText), null, { timeout: 8000 });
  const first = (await body()).match(/Evandro|Bruno|Camila/)?.[0];
  await click("Aceitar");
  await page.waitForURL(/espera/);
  await click("Demo: simular aceite da companhia");
  await page.waitForURL(/proposta/, { timeout: 8000 });
  await choose("Sugestão do app");
  await click(/^Demo: .* escolhe a mesma/);
  await seen("Vocês escolheram a mesma opção");
  await click("Ver viagem combinada");
  await page.waitForURL(/viagem/, { timeout: 8000 });
  return first;
}

await step("fim da viagem: o lembrete pergunta se aconteceu", async () => {
  await agreeTrip();
  await click("Demo · simular fim da viagem");
  await page.waitForURL(/lembrete/, { timeout: 8000 });
  await seen("aconteceu?");
  await shot("lembrete");
});

await step("responder depois mantém o lembrete na aba Viagens", async () => {
  await click("Responder depois");
  await page.waitForURL(/viagens/);
  await seen("conte como foi");
  await shot("viagens-lembrete-pendente");
  await click("Responder");
  await page.waitForURL(/lembrete/);
});

await step("avaliar: texto obrigatório abaixo de 3 estrelas", async () => {
  await click("Sim, aconteceu");
  await page.waitForURL(/avaliar/, { timeout: 8000 });
  await click("Enviar avaliação");
  await seen("Escolha de 1 a 5 estrelas");
  await radio("2 estrelas, Fraca").click();
  await click("Enviar avaliação");
  await seen("obrigatório para notas abaixo de 3");
  await shot("avaliar-erro");
  await page.getByLabel(/O que aconteceu/).first().fill("Atrasou bastante.");
  await radio("4 estrelas, Boa").click();
  await shot("avaliar");
});

await step("avaliação recebida só aparece depois de avaliar", async () => {
  await click(/^Demo · simular avaliação/);
  await seen("já avaliou você. Envie a sua para ver");
  await click("Enviar avaliação");
  await page.waitForURL(/avaliacao-enviada/, { timeout: 8000 });
  await seen("Avaliação simulada");
  await shot("avaliacao-enviada");
});

await step("concluir arquiva a viagem e libera a nota no perfil", async () => {
  await click("Concluir");
  await page.waitForURL(/viagens/);
  await seen("Viagens anteriores");
  await seen("Concluída");
  await shot("viagens-historico");
  await page.getByRole("tab", { name: /Perfil/ }).first().click();
  await page.waitForURL(/perfil/);
  await seen("★ 4,0");
  await shot("perfil-com-nota");
});

let blockedName = "";
await step("viagem não realizada, denúncia e bloqueio", async () => {
  const name = await agreeTrip();
  blockedName = name;
  await click("Demo · simular fim da viagem");
  await page.waitForURL(/lembrete/);
  await click("Não aconteceu");
  await page.waitForURL(/nao-realizada/);
  await shot("nao-realizada");
  await radio("A outra pessoa não apareceu").click();
  await click("Registrar");
  await seen("Viagem não realizada");
  await shot("nao-realizada-registrada");
  await click("Denunciar " + name);
  await page.waitForURL(/seguranca/);
  await shot("seguranca");
  await click("Denunciar " + name);
  const report = page.getByRole("dialog");
  await report.getByRole("button", { name: "Enviar denúncia" }).click();
  await seen("Escolha um motivo");
  await report.getByRole("radio", { name: "Me senti inseguro(a)" }).click();
  await report.getByRole("button", { name: "Enviar denúncia" }).click();
  await report.waitFor({ state: "hidden", timeout: 5000 });
  await seen("Denúncia registrada");
  await click("Bloquear " + name);
  await shot("bloquear-modal");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bloquear " + name })
    .click();
  await seen(name + " bloqueado");
  await shot("seguranca-feita");
  await click("Voltar");
  await page.waitForURL(/nao-realizada/);
  await click("Concluir");
  await page.waitForURL(/viagens/);
  await seen("Não realizada");
});

await step("pessoa bloqueada não aparece mais nas sugestões", async () => {
  await page.getByRole("tab", { name: /Perfil/ }).first().click();
  await page.waitForURL(/perfil/);
  await seen("Pessoas bloqueadas");
  await shot("perfil-bloqueados");
  await page.getByRole("tab", { name: /Buscar/ }).first().click();
  await page.getByRole("textbox", { name: "Local de partida" }).first().waitFor({ timeout: 10000 });
  await setPlaces();
  await click("Buscar companhia");
  await page.waitForURL(/busca/);
  await click(/^Ver \d+ pesso/);
  await page.waitForURL(/sugestoes/);
  await page.waitForFunction(() => /Evandro|Bruno|Camila/.test(document.body.innerText), null, { timeout: 8000 });
  if (blockedName && (await body()).includes(blockedName))
    throw new Error(blockedName + " bloqueado ainda aparece nas sugestões");
  await shot("sugestoes-sem-bloqueado");
});

await browser.close();
console.log(failed ? "RESULT: FAILED" : "RESULT: PASSED");
