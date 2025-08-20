<script setup>
import { ref } from 'vue';

// 回答数を保持する変数
const humanities = ref(0);
const science = ref(0);
const information = ref(0);
const livecomment = ref('どのような回答が集まるか！');

// 回答があった時に実行される関数
const answer = (field) => {
  if (field === '文系') {
    humanities.value++;
  } else if (field === '理系') {
    science.value++;
  }else if (field === '情報系') {
    information.value++;
  }
const max = Math.max(humanities.value, science.value, information.value);
const counts = [
    { label: '文系', value: humanities.value },
    { label: '理系', value: science.value },
    { label: '情報系', value: information.value }
];
const topFields = counts.filter(c => c.value === max && c.value > 0);

if (topFields.length === 1) {
    livecomment.value = `${topFields[0].label}が優勢です！`;
} else if (topFields.length > 1 && max > 0) {
    livecomment.value = `${topFields.map(c => c.label).join('・')}が拮抗しています！`;
} else {
    livecomment.value = 'どのような回答が集まるか！';
}
  };

// 回答リセットボタンが押された時に実行される関数
const resetAnswer = () => {
  humanities.value = 0;
  science.value = 0;
  information.value = 0;
  console.log('回答がリセットされました');
  livecomment.value = 'どのような回答が集まるか！';
};
resetAnswer();
</script>

<template>
  <p>何系の学部出身ですか？</p>
  <button @click="answer('文系')">文系</button>
  <button @click="answer('理系')">理系</button>
  <button @click="answer('情報系')">情報系</button>
  <hr />
  <p>{{ livecomment }}</p>
  <p>回答状況</p>
  <p>文系：{{ humanities }}　理系：{{ science }}　情報系：{{ information }}</p>
  <button @click="resetAnswer()">回答リセット</button>
</template>

<style scoped></style>
