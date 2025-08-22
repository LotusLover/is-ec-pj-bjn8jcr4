<script setup lang="ts">
import KaedeVote from '../components/Kaede_Vote.vue';

// 主催者ページを別ウィンドウで開く（ベースパスを保ったままハッシュのみ切替）
function openHostInNewWindow() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    url.hash = '#/host';
    const w = window.open(url.toString(), '_blank', 'noopener,noreferrer');
    // ポップアップブロック等で開けない場合は同タブ遷移にフォールバック
    if (!w) {
      window.location.hash = '#/host';
    }
  } catch {
    // URL生成に失敗しても最低限ハッシュ遷移
    try { window.location.hash = '#/host'; } catch {}
  }
}
</script>

<template>
  <div class="page">
    <h1>投票ページ</h1>
    <KaedeVote />
    <div class="nav">
      <p>主催者ページへは <router-link to="/host">/host</router-link></p>
      <button type="button" @click="openHostInNewWindow">主催者ページを別ウィンドウで開く</button>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 1rem; }
.nav { margin-top: 1rem; }
button { margin-top: 0.5rem; }
</style>
