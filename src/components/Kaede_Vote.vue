<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
let db;
// Firestoreは動的読み込み。まずは lite API（書き込み/読み出し）だけ読み込む。
let collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, getDocs, deleteDoc, doc, getFirestore;
const firebaseApp = ref(null);
let firestoreMode = 'none'; // 'none' | 'lite' | 'full'

// 選択肢（編集可能にするためref）
const options = ref(['A案', 'B案', 'C案']);
// 各選択肢ごとの投票（力）配列。例: [[力1, 力2], [力1], [力1, 力2, 力3]]
const votes = ref(options.value.map(() => []));

// 投票を保存する先（pollIdで投票ルームを分けられる）
const pollId = 'default';
let votesColRef;

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
// アニメーション用
const containerRef = ref(null);
const optionRefs = ref([]); // 各選択肢の集積ボックス参照
const flyingBalls = ref([]); // 画面上を飛ぶ一時的なボール
const lastPointer = ref({ x: 0, y: 0 }); // コンテナ基準の発射位置

// 疑似物理: 各選択肢のボール群を2Dで吸引・分離
const BOX_W = 120;
const BOX_H = 150;
const ATTRACT = 0.02;
const DAMPING = 0.92;
const REPULSE = 0.08;
const PADDING = 2;
const physicsBalls = ref(options.value.map(() => []));

function ensurePhysicsShape() {
  // options 変更時の形合わせ
  if (physicsBalls.value.length !== options.value.length) {
    physicsBalls.value = options.value.map(() => []);
  }
}

function syncPhysicsWithVotes() {
  ensurePhysicsShape();
  for (let idx = 0; idx < options.value.length; idx++) {
    const targetCount = votes.value[idx]?.length || 0;
    const arr = physicsBalls.value[idx];
    // 追加
    while (arr.length < targetCount) {
      const i = arr.length; // 新規のインデックス
      const power = votes.value[idx][i];
      const r = 10 + (power / chargeMax) * 40;
      arr.push({
        x: BOX_W / 2 + (Math.random() - 0.5) * 10,
        y: BOX_H / 2 + (Math.random() - 0.5) * 10,
        vx: 0,
        vy: 0,
        r,
      });
    }
    // 削除
    while (arr.length > targetCount) arr.pop();
  }
}

let rafId = 0;
function stepPhysics() {
  for (let idx = 0; idx < physicsBalls.value.length; idx++) {
    const arr = physicsBalls.value[idx];
    const cx = BOX_W / 2;
    const cy = BOX_H / 2;
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
      if (b.x > BOX_W - b.r) { b.x = BOX_W - b.r; b.vx *= -0.5; }
      if (b.y < b.r) { b.y = b.r; b.vy *= -0.5; }
      if (b.y > BOX_H - b.r) { b.y = BOX_H - b.r; b.vy *= -0.5; }
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
    const c = containerRef.value?.getBoundingClientRect();
    const e = evt || window.event;
    const ex = e?.clientX ?? (e?.pageX ?? 0);
    const ey = e?.clientY ?? (e?.pageY ?? 0);
    if (c) {
      lastPointer.value = { x: ex - c.left, y: ey - c.top };
    }
  } catch (_) {}
  chargeTick();
};

// 力をためるループ
function chargeTick() {
  if (!charging.value) return;
  const now = Date.now();
  let val = now - chargeStart.value;
  if (val > chargeMax) val = chargeMax;
  chargeValue.value = val;
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
  // 飛翔ボールを生成して目的地へアニメーション
  try {
    const c = containerRef.value?.getBoundingClientRect();
    const box = optionRefs.value[idx];
    let destX = lastPointer.value.x;
    let destY = lastPointer.value.y;
    if (c && box) {
      const r = box.getBoundingClientRect();
      destX = r.left - c.left + BOX_W / 2;
      destY = r.top - c.top + BOX_H / 2;
    }
    const r = 10 + power / chargeMax * 40;
    const id = Date.now() + Math.random();
    const ball = { id, left: lastPointer.value.x, top: lastPointer.value.y, r, arrived: false };
    flyingBalls.value.push(ball);
    await nextTick();
    // 目的地へ移動（CSSトランジション）
    requestAnimationFrame(() => {
      ball.left = destX;
      ball.top = destY;
      ball.arrived = true;
    });
    // 一定時間後にオーバーレイから除去
    setTimeout(() => {
      flyingBalls.value = flyingBalls.value.filter(b => b.id !== id);
    }, 700);
  } catch (_) {}
  try {
    // Firestore Lite を必要時に読み込んで書き込み（リアルタイム未接続でもOK）
    await ensureFirestoreLite();
    await addDoc(votesColRef, {
      optionIndex: idx,
      power,
      createdAt: serverTimestamp(),
    });
    // リアルタイム未接続時はローカルへも反映
    if (!isRealtimeConnected.value) {
      votes.value[idx].push(power);
    }
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

// Firestore/Lite を必要な時だけ読み込む（書き込み・リセット用）
async function ensureFirestoreLite() {
  if (!firebaseApp.value) {
    const firebaseMod = await import('../firebase');
    firebaseApp.value = firebaseMod.app;
  }
  if (firestoreMode === 'none') {
    const mod = await import('firebase/firestore/lite');
    ({ collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc, getFirestore } = mod);
    db = getFirestore(firebaseApp.value);
    votesColRef = collection(db, 'polls', pollId, 'votes');
    firestoreMode = 'lite';
  }
}

// リアルタイム購読はユーザー操作で開始（初期読み込みを軽く）
let unsubscribe = null;
const isRealtimeConnected = ref(false);
async function connectRealtime() {
  await ensureFirestoreLite();
  if (firestoreMode !== 'full') {
    const mod = await import('firebase/firestore');
    ({ collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, getDocs, deleteDoc, doc, getFirestore } = mod);
    db = getFirestore(firebaseApp.value);
    votesColRef = collection(db, 'polls', pollId, 'votes');
    firestoreMode = 'full';
  }
  if (unsubscribe) return; // すでに接続済み
  const q = query(votesColRef, orderBy('createdAt', 'asc'));
  unsubscribe = onSnapshot(q, (snap) => {
    const arrs = options.value.map(() => []);
    snap.forEach((d) => {
      const data = d.data();
      if (typeof data.optionIndex === 'number' && typeof data.power === 'number' && arrs[data.optionIndex]) {
        arrs[data.optionIndex].push(data.power);
      }
    });
    votes.value = arrs;
    nextTick().then(syncPhysicsWithVotes);
  });
  isRealtimeConnected.value = true;
}

// 起動時はローカル状態のみ（Firebaseは未接続）
onMounted(() => {
  hasVoted.value = !allowMultiVote && localStorage.getItem(`kaede_vote_voted_${pollId}`) === '1';
  // 物理ループ開始
  rafId = requestAnimationFrame(stepPhysics);
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
  if (rafId) cancelAnimationFrame(rafId);
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

const resetVotes = async () => {
  await ensureFirestoreLite();
  resetting.value = true;
  try {
    const snap = await getDocs(votesColRef);
    const tasks = [];
    snap.forEach((d) => tasks.push(deleteDoc(doc(votesColRef, d.id))));
    await Promise.all(tasks);
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
  votes.value = options.value.map(() => []);
  physicsBalls.value = options.value.map(() => []);
  await resetVotes();
};
</script>

<template>
  <div class="vote-area" ref="containerRef">
    <h2>力をためて投票ツール（Mentimeter風・リアルタイム）</h2>
    <div class="realtime-toggle">
      <button v-if="!isRealtimeConnected" @click="connectRealtime">リアルタイム受信を開始</button>
      <span v-else class="connected">リアルタイム受信中</span>
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
    <hr />
    <div class="ball-results">
      <h3>投票結果</h3>
      <div class="ball-row">
        <div v-for="(opt, idx) in options" :key="opt" class="ball-col">
          <div class="option-label">{{ opt }}</div>
          <div class="option-box" :ref="el => (optionRefs[idx] = el)" :style="{ width: BOX_W + 'px', height: BOX_H + 'px' }">
            <div
              v-for="(b, bi) in physicsBalls[idx]"
              :key="bi"
              class="cluster-ball"
              :style="{ left: b.x + 'px', top: b.y + 'px', width: (b.r*2) + 'px', height: (b.r*2) + 'px' }"
            ></div>
          </div>
          <div class="ball-count">{{ votes[idx].length }}票</div>
        </div>
      </div>
    </div>
    <!-- 飛翔ボールのオーバーレイ -->
    <div class="flying-layer">
      <div
        v-for="b in flyingBalls"
        :key="b.id"
        class="flying-ball"
        :style="{
          left: b.left + 'px',
          top: b.top + 'px',
          width: (b.r*2) + 'px',
          height: (b.r*2) + 'px',
          opacity: b.arrived ? 0.85 : 1
        }"
      ></div>
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
      <div class="admin-actions">
        <button @click="applyOptionsAndReset" :disabled="resetting">選択肢を適用してリセット</button>
        <button @click="resetVotes" :disabled="resetting">票だけリセット</button>
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
.ball-row {
  display: flex;
  gap: 2rem;
  justify-content: center;
}
.ball-col {
  text-align: center;
}
.option-label {
  font-weight: bold;
  margin-bottom: 0.5rem;
}
.ball-count {
  margin-top: 0.5rem;
  font-size: 0.9rem;
}
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
.connected { color: #00695c; font-weight: bold; }

/* 飛翔ボールのオーバーレイ */
.flying-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.flying-ball {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #b2dfdb, #009688);
  transform: translate(-50%, -50%);
  transition: left 0.6s ease, top 0.6s ease, opacity 0.3s ease;
  box-shadow: 0 6px 14px rgba(0,0,0,0.2);
}

/* クラスタ表示 */
.option-box {
  position: relative;
  margin: 0 auto;
  background: #e0f2f1;
  border-radius: 8px;
  border: 1px solid #b2dfdb;
  overflow: hidden;
}
.cluster-ball {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #b2dfdb, #009688);
  transform: translate(-50%, -50%);
  box-shadow: 0 6px 12px rgba(0,0,0,0.18);
}
</style>
