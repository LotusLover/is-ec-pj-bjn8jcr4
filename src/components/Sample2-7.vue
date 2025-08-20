<script setup>
import { ref } from 'vue';
</script>

<template>
  <img src="../assets/jikkyou.png" />
  <button @click="resetAnswer()">回答リセット</button>
</template>

<style scoped>
img {
  display: block;
  margin: auto;
}
</style>
