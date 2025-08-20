<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
let db;
let collection, addDoc, serverTimestamp, onSnapshot, query, orderBy;

// 選択肢
const options = ['A案', 'B案', 'C案'];
// 各選択肢ごとの投票（力）配列。例: [[力1, 力2], [力1], [力1, 力2, 力3]]
const votes = ref(options.map(() => []));

// 投票を保存する先（pollIdで投票ルームを分けられる）
const pollId = 'default';
let votesColRef;

// 投票済みフラグ（一人一票）
const hasVoted = ref(false);

// 力をためる処理
const charging = ref(false);
const chargeValue = ref(0);
const chargeStart = ref(0);
const chargeMax = 3000; // 最大3000ms（3秒）
const selectedIdx = ref(null);

// 投票ボタン長押し開始
const startCharge = (idx) => {
  if (hasVoted.value) return;
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

// 投票ボタン離す（サーバーに送信）
const endCharge = async () => {
  if (!charging.value || hasVoted.value || selectedIdx.value === null) return;
  charging.value = false;
  const power = chargeValue.value;
  const idx = selectedIdx.value;
  try {
    if (!votesColRef) {
      // 初期化前ならローカルに積むだけで終了
      votes.value[idx].push(power);
      return;
    }
    await addDoc(votesColRef, {
      optionIndex: idx,
      power,
      createdAt: serverTimestamp(),
    });
    // 一人一票（ローカルに記録）
    localStorage.setItem(`kaede_vote_voted_${pollId}`, '1');
    hasVoted.value = true;
  } catch (e) {
    console.error('投票の送信に失敗しました', e);
  } finally {
    selectedIdx.value = null;
    chargeValue.value = 0;
  }
};

// 起動時にリアルタイム購読を開始し、ローカルに反映
let unsubscribe = null;
onMounted(async () => {
  // 投票済み状態を復元
  hasVoted.value = localStorage.getItem(`kaede_vote_voted_${pollId}`) === '1';

  // Firebaseの動的import
  const mod = await import('firebase/firestore');
  ({ collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } = mod);
  const firebaseMod = await import('../firebase');
  db = firebaseMod.db;
  votesColRef = collection(db, 'polls', pollId, 'votes');
  const q = query(votesColRef, orderBy('createdAt', 'asc'));
  unsubscribe = onSnapshot(q, (snap) => {
    const arrs = options.map(() => []);
    snap.forEach((doc) => {
      const d = doc.data();
      if (typeof d.optionIndex === 'number' && typeof d.power === 'number' && arrs[d.optionIndex]) {
        arrs[d.optionIndex].push(d.power);
      }
    });
    votes.value = arrs;
  });
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
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
</script>

<template>
  <div class="vote-area">
    <h2>力をためて投票ツール（Mentimeter風・リアルタイム）</h2>
    <div class="options">
      <label v-for="(opt, idx) in options" :key="opt">
        <button
          :disabled="hasVoted"
          @mousedown="startCharge(idx)"
          @touchstart.prevent="startCharge(idx)"
          @mouseup="endCharge"
          @mouseleave="endCharge"
          @touchend.prevent="endCharge"
        >
          {{ opt }}に力をためて投票！
        </button>
        <span v-if="hasVoted">（投票済み）</span>
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

<style scoped>
.vote-area {
  padding: 2rem;
  border-radius: 10px;
  background: #e0f7fa;
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
  color: white;
  font-weight: bold;
  cursor: pointer;
  font-size: 1rem;
}
button:disabled {
  background: #bdbdbd;
  cursor: not-allowed;
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
  background: #fff;
  border-radius: 5px;
  padding: 0.5rem;
  min-height: 2rem;
}
</style>
