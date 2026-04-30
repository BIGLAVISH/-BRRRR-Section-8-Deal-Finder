let deals = [];
let filteredDeals = [];

const money = n => "$" + Number(n || 0).toLocaleString();

function toggleSidebar() {
  document.body.classList.toggle("sidebar-closed");
}

function showSection(id) {
  document.querySelectorAll("main section").forEach(s => s.classList.remove("active-section"));
  document.getElementById(id).classList.add("active-section");
  document.getElementById(id).scrollIntoView({ behavior: "smooth" });
}

async function loadDeals() {
  try {
    const res = await fetch("data/deals.json?cache=" + Date.now());
    const data = await res.json();
    deals = data.deals || [];
  } catch {
    deals = [];
  }

  filteredDeals = deals;
  updateDashboard();
  renderAlerts(filteredDeals);
  renderTable(filteredDeals);
}

function scoreDeal(d) {
  let score = Number(d.brrrr_section8_score || d.ai_score || 0);
  let equity = Number(d.created_equity || 0);
  let dscr = Number(d.estimated_dscr || 0);
  let units = Number(d.units || 0);
  let seller = String(d.seller_finance_probability || "").toLowerCase();

  if (units >= 1 && units <= 30) score += 10;
  if (equity >= 50000) score += 10;
  if (equity >= 100000) score += 10;
  if (dscr >= 1.2) score += 10;
  if (seller.includes("high")) score += 15;

  return Math.min(Math.round(score), 100);
}

function lenderMatch(d) {
  const score = scoreDeal(d);
  const units = Number(d.units || 0);
  const equity = Number(d.created_equity || 0);
  const dscr = Number(d.estimated_dscr || 0);
  const seller = String(d.seller_finance_probability || "").toLowerCase();

  if (seller.includes("high")) return "Seller Finance + Private Gap Lender";
  if (units >= 5 && dscr >= 1.2) return "DSCR Multifamily Lender";
  if (score >= 75 && equity >= 100000) return "Private BRRRR Lender";
  if (equity >= 50000) return "Hard Money Lender";
  return "Creative Finance / Renegotiate";
}

function updateDashboard() {
  const callFirst = deals.filter(d => scoreDeal(d) >= 70);
  const totalEquity = deals.reduce((sum, d) => sum + Number(d.created_equity || 0), 0);

  document.getElementById("totalDeals").innerText = deals.length;
  document.getElementById("callFirst").innerText = callFirst.length;
  document.getElementById("alertsCount").innerText = callFirst.length;
  document.getElementById("totalEquity").innerText = money(totalEquity);
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
Score: ${scoreDeal(d)}
Lender Match: ${lenderMatch(d)}

Next move: Call seller and push seller-finance / low-down terms.`;

  return "sms:?&body=" + encodeURIComponent(body);
}

function renderAlerts(rows) {
  const hot = [...rows]
    .sort((a, b) => scoreDeal(b) - scoreDeal(a))
    .filter(d => scoreDeal(d) >= 65)
    .slice(0, 8);

  const alerts = document.getElementById("alerts");

  if (!hot.length) {
    alerts.innerHTML = `<div class="deal-card">No hot alerts yet. Upload deals or run GitHub Action.</div>`;
    return;
  }

  alerts.innerHTML = hot.map(d => `
    <div class="deal-card">
      <div class="thumb">🏚️</div>
      <div>
        <b>${d.address || "Unknown Address"}</b>
        <p>${d.city || ""}, ${d.state || ""} • ${d.units || ""} units</p>
        <p>Ask: ${money(d.asking_price)} • Equity: ${money(d.created_equity)}</p>
        <p>Score: ${scoreDeal(d)} • ${lenderMatch(d)}</p>
        <a class="mini green" href="${smsLink(d)}">SMS</a>
        <a class="mini gold" href="tel:${d.contact_phone || ""}">Call</a>
      </div>
    </div>
  `).join("");
}

function renderTable(rows) {
  const table = document.getElementById("deals");

  table.innerHTML = `
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
        <td>${scoreDeal(d) >= 70 ? "CALL FIRST" : "REVIEW"}</td>
        <td>${d.address || ""}</td>
        <td>${d.city || ""}</td>
        <td>${d.state || ""}</td>
        <td>${d.units || ""}</td>
        <td>${money(d.asking_price)}</td>
        <td>${money(d.est_arv)}</td>
        <td>${money(d.created_equity)}</td>
        <td>${scoreDeal(d)}</td>
        <td>${lenderMatch(d)}</td>
        <td><a href="tel:${d.contact_phone || ""}">Call</a></td>
        <td><a href="${smsLink(d)}">SMS</a></td>
      </tr>
    `).join("")}
  `;
}

function searchDeals() {
  const q = document.getElementById("search").value.toLowerCase();
  filteredDeals = deals.filter(d => JSON.stringify(d).toLowerCase().includes(q));
  renderAlerts(filteredDeals);
  renderTable(filteredDeals);
}

function uploadCSV() {
  const file = document.getElementById("csvFile").files[0];
  if (!file) return alert("Upload a CSV first");

  const reader = new FileReader();

  reader.onload = e => {
    const rows = parseCSV(e.target.result);
    deals = rows.map(d => ({
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
      contact_phone: d.contact_phone || d.phone || "",
      contact_email: d.contact_email || d.email || "",
      brrrr_section8_score: Number(d.brrrr_section8_score || d.ai_score || 50)
    }));

    filteredDeals = deals;
    updateDashboard();
    renderAlerts(deals);
    renderTable(deals);
    alert("CSV uploaded successfully.");
  };

  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split(",").map(h => h.trim());

  return lines.map(line => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] ? values[i].trim() : "");
    return obj;
  });
}

function downloadCSV() {
  const headers = [
    "address","city","state","zip","units","asking_price","est_arv","est_rehab",
    "created_equity","estimated_dscr","seller_finance_probability","contact_phone",
    "contact_email","brrrr_section8_score"
  ];

  const csv = [
    headers.join(","),
    ...deals.map(d => headers.map(h => `"${String(d[h] || "").replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "bca_deals_export.csv";
  link.click();
}

function sendTopSMS() {
  const top = [...deals].sort((a, b) => scoreDeal(b) - scoreDeal(a))[0];
  if (!top) return alert("No deals loaded.");
  window.location.href = smsLink(top);
}

function callTopSeller() {
  const top = [...deals].sort((a, b) => scoreDeal(b) - scoreDeal(a)).find(d => d.contact_phone);
  if (!top) return alert("No seller phone number found.");
  window.location.href = "tel:" + top.contact_phone;
}

function calc() {
  const purchase = Number(document.getElementById("purchase").value || 0);
  const rehab = Number(document.getElementById("rehab").value || 0);
  const arv = Number(document.getElementById("arv").value || 0);
  const rent = Number(document.getElementById("rent").value || 0);

  const allIn = purchase + rehab;
  const equity = arv - allIn;
  const refiLoan = arv * 0.75;
  const noi = rent * 0.62;
  const debt = (refiLoan * 0.075) / 12;
  const dscr = debt ? noi / debt : 0;

  document.getElementById("result").innerText =
`All-In Cost: ${money(allIn)}
Created Equity: ${money(equity)}
Refi Loan @ 75% LTV: ${money(Math.round(refiLoan))}
Estimated NOI: ${money(Math.round(noi))}
Monthly Debt Estimate: ${money(Math.round(debt))}
DSCR: ${dscr.toFixed(2)}

Decision: ${equity > 50000 && dscr >= 1.2 ? "GOOD DEAL" : "RENEGOTIATE / PASS"}`;
}

loadDeals();
