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

function alerts(rows) {
  const hot = rows.filter(d =>
    d.recommendation === "CALL FIRST" ||
    d.brrrr_section8_score >= 65
  ).slice(0,5);

  document.getElementById("alertCount").innerText = hot.length;

  document.getElementById("alerts").innerHTML =
    hot.map(d =>
      `<div>🔥 ${d.address} | Score ${d.brrrr_section8_score}</div>`
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
