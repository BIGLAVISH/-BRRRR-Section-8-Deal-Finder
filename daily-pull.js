const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");

function number(value) {
  if (value === undefined || value === null) return 0;
  const cleaned = String(value).replace(/[$,%\s,]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"' && quote && next === '"') {
      cell += '"';
      i++;
    } else if (c === '"') {
      quote = !quote;
    } else if (c === "," && !quote) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quote) {
      if (cell.length || row.length) {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      }
      if (c === "\r" && next === "\n") i++;
    } else {
      cell += c;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows.shift().map(h =>
    String(h).trim().toLowerCase().replace(/\s+/g, "_")
  );

  return rows
    .filter(r => r.some(x => String(x).trim() !== ""))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = r[i] || ""));
      return obj;
    });
}

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "BCA-Deal-Finder/2.0" } }, res => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(25000, () => {
      req.destroy(new Error(`Timeout fetching ${url}`));
    });
  });
}

async function loadSources() {
  const sourcePath = path.join(DATA_DIR, "sources.json");
  const config = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const allRows = [];
  const logs = [];

  for (const source of config.sources || []) {
    if (source.enabled === false) continue;

    try {
      let rows = [];
      if (source.type === "local_csv") {
        const fullPath = path.join(ROOT, source.path);
        rows = parseCSV(fs.readFileSync(fullPath, "utf8"));
      } else if (source.type === "csv_url") {
        rows = parseCSV(await fetchURL(source.url));
      } else if (source.type === "json_url") {
        const raw = JSON.parse(await fetchURL(source.url));
        rows = Array.isArray(raw) ? raw : raw.items || raw.deals || [];
      } else {
        throw new Error(`Unsupported source type: ${source.type}`);
      }

      for (const row of rows) {
        row.source_name = source.name || "Unnamed Source";
        allRows.push(row);
      }

      logs.push({ source: source.name, status: "ok", rows: rows.length });
    } catch (err) {
      logs.push({ source: source.name, status: "error", error: err.message });
    }
  }

  return { rows: allRows, logs };
}

function normalize(row) {
  return {
    address: row.address || row.property_address || "",
    city: row.city || "",
    county: row.county || "",
    state: row.state || "",
    units: number(row.units || row.unit_count),
    asking_price: number(row.asking_price || row.price || row.list_price),
    est_arv: number(row.est_arv || row.arv || row.after_repair_value || row.est_value),
    est_rehab: number(row.est_rehab || row.rehab || row.rehab_budget || row.repairs),
    market_rent_per_unit: number(row.market_rent_per_unit || row.market_rent || row.rent),
    section8_rent_per_unit: number(row.section8_rent_per_unit || row.section_8_rent || row.fmr_rent),
    seller_finance_probability: row.seller_finance_probability || row.seller_finance || "",
    source_url: row.source_url || row.url || "",
    source_name: row.source_name || "",
    contact_name: row.contact_name || row.owner_name || row.seller_name || "",
    contact_phone: row.contact_phone || row.owner_phone || row.phone || "",
    contact_email: row.contact_email || row.owner_email || row.email || ""
  };
}

function scoreDeal(raw) {
  const row = normalize(raw);

  if (row.units < 1 || row.units > 20) return null;

  const allIn = row.asking_price + row.est_rehab;
  const createdEquity = row.est_arv - allIn;
  const createdEquityPct = row.est_arv ? (createdEquity / row.est_arv) * 100 : 0;
  const section8PremiumPct = row.market_rent_per_unit
    ? ((row.section8_rent_per_unit - row.market_rent_per_unit) / row.market_rent_per_unit) * 100
    : 0;

  const grossMonthlyRent = Math.max(row.section8_rent_per_unit, row.market_rent_per_unit) * row.units;
  const estimatedNOI = grossMonthlyRent * 0.62;
  const refiLoan75 = row.est_arv * 0.75;
  const monthlyDebtEstimate = refiLoan75 ? (refiLoan75 * 0.075) / 12 : 1;
  const dscr = monthlyDebtEstimate ? estimatedNOI / monthlyDebtEstimate : 0;
  const mao70Rule = row.est_arv * 0.7 - row.est_rehab - 15000;

  const sf = String(row.seller_finance_probability).toLowerCase();
  let score = 0;
  score += Math.max(0, Math.min(35, createdEquityPct * 0.7));
  score += sf === "high" ? 20 : sf === "medium" ? 10 : 0;
  score += Math.max(0, Math.min(15, section8PremiumPct * 0.8));
  score += dscr >= 1.35 ? 15 : dscr >= 1.15 ? 9 : 0;
  score += row.est_arv && row.est_rehab / row.est_arv <= 0.18 ? 10 : row.est_arv && row.est_rehab / row.est_arv <= 0.28 ? 5 : 0;
  score += row.asking_price <= mao70Rule ? 5 : 0;

  return {
    recommendation: score >= 65 ? "CALL FIRST" : score >= 45 ? "REVIEW" : "LOW PRIORITY",
    brrrr_section8_score: Math.round(score * 10) / 10,
    ...row,
    all_in_cost: Math.round(allIn),
    created_equity: Math.round(createdEquity),
    created_equity_pct: Math.round(createdEquityPct * 100) / 100,
    section8_rent_premium_pct: Math.round(section8PremiumPct * 100) / 100,
    gross_monthly_rent: Math.round(grossMonthlyRent),
    estimated_noi: Math.round(estimatedNOI),
    estimated_refi_loan_75_ltv: Math.round(refiLoan75),
    estimated_dscr: Math.round(dscr * 100) / 100,
    mao_70_rule: Math.round(mao70Rule),
    updated_at: new Date().toISOString()
  };
}

function toCSV(rows) {
  const fields = [
    "recommendation",
    "brrrr_section8_score",
    "address",
    "city",
    "county",
    "state",
    "units",
    "asking_price",
    "est_arv",
    "est_rehab",
    "all_in_cost",
    "created_equity",
    "created_equity_pct",
    "market_rent_per_unit",
    "section8_rent_per_unit",
    "section8_rent_premium_pct",
    "gross_monthly_rent",
    "estimated_noi",
    "estimated_dscr",
    "mao_70_rule",
    "seller_finance_probability",
    "source_name",
    "source_url",
    "contact_name",
    "contact_phone",
    "contact_email"
  ];

  const esc = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [fields.join(","), ...rows.map(r => fields.map(f => esc(r[f])).join(","))].join("\n");
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

  const { rows, logs } = await loadSources();
  const deals = rows
    .map(scoreDeal)
    .filter(Boolean)
    .sort((a, b) => b.brrrr_section8_score - a.brrrr_section8_score);

  fs.writeFileSync(
    path.join(DATA_DIR, "deals.json"),
    JSON.stringify({ updated_at: new Date().toISOString(), count: deals.length, deals }, null, 2)
  );

  fs.writeFileSync(path.join(DATA_DIR, "deals.csv"), toCSV(deals));

  fs.writeFileSync(
    path.join(DATA_DIR, "run_log.json"),
    JSON.stringify({ updated_at: new Date().toISOString(), source_logs: logs, deals_found: deals.length }, null, 2)
  );

  console.log(`BCA Deal Finder complete. Scored ${deals.length} 1-20 unit deals.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
