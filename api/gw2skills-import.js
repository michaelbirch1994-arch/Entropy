const MAX_PAGE_BYTES = 3_000_000;
const MAX_DATABASE_BYTES = 12_000_000;

function validatedUrl(input) {
  const url = new URL(String(input || ""));
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !(host === "gw2skills.net" || host.endsWith(".gw2skills.net"))) throw new Error("Unsupported source host.");
  if (!/^\/editor\/?$/i.test(url.pathname) || !url.search.slice(1)) throw new Error("Invalid editor URL.");
  return url;
}

async function limitedText(response, limit) {
  if (!response.ok) throw new Error(`Source returned ${response.status}.`);
  const text = await response.text();
  if (text.length > limit) throw new Error("Source response was too large.");
  return text;
}

async function fetchAllowed(url) {
  let current = validatedUrl(url);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const result = await fetch(current, { redirect: "manual" });
    if (result.status < 300 || result.status >= 400) return { response: result, url: current };
    const location = result.headers.get("location");
    if (!location) throw new Error("Source returned an invalid redirect.");
    current = validatedUrl(new URL(location, current).href);
  }
  throw new Error("Source returned too many redirects.");
}

function databaseFile(html, pageUrl) {
  const explicit = html.match(/(?:ajax\/db\/)?([a-z]{2}\.[0-9]+\.json)/i)?.[1];
  if (explicit) return explicit;
  const id = html.match(/\bdbid\s*:\s*([0-9]+)/i)?.[1];
  if (!id) throw new Error("Catalog version not found.");
  const languageCandidate = pageUrl.hostname.split(".")[0] || "";
  const language = /^[a-z]{2}$/i.test(languageCandidate) ? languageCandidate.toLowerCase() : "en";
  return `${language}.${id}.json`;
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  try {
    const sourceUrl = validatedUrl(request.query?.url);
    const page = await fetchAllowed(sourceUrl);
    const html = await limitedText(page.response, MAX_PAGE_BYTES);
    const databaseUrl = new URL(`/ajax/db/${databaseFile(html, page.url)}`, page.url.origin);
    const databaseText = await limitedText(await fetch(databaseUrl, { redirect: "error" }), MAX_DATABASE_BYTES);
    const database = JSON.parse(databaseText);
    response.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
    response.status(200).json({ html, database });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Import failed." });
  }
}
