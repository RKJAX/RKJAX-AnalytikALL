const marketsList = document.getElementById('marketsList');
const pairTitle = document.getElementById('pairTitle');
const quoteValue = document.getElementById('quoteValue');
const quoteChange = document.getElementById('quoteChange');
const statusLabel = document.getElementById('status');
const canvas = document.getElementById('priceChart');
const ctx = canvas.getContext('2d');

const BASE_MARKETS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', icon: '₿', seed: 68000 },
  { symbol: 'ETHUSDT', name: 'Ethereum', icon: '◆', seed: 3500 },
  { symbol: 'BNBUSDT', name: 'BNB', icon: '◈', seed: 520 },
  { symbol: 'XRPUSDT', name: 'XRP', icon: '✕', seed: 0.62 },
  { symbol: 'SOLUSDT', name: 'Solana', icon: '◎', seed: 155 },
  { symbol: 'ADAUSDT', name: 'Cardano', icon: '◉', seed: 0.67 },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', icon: 'Ð', seed: 0.18 },
  { symbol: 'TRXUSDT', name: 'TRON', icon: '◌', seed: 0.13 },
  { symbol: 'DOTUSDT', name: 'Polkadot', icon: '●', seed: 8.5 },
  { symbol: 'LTCUSDT', name: 'Litecoin', icon: 'Ł', seed: 95 },
  { symbol: 'AVAXUSDT', name: 'Avalanche', icon: '▲', seed: 42 },
  { symbol: 'LINKUSDT', name: 'Chainlink', icon: '∞', seed: 20 },
  { symbol: 'MATICUSDT', name: 'Polygon', icon: '⬡', seed: 1.1 },
  { symbol: 'ATOMUSDT', name: 'Cosmos', icon: '✦', seed: 11 },
  { symbol: 'UNIUSDT', name: 'Uniswap', icon: '🦄', seed: 12 },
];

const mockState = Object.fromEntries(
  BASE_MARKETS.map((m) => [m.symbol, { price: m.seed, change24h: 0 }])
);

let selectedMarket = BASE_MARKETS[0];
let quoteCurrency = 'usd';
let usdToKzt = 500;
let refreshTimer;
let liveSource = 'api';

const numberFormat = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function updateUsdKztRate() {
  try {
    const rates = await fetchJson('https://open.er-api.com/v6/latest/USD');
    const rate = rates?.rates?.KZT;
    if (typeof rate === 'number' && Number.isFinite(rate)) {
      usdToKzt = rate;
    }
  } catch (_error) {
    // если сеть недоступна, оставляем последнее значение
  }
}

function toCurrentCurrency(usdValue) {
  return quoteCurrency === 'kzt' ? usdValue * usdToKzt : usdValue;
}

function renderMarketList() {
  marketsList.innerHTML = '';

  BASE_MARKETS.forEach((market) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'market-item';
    item.setAttribute('aria-label', `${market.name} к ${quoteCurrency.toUpperCase()}`);

    if (market.symbol === selectedMarket.symbol) {
      item.classList.add('active');
    }

    item.innerHTML = `
      <strong>${market.icon} ${market.symbol.replace('USDT', '')} / ${quoteCurrency.toUpperCase()}</strong>
      <span>${market.name}</span>
    `;

    item.addEventListener('click', async () => {
      selectedMarket = market;
      renderMarketList();
      await refreshSelectedMarket();
    });

    marketsList.appendChild(item);
  });
}

function drawChart(points) {
  const width = canvas.width;
  const height = canvas.height;
  const padding = 34;

  ctx.clearRect(0, 0, width, height);
  if (points.length < 2) return;

  const min = Math.min(...points);
  const max = Math.max(...points);

  ctx.strokeStyle = 'rgba(122, 166, 255, 0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = padding + ((height - padding * 2) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  ctx.beginPath();
  points.forEach((price, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const normalized = (price - min) / ((max - min) || 1);
    const y = height - padding - normalized * (height - padding * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  const fillGradient = ctx.createLinearGradient(0, padding, 0, height - padding);
  fillGradient.addColorStop(0, 'rgba(132, 72, 255, 0.35)');
  fillGradient.addColorStop(1, 'rgba(45, 238, 255, 0.04)');

  ctx.lineTo(width - padding, height - padding);
  ctx.lineTo(padding, height - padding);
  ctx.closePath();
  ctx.fillStyle = fillGradient;
  ctx.fill();

  const strokeGradient = ctx.createLinearGradient(padding, 0, width - padding, 0);
  strokeGradient.addColorStop(0, '#25ffe0');
  strokeGradient.addColorStop(0.5, '#77a7ff');
  strokeGradient.addColorStop(1, '#bb6dff');

  ctx.beginPath();
  points.forEach((price, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const normalized = (price - min) / ((max - min) || 1);
    const y = height - padding - normalized * (height - padding * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = strokeGradient;
  ctx.shadowColor = 'rgba(88, 255, 231, 0.35)';
  ctx.shadowBlur = 14;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

async function fetchTickerFromApi() {
  const symbol = selectedMarket.symbol;
  const ticker = await fetchJson(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
  return {
    symbol,
    lastPriceUsd: Number(ticker.lastPrice),
    change24h: Number(ticker.priceChangePercent),
  };
}

async function fetchChartPointsFromApi() {
  const symbol = selectedMarket.symbol;
  const klines = await fetchJson(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=5m&limit=120`);
  return klines.map((item) => toCurrentCurrency(Number(item[4])));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function buildMockPoints(centerPrice) {
  const points = [];
  let current = centerPrice;

  for (let i = 0; i < 120; i += 1) {
    const drift = randomBetween(-0.004, 0.004);
    current = Math.max(0.0001, current * (1 + drift));
    points.push(toCurrentCurrency(current));
  }

  return points;
}

function getMockTickerAndChart() {
  const state = mockState[selectedMarket.symbol];
  const jump = randomBetween(-0.007, 0.007);

  state.price = Math.max(0.0001, state.price * (1 + jump));
  state.change24h = Math.max(-15, Math.min(15, state.change24h + jump * 100));

  return {
    ticker: {
      symbol: selectedMarket.symbol,
      lastPriceUsd: state.price,
      change24h: state.change24h,
    },
    points: buildMockPoints(state.price),
  };
}

function applyTickerToUI(ticker, points) {
  drawChart(points);

  const quote = toCurrentCurrency(ticker.lastPriceUsd);
  const pairBase = ticker.symbol.replace('USDT', '');

  pairTitle.textContent = `${pairBase} / ${quoteCurrency.toUpperCase()}`;
  quoteValue.textContent = `${numberFormat.format(quote)} ${quoteCurrency.toUpperCase()}`;

  quoteChange.textContent = `24ч: ${ticker.change24h.toFixed(2)}%`;
  quoteChange.classList.remove('up', 'down');
  quoteChange.classList.add(ticker.change24h >= 0 ? 'up' : 'down');

  const pulseColor = ticker.change24h >= 0 ? 'var(--success)' : 'var(--danger)';
  quoteValue.animate(
    [
      { textShadow: '0 0 0 transparent' },
      { textShadow: `0 0 18px ${pulseColor}` },
      { textShadow: '0 0 0 transparent' },
    ],
    { duration: 900, iterations: 1 }
  );
}

async function refreshSelectedMarket() {
  statusLabel.textContent = `Обновляем ${selectedMarket.symbol.replace('USDT', '')}...`;

  if (quoteCurrency === 'kzt') {
    await updateUsdKztRate();
  }

  try {
    const [ticker, points] = await Promise.all([fetchTickerFromApi(), fetchChartPointsFromApi()]);
    liveSource = 'api';
    applyTickerToUI(ticker, points);
  } catch (_error) {
    liveSource = 'mock';
    const { ticker, points } = getMockTickerAndChart();
    applyTickerToUI(ticker, points);
  }

  const sourceText = liveSource === 'api' ? 'LIVE API' : 'LIVE DEMO';
  statusLabel.textContent = `${sourceText} • Обновлено ${new Date().toLocaleTimeString('ru-RU')}`;
}

function bindCurrencySwitch() {
  document.querySelectorAll('.currency-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const next = button.dataset.currency;
      if (next === quoteCurrency) return;

      quoteCurrency = next;
      document.querySelectorAll('.currency-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.currency === quoteCurrency);
      });

      renderMarketList();
      await refreshSelectedMarket();
    });
  });
}

async function init() {
  bindCurrencySwitch();
  renderMarketList();
  await refreshSelectedMarket();

  clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshSelectedMarket, 5000);
}

init();
