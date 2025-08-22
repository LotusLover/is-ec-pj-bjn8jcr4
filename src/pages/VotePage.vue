<script setup lang="ts">
import KaedeVote from '../components/Kaede_Vote.vue';
</script>

<template>
  <div class="page">
    <h1>投票ページ</h1>
    <KaedeVote />
    <p class="nav">主催者ページへは <router-link to="/host">/host</router-link></p>
  </div>
</template>

<style scoped>
.page { padding: 1rem; }
.nav { margin-top: 1rem; }
</style>
