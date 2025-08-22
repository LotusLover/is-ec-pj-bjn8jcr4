<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue';

const props = defineProps<{
  options: string[];
  votes: any[][]; // entries may be number or { power, color? }
  optionColors: string[];
}>();

// stage & layout
const stageRef = ref<HTMLElement | null>(null);
const spotRefs = ref<HTMLElement[]>([] as any);
const stageSize = ref({ w: 900, h: 320 });
const centers = ref(props.options.map(() => ({ x: 0, y: 0 })));

// physics
const physicsBalls = ref<any[][]>(props.options.map(() => []));
const ATTRACT = 0.035;
const DAMPING = 0.92;
const REPULSE = 0.08;
const PADDING = 2;
const R_MIN = 14;
const R_MAX = 34;
function calcRadius(power: number) {
  const chargeMax = 3000;
  const t = Math.max(0, Math.min(1, (Number(power) || 0) / chargeMax));
  const eased = Math.sqrt(t);
  return R_MIN + (R_MAX - R_MIN) * eased;
}

function ensureShape() {
  if (physicsBalls.value.length !== props.options.length) {
    physicsBalls.value = props.options.map(() => []);
  }
  if (centers.value.length !== props.options.length) {
    centers.value = props.options.map(() => ({ x: 0, y: 0 }));
  }
}

function syncPhysicsWithVotes() {
  ensureShape();
  for (let idx = 0; idx < props.options.length; idx++) {
    const targetCount = props.votes?.[idx]?.length || 0;
    const arr = physicsBalls.value[idx];
    while (arr.length < targetCount) {
      const i = arr.length;
      const v = props.votes[idx][i];
      const power = (v && typeof v === 'object') ? Number(v.power) : Number(v);
      const color = ((v && typeof v === 'object') ? v.color : null) || props.optionColors?.[idx] || '#26a69a';
      const r = calcRadius(power);
      const cx = centers.value[idx]?.x ?? stageSize.value.w / 2;
      const cy = centers.value[idx]?.y ?? stageSize.value.h / 2;
      const sx = cx + (Math.random() - 0.5) * 12;
      const sy = cy + (Math.random() - 0.5) * 12;
      arr.push({ x: sx, y: sy, vx: 0, vy: 0, r, color });
    }
    while (arr.length > targetCount) arr.pop();
  }
}

let rafId = 0;
let lastTimeMs = performance.now();
function stepPhysics() {
  const now = performance.now();
  lastTimeMs = now;
  const w = stageSize.value.w;
  const h = stageSize.value.h;
  for (let idx = 0; idx < physicsBalls.value.length; idx++) {
    const arr = physicsBalls.value[idx];
    const cx = centers.value[idx]?.x ?? w / 2;
    const cy = centers.value[idx]?.y ?? h / 2;
    for (let b of arr) {
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
  } catch {}
}

onMounted(() => {
  nextTick().then(updateCenters);
  window.addEventListener('resize', updateCenters);
  rafId = requestAnimationFrame(stepPhysics);
  nextTick().then(syncPhysicsWithVotes);
});

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
  max-width: 1100px;
  min-height: 260px;
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
  width: 220px;
  height: 220px;
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
