<script setup>
import { ref } from 'vue';

// 回答数を保持する変数
const humanities = ref(0);
const science = ref(0);
const information = ref(0);

// 回答があった時に実行される関数
const answer = (field) => {
  if (field === '文系') {
    humanities.value++;
  } else if (field === '理系') {
    science.value++;
  }else if (field === '情報系') {
    information.value++;
  }
};

// 回答リセットボタンが押された時に実行される関数
const resetAnswer = () => {
  humanities.value = 0;
  science.value = 0;
  information.value = 0;
  console.log('回答がリセットされました');
};
</script>

<template>
  <p>何系の学部出身ですか？</p>
  <button @click="answer('文系')">文系</button>
  <button @click="answer('理系')">理系</button>
  <button @click="answer('情報系')">情報系</button>
  <hr />
  <p>回答状況</p>
  <p>文系：{{ humanities }}　理系：{{ science }}　情報系：{{ information }}</p>
  <button @click="resetAnswer()">回答リセット</button>
</template>

<style scoped></style>
