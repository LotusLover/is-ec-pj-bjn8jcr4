<script setup lang="ts">
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
const safeOptionColors = computed(() => {
  const arr = optionColors.value || [];
  const out: string[] = new Array(options.value.length);
  for (let i = 0; i < options.value.length; i++) out[i] = arr[i] || '#26a69a';
  return out;
});

async function init() {
  await ensureFirestoreLite();
  startPollingFallback();
  const cfg = await loadOptionsConfig();
  if (cfg?.options) options.value = cfg.options;
  if (cfg?.optionColors) optionColors.value = cfg.optionColors;
}
init();

async function applyOptions() {
  await saveOptionsConfig(options.value, optionColors.value);
}
async function doResetVotes() {
  await resetVotes();
}

// Fullscreen presenter mode
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
</script>

<template>
  <div class="page">
    <h1>主催者ページ</h1>
    <div class="row">
      <label>Poll ID: <input v-model="pollId" /></label>
      <label>Theme: <input v-model="theme" /></label>
      <button @click="init">接続/再読込</button>
      <button class="ghost" @click="toggleFullscreen">{{ isFullscreen ? 'フルスクリーン解除' : 'フルスクリーン' }}</button>
    </div>

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
        <ResultsCluster :options="options" :votes="votes" :option-colors="safeOptionColors" />
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
</style>
