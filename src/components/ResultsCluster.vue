<script setup lang="ts">
// 結果のクラスタ可視化：
// - 各選択肢ごとにボールをクラスタ表示
// - ボールは画面端のエミッタから水平に連続噴出し、弱い吸引＋風ノイズで揺らぐ
// - 読みにくい軌道と、楽しげな演出を両立
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue';

const props = defineProps<{
  options: string[];
  votes: any[][]; // entries may be number or { power, color? }
  optionColors: string[];
}>();

// stage & layout
// 可視化領域や各スポット（選択肢の中心）を追跡する
const stageRef = ref<HTMLElement | null>(null);
const spotRefs = ref<HTMLElement[]>([] as any);
const stageSize = ref({ w: 900, h: 320 });
const centers = ref(props.options.map(() => ({ x: 0, y: 0 })));
// Edge emitter point for "blow-out" effect（左右端のどちらか）
const emitter = ref<{ x: number; y: number }>({ x: 0, y: 0 } as any);
// desired counts per option（理想のボール数）。逐次スポーンのために使用
const desiredCounts = ref<number[]>(props.options.map(() => 0));

// physics
// 物理っぽい見た目のためのシンプルなルール群
const physicsBalls = ref<any[][]>(props.options.map(() => []));
const ATTRACT = 0.012; // 弱い中心吸引（読みづらさを出すため控えめに）
const DAMPING = 0.92;
const REPULSE = 0.08;
const PADDING = 2;
const R_MIN = 14;
const R_MAX = 34;
// gentle wind（風）で予測不能感を付与
const WIND_DRIFT = 0.02;
const WIND_MAX = 0.35;
let wind = { x: 0, y: 0 };
// 投票の力（長押し時間）からボール半径を計算
function calcRadius(power: number) {
  const chargeMax = 3000;
  const t = Math.max(0, Math.min(1, (Number(power) || 0) / chargeMax));
  const eased = Math.sqrt(t);
  return R_MIN + (R_MAX - R_MIN) * eased;
}

// 内部配列の形状を props に同期
function ensureShape() {
  if (physicsBalls.value.length !== props.options.length) {
    physicsBalls.value = props.options.map(() => []);
  }
  if (centers.value.length !== props.options.length) {
    centers.value = props.options.map(() => ({ x: 0, y: 0 }));
  }
  if (desiredCounts.value.length !== props.options.length) {
    desiredCounts.value = props.options.map(() => 0);
  }
}

// エミッタ位置を左右端のいずれかにランダム配置
function updateEmitter() {
  const w = stageSize.value.w;
  const h = stageSize.value.h;
  // pick left or right edge only for horizontal launch
  const right = Math.random() < 0.5;
  emitter.value = right ? ({ x: w, y: Math.random() * h } as any)
                        : ({ x: 0, y: Math.random() * h } as any);
}

// 票数→理想数（desiredCounts）へ同期（実スポーンは stepPhysics で逐次）
function syncPhysicsWithVotes() {
  ensureShape();
  for (let idx = 0; idx < props.options.length; idx++) {
    desiredCounts.value[idx] = props.votes?.[idx]?.length || 0;
  }
}

// 指定オプション idx に対して 1 個だけスポーン
function spawnOne(idx: number) {
  const arr = physicsBalls.value[idx];
  const src = props.votes?.[idx];
  if (!src) return false;
  const i = arr.length; // spawn next unseen vote
  const v = src[i];
  if (v == null) return false;
  // ビジュアル情報（半径・色など）を票から取得
  const power = (v && typeof v === 'object') ? Number(v.power) : Number(v);
  const color = ((v && typeof v === 'object') ? v.color : null) || props.optionColors?.[idx] || '#26a69a';
  const r = calcRadius(power);
  const cx = centers.value[idx]?.x ?? stageSize.value.w / 2;
  const cy = centers.value[idx]?.y ?? stageSize.value.h / 2;
  // spawn from emitter with slight jitter and horizontal launch
  const sx = emitter.value.x + (Math.random() - 0.5) * 8;
  const sy = emitter.value.y + (Math.random() - 0.5) * 8;
  const dir = emitter.value.x > (stageSize.value.w * 0.5) ? -1 : 1; // right edge -> left, left edge -> right
  const speed = 6 + Math.random() * 3; // base horizontal speed
  const jx = (Math.random() - 0.5) * 2.0; // slight sideways jitter
  const jy = (Math.random() - 0.5) * 2.0; // small initial vertical jitter
  arr.push({ x: sx, y: sy, vx: dir * speed + jx, vy: jy, r, color });
  return true;
}

let rafId = 0;
// 毎フレームの更新：
// 1) 風の更新 2) 逐次スポーン（全体で budget=1 個）3) 吸引・反発・減衰 4) 画面境界の当たり
function stepPhysics() {
  const w = stageSize.value.w;
  const h = stageSize.value.h;
  // update wind (smooth random drift)
  wind.x += (Math.random() - 0.5) * WIND_DRIFT;
  wind.y += (Math.random() - 0.5) * (WIND_DRIFT * 0.6);
  wind.x = Math.max(-WIND_MAX, Math.min(WIND_MAX, wind.x));
  wind.y = Math.max(-WIND_MAX * 0.6, Math.min(WIND_MAX * 0.6, wind.y));
  // sequential spawning: at most one ball per frame across all options
  let budget = 1;
  for (let idx = 0; idx < physicsBalls.value.length && budget > 0; idx++) {
    const arr = physicsBalls.value[idx];
    const want = desiredCounts.value[idx] || 0;
    if (arr.length < want) { if (spawnOne(idx)) budget--; }
  }
  // immediate removal if counts decreased
  for (let idx = 0; idx < physicsBalls.value.length; idx++) {
    const arr = physicsBalls.value[idx];
    const want = desiredCounts.value[idx] || 0;
    while (arr.length > want) arr.pop();
  }
  for (let idx = 0; idx < physicsBalls.value.length; idx++) {
    const arr = physicsBalls.value[idx];
    const cx = centers.value[idx]?.x ?? w / 2;
    const cy = centers.value[idx]?.y ?? h / 2;
    for (let b of arr) {
      // wind adds unpredictability
      b.vx += wind.x;
      b.vy += wind.y;
      b.vx += (cx - b.x) * ATTRACT;
      b.vy += (cy - b.y) * ATTRACT;
    }
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
    for (let b of arr) {
      b.vx *= DAMPING;
      b.vy *= DAMPING;
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < b.r) { b.x = b.r; b.vx *= -0.5; }
      if (b.x > w - b.r) { b.x = w - b.r; b.vx *= -0.5; }
      if (b.y < b.r) { b.y = b.r; b.vy *= -0.5; }
      if (b.y > h - b.r) { b.y = h - b.r; b.vy *= -0.5; }
    }
  }
  rafId = requestAnimationFrame(stepPhysics);
}

// DOM から各スポットの中心座標を測定し、表示領域サイズも更新
function updateCenters() {
  try {
    const st = stageRef.value?.getBoundingClientRect();
    if (!st) return;
    stageSize.value = { w: st.width, h: st.height } as any;
    centers.value = props.options.map((_, idx) => {
      const el = (spotRefs.value as any)[idx];
      if (!el) return { x: stageSize.value.w / 2, y: stageSize.value.h / 2 } as any;
      const r = el.getBoundingClientRect();
      return { x: r.left - st.left + r.width / 2, y: r.top - st.top + r.height / 2 } as any;
    });
    updateEmitter();
  } catch {}
}

// 初期化：レイアウト計測→ループ開始→スポーン準備
onMounted(() => {
  nextTick().then(updateCenters);
  window.addEventListener('resize', updateCenters);
  rafId = requestAnimationFrame(stepPhysics);
  nextTick().then(() => { updateEmitter(); syncPhysicsWithVotes(); });
});

// 終了処理：アニメ停止とイベント解除
onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId);
  window.removeEventListener('resize', updateCenters);
});

watch(() => props.options, () => { ensureShape(); nextTick().then(updateCenters); });
watch(() => props.votes, () => nextTick().then(syncPhysicsWithVotes), { deep: true });
watch(() => props.optionColors, () => nextTick().then(syncPhysicsWithVotes), { deep: true });
</script>

<template>
  <div class="cluster-stage" ref="stageRef">
    <div v-for="(opt, idx) in options" :key="'spot-'+idx" class="spot" :ref="el => (spotRefs[idx] = el as any)">
      <div class="spot-center" :style="{ background: optionColors[idx] || '#26a69a' }"></div>
      <div class="option-label">{{ opt }}</div>
      <div class="ball-count">{{ (votes[idx]?.length) || 0 }}票</div>
    </div>
    <div v-for="(arr, idx) in physicsBalls" :key="'balls-'+idx">
      <div v-for="(b, bi) in arr" :key="bi" class="cluster-ball"
           :style="{ left: b.x + 'px', top: b.y + 'px', width: (b.r*2)+'px', height: (b.r*2)+'px', backgroundColor: b.color, border: '3px solid rgba(0,0,0,0.15)' }" />
    </div>
  </div>
</template>

<style scoped>
.cluster-stage {
  position: relative;
  margin: 0.5rem auto 0;
  width: 100%;
  max-width: none;
  min-height: 70vh;
  padding: 18px 24px;
  background: #e0f2f1;
  border: 1px solid #b2dfdb;
  border-radius: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-around;
}
.spot {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: clamp(200px, 22vw, 320px);
  height: clamp(200px, 22vw, 320px);
  margin: 12px;
  border-radius: 14px;
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
  transform: translate(-50%, -50%);
  box-shadow: 0 4px 9px rgba(0,0,0,0.15);
  box-sizing: border-box;
}
.option-label { font-weight: bold; margin-bottom: 0.25rem; }
.ball-count {
  position: absolute;
  top: -1.2rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.9rem;
  background: rgba(255,255,255,0.92);
  padding: 2px 6px;
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  color: #263238;
  z-index: 2;
}
</style>
