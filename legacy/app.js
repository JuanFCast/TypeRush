const phrases = [
  "Cada tecla cuenta cuando el premio se mueve en stablecoin.",
  "La precision vence a la velocidad cuando la ronda se pone intensa.",
  "Bogota corre rapido, pero el ranking solo respeta dedos constantes.",
  "MiniPay abre la puerta a juegos simples con pagos pequenos y claros.",
  "Un buen sprint no se gana pegando texto, se gana con ritmo real.",
];

const leaders = [
  { name: "Mafe", tag: "Barranquilla", score: 7420 },
  { name: "Nico", tag: "Medellin", score: 7190 },
  { name: "Sara", tag: "Cali", score: 6880 },
  { name: "Pipe", tag: "Bogota", score: 6550 },
  { name: "Lina", tag: "Pereira", score: 6210 },
  { name: "Jose", tag: "Bucaramanga", score: 5960 },
];

const state = {
  balance: 12.4,
  pool: 24.5,
  entry: 0.5,
  locked: 0,
  earnings: 0,
  joined: false,
  running: false,
  finished: false,
  mode: "ranked",
  phrase: phrases[0],
  startedAt: 0,
  duration: 45,
  timer: null,
  miniPay: false,
  accountLabel: "Demo",
};

const els = {
  runtimeLabel: document.querySelector("#runtimeLabel"),
  statusPill: document.querySelector("#statusPill"),
  balanceLabel: document.querySelector("#balanceLabel"),
  walletBalance: document.querySelector("#walletBalance"),
  lockedBalance: document.querySelector("#lockedBalance"),
  earningsBalance: document.querySelector("#earningsBalance"),
  poolLabel: document.querySelector("#poolLabel"),
  entryLabel: document.querySelector("#entryLabel"),
  roundLabel: document.querySelector("#roundLabel"),
  phraseText: document.querySelector("#phraseText"),
  phraseSeed: document.querySelector("#phraseSeed"),
  antiCheatLabel: document.querySelector("#antiCheatLabel"),
  input: document.querySelector("#typingInput"),
  joinButton: document.querySelector("#joinButton"),
  depositButton: document.querySelector("#depositButton"),
  stablecoinSelect: document.querySelector("#stablecoinSelect"),
  wpmLabel: document.querySelector("#wpmLabel"),
  accuracyLabel: document.querySelector("#accuracyLabel"),
  scoreLabel: document.querySelector("#scoreLabel"),
  rankLabel: document.querySelector("#rankLabel"),
  leaderboard: document.querySelector("#leaderboard"),
  fullLeaderboard: document.querySelector("#fullLeaderboard"),
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  canvas: document.querySelector("#speedCanvas"),
};

function isMiniPay() {
  return Boolean(window.ethereum && window.ethereum.isMiniPay === true);
}

async function initMiniPay() {
  state.miniPay = isMiniPay();

  if (!window.ethereum) {
    els.runtimeLabel.textContent = "Vista demo";
    els.statusPill.textContent = "Demo";
    return;
  }

  if (state.miniPay) {
    els.runtimeLabel.textContent = "MiniPay";
    els.statusPill.textContent = "MiniPay";
  } else {
    els.runtimeLabel.textContent = "Provider detectado";
    els.statusPill.textContent = "Web";
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    state.accountLabel = accounts && accounts.length ? "Conectado" : "MiniPay listo";
    els.statusPill.textContent = state.accountLabel;
  } catch {
    els.statusPill.textContent = "Reintentar";
  }
}

function money(value) {
  return `${value.toFixed(2)} ${els.stablecoinSelect.value}`;
}

function renderWallet() {
  const entryLabel = state.mode === "ranked" ? money(state.entry) : "0.00 USDm";
  els.balanceLabel.textContent = money(state.balance);
  els.walletBalance.textContent = money(state.balance);
  els.lockedBalance.textContent = money(state.locked);
  els.earningsBalance.textContent = money(state.earnings);
  els.poolLabel.textContent = money(state.pool);
  els.entryLabel.textContent = entryLabel;
  els.joinButton.textContent = state.running
    ? "Corriendo"
    : state.mode === "ranked"
      ? `Entrar por ${money(state.entry)}`
      : "Practicar";
}

function renderPhrase() {
  const typed = els.input.value;
  els.phraseText.innerHTML = "";

  [...state.phrase].forEach((char, index) => {
    const span = document.createElement("span");
    span.textContent = char;

    if (index < typed.length) {
      span.className = typed[index] === char ? "correct" : "wrong";
    } else if (index === typed.length) {
      span.className = "current";
    }

    els.phraseText.appendChild(span);
  });
}

function getStats() {
  const typed = els.input.value;
  const elapsedMs = state.running ? Date.now() - state.startedAt : 0;
  const minutes = Math.max(elapsedMs / 60000, 1 / 60);
  let correct = 0;

  [...typed].forEach((char, index) => {
    if (char === state.phrase[index]) correct += 1;
  });

  const accuracy = typed.length ? correct / typed.length : 1;
  const words = correct / 5;
  const wpm = Math.round(words / minutes);
  const completion = Math.min(typed.length / state.phrase.length, 1);
  const score = Math.round(wpm * accuracy * 100 + completion * 1200);

  return { accuracy, wpm, score, completion };
}

function renderStats() {
  const stats = getStats();
  els.wpmLabel.textContent = String(stats.wpm);
  els.accuracyLabel.textContent = `${Math.round(stats.accuracy * 100)}%`;
  els.scoreLabel.textContent = String(stats.score);
  return stats;
}

function renderLeaderboard() {
  const stats = getStats();
  const board = [...leaders];

  if (state.joined) {
    board.push({ name: "Tu", tag: "MiniPay", score: stats.score });
  }

  board.sort((a, b) => b.score - a.score);

  const renderList = (target, rows) => {
    target.innerHTML = "";
    rows.forEach((row, index) => {
      const item = document.createElement("li");
      item.innerHTML = `
        <span class="rank-badge">${index + 1}</span>
        <span class="leader-name">
          <strong>${row.name}</strong>
          <span>${row.tag}</span>
        </span>
        <span class="leader-score">${row.score}</span>
      `;
      target.appendChild(item);
    });
  };

  renderList(els.leaderboard, board.slice(0, 6));
  renderList(els.fullLeaderboard, board);

  const ownRank = board.findIndex((row) => row.name === "Tu") + 1;
  els.rankLabel.textContent = ownRank > 0 ? `#${ownRank}` : "Sin entrar";
}

function pickPhrase() {
  const index = Math.floor(Math.random() * phrases.length);
  state.phrase = phrases[index];
  els.phraseSeed.textContent = `Seed ${42220 + index * 17}`;
}

function startRound() {
  if (state.running) return;
  if (state.mode === "ranked" && state.balance < state.entry) {
    window.location.href = "https://link.minipay.xyz/add_cash?tokens=USDM,USDT,USDC";
    return;
  }

  if (state.mode === "ranked") {
    state.balance -= state.entry;
    state.locked += state.entry;
    state.pool += state.entry;
  }

  state.joined = true;
  state.running = true;
  state.finished = false;
  state.startedAt = Date.now();
  state.duration = 45;
  els.roundLabel.textContent = "45s";
  pickPhrase();
  els.input.value = "";
  els.input.disabled = false;
  els.input.focus();
  els.antiCheatLabel.textContent = "Cadencia limpia";
  clearInterval(state.timer);
  state.timer = setInterval(tick, 250);

  renderPhrase();
  renderStats();
  renderWallet();
  renderLeaderboard();
}

function finishRound(won = false) {
  state.running = false;
  state.finished = true;
  els.input.disabled = true;
  clearInterval(state.timer);

  if (won && state.mode === "ranked") {
    const payout = 3.2;
    state.earnings += payout;
    state.balance += payout;
    state.locked = Math.max(0, state.locked - state.entry);
    els.antiCheatLabel.textContent = `Payout ${money(payout)}`;
  } else {
    state.locked = Math.max(0, state.locked - state.entry);
    els.antiCheatLabel.textContent = "Resultado guardado";
  }

  renderWallet();
  renderLeaderboard();
}

function tick() {
  const remaining = Math.max(0, 45 - Math.floor((Date.now() - state.startedAt) / 1000));
  els.roundLabel.textContent = `${remaining}s`;
  renderStats();
  renderLeaderboard();

  if (remaining === 0) finishRound(false);
}

els.input.addEventListener("paste", (event) => {
  event.preventDefault();
  els.antiCheatLabel.textContent = "Pegado bloqueado";
});

els.input.addEventListener("input", () => {
  renderPhrase();
  const stats = renderStats();
  renderLeaderboard();

  if (els.input.value.length >= state.phrase.length || stats.completion === 1) {
    finishRound(stats.score >= 6200);
  }
});

els.joinButton.addEventListener("click", startRound);
els.depositButton.addEventListener("click", () => {
  window.location.href = "https://link.minipay.xyz/add_cash?tokens=USDM,USDT,USDC";
});

els.stablecoinSelect.addEventListener("change", renderWallet);

document.querySelectorAll(".mode-pill").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.running) return;
    document.querySelectorAll(".mode-pill").forEach((item) => item.classList.remove("is-selected"));
    button.classList.add("is-selected");
    state.mode = button.textContent.trim().toLowerCase() === "practice" ? "practice" : "ranked";
    renderWallet();
  });
});

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((item) => item.classList.remove("is-active"));
    els.views.forEach((view) => view.classList.remove("is-visible"));
    tab.classList.add("is-active");
    document.querySelector(`#${tab.dataset.view}View`).classList.add("is-visible");
  });
});

function setupCanvas() {
  const ctx = els.canvas.getContext("2d");
  const glyphs = "ASDFJKL;WPM42220";
  const particles = Array.from({ length: 64 }, () => ({
    x: Math.random(),
    y: Math.random(),
    speed: 0.15 + Math.random() * 0.55,
    glyph: glyphs[Math.floor(Math.random() * glyphs.length)],
    size: 12 + Math.random() * 22,
    color: ["#00a878", "#ff6b57", "#2f80ed", "#f4b942"][
      Math.floor(Math.random() * 4)
    ],
  }));

  function resize() {
    const rect = els.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    els.canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    els.canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function draw() {
    const rect = els.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    particles.forEach((particle) => {
      particle.x += particle.speed / 1000;
      if (particle.x > 1.08) {
        particle.x = -0.08;
        particle.y = Math.random();
      }

      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = particle.color;
      ctx.font = `900 ${particle.size}px Inter, sans-serif`;
      ctx.fillText(particle.glyph, particle.x * rect.width, particle.y * rect.height);
      ctx.restore();
    });

    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  draw();
}

initMiniPay().finally(() => {
  renderPhrase();
  renderStats();
  renderWallet();
  renderLeaderboard();
  setupCanvas();
});
