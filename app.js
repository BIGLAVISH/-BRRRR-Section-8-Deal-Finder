let deals = [];
let filteredDeals = [];

const money = n => "$" + Number(n || 0).toLocaleString();

function login() {
  const u = document.getElementById("loginUser").value;
  const p = document.getElementById("loginPass").value;
  if (u === "admin" && p === "admin123") {
    localStorage.setItem("bca_logged_in", "yes");
    document.getElementById("loginScreen").style.display = "none";
  } else alert("Wrong login.");
}

function logout() {
  localStorage.removeItem("bca_logged_in");
  location.reload();
}

function toggleSidebar() {
  document.body.classList.toggle("sidebar-open");
}

function showSection(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active-section"));
  document.getElementById(id).classList.add("active-section");
  document.getElementById(id).scrollIntoView({ behavior: "smooth" });
}

function getNum(v) {
  return Number(String(v || "").replace(/[$,% ,]/g, "")) || 0;
}

function analyzeDeal(d) {
  const price = getNum(d.asking_price || d.price);
  const arv = getNum(d.est_arv || d.arv || d.zestimate);
  const rehab = getNum(d.est_rehab || d.rehab);
  const rent = getNum(d.rent || d.rent_zestimate || d.section8_rent_per_unit);
  const units = getNum(d.units) || 1;

  const allIn = price + rehab;
  const equity = arv ? arv - allIn : getNum(d.created_equity);
  const refiLoan = arv * 0.75;
  const noi = rent * units * 0.62;
  const debt = refiLoan ? (refiLoan * 0.08) / 12 : 0;
  const dscr = debt ? noi / debt : getNum(d.estimated_dscr);

  let score = 0;
  if (units >= 2) score += 15;
  if (price && rent && (rent * units) >= price * 0.01) score += 20;
  if (equity >= 50000) score += 20;
  if (equity >= 100000) score += 15;
  if (dscr >= 1.2) score += 20;
  if (String(d.statusText || d.distress_type || "").toLowerCase().includes("foreclosure")) score += 10;

  let grade = "red";
  let rec = "NO DEAL";
  let strategy = "Pass / renegotiate hard";

  if (score >= 70) {
    grade = "green";
    rec = "CALL FIRST";
    strategy = dscr >= 1.2 ? "BRRRR / Section 8 Rental" : "Wholesale / Seller Finance";
  } else if (score >= 45) {
    grade = "yellow";
    rec = "REVIEW";
    strategy = "Seller Finance / Creative Finance";
  }

  return {
    price, arv, rehab, rent, units, allIn, equity, refiLoan, noi, debt,
    dscr: Number(dscr || 0),
    score: Math.min(score, 100),
    grade, rec, strategy
  };
}

async function loadDeals() {
  if (localStorage.getItem("bca_logged_in") === "yes") {
    document.getElementById("loginScreen").style.display = "none";
  }

  const saved = localStorage.getItem("bca_deals");
  if (saved) {
    deals = JSON.parse(saved);
  } else {
    try {
      const res = await fetch("data/deals.json?cache=" + Date.now());
      const data = await res.json();
      deals = data.deals || [];
    } catch {
      deals = [];
    }
  }

  filteredDeals = deals;
  refreshAll();
}

function refreshAll() {
  updateDashboard();
  renderAlerts(filteredDeals, "alerts", 5);
  renderAlerts(filteredDeals, "allAlerts", 50);
  renderTable(filteredDeals);
  renderActivity();
  renderLenders();
  renderSkip();
  localStorage.setItem("bca_deals", JSON.stringify(deals));
}

function updateDashboard() {
  const analyzed = deals.map(analyzeDeal);
  const green = analyzed.filter(a => a.grade === "green");
  const equity = analyzed.reduce((s, a) => s + Math.max(a.equity || 0, 0), 0);
  const avgDscr = analyzed.length ? analyzed.reduce((s, a) => s + (a.dscr || 0), 0) / analyzed.length : 0;

  totalDeals.innerText = deals.length;
  callFirst.innerText = green.length;
  alertsCount.innerText = green.length;
  navAlertCount.innerText = green.length;
  donutTotal.innerText = deals.length;
  totalEquity.innerText = money(equity);
  avgDscr.innerText = avgDscr.toFixed(2);
}

function houseImage(d) {
  return d.image_url || d.img || d.photo || "";
}

function renderAlerts(rows, target, limit) {
  const box = document.getElementById(target);
  if (!box) return;

  const hot = [...rows].sort((a,b)=>analyzeDeal(b).score - analyzeDeal(a).score).slice(0, limit);

  box.innerHTML = hot.map(d => {
    const a = analyzeDeal(d);
    const img = houseImage(d);
    return `
      <div class="deal-card ${a.grade}">
        <div class="thumb">${img ? `<img src="${img}">` : "🏚️"}</div>
        <div>
          <b>${d.address || "Unknown Address"}</b>
          <p>${d.city || ""}, ${d.state || ""} • ${a.units} Units</p>
          <p>Score: ${a.score} • Equity: ${money(a.equity)}</p>
          <p>ARV: ${money(a.arv)} • Rent: ${money(a.rent)}</p>
          <p><strong>Strategy:</strong> ${a.strategy}</p>
          <span>${a.rec}</span>
          <a class="mini green" href="${smsLink(d)}">SMS</a>
          <a class="mini gold" href="tel:${d.contact_phone || d.phone || ""}">Call</a>
        </div>
      </div>`;
  }).join("");
}

function renderTable(rows) {
  dealsTable = document.getElementById("deals");
  dealsTable.innerHTML = `
    <tr>
      <th>Grade</th><th>Rec</th><th>Address</th><th>City</th><th>State</th><th>Units</th>
      <th>Price</th><th>ARV</th><th>Rehab</th><th>Rent</th><th>Equity</th>
      <th>DSCR</th><th>Strategy</th><th>Call</th><th>SMS</th>
    </tr>
    ${rows.map(d => {
      const a = analyzeDeal(d);
      return `
      <tr class="row-${a.grade}">
        <td>${a.grade.toUpperCase()}</td>
        <td>${a.rec}</td>
        <td>${d.address || ""}</td>
        <td>${d.city || ""}</td>
        <td>${d.state || ""}</td>
        <td>${a.units}</td>
        <td>${money(a.price)}</td>
        <td>${money(a.arv)}</td>
        <td>${money(a.rehab)}</td>
        <td>${money(a.rent)}</td>
        <td>${money(a.equity)}</td>
        <td>${a.dscr.toFixed(2)}</td>
        <td>${a.strategy}</td>
        <td><a href="tel:${d.contact_phone || d.phone || ""}">Call</a></td>
        <td><a href="${smsLink(d)}">SMS</a></td>
      </tr>`;
    }).join("")}`;
}

function renderActivity() {
  activity.innerHTML = deals.slice(0,5).map(d => {
    const a = analyzeDeal(d);
    return `<li>New deal added: <b>${d.address}</b><br><small>${a.rec} • ${a.strategy}</small></li>`;
  }).join("");
}

function renderLenders() {
  const lenders = [
    ["Luxe Capital Funding", 32, "$8.4M"],
    ["Iron Gate Capital", 28, "$6.7M"],
    ["Apex Private Lending", 24, "$5.9M"],
    ["Velocity Debt Partners", 18, "$3.8M"],
    ["Legacy Funding Group", 14, "$2.1M"]
  ];
  document.getElementById("lenders").innerHTML = lenders.map(l =>
    `<div class="lender"><span>👤 ${l[0]}</span><b>${l[1]} Deals</b><strong>${l[2]}</strong></div>`
  ).join("");
}

function renderSkip() {
  skipList.innerHTML = deals.filter(d => d.contact_phone || d.phone).slice(0,20).map(d =>
    `<div class="skip-item"><b>${d.address}</b> <a href="tel:${d.contact_phone || d.phone}">Call</a> <a href="${smsLink(d)}">SMS</a></div>`
  ).join("");
}

function searchDeals() {
  const q = search.value.toLowerCase();
  filteredDeals = deals.filter(d => JSON.stringify(d).toLowerCase().includes(q));
  refreshAll();
}

function smsLink(d) {
  const a = analyzeDeal(d);
  const body = `HOT DEAL ALERT

${d.address || ""}
${d.city || ""}, ${d.state || ""}
Price: ${money(a.price)}
ARV: ${money(a.arv)}
Rehab: ${money(a.rehab)}
Rent: ${money(a.rent)}
Equity: ${money(a.equity)}
DSCR: ${a.dscr.toFixed(2)}
Grade: ${a.grade.toUpperCase()}
Strategy: ${a.strategy}`;
  return "sms:?&body=" + encodeURIComponent(body);
}

function uploadCSV() {
  const file = csvFile.files[0];
  if (!file) return alert("Upload CSV first.");

  const reader = new FileReader();
  reader.onload = e => {
    deals = parseCSV(e.target.result);
    filteredDeals = deals;
    refreshAll();
    alert("CSV uploaded and scored.");
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split(",").map(h => h.trim());
  return lines.map(line => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h,i)=> obj[h] = values[i] ? values[i].replace(/^"|"$/g,"").trim() : "");
    return obj;
  });
}

function downloadCSV() {
  const headers = ["address","city","state","zip","units","asking_price","est_arv","est_rehab","rent","created_equity","estimated_dscr","grade","strategy","contact_phone","image_url"];
  const csv = [
    headers.join(","),
    ...deals.map(d => {
      const a = analyzeDeal(d);
      const row = {
        ...d,
        grade:a.grade,
        strategy:a.strategy,
        created_equity:a.equity,
        estimated_dscr:a.dscr
      };
      return headers.map(h => `"${String(row[h] || "").replace(/"/g,'""')}"`).join(",");
    })
  ].join("\n");

  const blob = new Blob([csv], {type:"text/csv"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "bca_scored_deals.csv";
  link.click();
}

function sendTopSMS() {
  if (!deals.length) return alert("No deals loaded.");
  const top = [...deals].sort((a,b)=>analyzeDeal(b).score - analyzeDeal(a).score)[0];
  location.href = smsLink(top);
}

function callTopSeller() {
  const top = deals.find(d => d.contact_phone || d.phone);
  if (!top) return alert("No phone numbers found.");
  location.href = "tel:" + (top.contact_phone || top.phone);
}

function createDeal() {
  deals.unshift({
    address:newAddress.value,
    city:newCity.value,
    state:newState.value,
    units:newUnits.value,
    asking_price:newPrice.value,
    est_arv:newArv.value,
    est_rehab:newRehab.value,
    rent:newRent.value,
    contact_phone:newPhone.value,
    image_url:newImage.value
  });
  filteredDeals = deals;
  refreshAll();
  alert("Deal created.");
}

function calcCore(p,r,arv,rent) {
  const allIn = p + r;
  const equity = arv - allIn;
  const loan = arv * 0.75;
  const noi = rent * 0.62;
  const debt = (loan * 0.08) / 12;
  const dscr = debt ? noi / debt : 0;
  const decision = equity > 50000 && dscr >= 1.2 ? "GREEN — BRRRR / Section 8" : equity > 25000 ? "YELLOW — Seller Finance / Wholesale" : "RED — No Deal";
  return `All-In Cost: ${money(allIn)}
Created Equity: ${money(equity)}
Refi Loan @ 75%: ${money(Math.round(loan))}
NOI Estimate: ${money(Math.round(noi))}
Monthly Debt: ${money(Math.round(debt))}
DSCR: ${dscr.toFixed(2)}
Decision: ${decision}`;
}

function calc() {
  result.innerText = calcCore(getNum(purchase.value), getNum(rehab.value), getNum(arv.value), getNum(rent.value));
}

function calc2() {
  result2.innerText = calcCore(getNum(purchase2.value), getNum(rehab2.value), getNum(arv2.value), getNum(rent2.value));
}

function runAIFinder() {
  const green = deals.filter(d => analyzeDeal(d).grade === "green").length;
  const yellow = deals.filter(d => analyzeDeal(d).grade === "yellow").length;
  const red = deals.filter(d => analyzeDeal(d).grade === "red").length;
  aiOutput.innerText = `AI Deal Finder Complete

GREEN Deals: ${green}
YELLOW Deals: ${yellow}
RED Deals: ${red}

Best Move:
1. Call GREEN deals first
2. Offer seller finance on YELLOW deals
3. Ignore or lowball RED deals`;
}

loadDeals();
