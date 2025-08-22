//起動までめちゃくちゃ時間がかかる

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useFirestore } from '../composables/useFirestore';

// Firestore ロジックは composable に委譲
let db; // 互換性のため残すが、直接は使わない

// 選択肢（編集可能にするためref）
const options = ref(['A案', 'B案', 'C案']);

// 投票を保存する先（pollIdで投票ルームを分けられる）
const pollId = 'default';

// テーマ（同じルーム内で複数トピックを切り替え）
const currentTheme = ref('main');
const newThemeName = ref('main');

// Firestore 関連は composable に委譲
const {
  votes,
  connectRealtime,
  disconnectRealtime,
  addVote,
  loadOptionsConfig,
  saveOptionsConfig,
  resetVotes: resetVotesFirestore,
  ensureFirestoreLite,
  isRealtimeConnected,
  connectingRealtime,
  realtimeError,
  isPollingFallback,
} = useFirestore(pollId, currentTheme);

// 開発用: 一人一票の制限を外す（true なら複数投票可）
const allowMultiVote = true;

// 投票済みフラグ（一人一票時に使用）
const hasVoted = ref(false);

// 力をためる処理
const charging = ref(false);
const chargeValue = ref(0);
const chargeStart = ref(0);
const chargeMax = 3000; // 最大3000ms（3秒）
const selectedIdx = ref(null);
// アニメーション用（集合点モデル）
const containerRef = ref(null); // 外枠（vote-area）
const stageRef = ref(null); // 集合ステージ（cluster-stage）
const spotRefs = ref([]); // 各選択肢の集合点参照
// 表示用: vote-area基準のカーソル位置（エフェクト描画に使用）
const lastPointerOverlay = ref({ x: 0, y: 0 });
// スポーン用: 直近のクライアント座標（stage基準に変換するために保持）
const lastClient = ref({ x: 0, y: 0 });
// 押下中の粒子エフェクトとプレビュー用チャージボール
const particles = ref([]); // {id,x,y,vx,vy,life,size}
let particleAcc = 0;
let lastTimeMs = performance.now();
const chargeSpawn = ref({ x: 0, y: 0 }); // ステージ基準のプレビュー位置

function flightDuration(power) {
  const t = Math.max(0, Math.min(1, power / chargeMax));
  // 強い力ほど速く（短く）飛ぶ: 0.7s -> 0.2s
  return 0.2 + (0.7 - 0.2) * (1 - t);
}

// 疑似物理: 各選択肢のボール群を2Dで吸引・分離
// ステージのサイズ（境界に使用）
const stageSize = ref({ w: 700, h: 240 });
const ATTRACT = 0.035;
const DAMPING = 0.92;
const REPULSE = 0.08;
const PADDING = 2;
// ボール半径の見た目調整（差を圧縮）
const R_MIN = 14; // 最小半径
const R_MAX = 34; // 最大半径（差分は 20）
function calcRadius(power) {
  const t = Math.max(0, Math.min(1, power / chargeMax));
  const eased = Math.sqrt(t); // 差を圧縮（0.5乗）
  return R_MIN + (R_MAX - R_MIN) * eased;
}
const physicsBalls = ref(options.value.map(() => []));
const pendingSpawns = ref(options.value.map(() => [])); // 票追加時の初期位置バッファ [{x,y}]
const centers = ref(options.value.map(() => ({ x: 0, y: 0 })));
const defaultPalette = ['#ef5350','#42a5f5','#66bb6a','#ffb300','#ab47bc','#26a69a','#8d6e63','#26c6da'];
const optionColors = ref(options.value.map((_, i) => defaultPalette[i % defaultPalette.length]));
// ユーザーが指定できるボール色（デフォルト）
const ballColor = ref('#26a69a');

// 背景色に対して読みやすい文字色（黒/白）を返す
function contrastTextColor(hex) {
  try {
    const h = (hex || '').replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    // 相対輝度の近似（単純な明度判定）
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 140 ? '#000' : '#fff';
  } catch (_) {
    return '#fff';
  }
}

function ensurePhysicsShape() {
  // options 変更時の形合わせ
  if (physicsBalls.value.length !== options.value.length) {
    physicsBalls.value = options.value.map(() => []);
  }
  if (pendingSpawns.value.length !== options.value.length) {
    pendingSpawns.value = options.value.map(() => []);
  }
  if (centers.value.length !== options.value.length) {
    centers.value = options.value.map(() => ({ x: 0, y: 0 }));
  }
}

function syncPhysicsWithVotes() {
  ensurePhysicsShape();
  for (let idx = 0; idx < options.value.length; idx++) {
    const targetCount = votes.value[idx]?.length || 0;
    const arr = physicsBalls.value[idx];
    const visibleTarget = Math.max(0, targetCount);
    // 追加（初期位置は pendingSpawn があればそれ、なければ集合点近傍）
    while (arr.length < visibleTarget) {
      const i = arr.length; // 新規のインデックス
      const v = votes.value[idx][i];
      const power = (v && typeof v === 'object') ? v.power : v;
      const color = (v && typeof v === 'object') ? v.color : null;
      const r = calcRadius(power);
      const spawn = pendingSpawns.value[idx]?.shift() || null;
      const cx = centers.value[idx]?.x ?? stageSize.value.w / 2;
      const cy = centers.value[idx]?.y ?? stageSize.value.h / 2;
      const sx = spawn?.x ?? (cx + (Math.random() - 0.5) * 12);
      const sy = spawn?.y ?? (cy + (Math.random() - 0.5) * 12);
      const svx = spawn?.vx ?? 0;
      const svy = spawn?.vy ?? 0;
      arr.push({ x: sx, y: sy, vx: svx, vy: svy, r, color });
    }
    // 削除
    while (arr.length > visibleTarget) arr.pop();
  }
}

let rafId = 0;
function stepPhysics() {
  // dt を計算（粒子用）
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastTimeMs) / 1000);
  lastTimeMs = now;
  // 粒子の生成（押下中のみ）
  if (charging.value) {
    const t = Math.max(0, Math.min(1, chargeValue.value / chargeMax));
    const rate = 20 + 120 * t; // 1秒あたりの生成数
    particleAcc += rate * dt;
    let spawnCount = Math.floor(particleAcc);
    particleAcc -= spawnCount;
    // 上限保護
    if (particles.value.length > 220) spawnCount = 0;
    while (spawnCount-- > 0) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.8 + 4.2 * t + Math.random() * 0.6; // px/フレーム相当
      const size = 4 + Math.random() * 6;
      particles.value.push({
        id: now + Math.random(),
        x: lastPointerOverlay.value.x,
        y: lastPointerOverlay.value.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 1,
        size,
      });
    }
  }
  // 粒子の更新と減衰
  if (particles.value.length) {
    for (let i = particles.value.length - 1; i >= 0; i--) {
      const p = particles.value[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.985; p.vy *= 0.985;
      p.life -= dt * 1.6;
      if (p.life <= 0) particles.value.splice(i, 1);
    }
  }
  const w = stageSize.value.w;
  const h = stageSize.value.h;
  for (let idx = 0; idx < physicsBalls.value.length; idx++) {
    const arr = physicsBalls.value[idx];
    const cx = centers.value[idx]?.x ?? w / 2;
    const cy = centers.value[idx]?.y ?? h / 2;
    // 吸引
    for (let b of arr) {
      b.vx += (cx - b.x) * ATTRACT;
      b.vy += (cy - b.y) * ATTRACT;
    }
    // 分離（単純なペア処理）
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const bi = arr[i], bj = arr[j];
        let dx = bj.x - bi.x;
        let dy = bj.y - bi.y;
        let dist = Math.hypot(dx, dy) || 0.0001;
        const minD = bi.r + bj.r + PADDING;
        if (dist < minD) {
          const overlap = (minD - dist);
          const nx = dx / dist, ny = dy / dist;
          const push = REPULSE * overlap;
          bi.vx -= nx * push;
          bi.vy -= ny * push;
          bj.vx += nx * push;
          bj.vy += ny * push;
        }
      }
    }
    // 速度減衰と位置更新、境界
    for (let b of arr) {
      b.vx *= DAMPING;
      b.vy *= DAMPING;
      b.x += b.vx;
      b.y += b.vy;
      // 境界
      if (b.x < b.r) { b.x = b.r; b.vx *= -0.5; }
      if (b.x > w - b.r) { b.x = w - b.r; b.vx *= -0.5; }
      if (b.y < b.r) { b.y = b.r; b.vy *= -0.5; }
      if (b.y > h - b.r) { b.y = h - b.r; b.vy *= -0.5; }
    }
  }
  rafId = requestAnimationFrame(stepPhysics);
}

// 投票ボタン長押し開始
const startCharge = (idx, evt) => {
  if (!allowMultiVote && hasVoted.value) return;
  charging.value = true;
  chargeValue.value = 0;
  chargeStart.value = Date.now();
  selectedIdx.value = idx;
  // 発射開始位置（コンテナ基準）を記録
  try {
    const cont = containerRef.value?.getBoundingClientRect();
    const e = evt || window.event;
    const ex = e?.clientX ?? (e?.pageX ?? 0);
    const ey = e?.clientY ?? (e?.pageY ?? 0);
    lastClient.value = { x: ex, y: ey };
    if (cont) {
      lastPointerOverlay.value = { x: ex - cont.left, y: ey - cont.top };
    }
  } catch (_) {}
  // 初回のプレビュー位置も更新
  updateChargePreview();
  chargeTick();
};

function onPointerMove(evt) {
  if (!charging.value) return;
  try {
  const c = containerRef.value?.getBoundingClientRect();
    const e = evt || window.event;
    const ex = e?.clientX ?? (e?.pageX ?? 0);
    const ey = e?.clientY ?? (e?.pageY ?? 0);
  lastClient.value = { x: ex, y: ey };
  if (c) lastPointerOverlay.value = { x: ex - c.left, y: ey - c.top };
  } catch (_) {}
  updateChargePreview();
}

// 力をためるループ
function chargeTick() {
  if (!charging.value) return;
  const now = Date.now();
  let val = now - chargeStart.value;
  if (val > chargeMax) val = chargeMax;
  chargeValue.value = val;
  updateChargePreview();
  if (val < chargeMax) {
    requestAnimationFrame(chargeTick);
  }
}

// 投票ボタン離す（サーバーに送信）
const endCharge = async () => {
  if (!charging.value || selectedIdx.value === null) return;
  charging.value = false;
  const power = chargeValue.value;
  const idx = selectedIdx.value;
  // 集合点モデルではオーバーレイ飛翔は行わない
  try {
  // Firestore へ投票を書き込む（composable 経由）
  await addVote(idx, power, ballColor.value);
    // 票に対応するボールの初期位置（stage基準）と初速を算出
    const spawn = computeSpawnForVote(idx, power);
    if (spawn) pendingSpawns.value[idx].push(spawn);
  // リアルタイム接続の有無に関係なく、即ローカル票に追加して視覚的連続性を確保
  // ローカルにオブジェクトで即時表示（互換性のため number も許容）
  votes.value[idx].push({ power, color: ballColor.value });
  nextTick().then(syncPhysicsWithVotes);
    // 一人一票（ローカルに記録）※開発時は無効
    if (!allowMultiVote) {
      localStorage.setItem(`kaede_vote_voted_${pollId}`, '1');
      hasVoted.value = true;
    }
  } catch (e) {
    console.error('投票の送信に失敗しました', e);
  } finally {
    selectedIdx.value = null;
    chargeValue.value = 0;
  }
};

// Firestore の購読・接続ロジックは composable に委譲されています

// 起動時はローカル状態のみ（Firebaseは未接続）
onMounted(async () => {
  hasVoted.value = !allowMultiVote && localStorage.getItem(`kaede_vote_voted_${pollId}`) === '1';
  // ボール色の復元
  try {
    const saved = localStorage.getItem('kaede_ball_color');
    if (saved) ballColor.value = saved;
  const savedTheme = localStorage.getItem('kaede_current_theme');
  if (savedTheme) { currentTheme.value = savedTheme; newThemeName.value = savedTheme; }
  } catch (_) {}
  // 物理ループ開始
  rafId = requestAnimationFrame(stepPhysics);
  // 初回のセンター計測
  nextTick().then(updateCenters);
  window.addEventListener('resize', onResize);

  // 初回ロード: Firestore に保存された選択肢があれば適用する
  try {
    const cfg = await loadOptionsConfig();
    if (cfg && Array.isArray(cfg.options) && cfg.options.length > 0) {
      // 選択肢・色を上書き（投票データはリアルタイム購読で取得されるためここでは票を消さない）
      options.value = cfg.options;
      optionColors.value = fillColorsToLength(cfg.optionColors || [], options.value.length);
      editableOptionsText.value = options.value.join('\n');
      // 物理配列長を合わせる
      votes.value = options.value.map(() => []);
      physicsBalls.value = options.value.map(() => []);
      pendingSpawns.value = options.value.map(() => []);
      centers.value = options.value.map(() => ({ x: 0, y: 0 }));
      // 再計測して見た目を整える
      await nextTick();
      updateCenters();
    }
  } catch (e) {
    console.error('初期設定の読み込みに失敗しました', e);
  }
});

onUnmounted(() => {
  // composable による接続解除
  disconnectRealtime();
  if (rafId) cancelAnimationFrame(rafId);
  window.removeEventListener('resize', onResize);
});

// optionsやDOM参照が変わったら中心を再計測
watch(options, () => nextTick().then(updateCenters));
watch(stageRef, () => nextTick().then(updateCenters));
watch(spotRefs, () => nextTick().then(updateCenters), { deep: true });
// ボール色の保存
watch(ballColor, (c) => {
  try { localStorage.setItem('kaede_ball_color', c); } catch (_) {}
});
// テーマ変更時の処理
watch(currentTheme, async (t, prev) => {
  try { localStorage.setItem('kaede_current_theme', t || 'main'); } catch (_) {}
  // composable の参照を更新する（内部で参照を監視しているためここではロードのみ行う）
  // 設定読み込み：保存された選択肢があれば適用（票データは composable で取得される）
  const wasRealtime = isRealtimeConnected.value;
  try {
    const cfg = await loadOptionsConfig();
    if (cfg && Array.isArray(cfg.options) && cfg.options.length > 0) {
      options.value = cfg.options;
      optionColors.value = fillColorsToLength(cfg.optionColors || [], options.value.length);
      editableOptionsText.value = options.value.join('\n');
    }
  } catch (e) {
    console.error('テーマ切替時の設定読み込みに失敗しました', e);
  }
  // 状態クリア（選択肢に合わせて配列長を揃える）
  votes.value = options.value.map(() => []);
  physicsBalls.value = options.value.map(() => []);
  pendingSpawns.value = options.value.map(() => []);
  centers.value = options.value.map(() => ({ x: 0, y: 0 }));
  if (wasRealtime) connectRealtime();
});

// コメント機能
const userMsg = ref('');
const userMsgs = ref([]);
const addUserMessage = () => {
  if (userMsg.value) {
    const date = new Date();
    const nowTime = date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
    userMsgs.value.unshift(nowTime + ' ' + userMsg.value);
    userMsg.value = '';
  }
};

// 管理: 選択肢編集と投票リセット
const editableOptionsText = ref(options.value.join('\n'));
const resetting = ref(false);
const savingOptions = ref(false);

const resetVotes = async () => {
  resetting.value = true;
  try {
    await resetVotesFirestore();
    votes.value = options.value.map(() => []);
    physicsBalls.value = options.value.map(() => []);
    if (!allowMultiVote) {
      localStorage.removeItem(`kaede_vote_voted_${pollId}`);
      hasVoted.value = false;
    }
  } catch (e) {
    console.error('リセットに失敗しました', e);
  } finally {
    resetting.value = false;
  }
};

const applyOptionsAndReset = async () => {
  const lines = editableOptionsText.value
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (lines.length === 0) return;
  options.value = lines;
  // optionColors の長さを合わせる
  optionColors.value = fillColorsToLength(optionColors.value, options.value.length);
  votes.value = options.value.map(() => []);
  physicsBalls.value = options.value.map(() => []);
  pendingSpawns.value = options.value.map(() => []);
  centers.value = options.value.map(() => ({ x: 0, y: 0 }));
  // Firestoreへオプションと色を保存し、票はリセット（composable 経由）
  await saveOptionsConfig(options.value, optionColors.value);
  await resetVotesFirestore();
};

function defaultColor(i) {
  return defaultPalette[i % defaultPalette.length];
}

function fillColorsToLength(colors, len) {
  const out = new Array(len);
  for (let i = 0; i < len; i++) out[i] = colors?.[i] || defaultColor(i);
  return out;
}

// 色を暗めにして枠線色にする（単純にRGBを係数で縮小）
function darkenHex(hex, amount = 0.2) {
  try {
    const h = (hex || '').replace('#', '');
    const r = Math.max(0, Math.min(255, Math.floor(parseInt(h.substring(0,2),16) * (1 - amount))));
    const g = Math.max(0, Math.min(255, Math.floor(parseInt(h.substring(2,4),16) * (1 - amount))));
    const b = Math.max(0, Math.min(255, Math.floor(parseInt(h.substring(4,6),16) * (1 - amount))));
    return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
  } catch (_) { return hex || '#000'; }
}

// saveOptionsConfig/loadOptionsConfig/saveOptionColors は composable を使用する

function updateCenters() {
  try {
    const st = stageRef.value?.getBoundingClientRect();
    if (!st) return;
    stageSize.value = { w: st.width, h: st.height };
    centers.value = options.value.map((_, idx) => {
      const el = spotRefs.value[idx];
      if (!el) return { x: stageSize.value.w / 2, y: stageSize.value.h / 2 };
      const r = el.getBoundingClientRect();
      return { x: r.left - st.left + r.width / 2, y: r.top - st.top + r.height / 2 };
    });
  if (charging.value) updateChargePreview();
  } catch (_) {}
}

function onResize() { updateCenters(); }

function updateChargePreview() {
  if (!charging.value || selectedIdx.value === null) return;
  const spawn = computeSpawnForVote(selectedIdx.value, chargeValue.value);
  if (spawn) chargeSpawn.value = { x: spawn.x, y: spawn.y };
}

// 押下位置（client座標）→集合点中心へ向かう線とステージ矩形の交点を初期位置にし、力に応じた初速を付与
function computeSpawnForVote(idx, power) {
  try {
    const st = stageRef.value?.getBoundingClientRect();
    if (!st) return null;
    const w = st.width, h = st.height;
    const p0x = lastClient.value.x, p0y = lastClient.value.y;
    const ctr = centers.value[idx] || { x: w / 2, y: h / 2 };
    const p1x = st.left + ctr.x, p1y = st.top + ctr.y;
    const dx = p1x - p0x, dy = p1y - p0y;
    if (dx === 0 && dy === 0) {
      return { x: ctr.x, y: ctr.y, vx: 0, vy: 0 };
    }
    const candidates = [];
    // 左右
    if (dx !== 0) {
      let t = (st.left - p0x) / dx; // 左
      let y = p0y + t * dy;
      if (t >= 0 && t <= 1 && y >= st.top && y <= st.bottom) candidates.push({ t, x: st.left, y });
      t = (st.right - p0x) / dx; // 右
      y = p0y + t * dy;
      if (t >= 0 && t <= 1 && y >= st.top && y <= st.bottom) candidates.push({ t, x: st.right, y });
    }
    // 上下
    if (dy !== 0) {
      let t = (st.top - p0y) / dy; // 上
      let x = p0x + t * dx;
      if (t >= 0 && t <= 1 && x >= st.left && x <= st.right) candidates.push({ t, x, y: st.top });
      t = (st.bottom - p0y) / dy; // 下
      x = p0x + t * dx;
      if (t >= 0 && t <= 1 && x >= st.left && x <= st.right) candidates.push({ t, x, y: st.bottom });
    }
    let spawnClient;
    const inside = p0x >= st.left && p0x <= st.right && p0y >= st.top && p0y <= st.bottom;
    if (inside) {
      spawnClient = { x: p0x, y: p0y };
    } else if (candidates.length) {
      candidates.sort((a, b) => a.t - b.t);
      spawnClient = { x: candidates[0].x, y: candidates[0].y };
    } else {
      // フォールバック: ステージ中心
      spawnClient = { x: st.left + w / 2, y: st.top + h / 2 };
    }
    // ステージ内側へ少しオフセット
    const dirx = (p1x - spawnClient.x);
    const diry = (p1y - spawnClient.y);
    const dlen = Math.hypot(dirx, diry) || 1;
    const inward = 6; // 内側へ6px
    const sx = spawnClient.x + (dirx / dlen) * inward;
    const sy = spawnClient.y + (diry / dlen) * inward;
    // 初速（力に応じて加速）
    const t = Math.max(0, Math.min(1, power / chargeMax));
    const speed = 4 + 12 * t; // px/フレーム相当
    const vx = (dirx / dlen) * speed;
    const vy = (diry / dlen) * speed;
    return { x: sx - st.left, y: sy - st.top, vx, vy };
  } catch (_) {
    return null;
  }
}
</script>

<template>
  <div class="vote-area" ref="containerRef">
    <h2>力をためて投票ツール（Mentimeter風・リアルタイム）</h2>
    <div class="realtime-toggle">
  <button v-if="!isRealtimeConnected && !connectingRealtime" @click="connectRealtime">リアルタイム受信を開始</button>
  <span v-if="connectingRealtime" class="connecting">接続中...</span>
  <span v-else-if="isRealtimeConnected" class="connected">リアルタイム受信中</span>
  <span v-if="realtimeError" class="rt-error">{{ realtimeError }}</span>
  <span v-if="isPollingFallback" class="fallback">（フォールバック更新中）</span>
    </div>
    <!-- テーマ切り替え -->
    <div class="theme-switcher">
      <span>テーマ: </span>
      <strong>{{ currentTheme }}</strong>
      <input type="text" v-model="newThemeName" placeholder="テーマ名" />
      <button @click="currentTheme = (newThemeName || 'main').trim()">切り替え</button>
    </div>
    <div class="options">
      <label v-for="(opt, idx) in options" :key="opt + '-' + idx">
        <button
          :disabled="!allowMultiVote && hasVoted"
          @mousedown="startCharge(idx, $event)"
          @touchstart.prevent="startCharge(idx, $event.touches?.[0] || $event)"
          @mouseup="endCharge"
          @mouseleave="endCharge"
          @touchend.prevent="endCharge"
          @mousemove="onPointerMove"
          @touchmove.prevent="onPointerMove($event.touches?.[0] || $event)"
          :style="{
            background: (!allowMultiVote && hasVoted) ? '#bdbdbd' : (optionColors[idx] || '#009688'),
            color: (!allowMultiVote && hasVoted) ? '#fff' : contrastTextColor(optionColors[idx] || '#009688')
          }"
        >
          {{ opt }}に力をためて投票！
        </button>
        <span v-if="!allowMultiVote && hasVoted">（投票済み）</span>
        <span v-else class="dev-badge">開発用: 複数投票可</span>
      </label>
    </div>
    <div v-if="charging" class="charge-bar">
      <div class="charge-label">力をためています... {{ Math.round(chargeValue / 1000 * 100) / 100 }}秒</div>
      <div class="charge-visual">
        <div class="charge-effect" :style="{ width: (chargeValue/chargeMax*100)+'%', background: '#009688' }"></div>
      </div>
    </div>
    <!-- ボール色の設定（常時表示） -->
    <div class="color-picker">
      <label>ボールの色: <input type="color" v-model="ballColor" /></label>
      <span class="hex">{{ ballColor }}</span>
    </div>
    <hr />
    <div class="ball-results">
      <h3>投票結果</h3>
      <!-- 集合ステージ：一枚キャンバス上に複数の集合点（スポット）を配置 -->
      <div class="cluster-stage" ref="stageRef" @mousemove="onPointerMove" @touchmove.prevent="onPointerMove($event.touches?.[0] || $event)">
        <!-- 集合スポット（各選択肢の中心） -->
        <div v-for="(opt, idx) in options" :key="'spot-' + idx" class="spot" :ref="el => (spotRefs[idx] = el)" :style="{ borderColor: optionColors[idx] || defaultPalette[idx % defaultPalette.length] }">
          <div class="spot-center" :style="{ background: optionColors[idx] || defaultPalette[idx % defaultPalette.length] }"></div>
          <div class="option-label">{{ opt }}</div>
          <div class="ball-count">{{ (votes[idx]?.length) || 0 }}票</div>
        </div>
        <!-- 集合中のボール群 -->
        <div v-for="(opt, idx) in options" :key="'balls-' + idx">
          <div
            v-for="(b, bi) in physicsBalls[idx]"
            :key="bi"
            class="cluster-ball"
            :style="{ left: b.x + 'px', top: b.y + 'px', width: (b.r*2) + 'px', height: (b.r*2) + 'px', backgroundColor: (b.color || ballColor), border: '3px solid ' + darkenHex(optionColors[idx] || defaultPalette[idx % defaultPalette.length], 0.22), boxShadow: '0 1px 3px rgba(0,0,0,0.15)'}"
          ></div>
          <!-- 押下中のプレビュー（ステージ基準の位置で表示） -->
          <div
            v-if="charging && selectedIdx === idx"
            class="cluster-ball"
            :style="{
              left: chargeSpawn.x + 'px',
              top: chargeSpawn.y + 'px',
              width: (calcRadius(chargeValue) * 2) + 'px',
              height: (calcRadius(chargeValue) * 2) + 'px',
              opacity: 0.5,
              backgroundColor: ballColor,
              border: '3px solid ' + darkenHex(optionColors[idx] || defaultPalette[idx % defaultPalette.length], 0.22)
            }"
          ></div>
        </div>
      </div>
    </div>
  <!-- オーバーレイ（粒子のみ保持／vote-area基準） -->
  <div class="flying-layer">
      <!-- 粒子 -->
      <div
        v-for="p in particles"
        :key="p.id"
        class="particle"
        :style="{
          left: p.x + 'px',
          top: p.y + 'px',
          width: p.size + 'px',
          height: p.size + 'px',
          opacity: Math.max(0, p.life)
        }"
      ></div>
  <!-- 飛翔ボールは廃止（集合点モデルではクラスタ内で移動） -->
    </div>
    <hr />
    <div class="comment-area">
      <h3>コメント投稿</h3>
      <input type="text" v-model="userMsg" placeholder="コメントを入力" />
      <button @click="addUserMessage">送信</button>
      <div class="user-msgs">
        <p v-for="msg in userMsgs" :key="msg">{{ msg }}</p>
      </div>
    </div>

    <hr />
    <div class="admin-panel">
      <h3>管理用（選択肢の編集と票のリセット）</h3>
      <p class="small-note">1行につき1つの選択肢として扱います。適用時に既存の票は削除されます。</p>
      <textarea v-model="editableOptionsText" rows="6" class="opts-textarea"></textarea>
      <div class="option-colors">
        <div v-for="(opt, idx) in options" :key="'color-' + idx" class="opt-color-row">
          <span class="opt-name">{{ opt }}</span>
          <input type="color" v-model="optionColors[idx]" />
          <span class="hex">{{ optionColors[idx] }}</span>
        </div>
      </div>
      <div class="admin-actions">
        <button @click="applyOptionsAndReset" :disabled="resetting">選択肢を適用してリセット</button>
        <button @click="resetVotes" :disabled="resetting">票だけリセット</button>
        <button @click="saveOptionColors" :disabled="savingOptions">色だけ保存</button>
        <span v-if="resetting" class="resetting">処理中...</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vote-area {
  padding: 2rem;
  border-radius: 10px;
  background: #6ba000;
  max-width: 800px;
  margin: auto;
  position: relative; /* 飛翔オーバーレイの基準にする */
}
.options {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}
button {
  padding: 0.5em 1em;
  border-radius: 5px;
  border: none;
  background: #009688;
  color: #ffffff;
  font-weight: bold;
  cursor: pointer;
  font-size: 1rem;
}
button:disabled {
  background: #bdbdbd;
  cursor: not-allowed;
}
.dev-badge {
  margin-left: 0.5rem;
  font-size: 0.8rem;
  color: #00695c;
}
.charge-bar {
  margin: 1rem 0;
}
.charge-label {
  font-size: 1rem;
  margin-bottom: 0.3rem;
}
.charge-visual {
  width: 100%;
  height: 10px;
  background: #e0f7fa;
  border-radius: 5px;
  overflow: hidden;
}
.charge-effect {
  height: 100%;
  transition: width 0.1s;
}
.ball-results {
  margin-bottom: 1rem;
}
.option-label { font-weight: bold; margin-bottom: 0.25rem; }
.ball-count { font-size: 0.9rem; }
.comment-area {
  margin-top: 1rem;
}
.user-msgs {
  margin-top: 0.5rem;
  background: #84d;
  border-radius: 5px;
  padding: 0.5rem;
  min-height: 2rem;
}

.admin-panel {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #ffffffaa;
  border-radius: 8px;
}
.admin-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}
.opts-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid #90caf9;
  background: #e3f2fd;
}
.small-note { font-size: 0.85rem; color: #004d40; margin: 0 0 0.5rem; }
.resetting { color: #004d40; }
.realtime-toggle { margin-bottom: 0.5rem; }
.theme-switcher { margin: 0.5rem 0 0.75rem; display: flex; gap: 0.5rem; align-items: center; }
.color-picker { margin: 0.5rem 0 1rem; display: flex; align-items: center; gap: 0.5rem; }
.color-picker .hex { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 0.9rem; color: #263238; }
.connected { color: #00695c; font-weight: bold; }
.connecting { color: #00695c; }
.rt-error { color: #b71c1c; margin-left: 0.5rem; }
.fallback { color: #455a64; margin-left: 0.5rem; font-size: 0.9rem; }

/* 飛翔ボールのオーバーレイ */
.flying-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.flying-ball {
  position: absolute;
  border-radius: 50%;
  /* 光沢をなくしフラットに */
  background: #26a69a;
  transform: translate(-50%, -50%);
  transition: left 0.6s cubic-bezier(0.2, 0.9, 0.2, 1.0), top 0.6s cubic-bezier(0.2, 0.9, 0.2, 1.0), opacity 0.3s ease;
  box-shadow: 0 4px 10px rgba(0,0,0,0.16);
}

.charge-ball {
  position: absolute;
  border-radius: 50%;
  background: #26a69a;
  transform: translate(-50%, -50%);
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}

.particle {
  position: absolute;
  border-radius: 50%;
  background: #80cbc4;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

/* クラスタ内のボール（物理表示） */
.cluster-ball {
  position: absolute;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box; /* border を含めてサイズ管理 */
  transition: left 0.12s linear, top 0.12s linear;
}

/* 集合ステージ全体 */
.cluster-stage {
  position: relative;
  margin: 0.5rem auto 0;
  width: 100%;
  max-width: 720px;
  min-height: 260px;
  background: #e0f2f1;
  border: 1px solid #b2dfdb;
  border-radius: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: center;
}
/* 集合スポット（各選択肢の中心マーカー）*/
.spot {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 220px;
  height: 220px;
  margin: 8px;
  background: #ffffffb3;
  border: 2px dashed #80cbc4;
  border-radius: 12px;
}
.spot-center {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.9;
}
.cluster-ball {
  position: absolute;
  border-radius: 50%;
  /* 光沢をなくしフラットに */
  background: #26a69a;
  transform: translate(-50%, -50%);
  box-shadow: 0 4px 9px rgba(0,0,0,0.15);
}
</style>
