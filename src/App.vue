
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { onMounted, onUnmounted, ref } from 'vue';

const router = useRouter();
const isEmbed = typeof window !== 'undefined' && window.self !== window.top;

function go(path: '/vote' | '/host') {
  try { router.push(path); } catch {}
}

// Optional: keyboard shortcuts for quick switching in embed
const enableHotkeys = ref(isEmbed);
function onKey(e: KeyboardEvent) {
  if (!enableHotkeys.value) return;
  if (e.key === 'h' || e.key === 'H') go('/host');
  if (e.key === 'v' || e.key === 'V') go('/vote');
}
onMounted(() => { if (enableHotkeys.value) window.addEventListener('keydown', onKey); });
onUnmounted(() => { if (enableHotkeys.value) window.removeEventListener('keydown', onKey); });
</script>

<template>
  <router-view />
  <div v-if="isEmbed" class="embed-nav">
    <button class="btn" @click="go('/vote')">投票</button>
    <button class="btn" @click="go('/host')">主催者</button>
  </div>
  
</template>

<style scoped>
.embed-nav {
  position: fixed;
  right: 12px;
  bottom: 12px;
  display: flex;
  gap: 8px;
  background: rgba(255,255,255,0.92);
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 10px;
  padding: 6px 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.12);
  z-index: 1000;
}
.btn { padding: .4em .7em; border-radius: 8px; border: none; cursor: pointer; background: #26a69a; color: #fff; }
.btn:hover { filter: brightness(1.05); }
</style>
