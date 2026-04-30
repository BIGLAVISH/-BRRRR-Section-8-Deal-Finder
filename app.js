let allDeals = [];
const money = n => "$" + Number(n || 0).toLocaleString();

async function loadDeals() {
  try {
    const response = await fetch("data/deals.json?cache=" + Date.now());
    const data = await response.json();
    allDeals = data.deals || [];
    document.getElementById("count").textContent = allDeals.length;
    document.getElementById("callFirst").textContent = allDeals.filter(d => d.recommendation === "CALL FIRST").length;
    document.getElementById("updated").textContent = (data.updated_at || "-").slice(0, 10);
    render(allDeals);
  } catch (error) {
    document.getElementById("deals").innerHTML = "<tr><td>No deal data yet. Run GitHub Actions once.</td></tr>";
  }
}

function render(rows) {
  const headers = ["Rec", "Score", "Address", "City", "County", "Units", "Ask", "ARV", "Rehab", "Equity", "S8 Premium", "DSCR", "MAO", "Seller Finance", "Contact"];
  const body = rows.map(d => `
    <tr>
      <td><span class="badge">${d.recommendation || ""}</span></td>
      <td>${d.brrrr_section8_score || 0}</td>
      <td>${d.address || ""}<br><span class="low">${d.source_name || ""}</span></td>
      <td>${d.city || ""}</td>
      <td>${d.county || ""}</td>
      <td>${d.units || ""}</td>
      <td>${money(d.asking_price)}</td>
      <td>${money(d.est_arv)}</td>
      <td>${money(d.est_rehab)}</td>
      <td>${money(d.created_equity)}</td>
      <td>${d.section8_rent_premium_pct || 0}%</td>
      <td>${d.estimated_dscr || 0}</td>
      <td>${money(d.mao_70_rule)}</td>
      <td>${d.seller_finance_probability || ""}</td>
      <td>${d.contact_name || ""}<br>${d.contact_phone || ""}<br>${d.contact_email || ""}</td>
    </tr>
  `).join("");

  document.getElementById("deals").innerHTML =
    "<thead><tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr></thead><tbody>" + body + "</tbody>";
}

document.getElementById("search").addEventListener("input", event => {
  const q = event.target.value.toLowerCase();
  render(allDeals.filter(d => JSON.stringify(d).toLowerCase().includes(q)));
});

loadDeals();
