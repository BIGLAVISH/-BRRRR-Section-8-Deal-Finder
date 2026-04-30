let deals = [];

async function loadDeals() {
  try {
    const res = await fetch("data/deals.json");
    const data = await res.json();
    deals = data.deals || [];

    document.getElementById("count").innerText = deals.length;
    document.getElementById("callFirst").innerText =
      deals.filter(d => d.recommendation === "CALL FIRST").length;

    render(deals);
    alerts(deals);
  } catch {
    document.getElementById("deals").innerHTML = "<tr><td>No data yet</td></tr>";
  }
}

function lenderMatch(d) {
  const score = Number(d.brrrr_section8_score || 0);
  const units = Number(d.units || 0);
  const equity = Number(d.created_equity || 0);

  if (score >= 65 && equity >= 100000) return "Private lender / BRRRR lender";
  if (units >= 5) return "DSCR multifamily lender";
  if (d.seller_finance_probability === "High") return "Seller finance + gap lender";
  return "Hard money lender";
}

function smsLink(d) {
  const body =
`HOT DEAL ALERT
Address: ${d.address}
City: ${d.city}
Units: ${d.units}
Score: ${d.brrrr_section8_score}
Ask: $${d.asking_price}
ARV: $${d.est_arv}
Equity: $${d.created_equity}
Lender Match: ${lenderMatch(d)}`;

  return `sms:?&body=${encodeURIComponent(body)}`;
}

function alerts(rows) {
  const hot = rows.filter(d =>
    d.recommendation === "CALL FIRST" ||
    d.brrrr_section8_score >= 65
  ).slice(0,5);

  document.getElementById("alertCount").innerText = hot.length;

  document.getElementById("alerts").innerHTML =
    hot.map(d =>
      `<div class="deal-card">
        🔥 <b>${d.address}</b><br>
        Score: ${d.brrrr_section8_score}<br>
        Lender: ${lenderMatch(d)}<br><br>
        <a class="btn" href="${smsLink(d)}">Send SMS Alert</a>
        <a class="btn" href="tel:${d.contact_phone || ''}">Call Seller</a>
      </div>`
    ).join("");
}

function render(rows) {
  document.getElementById("deals").innerHTML =
    rows.map(d => `
      <tr>
        <td>${d.recommendation}</td>
        <td>${d.address}</td>
        <td>${d.city}</td>
        <td>${d.units}</td>
        <td>$${d.asking_price}</td>
        <td>${lenderMatch(d)}</td>
        <td><a href="tel:${d.contact_phone || ''}">Call</a></td>
        <td><a href="${smsLink(d)}">SMS</a></td>
      </tr>
    `).join("");
}

function calc() {
  let p = +document.getElementById("purchase").value;
  let r = +document.getElementById("rehab").value;
  let arv = +document.getElementById("arv").value;
  let rent = +document.getElementById("rent").value;

  let equity = arv - (p + r);

  document.getElementById("result").innerText =
`Equity: $${equity}
Rent: $${rent}
Decision: ${equity > 50000 ? "GOOD DEAL" : "PASS"}`;
}

document.getElementById("search").addEventListener("input", e => {
  let q = e.target.value.toLowerCase();
  render(deals.filter(d =>
    JSON.stringify(d).toLowerCase().includes(q)
  ));
});

loadDeals();
