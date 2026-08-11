import { SUPABASE_CONFIG } from "./supabase-config.js";
const ADMIN_NAME = "椰子饭";
const ADMIN_HASH = "$2a$10$M4BT179Phm0a8cV7dKuL4u7VxenUlb.Cxw3Vub84JFULNr7WHStAi";
const NORMAL_PLAYERS = ["殳醋", "梦男哥", "幽灵鱼", "玻璃频"];
const PLAYER_NAMES = [ADMIN_NAME, ...NORMAL_PLAYERS];
const STORAGE_PREFIX = "mini-guess:";
const ADMIN_FAIL_KEY = `${STORAGE_PREFIX}admin-password-failed`;
let supabaseClient = null;

const ACHIEVEMENTS = [
  { id: "a1", title: "人才济济", description: "输入过指定群像字中的至少 3 个。" },
  { id: "a2", title: "欢聚一堂", description: "输入过指定群像字中的所有字。" },
  { id: "a3", title: "金鱼的记忆", description: "重复输入已经猜过的字累计 2 次。" },
  { id: "a4", title: "旗开得胜", description: "第一次猜中字符。" },
  { id: "a5", title: "就是这样！", description: "第一次猜出完整词语。" },
  { id: "a6", title: "僭越", description: "尝试登录椰子饭失败后，又登录回普通玩家账号。" },
  { id: "a7", title: "超爱打小抄", description: "累计第 5 次点击提示。" },
  { id: "a8", title: "循序渐进", description: "猜出 3 个词语。" },
  { id: "a9", title: "刻苦钻研", description: "第一次尝试隐藏挑战。" },
  { id: "a10", title: "竹篮打水", description: "累计猜过 20 个未命中字符。" },
  { id: "a11", title: "领取粉籍", description: "猜过指定粉籍字中的至少 3 个。" },
  { id: "a12", title: "椰子饭", description: "猜过“椰、子、饭”。" },
  { id: "a13", title: "殳醋", description: "猜过“殳、醋”。" },
  { id: "a14", title: "梦男哥", description: "猜过“梦、男、哥”。" },
  { id: "a15", title: "幽灵鱼", description: "猜过“幽、灵、鱼”。" },
  { id: "a16", title: "皮蛋瘦肉粥", description: "猜过“皮、蛋、瘦、肉、粥”。" },
  { id: "a17", title: "萝卜", description: "猜过“萝、卜”。" },
  { id: "a18", title: "海带", description: "猜过“海、带”。" },
  { id: "a19", title: "那个女人", description: "猜过“于、晗”。" },
  { id: "a20", title: "饭心肝", description: "猜过“金、云、鹤”。" },
  { id: "a21", title: "醋心肝", description: "猜过“金、桐、儇”。" },
  { id: "a22", title: "哥心肝", description: "猜过“宋、银、硕”。" },
  { id: "a23", title: "全世界最尊重椰子饭的人", description: "猜出所有普通题词语。" },
  { id: "a24", title: "全世界最闲的人", description: "猜出所有隐藏挑战词语。" },
  { id: "a25", title: "关心同学", description: "第一次点开成就榜。" },
];

const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((item) => [item.id, item]));
const TALENT_CHARS = ["饭", "醋", "哥", "萝", "海", "粥", "面", "鞋", "鱼", "裤"];
const FAN_CHARS = ["椅", "门", "次", "套", "档", "符", "心", "礼", "鲸", "划", "数", "梦", "愿", "吐", "衩", "烤", "地", "兔", "墨", "迷", "得", "盒", "葵", "芙", "吒", "娃", "击", "爻"];
const SET_ACHIEVEMENTS = [
  ["a12", ["椰", "子", "饭"]],
  ["a13", ["殳", "醋"]],
  ["a14", ["梦", "男", "哥"]],
  ["a15", ["幽", "灵", "鱼"]],
  ["a16", ["皮", "蛋", "瘦", "肉", "粥"]],
  ["a17", ["萝", "卜"]],
  ["a18", ["海", "带"]],
  ["a19", ["于", "晗"]],
  ["a20", ["金", "云", "鹤"]],
  ["a21", ["金", "桐", "儇"]],
  ["a22", ["宋", "银", "硕"]],
];

const app = document.querySelector("#app");

const state = {
  questions: [],
  tips: {},
  personal: {},
  hard: [],
  currentUser: null,
  currentMode: "normal",
  currentView: "game",
  cloudReady: false,
  cloudMessage: "",
};

init();

async function init() {
  try {
    const [phrasesText, personalText, hardText, tipText, adminPhrasesText, adminTipText] = await Promise.all([
      fetchText("questions/phrases.txt"),
      fetchText("questions/personal.txt"),
      fetchText("questions/phrases-hard.txt"),
      fetchText("questions/tip.txt"),
      fetchOptionalText("questions/yezifan-phrases.txt"),
      fetchOptionalText("questions/yezifan-tip.txt"),
    ]);

    state.questions = parsePhrases(phrasesText);
    state.personal = parsePersonal(personalText);
    state.hard = parseHard(hardText);
    state.tips = parseTips(tipText);
    state.adminQuestions = adminPhrasesText ? parsePhrases(adminPhrasesText, "yezifan-phrases.txt") : [];
    state.adminTips = adminTipText ? parseTips(adminTipText, "yezifan-tip.txt") : {};
    initCloudSync();

    const savedUser = localStorage.getItem(`${STORAGE_PREFIX}user`);
    if (savedUser && isKnownUser(savedUser)) {
      state.currentUser = savedUser;
      state.currentView = savedUser === ADMIN_NAME ? "admin" : "game";
      await hydrateProgressForUser(savedUser);
      render();
      return;
    }

    renderLogin();
  } catch (error) {
    app.innerHTML = `
      <section class="login-panel">
        <h1>题库读取失败</h1>
        <p class="subtle">请用本地服务器打开页面，或部署到 GitHub Pages 后访问。</p>
        <p class="message">${escapeHtml(error.message)}</p>
      </section>
    `;
  }
}

async function fetchText(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path} 读取失败：${response.status}`);
  }
  return response.text();
}


async function fetchOptionalText(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (response.status === 404) {
    return "";
  }
  if (!response.ok) {
    throw new Error(`${path} 读取失败：${response.status}`);
  }
  return response.text();
}
function initCloudSync() {
  const hasConfig = Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey && SUPABASE_CONFIG.table);
  const hasSdk = Boolean(window.supabase?.createClient);

  if (!hasConfig) {
    state.cloudReady = false;
    state.cloudMessage = "未配置 Supabase，当前使用本地进度。";
    return;
  }

  if (!hasSdk) {
    state.cloudReady = false;
    state.cloudMessage = "Supabase SDK 未加载，当前使用本地进度。";
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  state.cloudReady = true;
  state.cloudMessage = "Supabase 已连接。";
}

async function hydrateProgressForUser(player) {
  if (!state.cloudReady || !PLAYER_NAMES.includes(player)) return;

  const remoteProgress = await fetchRemoteProgress(player);
  if (remoteProgress) {
    persistLocalProgress(player, remoteProgress);
    return;
  }

  const localProgress = loadProgress(player);
  await saveRemoteProgress(player, localProgress);
}

async function hydrateProgressForPlayers(players = PLAYER_NAMES) {
  if (!state.cloudReady) return;

  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_CONFIG.table)
      .select("player_name, progress")
      .in("player_name", players);

    if (error) throw error;

    for (const row of data || []) {
      if (PLAYER_NAMES.includes(row.player_name) && row.progress) {
        persistLocalProgress(row.player_name, row.progress);
      }
    }
  } catch (error) {
    state.cloudMessage = `云端同步失败：${error.message}`;
  }
}

async function fetchRemoteProgress(player) {
  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_CONFIG.table)
      .select("progress")
      .eq("player_name", player)
      .maybeSingle();

    if (error) throw error;
    return data?.progress || null;
  } catch (error) {
    state.cloudMessage = `云端读取失败：${error.message}`;
    return null;
  }
}

async function saveRemoteProgress(player, progress) {
  if (!state.cloudReady || !PLAYER_NAMES.includes(player)) return;

  try {
    const { error } = await supabaseClient
      .from(SUPABASE_CONFIG.table)
      .upsert({
        player_name: player,
        progress,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
  } catch (error) {
    state.cloudMessage = `云端保存失败：${error.message}`;
  }
}

async function deleteRemoteProgress(player) {
  if (!state.cloudReady || !PLAYER_NAMES.includes(player)) return;

  try {
    const { error } = await supabaseClient
      .from(SUPABASE_CONFIG.table)
      .delete()
      .eq("player_name", player);

    if (error) throw error;
  } catch (error) {
    state.cloudMessage = `云端删除失败：${error.message}`;
  }
}

function persistLocalProgress(player, progress) {
  localStorage.setItem(`${STORAGE_PREFIX}progress:${player}`, JSON.stringify(progress));
}

function renderLoadingPanel(message) {
  app.innerHTML = `
    <section class="loading-panel">
      <h1>迷你猜词游戏</h1>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
}

function parsePhrases(text, sourceName = "phrases.txt") {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.+)$/u);
      if (!match) {
        throw new Error(`${sourceName} 格式错误：${line}`);
      }
      return {
        id: Number(match[1]),
        answer: match[2],
      };
    });
}

function parsePersonal(text) {
  const result = {};
  let currentPlayer = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (PLAYER_NAMES.includes(line)) {
      currentPlayer = line;
      result[currentPlayer] = [];
      continue;
    }

    if (!currentPlayer) {
      throw new Error(`personal.txt 缺少玩家名：${line}`);
    }

    const id = Number(line);
    if (!Number.isInteger(id)) {
      throw new Error(`personal.txt 题号错误：${line}`);
    }
    result[currentPlayer].push(id);
  }

  return result;
}

function parseHard(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((answer, index) => ({
      id: `H${index + 1}`,
      answer,
    }));
}

function parseTips(text) {
  const result = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^(\d+)\s+(.+)$/u);
    if (!match) {
      throw new Error(`tip.txt 格式错误：${line}`);
    }
    result[Number(match[1])] = match[2];
  }

  return result;
}

function render() {
  if (state.currentView === "achievements") {
    renderAchievementsBoard();
    return;
  }

  if (state.currentUser === ADMIN_NAME && state.currentView === "admin") {
    renderAdmin();
    return;
  }
  renderGame();
}

function renderLogin() {
  state.currentView = "game";
  app.innerHTML = `
    <section class="login-panel">
      <h1>迷你猜词游戏</h1>
      <p class="subtle">输入你的名字进入游戏。椰子饭需要额外输入管理员密码。</p>
      <form id="login-form">
        <div class="form-row">
          <label for="name">名字</label>
          <input id="name" autocomplete="username" placeholder="殳醋 / 梦男哥 / 幽灵鱼 / 玻璃频 / 椰子饭" />
        </div>
        <div class="form-row" id="password-row" hidden>
          <label for="password">管理员密码</label>
          <input id="password" type="password" autocomplete="current-password" />
        </div>
        <div class="login-actions">
          <button class="primary-button" type="submit">进入</button>
        </div>
        <p class="message" id="login-message"></p>
      </form>
    </section>
  `;

  const form = document.querySelector("#login-form");
  const nameInput = document.querySelector("#name");
  const passwordRow = document.querySelector("#password-row");
  const passwordInput = document.querySelector("#password");
  const message = document.querySelector("#login-message");

  nameInput.addEventListener("input", () => {
    passwordRow.hidden = nameInput.value.trim() !== ADMIN_NAME;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();

    if (!isKnownUser(name)) {
      message.textContent = "没有这个身份。";
      return;
    }

    if (name === ADMIN_NAME) {
      if (!window.dcodeIO?.bcrypt) {
        message.textContent = "密码校验库还没加载成功，请稍后再试。";
        return;
      }
      const ok = await window.dcodeIO.bcrypt.compare(passwordInput.value, ADMIN_HASH);
      if (!ok) {
        localStorage.setItem(ADMIN_FAIL_KEY, "1");
        message.textContent = "管理员密码不正确。";
        return;
      }
    }

    await login(name);
  });
}

function isKnownUser(name) {
  return PLAYER_NAMES.includes(name);
}

async function login(name) {
  state.currentUser = name;
  state.currentView = name === ADMIN_NAME ? "admin" : "game";
  localStorage.setItem(`${STORAGE_PREFIX}user`, name);
  await hydrateProgressForUser(name);

  if (NORMAL_PLAYERS.includes(name) && localStorage.getItem(ADMIN_FAIL_KEY) === "1") {
    const progress = loadProgress(name);
    unlockAchievement(progress, "a6");
    await saveProgress(name, progress);
    localStorage.removeItem(ADMIN_FAIL_KEY);
  }

  if (name === ADMIN_NAME) {
    localStorage.removeItem(ADMIN_FAIL_KEY);
  }

  render();
}

function logout() {
  localStorage.removeItem(`${STORAGE_PREFIX}user`);
  state.currentUser = null;
  state.currentMode = "normal";
  state.currentView = "game";
  renderLogin();
}

function renderGame() {
  const progress = loadProgress(state.currentUser);
  const normalQuestions = getPlayerQuestions(state.currentUser);
  const activeQuestions = state.currentMode === "hard" ? state.hard : normalQuestions;
  const stats = getStats(activeQuestions, progress[state.currentMode]);
  const randomHint = getRandomHintPlan(activeQuestions, progress[state.currentMode]);
  const fanBadge = getFanBadge(progress);

  app.innerHTML = `
    <header class="game-header">
      <div>
        <h1>${escapeHtml(state.currentUser)}</h1>
        <p class="subtle">${state.currentMode === "hard" ? "隐藏挑战题库" : "你的专属题库"}</p>
      </div>
      <div class="top-actions">
        <button class="ghost-button" id="achievement-board-button">成就榜</button>
        ${state.currentUser === ADMIN_NAME ? `<button class="ghost-button" id="admin-panel-button">管理员面板</button>` : ""}
        <button class="ghost-button" id="logout-button">退出登录</button>
      </div>
    </header>

    <section class="game-layout">
      <div class="game-main">
        <div class="tabs">
          <button class="tab-button ${state.currentMode === "normal" ? "active" : ""}" data-mode="normal">普通题</button>
          <button class="tab-button ${state.currentMode === "hard" ? "active" : ""}" data-mode="hard">隐藏挑战</button>
        </div>
        <form class="guess-bar" id="guess-form">
          <input id="guess-input" autocomplete="off" placeholder="输入一个字符，或直接输入完整答案" />
          <button class="primary-button" type="submit">猜</button>
          <button class="hint-button" id="random-hint-button" type="button" ${randomHint.count === 0 ? "disabled" : ""} title="${randomHint.count === 0 ? "只剩最后一个字时不能使用提示" : `随机点亮 ${randomHint.count} 个字`}">提示</button>
        </form>
        <p class="status-line ${progress.lastMessageType === "error" ? "error" : ""}" id="status-line">
          ${escapeHtml(progress.lastMessage || "从一个汉字、英文字母或数字开始。")}
        </p>
        <div class="question-list">
          ${activeQuestions.map((question, index) => renderQuestion(question, index, progress[state.currentMode])).join("")}
        </div>
        ${stats.total > 0 && stats.done === stats.total ? `<p class="win-banner">全部猜完了，你获胜了。</p>` : ""}
      </div>

      <aside class="side-panel">
        <h2>进度</h2>
        ${fanBadge ? `<p class="fan-badge">你的粉籍：${escapeHtml(fanBadge)}</p>` : ""}
        <p class="subtle">${stats.done} / ${stats.total} 已完成</p>
        <div class="progress-meter"><span style="width: ${stats.percent}%"></span></div>
        <h3>已猜字符</h3>
        <div class="tag-list">
          ${progress[state.currentMode].guesses.length ? progress[state.currentMode].guesses.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("") : `<span class="subtle">还没有</span>`}
        </div>
      </aside>
    </section>
  `;

  document.querySelector("#achievement-board-button").addEventListener("click", openAchievementsBoard);
  document.querySelector("#admin-panel-button")?.addEventListener("click", () => {
    state.currentView = "admin";
    renderAdmin();
  });
  document.querySelector("#logout-button").addEventListener("click", logout);
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentMode = button.dataset.mode;
      if (state.currentMode === "hard") {
        const userProgress = loadProgress(state.currentUser);
        unlockAchievement(userProgress, "a9");
        saveProgress(state.currentUser, userProgress);
      }
      renderGame();
    });
  });

  const guessInput = document.querySelector("#guess-input");
  document.querySelector("#guess-form").addEventListener("submit", (event) => {
    event.preventDefault();
    handleGuess(guessInput.value, activeQuestions);
  });
  document.querySelector("#random-hint-button").addEventListener("click", () => {
    applyRandomHint(activeQuestions);
  });
  document.querySelectorAll(".word-hint-button").forEach((button) => {
    button.addEventListener("click", () => {
      revealWordHint(button.dataset.questionId);
    });
  });
  guessInput.focus();
}

function renderQuestion(question, index, modeProgress) {
  const chars = Array.from(question.answer);
  const solved = modeProgress.solved.includes(String(question.id));
  const tip = state.currentMode === "normal" ? getPlayerTips(state.currentUser)[question.id] : "";
  const tipVisible = tip && modeProgress.openTips.includes(String(question.id));

  return `
    <div class="question-row">
      <div class="question-number">${index + 1}.</div>
      <div class="question-content">
        <div class="cells-line">
          <div class="cells" aria-label="第 ${index + 1} 题">
            ${chars.map((char) => renderCell(char, modeProgress.guesses, solved)).join("")}
          </div>
          ${tip ? `<button class="word-hint-button" type="button" data-question-id="${escapeHtml(question.id)}" title="查看这道题的提示" aria-label="查看这道题的提示"></button>` : ""}
        </div>
        ${tipVisible ? `<p class="word-tip">${escapeHtml(tip)}</p>` : ""}
      </div>
    </div>
  `;
}

function renderCell(char, guesses, solved) {
  if (solved || !isGuessable(char) || guesses.some((guess) => sameGuess(guess, char))) {
    return `<span class="cell revealed ${!isGuessable(char) ? "auto" : ""}">${escapeHtml(char)}</span>`;
  }
  return `<span class="cell">?</span>`;
}

function handleGuess(rawValue, questions) {
  const input = rawValue.trim();
  const progress = loadProgress(state.currentUser);
  const modeProgress = progress[state.currentMode];

  if (!input) {
    saveMessage(progress, "请输入内容。", "error");
    return;
  }

  if (Array.from(input).length > 1) {
    const matched = questions.find((question) => {
      return !modeProgress.solved.includes(String(question.id)) && normalizeText(question.answer) === normalizeText(input);
    });

    if (matched) {
      modeProgress.solved.push(String(matched.id));
      evaluateAchievements(progress);
      saveProgress(state.currentUser, progress);
      saveMessage(progress, `完整命中：${matched.answer}`, "success");
      return;
    }

    saveMessage(progress, "多字符输入只有完整匹配某个未完成答案时才算对。", "error");
    return;
  }

  const char = input;
  if (!isGuessable(char)) {
    saveMessage(progress, "请输入一个汉字、英文字母或数字。", "error");
    return;
  }

  if (modeProgress.guesses.some((guess) => sameGuess(guess, char))) {
    progress.stats.duplicateGuesses += 1;
    evaluateAchievements(progress);
    saveMessage(progress, "这个字符已经猜过了。", "error");
    return;
  }

  modeProgress.guesses.push(char);
  rememberFanChar(progress, char);
  const hitCount = questions.reduce((count, question) => {
    return count + Array.from(question.answer).filter((answerChar) => sameGuess(answerChar, char)).length;
  }, 0);

  if (hitCount > 0) {
    progress.stats.hitGuesses += 1;
  } else {
    progress.stats.missGuesses += 1;
  }

  markSolvedQuestions(questions, modeProgress);
  evaluateAchievements(progress);
  saveProgress(state.currentUser, progress);

  if (hitCount > 0) {
    saveMessage(progress, `命中 ${hitCount} 个格子。`, "success");
  } else {
    saveMessage(progress, "没有命中。", "error");
  }
}

function applyRandomHint(questions) {
  const progress = loadProgress(state.currentUser);
  const modeProgress = progress[state.currentMode];
  const plan = getRandomHintPlan(questions, modeProgress);

  if (plan.count === 0) {
    saveMessage(progress, "只剩最后一个字时不能使用提示。", "error");
    return;
  }

  progress.stats.hintClicks += 1;
  const selected = shuffle(plan.remaining).slice(0, plan.count);
  for (const char of selected) {
    if (!modeProgress.guesses.some((guess) => sameGuess(guess, char))) {
      modeProgress.guesses.push(char);
      rememberFanChar(progress, char);
    }
  }

  markSolvedQuestions(questions, modeProgress);
  evaluateAchievements(progress);
  saveProgress(state.currentUser, progress);
  saveMessage(progress, `提示点亮了：${selected.join("、")}`, "success");
}

function getRandomHintPlan(questions, modeProgress) {
  const remaining = getRemainingUniqueChars(questions, modeProgress);

  if (remaining.length <= 1) {
    return { remaining, count: 0 };
  }

  if (remaining.length >= 11) {
    return { remaining, count: 3 };
  }

  if (remaining.length >= 6) {
    return { remaining, count: 2 };
  }

  return { remaining, count: 1 };
}

function getRemainingUniqueChars(questions, modeProgress) {
  const result = [];
  const seen = new Set();

  for (const question of questions) {
    if (modeProgress.solved.includes(String(question.id))) continue;

    for (const char of Array.from(question.answer)) {
      if (!isGuessable(char) || modeProgress.guesses.some((guess) => sameGuess(guess, char))) continue;

      const normalized = normalizeText(char);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push(char);
      }
    }
  }

  return result;
}

function revealWordHint(questionId) {
  const progress = loadProgress(state.currentUser);
  const modeProgress = progress[state.currentMode];

  progress.stats.hintClicks += 1;
  if (!modeProgress.openTips.includes(String(questionId))) {
    modeProgress.openTips.push(String(questionId));
  }

  evaluateAchievements(progress);
  saveProgress(state.currentUser, progress);
  renderGame();
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function markSolvedQuestions(questions, modeProgress) {
  for (const question of questions) {
    const id = String(question.id);
    if (modeProgress.solved.includes(id)) continue;

    const complete = Array.from(question.answer).every((char) => {
      return !isGuessable(char) || modeProgress.guesses.some((guess) => sameGuess(guess, char));
    });

    if (complete) {
      modeProgress.solved.push(id);
    }
  }
}

function getPlayerQuestions(player) {
  const ids = new Set(state.personal[player] || []);
  const source = player === ADMIN_NAME ? state.adminQuestions : state.questions;
  return source.filter((question) => ids.has(question.id));
}

function getPlayerTips(player) {
  return player === ADMIN_NAME ? state.adminTips : state.tips;
}

function getStats(questions, modeProgress) {
  const total = questions.length;
  const done = questions.filter((question) => modeProgress.solved.includes(String(question.id))).length;
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

async function openAchievementsBoard() {
  if (PLAYER_NAMES.includes(state.currentUser)) {
    const progress = loadProgress(state.currentUser);
    unlockAchievement(progress, "a25");
    await saveProgress(state.currentUser, progress);
  }

  state.currentView = "achievements";
  renderLoadingPanel("正在同步成就榜...");
  await hydrateProgressForPlayers();
  renderAchievementsBoard();
}

function renderAchievementsBoard() {
  const cards = PLAYER_NAMES.map((player) => {
    const progress = loadProgress(player);
    const unlocked = ACHIEVEMENTS.filter((achievement) => progress.achievements[achievement.id]);
    const badge = getFanBadge(progress);

    return `
      <article class="achievement-player-card ${player === state.currentUser ? "current" : ""}">
        <div class="achievement-player-head">
          <h2>${escapeHtml(player)}</h2>
          <span>${unlocked.length} / ${ACHIEVEMENTS.length}</span>
        </div>
        ${badge ? `<p class="fan-badge compact">粉籍：${escapeHtml(badge)}</p>` : ""}
        <div class="achievement-list">
          ${unlocked.length ? unlocked.map((achievement) => renderAchievementItem(achievement, progress, player === state.currentUser)).join("") : `<p class="empty-achievements">暂时还没有达成成就。</p>`}
        </div>
      </article>
    `;
  }).join("");

  app.innerHTML = `
    <header class="game-header">
      <div>
        <h1>成就榜</h1>
        <p class="subtle">${state.cloudReady ? "成就榜已尝试从 Supabase 同步。" : "当前使用本地成就榜。"}</p>
      </div>
      <div class="top-actions">
        <button class="ghost-button" id="back-button">返回</button>
        <button class="ghost-button" id="logout-button">退出登录</button>
      </div>
    </header>
    <section class="achievement-board">${cards}</section>
  `;

  document.querySelector("#back-button").addEventListener("click", () => {
    state.currentView = "game";
    render();
  });
  document.querySelector("#logout-button").addEventListener("click", logout);
}

function renderAchievementItem(achievement, progress, canShowDescription) {
  const fanText = achievement.id === "a11" && getFanBadge(progress) ? `你的粉籍：${escapeHtml(getFanBadge(progress))}` : "";
  const detail = canShowDescription ? `<p>${escapeHtml(achievement.description)}${fanText ? `<br />${fanText}` : ""}</p>` : "";

  return `
    <div class="achievement-item unlocked compact-achievement">
      <div>
        <strong>${escapeHtml(achievement.title)}</strong>
        ${detail}
      </div>
      <span>已达成</span>
    </div>
  `;
}

function evaluateAchievements(progress) {
  const guessed = getAllGuessedChars(progress);
  const normalQuestions = getPlayerQuestions(state.currentUser);
  const normalStats = getStats(normalQuestions, progress.normal);
  const hardStats = getStats(state.hard, progress.hard);
  const solvedTotal = progress.normal.solved.length + progress.hard.solved.length;

  if (countMatches(guessed, TALENT_CHARS) >= 3) unlockAchievement(progress, "a1");
  if (countMatches(guessed, TALENT_CHARS) === TALENT_CHARS.length) unlockAchievement(progress, "a2");
  if (progress.stats.duplicateGuesses >= 2) unlockAchievement(progress, "a3");
  if (progress.stats.hitGuesses >= 1) unlockAchievement(progress, "a4");
  if (solvedTotal >= 1) unlockAchievement(progress, "a5");
  if (progress.stats.hintClicks >= 5) unlockAchievement(progress, "a7");
  if (solvedTotal >= 3) unlockAchievement(progress, "a8");
  if (progress.stats.missGuesses >= 20) unlockAchievement(progress, "a10");
  if (countMatches(guessed, FAN_CHARS) >= 3) unlockAchievement(progress, "a11");

  for (const [id, chars] of SET_ACHIEVEMENTS) {
    if (hasAllChars(guessed, chars)) unlockAchievement(progress, id);
  }

  if (normalStats.total > 0 && normalStats.done === normalStats.total) unlockAchievement(progress, "a23");
  if (hardStats.total > 0 && hardStats.done === hardStats.total) unlockAchievement(progress, "a24");
}

function unlockAchievement(progress, achievementId) {
  if (progress.achievements[achievementId]) return false;

  progress.achievements[achievementId] = Date.now();
  showAchievementToast(ACHIEVEMENT_BY_ID[achievementId]);
  return true;
}

function showAchievementToast(achievement) {
  if (!achievement) return;

  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const toast = document.createElement("div");
  toast.className = "achievement-toast";
  toast.innerHTML = `<span>成就达成</span><strong>${escapeHtml(achievement.title)}</strong>`;
  stack.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("leaving");
    window.setTimeout(() => toast.remove(), 280);
  }, 3200);
}

function getAllGuessedChars(progress) {
  return [...progress.normal.guesses, ...progress.hard.guesses];
}

function countMatches(guessed, required) {
  return required.filter((char) => guessed.some((guess) => sameGuess(guess, char))).length;
}

function hasAllChars(guessed, required) {
  return countMatches(guessed, required) === required.length;
}

function rememberFanChar(progress, char) {
  if (progress.stats.firstFanChar) return;
  const matched = FAN_CHARS.find((fanChar) => sameGuess(fanChar, char));
  if (matched) {
    progress.stats.firstFanChar = matched;
  }
}

function getFanBadge(progress) {
  if (!progress.achievements.a11) return "";
  return progress.stats.firstFanChar || "?";
}

function createModeProgress() {
  return { guesses: [], solved: [], openTips: [] };
}

function createStats() {
  return {
    duplicateGuesses: 0,
    hitGuesses: 0,
    missGuesses: 0,
    hintClicks: 0,
    firstFanChar: "",
  };
}

function loadProgress(player) {
  const fallback = {
    normal: createModeProgress(),
    hard: createModeProgress(),
    achievements: {},
    stats: createStats(),
    lastMessage: "",
    lastMessageType: "success",
  };

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}progress:${player}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
      normal: { ...fallback.normal, ...parsed.normal },
      hard: { ...fallback.hard, ...parsed.hard },
      achievements: { ...fallback.achievements, ...parsed.achievements },
      stats: { ...fallback.stats, ...parsed.stats },
    };
  } catch {
    return fallback;
  }
}

function saveProgress(player, progress) {
  progress.updatedAt = new Date().toISOString();
  persistLocalProgress(player, progress);
  return saveRemoteProgress(player, progress);
}

function saveMessage(progress, message, type) {
  progress.lastMessage = message;
  progress.lastMessageType = type;
  saveProgress(state.currentUser, progress);
  renderGame();
}

function renderAdmin() {
  const cards = PLAYER_NAMES.map((player) => {
    const progress = loadProgress(player);
    const normalQuestions = getPlayerQuestions(player);
    const normalStats = getStats(normalQuestions, progress.normal);
    const hardStats = getStats(state.hard, progress.hard);
    const achievementCount = Object.keys(progress.achievements).length;

    return `
      <article class="admin-card">
        <div class="admin-card-head">
          <h2>${escapeHtml(player)}</h2>
          <button class="danger-button reset-progress-button" type="button" data-player="${escapeHtml(player)}">清空进度</button>
        </div>
        <p class="subtle">普通题：${normalStats.done} / ${normalStats.total}，隐藏挑战：${hardStats.done} / ${hardStats.total}，成就：${achievementCount} / ${ACHIEVEMENTS.length}</p>
        <div class="progress-meter"><span style="width: ${normalStats.percent}%"></span></div>
        <div class="admin-detail">
          普通题已猜：${progress.normal.guesses.length ? progress.normal.guesses.map(escapeHtml).join("、") : "无"}<br />
          隐藏挑战已猜：${progress.hard.guesses.length ? progress.hard.guesses.map(escapeHtml).join("、") : "无"}
        </div>
      </article>
    `;
  }).join("");

  app.innerHTML = `
    <header class="game-header">
      <div>
        <h1>椰子饭</h1>
        <p class="subtle">管理员视图会读取当前浏览器里保存的玩家进度。</p>
      </div>
      <div class="top-actions">
        <button class="ghost-button" id="achievement-board-button">成就榜</button>
        <button class="ghost-button" id="admin-game-button">我的答题区</button>
        <button class="ghost-button" id="logout-button">退出登录</button>
      </div>
    </header>
    <section class="admin-grid">${cards}</section>
  `;

  document.querySelector("#achievement-board-button").addEventListener("click", openAchievementsBoard);
  document.querySelector("#admin-game-button").addEventListener("click", () => {
    state.currentView = "game";
    renderGame();
  });
  document.querySelector("#logout-button").addEventListener("click", logout);
  document.querySelectorAll(".reset-progress-button").forEach((button) => {
    button.addEventListener("click", () => {
      resetPlayerProgress(button.dataset.player);
    });
  });
}

async function resetPlayerProgress(player) {
  if (!PLAYER_NAMES.includes(player)) return;

  const confirmed = window.confirm(`确定要清空 ${player} 的当前答题进度吗？`);
  if (!confirmed) return;

  localStorage.removeItem(`${STORAGE_PREFIX}progress:${player}`);
  await deleteRemoteProgress(player);
  renderAdmin();
}

function isGuessable(char) {
  return /^[\p{L}\p{N}]$/u.test(char);
}

function sameGuess(left, right) {
  return normalizeText(left) === normalizeText(right);
}

function normalizeText(value) {
  return value.toLocaleLowerCase("en-US");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}










