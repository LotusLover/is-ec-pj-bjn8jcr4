<script setup>
import { ref } from 'vue';
</script>

<template>
  <div class="question-area">
    <p>何系の学部出身ですか？</p>
    <button class="button-red" @click="answer('文系')">文系</button>
    <button class="button-blue" @click="answer('理系')">理系</button>
  </div>
</template>

<style scoped>
button {
  margin: 1rem;
}

button:hover {
  transition: all 0.2s;
  transform: scale(1.2);
}

.button-red {
  background: red;
  color: #ffe5e2;
}

.button-blue {
  background: blue;
  color: #e2ebff;
}

.question-area {
  border: 2rem solid lightseagreen;
  border-radius: 10px;
  padding: 1rem;
}
</style>
