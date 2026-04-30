const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = __dirname;
const DATA = path.join(ROOT, "data");

function num(v) {
  if (!v) return 0;
  const n = Number(String(v).replace(/[$,% ,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function csvParse(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split(",").map(h => h.trim());

  return lines.map(line => {
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h, i) => obj[h] = cols[i] || "");
    return obj;
  });
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function normalize(r) {
  const ask = num(r.asking_price || r.price || r.list_price || r.amount_due);
  const arv = num(r.est_arv || r.arv || r.estimated_value || r.market_value);
  const rehab = num(r.est_rehab || r.rehab || r.repairs || 50000);
  const units = num(r.units || r.unit_count || r.number_of_units || 1);
  const rent = num(r.section8_rent_per_unit || r.rent || r.market_rent || 1200);

  const address = r.address || r.property_address || r.site_address || r.location || "";
  const city = r.city || "";
  const state = r.state || "";
  const zip = r.zip || r.zip_code || "";

  const text = JSON.stringify(r).toLowerCase();

  const distress =
    text.includes("foreclosure") ||
    text.includes("auction") ||
    text.includes("tax delinquent") ||
    text.includes("code violation") ||
    text.includes("vacant") ||
    text.includes("distressed") ||
    text.includes("reo");

  const sellerFinance =
    text.includes("seller finance") ||
    text.includes("owner finance") ||
    text.includes("subject to") ||
    text.includes("creative finance") ||
    text.includes("carryback");

  const allIn = ask + rehab;
  const equity = arv ? arv - allIn : 0;
  const dscr = rent && allIn ? ((rent * units * 0.62) / ((allIn * 0.075) / 12)) : 0;

  let score = 0;
  if (units >= 1 && units <= 30) score += 15;
  if (equity >= 50000) score += 20;
  if (equity >= 100000) score += 15;
  if (dscr >= 1.2) score += 15;
  if (distress) score += 15;
  if (sellerFinance) score += 20;

  const ai_score = Math.min(score, 100);

  let recommendation = "REVIEW";
  if (ai_score >= 75) recommendation = "CALL FIRST";
  if (ai_score < 45) recommendation = "LOW PRIORITY";

  let lender_match = "Hard money lender";
  if (sellerFinance) lender_match = "Seller finance + private gap lender";
  else if (units >= 5 && dscr >= 1.2) lender_match = "DSCR multifamily lender";
  else if (equity >= 100000) lender_match = "Private BRRRR lender";

  return {
    recommendation,
    ai_score,
    brrrr_section8_score: ai_score,
    address,
    city,
    state,
    zip,
    units,
    asking_price: ask,
    est_arv: arv,
    est_rehab: rehab,
    created_equity: equity,
    estimated_dscr: Math.round(dscr * 100) / 100,
    seller_finance_probability: sellerFinance ? "High" : distress ? "Medium" : "Unknown",
    distress_type: distress ? "Distressed / foreclosure / public-record lead" : "Standard",
    lender_match,
    contact_name: r.contact_name || r.owner_name || r.seller_name || "",
    contact_phone: r.contact_phone || r.owner_phone || r.phone || "",
    contact_email: r.contact_email || r.owner_email || r.email || "",
    source_url: r.source_url || r.url || "",
    source_name: r.source_name || ""
  };
}

function toCSV(rows) {
  const headers = [
    "recommendation","ai_score","brrrr_section8_score","address","city","state","zip","units",
    "asking_price","est_arv","est_rehab","created_equity","estimated_dscr",
    "seller_finance_probability","distress_type","lender_match",
    "contact_name","contact_phone","contact_email","source_url","source_name"
  ];

  return [
    headers.join(","),
    ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))
  ].join("\n");
}

async function loadSources() {
  const config = JSON.parse(fs.readFileSync(path.join(DATA, "sources.json"), "utf8"));
  let rows = [];

  for (const src of config.sources || []) {
    if (!src.enabled) continue;

    try {
      let rawRows = [];

      if (src.type === "local_csv") {
        const text = fs.readFileSync(path.join(ROOT, src.path), "utf8");
        rawRows = csvParse(text);
      }

      if (src.type === "csv_url") {
        const text = await fetchUrl(src.url);
        rawRows = csvParse(text);
      }

      rawRows.forEach(r => {
        r.source_name = src.name;
        rows.push(r);
      });
    } catch (e) {
      console.log("SOURCE FAILED:", src.name, e.message);
    }
  }

  return rows;
}

async function main() {
  const raw = await loadSources();

  const deals = raw
    .map(normalize)
    .filter(d => d.address && d.units >= 1 && d.units <= 30)
    .sort((a, b) => b.ai_score - a.ai_score)
    .slice(0, 500);

  fs.writeFileSync(path.join(DATA, "deals.json"), JSON.stringify({
    updated_at: new Date().toISOString(),
    count: deals.length,
    deals
  }, null, 2));

  fs.writeFileSync(path.join(DATA, "deals.csv"), toCSV(deals));

  fs.writeFileSync(path.join(DATA, "run_log.json"), JSON.stringify({
    updated_at: new Date().toISOString(),
    pulled: raw.length,
    saved: deals.length
  }, null, 2));

  console.log(`REAL DEAL ENGINE COMPLETE: saved ${deals.length} deals.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
