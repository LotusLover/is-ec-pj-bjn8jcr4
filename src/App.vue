
<script setup lang="ts">
// Sample1.vueコンポーネントをインポートします
import myComponent from './components/Sample1-asg.vue';

// Vueのリアクティブ変数とライフサイクルフックをインポートします
import { ref, onMounted } from 'vue';

// 課題表示用のフラグ（trueなら課題名を表示）
const flgAsg = ref(false);
// ファイル名を格納する変数
const fileName = ref('');
// 課題判定用の文字列（ファイル名に含まれているかチェック）
const argId = '-asg.vue';

// コンポーネントがマウントされたときに実行される処理
onMounted(() => {
  // インポートしたコンポーネントのファイル名を取得
  fileName.value = myComponent.__file.replace(/^.*[\\\/]/, '');
  // ファイル名に「-asg.vue」が含まれているか判定
  if (-1 < fileName.value.lastIndexOf(argId)) {
    // 「-asg.vue」を除いた名前に変更
    fileName.value = fileName.value.replace(argId, '');
    // 課題表示フラグをON
    flgAsg.value = true;
  }
});
</script>


<template>
  <!-- flgAsgがtrueのときだけ課題名を表示するブロック -->
  <div v-if="flgAsg" class="question-aire">
    <div class="question">
      <!-- ファイル名を表示 -->
      <p>{{ fileName }}の課題</p>
    </div>
  </div>
  <!-- インポートしたコンポーネントを表示 -->
  <myComponent />
</template>


<style scoped>
/* 課題表示用の枠のスタイル */
.question-aire {
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 10px;
  background-color: lightseagreen;
  p {
    margin: 0;
  }
}
/* 課題名部分のスタイル */
.question {
  padding: 0.5rem;
  border-radius: 10px;
  background-color: white;
}
</style>
