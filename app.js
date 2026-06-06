(function () {
  "use strict";

  const data = window.WORLD_CUP_DATA;
  if (!data || !Array.isArray(data.players)) {
    document.body.innerHTML = "<main class=\"missing-data\">缺少 data/players.js，请先运行 tools/build_data.py。</main>";
    return;
  }

  const players = data.players;
  const playerById = new Map(players.map((player) => [String(player.id), player]));
  const SIMULATION_COUNT = 900;

  const formations = {
    "4-3-3": [
      [
        { group: "Attack", label: "LW" },
        { group: "Attack", label: "ST" },
        { group: "Attack", label: "RW" },
      ],
      [
        { group: "Midfield", label: "LCM" },
        { group: "Midfield", label: "CM" },
        { group: "Midfield", label: "RCM" },
      ],
      [
        { group: "Defender", label: "LB" },
        { group: "Defender", label: "LCB" },
        { group: "Defender", label: "RCB" },
        { group: "Defender", label: "RB" },
      ],
      [{ group: "Goalkeeper", label: "GK" }],
    ],
    "4-4-2": [
      [
        { group: "Attack", label: "LS" },
        { group: "Attack", label: "RS" },
      ],
      [
        { group: "Midfield", label: "LM" },
        { group: "Midfield", label: "LCM" },
        { group: "Midfield", label: "RCM" },
        { group: "Midfield", label: "RM" },
      ],
      [
        { group: "Defender", label: "LB" },
        { group: "Defender", label: "LCB" },
        { group: "Defender", label: "RCB" },
        { group: "Defender", label: "RB" },
      ],
      [{ group: "Goalkeeper", label: "GK" }],
    ],
    "3-5-2": [
      [
        { group: "Attack", label: "LS" },
        { group: "Attack", label: "RS" },
      ],
      [
        { group: "Midfield", label: "LWB" },
        { group: "Midfield", label: "LCM" },
        { group: "Midfield", label: "CM" },
        { group: "Midfield", label: "RCM" },
        { group: "Midfield", label: "RWB" },
      ],
      [
        { group: "Defender", label: "LCB" },
        { group: "Defender", label: "CB" },
        { group: "Defender", label: "RCB" },
      ],
      [{ group: "Goalkeeper", label: "GK" }],
    ],
    "5-3-2": [
      [
        { group: "Attack", label: "LS" },
        { group: "Attack", label: "RS" },
      ],
      [
        { group: "Midfield", label: "LCM" },
        { group: "Midfield", label: "CM" },
        { group: "Midfield", label: "RCM" },
      ],
      [
        { group: "Defender", label: "LWB" },
        { group: "Defender", label: "LCB" },
        { group: "Defender", label: "CB" },
        { group: "Defender", label: "RCB" },
        { group: "Defender", label: "RWB" },
      ],
      [{ group: "Goalkeeper", label: "GK" }],
    ],
  };

  const state = {
    formation: "4-3-3",
    team: "all",
    realOnly: false,
    seed: createSeed(),
    lineup: [],
  };

  const simulationCache = new Map();

  const elements = {
    dataSummary: document.getElementById("dataSummary"),
    formationButtons: document.getElementById("formationButtons"),
    teamSelect: document.getElementById("teamSelect"),
    realRatingsOnly: document.getElementById("realRatingsOnly"),
    poolStats: document.getElementById("poolStats"),
    seedInput: document.getElementById("seedInput"),
    seedButton: document.getElementById("seedButton"),
    drawButton: document.getElementById("drawButton"),
    copyButton: document.getElementById("copyButton"),
    pitch: document.getElementById("pitch"),
    lineupList: document.getElementById("lineupList"),
    lineupMeta: document.getElementById("lineupMeta"),
    averageOverall: document.getElementById("averageOverall"),
    totalValue: document.getElementById("totalValue"),
    luckScore: document.getElementById("luckScore"),
    estimatedCount: document.getElementById("estimatedCount"),
    statusLine: document.getElementById("statusLine"),
  };

  function init() {
    renderDataSummary();
    renderFormationButtons();
    renderTeamOptions();
    bindEvents();

    const sharedState = parseSharedState();
    if (sharedState) {
      applySharedState(sharedState);
      render();
      return;
    }

    drawNewLineup(false);
  }

  function renderDataSummary() {
    const metadata = data.metadata || {};
    elements.dataSummary.textContent = `${metadata.playerCount || players.length} 名球员，${metadata.fc26RatingCount || 0} 个真实 FC26 评分，${metadata.estimatedRatingCount || 0} 个估算评分`;
  }

  function renderFormationButtons() {
    elements.formationButtons.innerHTML = "";
    Object.keys(formations).forEach((formation) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "formation-button";
      button.textContent = formation;
      button.dataset.formation = formation;
      elements.formationButtons.appendChild(button);
    });
  }

  function renderTeamOptions() {
    const teams = Array.from(new Set(players.map((player) => player.team))).sort((a, b) => a.localeCompare(b));
    elements.teamSelect.innerHTML = "";
    elements.teamSelect.appendChild(optionNode("all", "全部球队"));
    teams.forEach((team) => {
      const count = players.filter((player) => player.team === team).length;
      elements.teamSelect.appendChild(optionNode(team, `${team} (${count})`));
    });
  }

  function optionNode(value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function bindEvents() {
    elements.formationButtons.addEventListener("click", (event) => {
      const button = event.target.closest("[data-formation]");
      if (!button) {
        return;
      }
      state.formation = button.dataset.formation;
      drawNewLineup(true);
    });

    elements.teamSelect.addEventListener("change", () => {
      state.team = elements.teamSelect.value;
      drawNewLineup(true);
    });

    elements.realRatingsOnly.addEventListener("change", () => {
      state.realOnly = elements.realRatingsOnly.checked;
      drawNewLineup(true);
    });

    elements.seedButton.addEventListener("click", () => {
      state.seed = createSeed();
      elements.seedInput.value = state.seed;
      drawNewLineup(false);
    });

    elements.seedInput.addEventListener("change", () => {
      state.seed = normalizeSeed(elements.seedInput.value) || createSeed();
      elements.seedInput.value = state.seed;
      drawNewLineup(false);
    });

    elements.drawButton.addEventListener("click", () => {
      state.seed = createSeed();
      elements.seedInput.value = state.seed;
      drawNewLineup(false);
    });

    elements.copyButton.addEventListener("click", copyShareLink);
  }

  function applyControls() {
    elements.seedInput.value = state.seed;
    elements.teamSelect.value = state.team;
    elements.realRatingsOnly.checked = state.realOnly;
    Array.from(elements.formationButtons.children).forEach((button) => {
      button.classList.toggle("is-active", button.dataset.formation === state.formation);
    });
    renderPoolStats();
  }

  function drawNewLineup(refreshSeed) {
    if (refreshSeed) {
      state.seed = createSeed();
    }
    const source = getFilteredPlayers();
    const warning = validatePools(source, formations[state.formation]);
    if (warning) {
      state.lineup = [];
      applyControls();
      renderEmpty(warning);
      return;
    }
    state.lineup = drawLineupFromPool(source, formations[state.formation], state.seed);
    updateHash();
    render();
  }

  function getFilteredPlayers() {
    return players.filter((player) => {
      if (state.team !== "all" && player.team !== state.team) {
        return false;
      }
      return !state.realOnly || player.overallSource === "fc26";
    });
  }

  function validatePools(source, rows) {
    const requirements = requiredGroups(rows);
    const available = groupPlayers(source);
    for (const [group, required] of Object.entries(requirements)) {
      const count = (available[group] || []).length;
      if (count < required) {
        return `当前奖池的 ${groupLabel(group)} 不足：需要 ${required} 人，只有 ${count} 人。`;
      }
    }
    return "";
  }

  function requiredGroups(rows) {
    return rows.flat().reduce((counts, slot) => {
      counts[slot.group] = (counts[slot.group] || 0) + 1;
      return counts;
    }, {});
  }

  function groupPlayers(source) {
    return source.reduce((groups, player) => {
      const key = player.positionGroup || "Other";
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(player);
      return groups;
    }, {});
  }

  function drawLineupFromPool(source, rows, seed) {
    const random = seededRandom(`${seed}:${state.formation}:${state.team}:${state.realOnly ? "real" : "all"}`);
    const groups = groupPlayers(source);
    const used = new Set();
    const lineup = [];

    rows.flat().forEach((slot, index) => {
      const pool = groups[slot.group].filter((player) => !used.has(player.id));
      const player = pool[Math.floor(random() * pool.length)];
      used.add(player.id);
      lineup.push({
        slot,
        player,
        order: index + 1,
      });
    });

    return lineup;
  }

  function render() {
    applyControls();
    if (!state.lineup.length) {
      renderEmpty("还没有阵容。");
      return;
    }

    const stats = calculateStats(state.lineup);
    renderStats(stats);
    renderPitch();
    renderLineupList(stats);
    elements.statusLine.classList.remove("is-error");
    elements.statusLine.textContent = `Seed ${state.seed}，${state.team === "all" ? "全部球队" : state.team}，${state.realOnly ? "仅真实评分" : "包含估算评分"}。`;
  }

  function renderStats(stats) {
    elements.averageOverall.textContent = stats.averageOverall.toFixed(1);
    elements.totalValue.textContent = formatMoney(stats.totalValue);
    elements.estimatedCount.textContent = `${stats.estimatedCount}/11`;

    const luck = calculateLuck(stats);
    elements.luckScore.textContent = `${luck.score}`;
    elements.luckScore.title = `能力分位 ${luck.abilityPercentile}% · 身价分位 ${luck.valuePercentile}%`;
  }

  function renderPitch() {
    const rows = formations[state.formation];
    let cursor = 0;
    elements.pitch.innerHTML = "";
    rows.forEach((row) => {
      const rowNode = document.createElement("div");
      rowNode.className = "pitch-row";
      row.forEach(() => {
        const item = state.lineup[cursor];
        cursor += 1;
        rowNode.appendChild(playerTile(item));
      });
      elements.pitch.appendChild(rowNode);
    });
  }

  function playerTile(item) {
    const sourceLabel = item.player.overallSource === "fc26" ? "FC26" : "估";
    const node = document.createElement("article");
    node.className = "player-tile";
    node.innerHTML = `
      <div class="tile-top">
        <span class="slot-label">${escapeHtml(item.slot.label)}</span>
        <span class="overall-badge ${item.player.overallSource === "estimated" ? "is-estimated" : ""}" title="${sourceLabel}">${item.player.overall}</span>
      </div>
      <div>
        <p class="player-name">${escapeHtml(item.player.name)}</p>
        <p class="player-meta">${escapeHtml(item.player.team)} · ${escapeHtml(item.player.position)}</p>
      </div>
      <p class="player-value">${escapeHtml(item.player.marketValueText || formatMoney(item.player.marketValueEur))}</p>
    `;
    return node;
  }

  function renderLineupList(stats) {
    elements.lineupMeta.textContent = `${state.formation} · ${stats.realCount} 真实评分`;
    elements.lineupList.innerHTML = "";
    state.lineup.forEach((item) => {
      const li = document.createElement("li");
      const value = item.player.marketValueText || formatMoney(item.player.marketValueEur);
      const ratingLabel = item.player.overallSource === "fc26" ? "FC26" : "估算";
      li.innerHTML = `
        <span class="mini-position">${escapeHtml(item.slot.label)}</span>
        <div>
          <p class="list-name">${escapeHtml(item.player.name)}</p>
          <p class="list-meta">${escapeHtml(item.player.team)} · ${escapeHtml(item.player.club || "无俱乐部")} · ${escapeHtml(value)}</p>
        </div>
        <span class="list-rating"><strong>${item.player.overall}</strong><span>${ratingLabel}</span></span>
      `;
      elements.lineupList.appendChild(li);
    });
  }

  function renderPoolStats() {
    const source = getFilteredPlayers();
    const groups = groupPlayers(source);
    const realCount = source.filter((player) => player.overallSource === "fc26").length;
    const rows = [
      ["总数", `${source.length} 人`],
      ["真实评分", `${realCount} 人`],
      ["门将", `${(groups.Goalkeeper || []).length} 人`],
      ["后卫", `${(groups.Defender || []).length} 人`],
      ["中场", `${(groups.Midfield || []).length} 人`],
      ["前锋", `${(groups.Attack || []).length} 人`],
    ];
    elements.poolStats.innerHTML = rows
      .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
      .join("");
  }

  function renderEmpty(message) {
    elements.averageOverall.textContent = "--";
    elements.totalValue.textContent = "--";
    elements.luckScore.textContent = "--";
    elements.estimatedCount.textContent = "--";
    elements.pitch.innerHTML = "";
    elements.lineupList.innerHTML = "";
    elements.lineupMeta.textContent = "--";
    elements.statusLine.classList.add("is-error");
    elements.statusLine.textContent = message;
  }

  function calculateStats(lineup) {
    const totalOverall = lineup.reduce((sum, item) => sum + item.player.overall, 0);
    const totalValue = lineup.reduce((sum, item) => sum + item.player.marketValueEur, 0);
    const estimatedCount = lineup.filter((item) => item.player.overallSource === "estimated").length;
    return {
      averageOverall: totalOverall / lineup.length,
      totalValue,
      estimatedCount,
      realCount: lineup.length - estimatedCount,
    };
  }

  function calculateLuck(stats) {
    const cacheKey = `${state.formation}|${state.team}|${state.realOnly ? "real" : "all"}`;
    if (!simulationCache.has(cacheKey)) {
      simulationCache.set(cacheKey, simulateBaseline(cacheKey));
    }
    const baseline = simulationCache.get(cacheKey);
    const abilityPercentile = percentile(baseline.averageOverall, stats.averageOverall);
    const valuePercentile = percentile(baseline.totalValue, stats.totalValue);
    return {
      abilityPercentile,
      valuePercentile,
      score: Math.round(abilityPercentile * 0.55 + valuePercentile * 0.45),
    };
  }

  function simulateBaseline(cacheKey) {
    const source = getFilteredPlayers();
    const rows = formations[state.formation];
    const averageOverall = [];
    const totalValue = [];

    for (let index = 0; index < SIMULATION_COUNT; index += 1) {
      const lineup = drawLineupFromPool(source, rows, `${cacheKey}:sim:${index}`);
      const stats = calculateStats(lineup);
      averageOverall.push(stats.averageOverall);
      totalValue.push(stats.totalValue);
    }

    averageOverall.sort((a, b) => a - b);
    totalValue.sort((a, b) => a - b);
    return { averageOverall, totalValue };
  }

  function percentile(sortedValues, current) {
    let low = 0;
    let high = sortedValues.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (sortedValues[middle] <= current) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return Math.max(1, Math.min(99, Math.round((low / sortedValues.length) * 100)));
  }

  function updateHash() {
    const payload = {
      formation: state.formation,
      team: state.team,
      realOnly: state.realOnly,
      seed: state.seed,
      ids: state.lineup.map((item) => item.player.id),
    };
    const nextHash = `lineup=${encodeState(payload)}`;
    if (window.location.hash.slice(1) !== nextHash) {
      window.history.replaceState(null, "", `${window.location.href.split("#")[0]}#${nextHash}`);
    }
  }

  function parseSharedState() {
    const hash = window.location.hash.slice(1);
    if (!hash.startsWith("lineup=")) {
      return null;
    }
    return decodeState(hash.slice("lineup=".length));
  }

  function applySharedState(sharedState) {
    state.formation = formations[sharedState.formation] ? sharedState.formation : "4-3-3";
    state.team = sharedState.team || "all";
    if (!Array.from(elements.teamSelect.options).some((option) => option.value === state.team)) {
      state.team = "all";
    }
    state.realOnly = Boolean(sharedState.realOnly);
    state.seed = normalizeSeed(sharedState.seed) || createSeed();
    state.lineup = restoreLineup(sharedState.ids || []);
    if (state.lineup.length !== 11) {
      drawNewLineup(false);
    }
  }

  function restoreLineup(ids) {
    const slots = formations[state.formation].flat();
    return ids
      .map((id, index) => {
        const player = playerById.get(String(id));
        if (!player || !slots[index]) {
          return null;
        }
        return {
          slot: slots[index],
          player,
          order: index + 1,
        };
      })
      .filter(Boolean);
  }

  function copyShareLink() {
    updateHash();
    const link = `${window.location.href.split("#")[0]}${window.location.hash}`;
    copyText(link).then(() => {
      const original = elements.copyButton.textContent;
      elements.copyButton.textContent = "已复制";
      window.setTimeout(() => {
        elements.copyButton.textContent = original;
      }, 1400);
    }).catch(() => {
      elements.copyButton.textContent = "复制失败";
      window.setTimeout(() => {
        elements.copyButton.textContent = "复制分享链接";
      }, 1400);
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
    }
    return fallbackCopyText(text);
  }

  function fallbackCopyText(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    return Promise.resolve();
  }

  function createSeed() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function normalizeSeed(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 32);
  }

  function seededRandom(seed) {
    return mulberry32(xmur3(seed)());
  }

  function xmur3(value) {
    let hash = 1779033703 ^ value.length;
    for (let index = 0; index < value.length; index += 1) {
      hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    return function () {
      hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
      hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
      return (hash ^= hash >>> 16) >>> 0;
    };
  }

  function mulberry32(seed) {
    return function () {
      let value = (seed += 0x6d2b79f5);
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function encodeState(payload) {
    const json = JSON.stringify(payload);
    return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodeState(value) {
    try {
      const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
      return JSON.parse(decodeURIComponent(escape(atob(padded))));
    } catch (error) {
      return null;
    }
  }

  function groupLabel(group) {
    return {
      Goalkeeper: "门将",
      Defender: "后卫",
      Midfield: "中场",
      Attack: "前锋",
    }[group] || group;
  }

  function formatMoney(value) {
    if (!value) {
      return "€0";
    }
    if (value >= 1_000_000_000) {
      return `€${(value / 1_000_000_000).toFixed(2)}bn`;
    }
    if (value >= 1_000_000) {
      return `€${(value / 1_000_000).toFixed(2)}m`;
    }
    if (value >= 1_000) {
      return `€${Math.round(value / 1_000)}k`;
    }
    return `€${value}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  init();
})();
