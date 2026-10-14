// Origem dos tiles para a política de segurança (CSP) do mapa. Modelos com
// {s} viram um host curinga (https://*.exemplo.com); curinga em outra posição
// não é válido em CSP e cai para "https:" (qualquer https, só imagens).
export function tileImgSrc(template: string) {
  const probe = template.replace(/\{s\}/g, "a").replace(/\{[zxyr]\}/g, "1");
  let url: URL;
  try {
    url = new URL(probe);
  } catch {
    return "https:";
  }
  if (url.protocol !== "https:") return "https:";
  const host = /^https:\/\/([^/?#]+)/.exec(template)?.[1] ?? "";
  if (!host.includes("{s}")) return url.origin;
  const rest = /^\{s\}\.(.+)$/.exec(host)?.[1];
  return rest ? `https://*.${rest}` : "https:";
}
