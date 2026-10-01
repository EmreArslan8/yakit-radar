// Chart.js ortak tema + yardımcılar
const ChartKit = {
  _init() {
    if (this._ok || !window.Chart) return;
    Chart.defaults.color = '#7d8a7f';
    Chart.defaults.font.family = "'Instrument Sans', sans-serif";
    Chart.defaults.borderColor = 'rgba(255,255,255,.05)';
    this._ok = true;
  },
  // series: [{label,data,color,fill,dash,meta}]; meta=true → lejant/tooltip'te gizli (güven aralığı)
  line(canvas, { labels, series, yFmt = v => v.toFixed(1) + ' ₺', legend = true }) {
    this._init();
    const ds = series.map(s => ({
      label: s.label, data: s.data, borderColor: s.meta ? 'transparent' : s.color, borderWidth: s.meta ? 0 : (s.dash ? 2 : 2.5),
      borderDash: s.dash ? [6, 5] : [], pointRadius: 0, pointHoverRadius: s.meta ? 0 : 5, pointHoverBackgroundColor: s.color,
      tension: .25, stepped: s.step ? 'before' : false, meta: s.meta, spanGaps: false,
      fill: s.meta ? (s.fillPrev ? '-1' : false) : s.fill,
      backgroundColor: s.meta ? s.color + '22' : (c) => {
        const { ctx, chartArea } = c.chart; if (!chartArea || !s.fill) return 'transparent';
        const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g.addColorStop(0, s.color + '40'); g.addColorStop(1, s.color + '00'); return g;
      },
    }));
    return new Chart(canvas, {
      type: 'line', data: { labels, datasets: ds },
      options: {
        maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: legend, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, filter: i => !ds[i.datasetIndex].meta } },
          tooltip: { filter: i => !i.dataset.meta, backgroundColor: '#eef3ea', titleColor: '#090b0a', bodyColor: '#090b0a', padding: 12, cornerRadius: 12, displayColors: false,
            callbacks: { label: c => `${c.dataset.label}: ${yFmt(c.parsed.y)}` } },
        },
        scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 7, maxRotation: 0 } }, y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { callback: yFmt } } },
      },
    });
  },
};
