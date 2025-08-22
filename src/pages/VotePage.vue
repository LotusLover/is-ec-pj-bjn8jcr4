<script setup lang="ts">
import KaedeVote from '../components/Kaede_Vote.vue';

// 主催者ページを別ウィンドウで開く（ベースパスを保ったままハッシュのみ切替）
function openHostInNewWindow() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    url.hash = '#/host';
    const w = window.open(url.toString(), '_blank', 'noopener,noreferrer');
    // ポップアップブロックやサンドボックスで弾かれる場合はアンカー擬似クリックで再試行
    if (!w) {
      try {
        const a = document.createElement('a');
        a.href = '#/host';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {}
      // 最終フォールバック：同タブ遷移
      try { window.location.hash = '#/host'; } catch {}
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
      <div class="actions">
        <button type="button" @click="openHostInNewWindow">主催者ページを別ウィンドウで開く</button>
        <a class="btn-link" href="#/host" target="_blank" rel="noopener noreferrer">新しいタブで開く（リンク）</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 1rem; }
.nav { margin-top: 1rem; }
.actions { display: flex; gap: .5rem; align-items: center; margin-top: .5rem; flex-wrap: wrap; }
button { margin-top: 0.5rem; }
.btn-link { color: #1a73e8; text-decoration: underline; }
</style>
