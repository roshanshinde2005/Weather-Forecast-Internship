const tooltip  = document.getElementById('tooltip');
const ttHeader = document.getElementById('tt-header');
const ttRows   = document.getElementById('tt-rows');
const ttTotal  = document.getElementById('tt-total');

// helper funtions 

function rfMap(d) {
  const m = {};
  d.weeks.forEach((w, i) => m[w] = (m[w] || 0) + d.rf[i]);
  return m;
}

function buildDatasets(yd, weekRange) {
  const maxW = Math.max(...Object.values(yd).flatMap(d => d.weeks));
  const minWeek = weekRange ? weekRange[0] : 1;
  const maxWeek = weekRange ? weekRange[1] : maxW;
  const labels = [];
  for (let w = minWeek; w <= maxWeek; w++) labels.push(w);
  const datasets = CITIES.map(city => {
    const d = yd[city];
    const m = d ? rfMap(d) : {};
    return {
      label: CLABEL[city],
      data: labels.map(w => m[w] ?? null),
      borderColor: CCOLOR[city],
      backgroundColor: CCOLOR[city] + '18',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: CCOLOR[city],
      pointHoverBorderColor: '#ffffff',
      pointHoverBorderWidth: 2,
      tension: 0.35,
      fill: false,
      spanGaps: false,
    };
  });
  return { labels, datasets };
}

function annualTotal(yd, city) {
  return (yd[city]?.rf.reduce((a, b) => a + b, 0) ?? 0).toFixed(0);
}

function rangeTotal(yd, city, weekRange) {
  const d = yd[city];
  if (!d) return '0';
  let sum = 0;
  d.weeks.forEach((w, i) => { if (w >= weekRange[0] && w <= weekRange[1]) sum += d.rf[i]; });
  return sum.toFixed(0);
}

function peakWeek(yd, city) {
  const d = yd[city];
  if (!d || !d.rf.length) return '—';
  const mx = Math.max(...d.rf);
  if (mx === 0) return 'no rain';
  const idx = d.rf.indexOf(mx);
  return `W${d.weeks[idx]}`;
}

// tooltip

function showTooltip(e, year, week, weekIdx, datasets) {
  ttHeader.textContent = `Year ${year} · Week ${week}`;
  let total = 0;
  ttRows.innerHTML = datasets.map(ds => {
    const val = ds.data[weekIdx];
    if (val === null || val === undefined) return `
      <div class="tt-row">
        <span class="tt-city"><span class="tt-dot" style="background:${CCOLOR[ds.label.toLowerCase()]}"></span>${ds.label}</span>
        <span class="tt-val" style="color:var(--muted)">no data</span>
      </div>`;
    total += val;
    const city = ds.label.toLowerCase();
    return `
      <div class="tt-row">
        <span class="tt-city"><span class="tt-dot" style="background:${CCOLOR[city]}"></span>${ds.label}</span>
        <span class="tt-val" style="color:${CCOLOR[city]}">${val.toFixed(1)} mm</span>
      </div>`;
  }).join('');
  ttTotal.textContent = `${total.toFixed(1)} mm`;

  const margin = 14;
  const tw = 220, th = 160;
  let x = e.clientX + margin;
  let y = e.clientY - 60;
  if (x + tw > window.innerWidth)  x = e.clientX - tw - margin;
  if (y + th > window.innerHeight) y = window.innerHeight - th - margin;
  if (y < 0) y = margin;
  tooltip.style.left = x + 'px';
  tooltip.style.top  = y + 'px';
  tooltip.classList.add('visible');
}

function hideTooltip() { tooltip.classList.remove('visible'); }

function showMaiTooltip(e) {
  const margin = 14;
  const tw = 220, th = 110;
  let x = e.clientX + margin;
  let y = e.clientY - 60;
  if (x + tw > window.innerWidth)  x = e.clientX - tw - margin;
  if (y + th > window.innerHeight) y = window.innerHeight - th - margin;
  if (y < 0) y = margin;
  tooltip.style.left = x + 'px';
  tooltip.style.top  = y + 'px';
  tooltip.classList.add('visible');
}

// Global tooltip tracker (mousemove)
document.addEventListener('mousemove', e => {
  if (tooltip.classList.contains('visible')) {
    const margin = 14, tw = 220, th = 180;
    let x = e.clientX + margin;
    let y = e.clientY - 60;
    if (x + tw > window.innerWidth)  x = e.clientX - tw - margin;
    if (y + th > window.innerHeight) y = window.innerHeight - th - margin;
    if (y < 0) y = margin;
    tooltip.style.left = x + 'px';
    tooltip.style.top  = y + 'px';
  }
});

// charts

function buildCard(year, idSuffix, weekRange) {
  idSuffix = idSuffix || '';
  const yd = DATA[year];
  const card = document.createElement('div');
  card.className = 'card';
  card.id = `card-${year}${idSuffix}`;

  const totalFn = weekRange ? (c => rangeTotal(yd, c, weekRange)) : (c => annualTotal(yd, c));
  const wetCity = CITIES.reduce((a, b) => (+totalFn(b) > +totalFn(a) ? b : a));
  const totalAll = CITIES.reduce((s, c) => s + (+totalFn(c)), 0).toFixed(0);
  const subLabel = weekRange ? `Total (weeks ${weekRange[0]}–${weekRange[1]})` : 'All-district total';

  card.innerHTML = `
    <div class="card-header">
      <div class="card-left">
        <div class="card-year">${year}</div>
        <div class="card-sub">Wettest district: <span style="color:${CCOLOR[wetCity]}">${CLABEL[wetCity]}</span> · ${subLabel}: <span style="font-family:'IBM Plex Mono',monospace">${totalAll} mm</span></div>
      </div>
      <div class="card-stats">
        ${CITIES.map(c => `
          <div class="stat">
            <span class="stat-value" style="color:${CCOLOR[c]}">${totalFn(c)} mm</span>
            <span class="stat-label">${CLABEL[c]}</span>
          </div>`).join('')}
      </div>
    </div>
    <div class="chart-wrap"><canvas id="chart-${year}${idSuffix}"></canvas></div>
  `;
  return card;
}

function renderChart(year, idSuffix, weekRange) {
  idSuffix = idSuffix || '';
  const yd = DATA[year];
  const ctx = document.getElementById(`chart-${year}${idSuffix}`).getContext('2d');
  const { labels, datasets } = buildDatasets(yd, weekRange);

  new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(30,20,10,0.06)', drawTicks: false },
          ticks: { color: '#8c7d6e', font: { family: "'JetBrains Mono'", size: 9 }, maxTicksLimit: 14, maxRotation: 0, padding: 6 },
          title: { display: true, text: 'Meteorological Week', color: '#a09080', font: { family: "'Inter'", size: 10 } }
        },
        y: {
          grid: { color: 'rgba(30,20,10,0.05)', drawTicks: false },
          ticks: { color: '#8c7d6e', font: { family: "'JetBrains Mono'", size: 9 }, maxTicksLimit: 6, padding: 6 },
          title: { display: true, text: 'Rainfall (mm)', color: '#a09080', font: { family: "'Inter'", size: 10 } },
          beginAtZero: true
        }
      },
      onHover: (e, elements) => {
        if (elements.length) {
          const idx = elements[0].index;
          showTooltip(e.native, year, labels[idx], idx, datasets);
        } else {
          hideTooltip();
        }
      }
    }
  });

  document.getElementById(`chart-${year}${idSuffix}`).addEventListener('mouseleave', hideTooltip);
}

// chart - 1 weekly all years

const nav  = document.getElementById('yearNav');
const grid = document.getElementById('grid');

const allBtn = document.createElement('button');
allBtn.className = 'year-btn active';
allBtn.textContent = 'All years';
allBtn.dataset.year = 'all';
allBtn.addEventListener('click', () => setFilter('all', nav, grid));
nav.appendChild(allBtn);

YEARS.forEach(year => {
  const btn = document.createElement('button');
  btn.className = 'year-btn';
  btn.textContent = year;
  btn.dataset.year = year;
  btn.addEventListener('click', () => setFilter(year, nav, grid));
  nav.appendChild(btn);

  const card = buildCard(year);
  grid.appendChild(card);
  renderChart(year);
});

function setFilter(year, navEl, gridEl) {
  navEl.querySelectorAll('.year-btn').forEach(b => b.classList.toggle('active', b.dataset.year === year));
  gridEl.querySelectorAll('.card').forEach(c => {
    c.classList.toggle('hidden', year !== 'all' && c.id !== `card-${year}`);
  });
  if (year !== 'all') {
    const card = gridEl.querySelector(`#card-${year}`);
    if (card) setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
}

// chart - 2 24-40w monsoon period

const WEEK_RANGE = [24, 40];
const ID_SUFFIX  = '-w2440';
const nav2  = document.getElementById('yearNav2');
const grid2 = document.getElementById('grid2');

const allBtn2 = document.createElement('button');
allBtn2.className = 'year-btn active';
allBtn2.textContent = 'All years';
allBtn2.dataset.year = 'all';
allBtn2.addEventListener('click', () => setFilter2('all'));
nav2.appendChild(allBtn2);

YEARS.forEach(year => {
  const btn = document.createElement('button');
  btn.className = 'year-btn';
  btn.textContent = year;
  btn.dataset.year = year;
  btn.addEventListener('click', () => setFilter2(year));
  nav2.appendChild(btn);

  const card = buildCard(year, ID_SUFFIX, WEEK_RANGE);
  grid2.appendChild(card);
  renderChart(year, ID_SUFFIX, WEEK_RANGE);
});

function setFilter2(year) {
  nav2.querySelectorAll('.year-btn').forEach(b => b.classList.toggle('active', b.dataset.year === year));
  grid2.querySelectorAll('.card').forEach(c => {
    c.classList.toggle('hidden', year !== 'all' && c.id !== `card-${year}${ID_SUFFIX}`);
  });
  if (year !== 'all') {
    const card = document.getElementById(`card-${year}${ID_SUFFIX}`);
    if (card) setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
}

// chart - 3 40-43w post monsoon

const WEEK_RANGE_3 = [40, 43];
const ID_SUFFIX_3  = '-w4043';
const nav3  = document.getElementById('yearNav3');
const grid3 = document.getElementById('grid3');

const allBtn3 = document.createElement('button');
allBtn3.className = 'year-btn active';
allBtn3.textContent = 'All years';
allBtn3.dataset.year = 'all';
allBtn3.addEventListener('click', () => setFilter3('all'));
nav3.appendChild(allBtn3);

YEARS.forEach(year => {
  const btn = document.createElement('button');
  btn.className = 'year-btn';
  btn.textContent = year;
  btn.dataset.year = year;
  btn.addEventListener('click', () => setFilter3(year));
  nav3.appendChild(btn);

  const card = buildCard(year, ID_SUFFIX_3, WEEK_RANGE_3);
  grid3.appendChild(card);
  renderChart(year, ID_SUFFIX_3, WEEK_RANGE_3);
});

function setFilter3(year) {
  nav3.querySelectorAll('.year-btn').forEach(b => b.classList.toggle('active', b.dataset.year === year));
  grid3.querySelectorAll('.card').forEach(c => {
    c.classList.toggle('hidden', year !== 'all' && c.id !== `card-${year}${ID_SUFFIX_3}`);
  });
  if (year !== 'all') {
    const card = document.getElementById(`card-${year}${ID_SUFFIX_3}`);
    if (card) setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
}

// chart - 4 22-26w pre monsoon

const WEEK_RANGE_4 = [22, 26];
const ID_SUFFIX_4  = '-w2226';
const nav4  = document.getElementById('yearNav4');
const grid4 = document.getElementById('grid4');

const allBtn4 = document.createElement('button');
allBtn4.className = 'year-btn active';
allBtn4.textContent = 'All years';
allBtn4.dataset.year = 'all';
allBtn4.addEventListener('click', () => setFilter4('all'));
nav4.appendChild(allBtn4);

YEARS.forEach(year => {
  const btn = document.createElement('button');
  btn.className = 'year-btn';
  btn.textContent = year;
  btn.dataset.year = year;
  btn.addEventListener('click', () => setFilter4(year));
  nav4.appendChild(btn);

  const card = buildCard(year, ID_SUFFIX_4, WEEK_RANGE_4);
  grid4.appendChild(card);
  renderChart(year, ID_SUFFIX_4, WEEK_RANGE_4);
});

function setFilter4(year) {
  nav4.querySelectorAll('.year-btn').forEach(b => b.classList.toggle('active', b.dataset.year === year));
  grid4.querySelectorAll('.card').forEach(c => {
    c.classList.toggle('hidden', year !== 'all' && c.id !== `card-${year}${ID_SUFFIX_4}`);
  });
  if (year !== 'all') {
    const card = document.getElementById(`card-${year}${ID_SUFFIX_4}`);
    if (card) setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
}


// chart - 5 MAI (moisture adquency idx)

function buildMaiCard(year) {
  const d = MAI_DATA[year];
  const card = document.createElement('div');
  card.className = 'card';
  card.id = `mai-card-${year}`;

  const validVals = d.mai.filter(v => v !== null);
  const peakIdx = d.mai.indexOf(Math.max(...validVals));
  const peakWeekNum = d.weeks[peakIdx];
  const avg = (validVals.reduce((a, b) => a + b, 0) / validVals.length).toFixed(2);

  card.innerHTML = `
    <div class="card-header">
      <div class="card-left">
        <div class="card-year" style="color:${MAI_YEAR_COLOR[year]}">${year}</div>
        <div class="card-sub">Peak MAI: <span style="color:${MAI_YEAR_COLOR[year]}">${validVals.length ? Math.max(...validVals).toFixed(2) : '—'} (W${peakWeekNum})</span> · Avg MAI: <span style="font-family:'IBM Plex Mono',monospace">${avg}</span></div>
      </div>
    </div>
    <div class="chart-wrap"><canvas id="mai-chart-${year}"></canvas></div>
  `;
  return card;
}

function renderMaiChart(year) {
  const d = MAI_DATA[year];
  const ctx = document.getElementById(`mai-chart-${year}`).getContext('2d');
  const color = MAI_YEAR_COLOR[year];

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.weeks,
      datasets: [{
        label: year,
        data: d.mai,
        borderColor: color,
        backgroundColor: color + '22',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
        tension: 0.35,
        fill: true,
        spanGaps: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: {
          grid: { color: 'rgba(30,20,10,0.06)', drawTicks: false },
          ticks: { color: '#8c7d6e', font: { family: "'JetBrains Mono'", size: 9 }, maxTicksLimit: 10, maxRotation: 0, padding: 6 },
          title: { display: true, text: 'Meteorological Week', color: '#a09080', font: { family: "'Inter'", size: 10 } }
        },
        y: {
          grid: { color: 'rgba(30,20,10,0.05)', drawTicks: false },
          ticks: { color: '#8c7d6e', font: { family: "'JetBrains Mono'", size: 9 }, maxTicksLimit: 6, padding: 6 },
          title: { display: true, text: 'MAI', color: '#a09080', font: { family: "'Inter'", size: 10 } },
          beginAtZero: true
        }
      },
      onHover: (e, elements) => {
        if (elements.length) {
          const idx = elements[0].index;
          const week = d.weeks[idx];
          const val = d.mai[idx];
          ttHeader.textContent = `Year ${year} · Week ${week}`;
          ttRows.innerHTML = (val === null) ? `
            <div class="tt-row">
              <span class="tt-city"><span class="tt-dot" style="background:${color}"></span>MAI</span>
              <span class="tt-val" style="color:var(--muted)">no data</span>
            </div>` : `
            <div class="tt-row">
              <span class="tt-city"><span class="tt-dot" style="background:${color}"></span>MAI</span>
              <span class="tt-val" style="color:${color}">${val.toFixed(3)}</span>
            </div>`;
          ttTotal.parentElement.style.display = 'none';
          showMaiTooltip(e.native);
        } else {
          hideTooltip();
        }
      }
    }
  });

  document.getElementById(`mai-chart-${year}`).addEventListener('mouseleave', hideTooltip);
}

// combined MAI chart: all 5 years

function buildMaiCombinedCard() {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'mai-card-combined';
  card.innerHTML = `
    <div class="card-header">
      <div class="card-left">
        <div class="card-year" style="font-size:1.2rem;">All Years Combined</div>
        <div class="card-sub">MAI overlay · weeks 21–39 · 2021–2025</div>
      </div>
    </div>
    <div class="chart-wrap" style="height: 320px;"><canvas id="mai-chart-combined"></canvas></div>
  `;
  return card;
}

function renderMaiCombinedChart() {
  const ctx = document.getElementById('mai-chart-combined').getContext('2d');
  const allWeeks = MAI_DATA[MAI_YEARS[0]].weeks;

  const datasets = MAI_YEARS.map(year => {
    const d = MAI_DATA[year];
    const color = MAI_YEAR_COLOR[year];
    return {
      label: year,
      data: d.mai,
      borderColor: color,
      backgroundColor: color + '18',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: color,
      pointHoverBorderColor: '#0d1117',
      pointHoverBorderWidth: 2,
      tension: 0.35,
      fill: false,
      spanGaps: false,
    };
  });

  new Chart(ctx, {
    type: 'line',
    data: { labels: allWeeks, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: {
          grid: { color: 'rgba(30,20,10,0.06)', drawTicks: false },
          ticks: { color: '#8c7d6e', font: { family: "'JetBrains Mono'", size: 9 }, maxTicksLimit: 19, maxRotation: 0, padding: 6 },
          title: { display: true, text: 'Meteorological Week', color: '#a09080', font: { family: "'Inter'", size: 10 } }
        },
        y: {
          grid: { color: 'rgba(30,20,10,0.05)', drawTicks: false },
          ticks: { color: '#8c7d6e', font: { family: "'JetBrains Mono'", size: 9 }, maxTicksLimit: 8, padding: 6 },
          title: { display: true, text: 'MAI', color: '#a09080', font: { family: "'Inter'", size: 10 } },
          beginAtZero: true
        }
      },
      onHover: (e, elements) => {
        if (elements.length) {
          const idx = elements[0].index;
          const week = allWeeks[idx];
          ttHeader.textContent = `Week ${week}`;
          ttRows.innerHTML = datasets.map(ds => {
            const val = ds.data[idx];
            const color = MAI_YEAR_COLOR[ds.label];
            if (val === null || val === undefined) return `
              <div class="tt-row">
                <span class="tt-city"><span class="tt-dot" style="background:${color}"></span>${ds.label}</span>
                <span class="tt-val" style="color:var(--muted)">no data</span>
              </div>`;
            return `
              <div class="tt-row">
                <span class="tt-city"><span class="tt-dot" style="background:${color}"></span>${ds.label}</span>
                <span class="tt-val" style="color:${color}">${val.toFixed(3)}</span>
              </div>`;
          }).join('');
          ttTotal.parentElement.style.display = 'none';
          showMaiTooltip(e.native);
        } else {
          hideTooltip();
        }
      }
    }
  });

  document.getElementById('mai-chart-combined').addEventListener('mouseleave', hideTooltip);
}

// individual MAI cards

const maiGrid = document.getElementById('maiGrid');
MAI_YEARS.forEach(year => {
  const card = buildMaiCard(year);
  maiGrid.appendChild(card);
  renderMaiChart(year);
});

// combined MAI card with legend

const maiLegendDiv = document.createElement('div');
maiLegendDiv.className = 'legend';
maiLegendDiv.style.borderBottom = 'none';
maiLegendDiv.innerHTML = MAI_YEARS.map(year => `
  <div class="legend-item">
    <div style="position:relative;width:24px;height:12px;display:flex;align-items:center">
      <div class="legend-line" style="background:${MAI_YEAR_COLOR[year]};position:absolute;width:100%"></div>
      <div class="legend-dot-line" style="background:${MAI_YEAR_COLOR[year]};position:absolute;left:8px"></div>
    </div>
    <span>${year}</span>
  </div>
`).join('');

const maiCombinedGrid = document.getElementById('maiCombinedGrid');
maiCombinedGrid.parentElement.insertBefore(maiLegendDiv, maiCombinedGrid);
maiCombinedGrid.appendChild(buildMaiCombinedCard());
renderMaiCombinedChart();

// 
document.querySelectorAll('canvas[id^="chart-"]').forEach(c => {
  c.addEventListener('mouseenter', () => { ttTotal.parentElement.style.display = ''; });
});


// crop charts based on features 


// helper: sum chandrapur RF for given week set in a given year
function chandrapurStageRF(year, weekSet) {
  const d = DATA[year]?.chandrapur;
  if (!d) return 0;
  let sum = 0;
  d.weeks.forEach((w, i) => {
    if (weekSet.includes(w)) sum += (d.rf[i] || 0);
  });
  return +sum.toFixed(2);
}

function buildStageCard(stage) {
  const card = document.createElement('div');
  card.className = 'stage-card';
  card.id = `stage-card-${stage.id}`;

  card.innerHTML = `
    <div class="stage-card-header">
      <span class="stage-badge">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--chandrapur);display:inline-block;"></span>
        Chandrapur · Rice (Paddy) Kharif · ${stage.smwLabel}
      </span>
      <div class="stage-title">${stage.label}</div>
      <div class="stage-meta">${stage.dateRange} &nbsp;·&nbsp; ${stage.duration} &nbsp;·&nbsp; Water Req: <span style="font-family:'IBM Plex Mono',monospace;color:#34d399">${stage.waterReq} mm</span></div>
    </div>
    <div class="stage-legend">
      <div class="stage-legend-item">
        <div class="stage-legend-swatch" style="background:${COLOR_WATER_REQ}"></div>
        <span>Water Required (${stage.waterReq} mm)</span>
      </div>
      <div class="stage-legend-item">
        <div class="stage-legend-swatch" style="background:${COLOR_ACTUAL}"></div>
        <span>Actual Rainfall (Chandrapur sum)</span>
      </div>
    </div>
    <div class="stage-chart-wrap"><canvas id="stage-chart-${stage.id}"></canvas></div>
  `;
  return card;
}

function renderStageChart(stage) {
  const ctx = document.getElementById(`stage-chart-${stage.id}`).getContext('2d');

  const actualData = STAGE_YEARS.map(yr => chandrapurStageRF(yr, stage.weeks));
  const reqData    = STAGE_YEARS.map(() => stage.waterReq);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: STAGE_YEARS,
      datasets: [
        {
          label: `Water Required (${stage.waterReq} mm)`,
          data: reqData,
          backgroundColor: COLOR_WATER_REQ_BG,
          borderColor: COLOR_WATER_REQ,
          borderWidth: 2,
          borderRadius: 4,
          borderSkipped: false,
          order: 2,
        },
        {
          label: 'Actual Rainfall (Chandrapur)',
          data: actualData,
          backgroundColor: COLOR_ACTUAL_BG,
          borderColor: COLOR_ACTUAL,
          borderWidth: 2,
          borderRadius: 4,
          borderSkipped: false,
          order: 1,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: '#2a2420',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: 'rgba(255,255,255,0.5)',
          bodyColor: 'rgba(255,255,255,0.85)',
          titleFont: { family: "'JetBrains Mono'", size: 11 },
          bodyFont: { family: "'Inter'", size: 12 },
          padding: 12,
          callbacks: {
            title: (items) => `Year ${items[0].label}`,
            label: (item) => {
              const val = item.raw.toFixed(1);
              const name = item.datasetIndex === 0 ? 'Water Required' : 'Actual Rainfall';
              return `  ${name}: ${val} mm`;
            },
            afterBody: (items) => {
              const req = items.find(i => i.datasetIndex === 0)?.raw ?? stage.waterReq;
              const act = items.find(i => i.datasetIndex === 1)?.raw ?? 0;
              const diff = (act - req).toFixed(1);
              const sign = diff >= 0 ? '+' : '';
              const status = act >= req ? '✔ Adequate' : '✘ Deficit';
              return [`  Difference: ${sign}${diff} mm   ${status}`];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(30,20,10,0.06)', drawTicks: false },
          ticks: {
            color: '#8c7d6e',
            font: { family: "'JetBrains Mono'", size: 10 },
            maxRotation: 0,
            padding: 6,
          },
          title: {
            display: true,
            text: 'Year',
            color: '#a09080',
            font: { family: "'Inter'", size: 11 }
          }
        },
        y: {
          grid: { color: 'rgba(30,20,10,0.05)', drawTicks: false },
          ticks: {
            color: '#8c7d6e',
            font: { family: "'JetBrains Mono'", size: 10 },
            maxTicksLimit: 6,
            padding: 6,
            callback: v => v + ' mm'
          },
          title: {
            display: true,
            text: 'Rainfall (mm)',
            color: '#a09080',
            font: { family: "'Inter'", size: 11 }
          },
          beginAtZero: true,
        }
      }
    }
  });
}

// rice growth stage charts
const stageGrid = document.getElementById('stageGrid');
GROWTH_STAGES.forEach(stage => {
  stageGrid.appendChild(buildStageCard(stage));
  renderStageChart(stage);
});

// soybean growth stage charts
const soybeanGrid = document.getElementById('soybeanGrid');
SOYBEAN_STAGES.forEach(stage => {
  soybeanGrid.appendChild(buildStageCard(stage));
  renderStageChart(stage);
});

// pigeonpea growth stage charts
const pigeonpeaGrid = document.getElementById('pigeonpeaGrid');
PIGEONPEA_STAGES.forEach(stage => {
  pigeonpeaGrid.appendChild(buildStageCard(stage));
  renderStageChart(stage);
});

// chart - 6 dry spell analysis (weeks 24-40, one line chart per year, small multiples)

function buildDryCard(year) {
  const d = DRY_SPELL_DATA[year];
  const card = document.createElement('div');
  card.className = 'card';
  card.id = `dry-card-${year}`;

  const cVals = d.chandrapur.filter(v => v !== null);
  const wVals = d.wardha.filter(v => v !== null);
  const aVals = d.akola.filter(v => v !== null);
  const sVals = d.washim.filter(v => v !== null);
  const cMax = cVals.length ? Math.max(...cVals) : 0;
  const wMax = wVals.length ? Math.max(...wVals) : 0;
  const aMax = aVals.length ? Math.max(...aVals) : 0;
  const sMax = sVals.length ? Math.max(...sVals) : 0;
  const cAvg = cVals.length ? (cVals.reduce((a, b) => a + b, 0) / cVals.length).toFixed(1) : '—';
  const wAvg = wVals.length ? (wVals.reduce((a, b) => a + b, 0) / wVals.length).toFixed(1) : '—';
  const aAvg = aVals.length ? (aVals.reduce((a, b) => a + b, 0) / aVals.length).toFixed(1) : '—';
  const sAvg = sVals.length ? (sVals.reduce((a, b) => a + b, 0) / sVals.length).toFixed(1) : '—';

  card.innerHTML = `
    <div class="card-header">
      <div class="card-left">
        <div class="card-year">${year}</div>
        <div class="card-sub">
          <span style="color:${CCOLOR.chandrapur}">Chandrapur</span> driest week: ${cMax}d · avg ${cAvg}/wk
          &nbsp;·&nbsp;
          <span style="color:${CCOLOR.wardha}">Wardha</span> driest week: ${wMax}d · avg ${wAvg}/wk
          &nbsp;·&nbsp;
          <span style="color:${CCOLOR.akola}">Akola</span> driest week: ${aMax}d · avg ${aAvg}/wk
          &nbsp;·&nbsp;
          <span style="color:${CCOLOR.washim}">Washim</span> driest week: ${sMax}d · avg ${sAvg}/wk
        </div>
      </div>
    </div>
    <div class="chart-wrap"><canvas id="dry-chart-${year}"></canvas></div>
  `;
  return card;
}

function renderDryChart(year) {
  const d = DRY_SPELL_DATA[year];
  const ctx = document.getElementById(`dry-chart-${year}`).getContext('2d');

  function makeDataset(label, data, color) {
    return {
      label,
      data,
      borderColor: color,
      backgroundColor: color + '22',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: color,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: color,
      pointHoverBorderColor: '#ffffff',
      pointHoverBorderWidth: 2,
      tension: 0.25,
      fill: false,
      spanGaps: false,
    };
  }

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.weeks,
      datasets: [
        makeDataset('Chandrapur', d.chandrapur, CCOLOR.chandrapur),
        makeDataset('Wardha', d.wardha, CCOLOR.wardha),
        makeDataset('Akola', d.akola, CCOLOR.akola),
        makeDataset('Washim', d.washim, CCOLOR.washim),
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#8c7d6e', font: { family: "'Inter'", size: 10 }, boxWidth: 10, boxHeight: 10 }
        },
        tooltip: {
          enabled: true,
          callbacks: {
            title: (items) => `Week ${items[0].label}`,
            label: (item) => {
              const v = item.raw;
              if (v === null || v === undefined) return `${item.dataset.label}: no data`;
              return `${item.dataset.label}: ${v} dry day${v === 1 ? '' : 's'} this week`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(30,20,10,0.06)', drawTicks: false },
          ticks: { color: '#8c7d6e', font: { family: "'JetBrains Mono'", size: 9 }, maxRotation: 0, padding: 6 },
          title: { display: true, text: 'IMD Meteorological Week', color: '#a09080', font: { family: "'Inter'", size: 10 } }
        },
        y: {
          min: 0,
          max: 7,
          grid: { color: 'rgba(30,20,10,0.05)', drawTicks: false },
          ticks: { color: '#8c7d6e', font: { family: "'JetBrains Mono'", size: 9 }, stepSize: 1, precision: 0 },
          title: { display: true, text: 'Number of Dry Spell Days (RF < 2.5mm)', color: '#a09080', font: { family: "'Inter'", size: 10 } }
        }
      }
    }
  });
}

// Small multiples: one chart per year, no filtering/tabs
DRY_SPELL_YEARS.forEach(year => {
  const gridDry = document.getElementById('gridDry');
  const card = buildDryCard(year);
  gridDry.appendChild(card);
  renderDryChart(year);
});

// chart - 7 LGP (Length of Growing Period) summary — single bar chart, all years

function renderLGPChart() {
  const ctx = document.getElementById('lgp-chart').getContext('2d');
  const labels = LGP_DATA.map(d => d.year);
  const values = LGP_DATA.map(d => d.lgp);
  const color = CCOLOR.chandrapur;

  // Slightly distinguish the 2022 short-LGP year and 2023 mild-stress year for a quick visual cue
  const barColors = LGP_DATA.map(d => {
    if (d.stress !== 'No') return '#c4436b';       // stress year
    if (d.recommendation !== 'Normal crops') return '#9e5a2b'; // short-duration advisory year
    return color;
  });

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'LGP (days)',
        data: values,
        backgroundColor: barColors,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 70,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            title: (items) => `Year ${items[0].label}`,
            label: (item) => {
              const d = LGP_DATA[item.dataIndex];
              return `LGP: ${d.lgp} days`;
            },
            afterLabel: (item) => {
              const d = LGP_DATA[item.dataIndex];
              return [
                `Sowing Week: ${d.sowingWeek}`,
                `Stress: ${d.stress}`,
                `Alternate Crop: ${d.altCrop}`,
                `Recommendation: ${d.recommendation}`,
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#8c7d6e', font: { family: "'JetBrains Mono'", size: 11 } },
          title: { display: true, text: 'Year', color: '#a09080', font: { family: "'Inter'", size: 11 } }
        },
        y: {
          beginAtZero: true,
          suggestedMax: 130,
          grid: { color: 'rgba(30,20,10,0.06)', drawTicks: false },
          ticks: { color: '#8c7d6e', font: { family: "'JetBrains Mono'", size: 10 } },
          title: { display: true, text: 'LGP (days)', color: '#a09080', font: { family: "'Inter'", size: 11 } }
        }
      }
    }
  });
}

renderLGPChart();

// ===================================================================
// FLOATING NAV — Aceternity UI FloatingNav behaviour (vanilla JS)
// Shows when scrolling UP past 5% of page, hides when scrolling DOWN
// or when near the very top.
// ===================================================================
(function () {
  const floatingNav   = document.getElementById('floatingNav');
  const mobileMenu    = document.getElementById('floatingMobileMenu');
  const menuBtn       = document.getElementById('floatingMenuBtn');
  const allPanels     = document.querySelectorAll('.section-panel');
  // All fnav-tab buttons (pill + mobile dropdown)
  const allTabs       = document.querySelectorAll('.fnav-tab');

  // ── Section switching ──────────────────────────────────────────
  function showSection(sectionId) {
    allPanels.forEach(p => p.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');

    // Update active state on ALL tabs (pill + mobile menu)
    allTabs.forEach(t => {
      t.classList.toggle('active', t.dataset.section === sectionId);
    });

    // Close mobile dropdown and scroll back to top
    closeMobileMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  allTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.section) showSection(tab.dataset.section);
    });
  });

  // ── Mobile dropdown toggle ─────────────────────────────────────
  function closeMobileMenu() {
    mobileMenu.classList.remove('open');
    mobileMenu.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = mobileMenu.classList.toggle('open');
    mobileMenu.setAttribute('aria-hidden', String(!isOpen));
    menuBtn.setAttribute('aria-expanded', String(isOpen));
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#floatingNav') && !e.target.closest('#floatingMobileMenu')) {
      closeMobileMenu();
    }
  });

  // ── Scroll-driven show / hide (mirrors FloatingNav logic) ──────
  // Uses the same direction-detection as the React original:
  //   • if scrollY < 5% of total → always hide
  //   • scrolling UP  → show
  //   • scrolling DOWN → hide
  let lastScrollY   = window.scrollY;
  let ticking       = false;

  // Show the nav immediately on load, regardless of scroll position
  floatingNav.classList.add('visible');

  function updateNav() {
    const scrollY     = window.scrollY;
    const maxScroll   = document.documentElement.scrollHeight - window.innerHeight;
    const progress    = maxScroll > 0 ? scrollY / maxScroll : 0;
    const direction   = scrollY - lastScrollY;   // positive = down, negative = up
    lastScrollY       = scrollY;

    if (progress < 0.05) {
      // Near top — keep visible (don't hide on initial view)
      floatingNav.classList.add('visible');
    } else if (direction < 0) {
      // Scrolling UP → reveal
      floatingNav.classList.add('visible');
    } else if (direction > 0) {
      // Scrolling DOWN → hide + close dropdown
      floatingNav.classList.remove('visible');
      closeMobileMenu();
    }

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateNav);
      ticking = true;
    }
  }, { passive: true });
})();