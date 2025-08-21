<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';

// Firestore（動的読み込みで起動を軽量化）
let db;
let collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, getDocs, deleteDoc, doc;

// 選択肢（編集可能）
const options = ref(['A案', 'B案', 'C案']);
const votes = ref(options.value.map(() => []));

// Poll（ルーム）ID（切り替え可能）
const pollId = ref('default');
let votesColRef;
let unsubscribe = null;

// 開発用: 一人一票の制限を外す
const allowMultiVote = true;

// 投票済みフラグ（一人一票時に使用）
const hasVoted = ref(false);
const votedKey = () => `kaede_vote_voted_${pollId.value}`;

// 力をためる処理
const charging = ref(false);
const chargeValue = ref(0);
const chargeStart = ref(0);
const chargeMax = 3000; // 最大3000ms（3秒）
const selectedIdx = ref(null);

// 長押し開始
const startCharge = (idx) => {
  if (!allowMultiVote && hasVoted.value) return;
  charging.value = true;
  chargeValue.value = 0;
  chargeStart.value = Date.now();
  selectedIdx.value = idx;
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

// 離して投票（Firestoreへ保存）
const endCharge = async () => {
  if (!charging.value || selectedIdx.value === null) return;
  charging.value = false;
  const power = chargeValue.value;
  const idx = selectedIdx.value;
  try {
    if (!votesColRef) {
      // 初期化前はローカルに積む
      votes.value[idx].push(power);
    } else {
      await addDoc(votesColRef, {
        optionIndex: idx,
        power,
        createdAt: serverTimestamp(),
      });
    }
    if (!allowMultiVote) {
      localStorage.setItem(votedKey(), '1');
      hasVoted.value = true;
    }
  } catch (e) {
    console.error('投票の送信に失敗しました', e);
  } finally {
    selectedIdx.value = null;
    chargeValue.value = 0;
  }
};

// Firestore購読の開始・再開始
async function startSubscription() {
  if (!db || !collection) return;
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  votesColRef = collection(db, 'polls', pollId.value, 'votes');
  const q = query(votesColRef, orderBy('createdAt', 'asc'));
  unsubscribe = onSnapshot(q, (snap) => {
    const arrs = options.value.map(() => []);
    snap.forEach((d) => {
      const data = d.data();
      if (
        typeof data.optionIndex === 'number' &&
        typeof data.power === 'number' &&
        arrs[data.optionIndex]
      ) {
        arrs[data.optionIndex].push(data.power);
      }
    });
    votes.value = arrs;
  });
}

// 起動時
onMounted(async () => {
  hasVoted.value = !allowMultiVote && localStorage.getItem(votedKey()) === '1';
  const mod = await import('firebase/firestore');
  ({ collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, getDocs, deleteDoc, doc } = mod);
  const firebaseMod = await import('../firebase');
  db = firebaseMod.db;

  await startSubscription();
});

// 切り替え時のクリーンアップ
onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});

// Poll ID切り替え
const draftPollId = ref(pollId.value);
const applyPollId = async () => {
  if (!draftPollId.value) return;
  pollId.value = draftPollId.value.trim();
  votes.value = options.value.map(() => []);
  hasVoted.value = !allowMultiVote && localStorage.getItem(votedKey()) === '1';
  await startSubscription();
};

// 投票の全リセット（Firestoreの該当Pollのvotesを全削除）
const resetting = ref(false);
const resetVotes = async () => {
  if (!votesColRef || !getDocs || !deleteDoc || !doc) return;
  resetting.value = true;
  try {
    const snap = await getDocs(votesColRef);
    // 注意: 件数が多い場合はバッチ化推奨
    const tasks = [];
    snap.forEach((d) => {
      tasks.push(deleteDoc(doc(votesColRef, d.id)));
    });
    await Promise.all(tasks);
    votes.value = options.value.map(() => []);
    if (!allowMultiVote) {
      localStorage.removeItem(votedKey());
      hasVoted.value = false;
    }
  } catch (e) {
    console.error('リセットに失敗しました', e);
  } finally {
    resetting.value = false;
  }
};

// 選択肢の編集（複数行テキスト→適用で投票リセット）
const editableOptionsText = ref(options.value.join('\n'));
const applyOptionsAndReset = async () => {
  const lines = editableOptionsText.value
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (lines.length === 0) return;
  options.value = lines;
  votes.value = options.value.map(() => []);
  await resetVotes();
};

</script>

<template>
  <div class="vote-area">
    <h2>力をためて投票ツール（Mentimeter風・リアルタイム）</h2>

    <!-- 管理パネル -->
    <div class="admin-panel">
      <h3>設定</h3>
      <div class="row">
        <label class="label">Poll ID:</label>
        <input v-model="draftPollId" placeholder="poll ID を入力 (例: default, room-1)" />
        <button @click="applyPollId">適用</button>
      </div>
      <div class="row">
        <label class="label">選択肢（1行1項目）:</label>
        <textarea v-model="editableOptionsText" rows="4" />
      </div>
      <div class="row gap">
        <button @click="applyOptionsAndReset">選択肢を適用（投票リセット）</button>
        <button :disabled="resetting" @click="resetVotes">
          {{ resetting ? 'リセット中...' : '投票だけリセット' }}
        </button>
        <span class="dev-badge">開発用: 複数投票可</span>
      </div>
    </div>

    <div class="options">
      <label v-for="(opt, idx) in options" :key="opt">
        <button
          :disabled="!allowMultiVote && hasVoted"
          @mousedown="startCharge(idx)"
          @touchstart.prevent="startCharge(idx)"
          @mouseup="endCharge"
          @mouseleave="endCharge"
          @touchend.prevent="endCharge"
        >
          {{ opt }}に力をためて投票！
        </button>
        <span v-if="!allowMultiVote && hasVoted">（投票済み）</span>
      </label>
    </div>

    <div v-if="charging" class="charge-bar">
      <div class="charge-label">
        力をためています... {{ Math.round((chargeValue / 1000) * 100) / 100 }}秒
      </div>
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
          <svg width="120" height="150">
            <circle
              v-for="(val, i) in votes[idx]"
              :key="i"
              :cx="60"
              :cy="20 + i*30"
              :r="10 + val/chargeMax*40"
              :fill="'#009688'"
              :opacity="0.7"
              stroke="#00695c"
              stroke-width="2"
            />
          </svg>
          <div class="ball-count">{{ votes[idx].length }}票</div>
        </div>
      </div>
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
  </div>
</template>

<script setup>
// ...existing code...
// コメント機能（ローカルのみの簡易版）
const userMsg = ref('');
const userMsgs = ref([]);
const addUserMessage = () => {
  if (userMsg.value) {
    const d = new Date();
    const t = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    userMsgs.value.unshift(t + ' ' + userMsg.value);
    userMsg.value = '';
  }
};
// ...existing code...
</script>

<style scoped>
.vote-area {
  padding: 2rem;
  border-radius: 10px;
  background: #e0f7fa;
  max-width: 900px;
  margin: auto;
}
.admin-panel {
  background: #fafafa;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}
.admin-panel .row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
}
.admin-panel .row.gap {
  gap: 1rem;
}
.admin-panel .label {
  min-width: 110px;
  font-weight: 600;
}
.admin-panel input, .admin-panel textarea {
  flex: 1;
  padding: 0.4rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 0.95rem;
}
.options {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
button {
  padding: 0.5em 1em;
  border-radius: 5px;
  border: none;
  background: #009688;
  color: white;
  font-weight: bold;
  cursor: pointer;
  font-size: 1rem;
}
button:disabled {
  background: #bdbdbd;
  cursor: not-allowed;
}
.dev-badge {
  font-size: 0.85rem;
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
  flex-wrap: wrap;
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
</style>