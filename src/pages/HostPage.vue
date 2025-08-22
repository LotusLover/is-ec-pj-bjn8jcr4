<script setup lang="ts">
// 主催者ページ：
// - Firestore から票を読み、クラスタ可視化へ渡す
// - StackBlitz 等の埋め込み環境向けに外部ウィンドウ起動やデモモードを用意
import { ref, computed } from 'vue';
import { useFirestore } from '../composables/useFirestore';
import ResultsCluster from '../components/ResultsCluster.vue';

const pollId = ref('default');
const theme = ref('main');
const {
  votes,
  loadOptionsConfig,
  saveOptionsConfig,
  resetVotes,
  ensureFirestoreLite,
  startPollingFallback,
} = useFirestore(pollId, theme);

const options = ref<string[]>([]);
const optionColors = ref<string[]>([]);
// 選択肢数に合わせて不足色を安全に埋める
const safeOptionColors = computed(() => {
  const arr = optionColors.value || [];
  const out: string[] = new Array(options.value.length);
  for (let i = 0; i < options.value.length; i++) out[i] = arr[i] || '#26a69a';
  return out;
});

const fsError = ref('');
const isEmbed = window.self !== window.top;
const isStackblitz = /stackblitz|webcontainer|blitz|vitest\.dev/.test(location.hostname);

// Firestore へ接続して設定/票を取得（失敗時はメッセージ表示）
async function init() {
  fsError.value = '';
  try {
    await ensureFirestoreLite();
    startPollingFallback();
    const cfg = await loadOptionsConfig();
    if (cfg?.options) options.value = cfg.options;
    if (cfg?.optionColors) optionColors.value = cfg.optionColors;
  } catch (e:any) {
    fsError.value = e?.message || String(e || 'Firestoreの初期化で問題が発生しました');
  }
}
init();

// 選択肢と色を保存
async function applyOptions() {
  await saveOptionsConfig(options.value, optionColors.value);
}
// 全票を削除
async function doResetVotes() {
  await resetVotes();
}

// Fullscreen presenter mode（配信用の全画面切替）
const isFullscreen = ref(false);
async function toggleFullscreen() {
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement) {
      await el.requestFullscreen();
      isFullscreen.value = true;
    } else {
      await document.exitFullscreen();
      isFullscreen.value = false;
    }
  } catch {}
}

// デモモード（埋め込み環境用の疑似票発生器）
const demoMode = ref(false);
const demoVotes = ref<any[][]>([]);
const displayVotes = computed(() => demoMode.value ? demoVotes.value : votes);
let demoTimer:any = 0;
function startDemo() {
  demoMode.value = true;
  if (demoTimer) clearInterval(demoTimer);
  demoVotes.value = options.value.map(() => []);
  demoTimer = setInterval(() => {
    if (!options.value.length) return;
    // randomly add a vote to one option
    const idx = Math.floor(Math.random() * options.value.length);
    const power = 500 + Math.random() * 2500;
    const color = (optionColors.value && optionColors.value[idx]) || '#26a69a';
    if (!demoVotes.value[idx]) demoVotes.value[idx] = [];
    demoVotes.value[idx] = [...demoVotes.value[idx], { power, color }];
    // occasionally decay to avoid unbounded growth
    for (let i = 0; i < demoVotes.value.length; i++) {
      if (demoVotes.value[i] && demoVotes.value[i].length > 120) demoVotes.value[i].splice(0, 10);
    }
  }, 800);
}
function stopDemo() { demoMode.value = false; if (demoTimer) { clearInterval(demoTimer); demoTimer = 0; } }
</script>

<template>
  <div class="page">
    <h1>主催者ページ</h1>
    <div class="row">
      <label>Poll ID: <input v-model="pollId" /></label>
      <label>Theme: <input v-model="theme" /></label>
      <button @click="init">接続/再読込</button>
      <button class="ghost" @click="toggleFullscreen">{{ isFullscreen ? 'フルスクリーン解除' : 'フルスクリーン' }}</button>
      <button class="ghost" v-if="!demoMode" @click="startDemo">デモモード</button>
      <button class="ghost" v-else @click="stopDemo">デモ停止</button>
      <button class="ghost" v-if="isEmbed || isStackblitz" @click="() => window.open(location.href.replace(/#.*$/, '') + '#/host', '_blank')">外部ウィンドウで開く</button>
    </div>

    <p v-if="fsError" class="warn">接続エラー: {{ fsError }}<br>
      埋め込み環境（StackBlitz等）では制限で接続できない場合があります。上の「外部ウィンドウで開く」や「デモモード」をお試しください。</p>

    <section>
      <h2>選択肢と色</h2>
  <div v-for="(_, i) in options" :key="i" class="opt-row">
        <input v-model="options[i]" placeholder="選択肢" />
        <input type="color" v-model="optionColors[i]" />
        <button @click="options.splice(i,1); optionColors.splice(i,1)">削除</button>
      </div>
      <button @click="options.push(''); optionColors.push('#26a69a')">選択肢を追加</button>
      <div class="actions">
        <button @click="applyOptions">設定を保存</button>
      </div>
    </section>

    <section>
      <h2>票の管理</h2>
      <button @click="doResetVotes">票をリセット</button>
      <p>各選択肢の票数: {{ votes.map(v=>v?.length||0) }}</p>
    </section>

    <section>
      <h2>結果（クラスタ表示）</h2>
      <div class="presenter-area">
        <ResultsCluster :options="options" :votes="displayVotes" :option-colors="safeOptionColors" />
      </div>
    </section>

    <p class="nav">投票ページへは <router-link to="/vote">/vote</router-link></p>
  </div>
</template>

<style scoped>
.page { padding: 1rem; }
.row { display:flex; gap:.5rem; align-items:center; margin-bottom: .75rem; }
.opt-row { display:flex; gap:.5rem; align-items:center; margin:.25rem 0; }
.actions { margin-top:.5rem; }
.nav { margin-top: 1rem; }
.ghost { opacity: .85; }
.presenter-area { width: 100%; height: 80vh; display: flex; }
.presenter-area :deep(.cluster-stage) { flex: 1; }
.warn { background:#fff3cd; color:#5c4400; padding:.5rem .75rem; border:1px solid #ffe69c; border-radius:6px; }
</style>
