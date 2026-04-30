let deals = [];

const money = n => "$" + Number(n || 0).toLocaleString();

async function loadDeals() {
  try {
    const res = await fetch("data/deals.json?cache=" + Date.now());
    const data = await res.json();
    deals = data.deals || [];
    updateStats(data.updated_at);
    render(deals);
    alerts(deals);
  } catch {
    document.getElementById("deals").innerHTML = "<tr><td>No data yet. Upload CSV or run GitHub Action.</td></tr>";
  }
}

function updateStats(updatedAt = "-") {
  document.getElementById("count").innerText = deals.length;
  document.getElementById("callFirst").innerText =
    deals.filter(d => d.recommendation === "CALL FIRST").length;
  document.getElementById("updated").innerText =
    updatedAt && updatedAt !== "-" ? updatedAt.slice(0, 10) : "-";
}

function aiScore(d) {
  let score = Number(d.brrrr_section8_score || d.ai_score || 0);
  let equity = Number(d.created_equity || 0);
  let dscr = Number(d.estimated_dscr || 0);
  let units = Number(d.units || 0);
  let seller = String(d.seller_finance_probability || "").toLowerCase();
  let distress = String(d.distress_type || d.notes || "").toLowerCase();

  if (units >= 1 && units <= 30) score += 10;
  if (equity >= 50000) score += 10;
  if (equity >= 100000) score += 10;
  if (dscr >= 1.2) score += 10;
  if (seller.includes("high")) score += 15;
  if (distress.includes("foreclosure") || distress.includes("distressed") || distress.includes("vacant")) score += 10;

  return Math.min(Math.round(score), 100);
}

function lenderMatch(d) {
  const score = aiScore(d);
  const units = Number(d.units || 0);
  const equity = Number(d.created_equity || 0);
  const dscr = Number(d.estimated_dscr || 0);
  const seller = String(d.seller_finance_probability || "").toLowerCase();

  if (seller.includes("high")) return "Seller finance + private gap lender";
  if (units >= 5 && dscr >= 1.2) return "DSCR multifamily lender";
  if (score >= 75 && equity >= 100000) return "Private lender / BRRRR lender";
  if (equity >= 50000) return "Hard money lender";
  return "Creative finance / renegotiate";
}

function smsLink(d) {
  const body =
`HOT DEAL ALERT

Address: ${d.address || ""}
City: ${d.city || ""}
State: ${d.state || ""}
Units: ${d.units || ""}
Ask: ${money(d.asking_price)}
ARV: ${money(d.est_arv)}
Rehab: ${money(d.est_rehab)}
Equity: ${money(d.created_equity)}
DSCR: ${d.estimated_dscr || ""}
AI Score: ${aiScore(d)}
Lender Match: ${lenderMatch(d)}

Next move: Call seller and push seller-finance / low-down terms.`;

  return `sms:?&body=${encodeURIComponent(body)}`;
}

function alerts(rows) {
  const hot = rows
    .filter(d => aiScore(d) >= 65 || d.recommendation === "CALL FIRST")
    .sort((a, b) => aiScore(b) - aiScore(a))
    .slice(0, 8);

  document.getElementById("alertCount").innerText = hot.length;

  document.getElementById("alerts").innerHTML = hot.length
    ? hot.map(d => `
      <div class="deal-card">
        🔥 <b>${d.address || "Unknown Address"}</b><br>
        ${d.city || ""}, ${d.state || ""}<br>
        Units: ${d.units || ""}<br>
        Ask: ${money(d.asking_price)}<br>
        ARV: ${money(d.est_arv)}<br>
        Equity: ${money(d.created_equity)}<br>
        Score: ${aiScore(d)}<br>
        Lender: ${lenderMatch(d)}<br><br>
        <a class="btn" href="${smsLink(d)}">Send SMS Alert</a>
        <a class="btn" href="tel:${d.contact_phone || ""}">Call Seller</a>
      </div>
    `).join("")
    : `<div class="deal-card">No hot alerts yet.</div>`;
}

function render(rows) {
  document.getElementById("deals").innerHTML = `
    <tr>
      <th>Rec</th>
      <th>Address</th>
      <th>City</th>
      <th>State</th>
      <th>Units</th>
      <th>Ask</th>
      <th>ARV</th>
      <th>Equity</th>
      <th>Score</th>
      <th>Lender</th>
      <th>Call</th>
      <th>SMS</th>
    </tr>
    ${rows.map(d => `
      <tr>
        <td>${d.recommendation || "REVIEW"}</td>
        <td>${d.address || ""}</td>
        <td>${d.city || ""}</td>
        <td>${d.state || ""}</td>
        <td>${d.units || ""}</td>
        <td>${money(d.asking_price)}</td>
        <td>${money(d.est_arv)}</td>
        <td>${money(d.created_equity)}</td>
        <td>${aiScore(d)}</td>
        <td>${lenderMatch(d)}</td>
        <td><a href="tel:${d.contact_phone || ""}">Call</a></td>
        <td><a href="${smsLink(d)}">SMS</a></td>
      </tr>
    `).join("")}
  `;
}

function uploadCSV() {
  const file = document.getElementById("csvFile").files[0];
  if (!file) return alert("Upload a CSV first");

  const reader = new FileReader();

  reader.onload = function(e) {
    const rows = parseCSV(e.target.result.trim());

    deals = rows.map(d => ({
      recommendation: d.recommendation || "REVIEW",
      address: d.address || "",
      city: d.city || "",
      state: d.state || "",
      zip: d.zip || "",
      units: Number(d.units || 1),
      asking_price: Number(d.asking_price || d.price || 0),
      est_arv: Number(d.est_arv || d.arv || 0),
      est_rehab: Number(d.est_rehab || d.rehab || 0),
      created_equity: Number(d.created_equity || 0),
      estimated_dscr: Number(d.estimated_dscr || 0),
      seller_finance_probability: d.seller_finance_probability || "",
      distress_type: d.distress_type || d.notes || "",
      contact_name: d.contact_name || "",
      contact_phone: d.contact_phone || d.phone || "",
      contact_email: d.contact_email || d.email || "",
      brrrr_section8_score: Number(d.brrrr_section8_score || d.ai_score || 50)
    }));

    updateStats(new Date().toISOString());
    render(deals);
    alerts(deals);
  };

  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split(",").map(h => h.trim());

  return lines.map(line => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] ? values[i].trim() : "");
    return obj;
  });
}

function calc() {
  const p = Number(document.getElementById("purchase").value || 0);
  const r = Number(document.getElementById("rehab").value || 0);
  const arv = Number(document.getElementById("arv").value || 0);
  const rent = Number(document.getElementById("rent").value || 0);

  const equity = arv - (p + r);
  const noi = rent * 0.62;
  const loan = arv * 0.75;
  const debt = (loan * 0.075) / 12;
  const dscr = debt ? noi / debt : 0;

  document.getElementById("result").innerText =
`Equity Created: ${money(equity)}
Estimated NOI: ${money(Math.round(noi))}
Estimated Refi Loan: ${money(Math.round(loan))}
Estimated Monthly Debt: ${money(Math.round(debt))}
DSCR: ${dscr.toFixed(2)}

Decision: ${equity > 50000 && dscr >= 1.2 ? "GOOD DEAL" : "RENEGOTIATE / PASS"}`;
}

document.getElementById("search").addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  const filtered = deals.filter(d => JSON.stringify(d).toLowerCase().includes(q));
  render(filtered);
  alerts(filtered);
});

loadDeals();
