<script setup lang="ts">
// 参加者ページの投票 UI：
// - ボタン長押しで「力ため」→離した瞬間に上へ飛ぶボールをローカル表示
// - 投票データの書き込みのみ実施（集計表示は主催者ページ）
import { ref, onMounted, onUnmounted } from 'vue';
import { useFirestore } from '../composables/useFirestore';

// Firestore の poll/theme。基本はホストと合わせる
const pollId = 'default';
const currentTheme = ref('main');
const { addVote, loadOptionsConfig, loadCurrentTheme } = useFirestore(pollId, currentTheme);
const themeText = ref('');

// 選択肢・色（ホスト側設定があればそれを上書きして使用）
const options = ref<string[]>(['A案', 'B案', 'C案']);
const defaultPalette = ['#ef5350','#42a5f5','#66bb6a','#ffb300','#ab47bc','#26a69a','#8d6e63','#26c6da'];
const optionColors = ref<string[]>(options.value.map((_, i) => defaultPalette[i % defaultPalette.length]));

// 単票制にしたい場合は false。ローカルストレージで既投票の有無を保持
const allowMultiVote = true;
const hasVoted = ref(false);

// 長押し状態/値、選択中の選択肢
const charging = ref(false);
const chargeValue = ref(0);
const chargeStart = ref(0);
const chargeMax = 3000;
const selectedIdx = ref<number | null>(null);

const containerRef = ref<HTMLElement | null>(null);
const lastPointerOverlay = ref({ x: 0, y: 0 });
// 視覚効果用のパーティクルと飛翔ボール
const particles = ref<any[]>([]);
const flyBalls = ref<any[]>([]);
let particleAcc = 0;
let lastTimeMs = performance.now();

// 投票ボールの色（参加者が選択可能）
const ballColor = ref('#26a69a');
function contrastTextColor(hex?: string) {
  try {
    const h = (hex || '').replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 140 ? '#000' : '#fff';
  } catch { return '#fff'; }
}
const R_MIN = 14, R_MAX = 34;
function calcRadius(power: number) {
  const t = Math.max(0, Math.min(1, power / chargeMax));
  const eased = Math.sqrt(t);
  return R_MIN + (R_MAX - R_MIN) * eased;
}
// 長押し開始：座標の初期化と charge の更新ループ開始
function startCharge(idx: number, evt: any) {
  if (!allowMultiVote && hasVoted.value) return;
  charging.value = true;
  chargeValue.value = 0;
  chargeStart.value = Date.now();
  selectedIdx.value = idx;
  try {
    const cont = containerRef.value?.getBoundingClientRect();
    const e = evt || window.event;
    const ex = e?.clientX ?? (e?.pageX ?? 0);
    const ey = e?.clientY ?? (e?.pageY ?? 0);
    if (cont) lastPointerOverlay.value = { x: ex - cont.left, y: ey - cont.top };
  } catch {}
  requestAnimationFrame(chargeTick);
}
// 長押し中のポインタ移動でパーティクルの発生位置を更新
function onPointerMove(evt: any) {
  if (!charging.value) return;
  try {
    const c = containerRef.value?.getBoundingClientRect();
    const e = evt || window.event;
    const ex = e?.clientX ?? (e?.pageX ?? 0);
    const ey = e?.clientY ?? (e?.pageY ?? 0);
    if (c) lastPointerOverlay.value = { x: ex - c.left, y: ey - c.top };
  } catch {}
}
// 長押し中は chargeValue を経過時間で更新
function chargeTick() {
  if (!charging.value) return;
  const now = Date.now();
  let val = now - chargeStart.value;
  if (val > chargeMax) val = chargeMax;
  chargeValue.value = val;
  requestAnimationFrame(chargeTick);
}
// 指を離したら投票：ローカルに飛翔ボールを生成し、Firestore へ書き込み
async function endCharge() {
  if (!charging.value || selectedIdx.value === null) return;
  charging.value = false;
  const power = chargeValue.value;
  const idx = selectedIdx.value;
  try {
    const t = Math.max(0, Math.min(1, power / chargeMax));
    const speed = 5 + 16 * t;
    const drift = (Math.random() - 0.5) * 2;
    flyBalls.value.push({
      id: Date.now() + Math.random(), x: lastPointerOverlay.value.x, y: lastPointerOverlay.value.y,
      vx: drift, vy: -speed, r: calcRadius(power), color: ballColor.value, life: 1,
    });
  } catch {}
  try {
    await addVote(idx, power, ballColor.value);
    if (!allowMultiVote) { localStorage.setItem(`kaede_vote_voted_${pollId}`, '1'); hasVoted.value = true; }
  } catch (e) { console.error('投票の送信に失敗しました', e); }
  finally { selectedIdx.value = null; chargeValue.value = 0; }
}
let rafId = 0;
// 毎フレーム、パーティクルと飛翔ボールを更新
function stepAnim() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastTimeMs) / 1000);
  lastTimeMs = now;
  if (charging.value) {
    const t = Math.max(0, Math.min(1, chargeValue.value / chargeMax));
    const rate = 20 + 120 * t;
    particleAcc += rate * dt;
    let spawnCount = Math.floor(particleAcc);
    particleAcc -= spawnCount;
    if (particles.value.length > 220) spawnCount = 0;
    while (spawnCount-- > 0) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.8 + 4.2 * t + Math.random() * 0.6;
      const size = 4 + Math.random() * 6;
      particles.value.push({ id: now + Math.random(), x: lastPointerOverlay.value.x, y: lastPointerOverlay.value.y, vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd, life: 1, size });
    }
  }
  for (let i = particles.value.length - 1; i >= 0; i--) {
    const p = particles.value[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.vy *= 0.985; p.life -= dt * 1.6; if (p.life <= 0) particles.value.splice(i, 1);
  }
  for (let i = flyBalls.value.length - 1; i >= 0; i--) {
    const b = flyBalls.value[i]; b.x += b.vx; b.y += b.vy; b.vx *= 0.995; b.life -= dt * 0.8; if (b.y + b.r < -10 || b.life <= 0) flyBalls.value.splice(i, 1);
  }
  rafId = requestAnimationFrame(stepAnim);
}
// 初期化：色と選択肢のロード、アニメ開始
onMounted(async () => {
  hasVoted.value = !allowMultiVote && localStorage.getItem(`kaede_vote_voted_${pollId}`) === '1';
  try { const saved = localStorage.getItem('kaede_ball_color'); if (saved) ballColor.value = saved; } catch {}
  try {
    // ホストが設定した現在のテーマを追従
    const cur = await loadCurrentTheme();
    if (cur) currentTheme.value = cur;
    const cfg = await loadOptionsConfig();
    if (cfg?.options?.length) {
      options.value = cfg.options;
      optionColors.value = (cfg.optionColors || []).map((c: string, i: number) => c || defaultPalette[i % defaultPalette.length]);
      while (optionColors.value.length < options.value.length) optionColors.value.push(defaultPalette[optionColors.value.length % defaultPalette.length]);
    }
    if (cfg?.themeText) themeText.value = cfg.themeText;
  } catch {}
  rafId = requestAnimationFrame(stepAnim);
});
onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });
</script>

<template>
  <div class="vote-area" ref="containerRef">
  <h2>力をためて投票！</h2>
  <p v-if="themeText" class="theme">お題: {{ themeText }}</p>
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
          :style="{ background: (!allowMultiVote && hasVoted) ? '#bdbdbd' : (optionColors[idx] || '#009688'), color: (!allowMultiVote && hasVoted) ? '#fff' : contrastTextColor(optionColors[idx] || '#009688') }"
        >{{ opt }}に力をためて投票！</button>
        <span v-if="!allowMultiVote && hasVoted">（投票済み）</span>
      </label>
    </div>
    <div v-if="charging" class="charge-bar">
      <div class="charge-label">力をためています... {{ Math.round(chargeValue / 1000 * 100) / 100 }}秒</div>
      <div class="charge-visual"><div class="charge-effect" :style="{ width: (chargeValue/chargeMax*100)+'%', background: '#009688' }"></div></div>
    </div>
    <div class="color-picker"><label>ボールの色: <input type="color" v-model="ballColor" /></label><span class="hex">{{ ballColor }}</span></div>
    <div class="flying-layer">
      <div v-for="p in particles" :key="p.id" class="particle" :style="{ left: p.x + 'px', top: p.y + 'px', width: p.size + 'px', height: p.size + 'px', opacity: Math.max(0, p.life) }"></div>
      <div v-for="b in flyBalls" :key="b.id" class="fly-ball" :style="{ left: (b.x - b.r) + 'px', top: (b.y - b.r) + 'px', width: (b.r * 2) + 'px', height: (b.r * 2) + 'px', backgroundColor: b.color, opacity: Math.max(0, b.life) }"></div>
    </div>
    <p class="hint">集計表示は主催者ページ（/host）をご覧ください。</p>
  </div>
  
</template>

<style scoped>
.vote-area { padding: 2rem; border-radius: 10px; background: #6ba000; max-width: 800px; margin: auto; position: relative; }
.options { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; }
button { padding: 0.65em 1.1em; border-radius: 8px; border: none; background: #009688; color: #fff; font-weight: bold; cursor: pointer; font-size: 1rem; }
button:disabled { background: #bdbdbd; cursor: not-allowed; }
.charge-bar { margin: 1rem 0; }
.charge-label { font-size: 1rem; margin-bottom: 0.3rem; }
.charge-visual { width: 100%; height: 10px; background: #e0f7fa; border-radius: 5px; overflow: hidden; }
.charge-effect { height: 100%; transition: width 0.1s; }
.color-picker { margin-bottom: .5rem; display: flex; align-items: center; gap: .5rem; }
.hex { margin-left: .25rem; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.flying-layer { position: absolute; left: 0; top: 0; right: 0; bottom: 0; pointer-events: none; }
.particle { position: absolute; background: rgba(255,255,255,0.9); border-radius: 50%; transform: translate(-50%, -50%); }
.fly-ball { position: absolute; border-radius: 50%; border: 3px solid rgba(0,0,0,0.15); box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
.hint { margin-top: 1rem; opacity: .85; }
.theme { margin:-.25rem 0 .5rem; font-weight: 600; }
</style>
