<script setup>
// Vueのリアクティブ変数を使うためのimport
import { ref } from 'vue';

// 入力されたメッセージを保持する変数
const userMsg = ref('');
// 画面に表示するメッセージ一覧（初期値あり）
const userMsgs = ref([
  '09:59_どの学部が多いんだろ',
  '09:58_文系出身です！他にも居るかな',
  '09:58_理系が多いと予想',
]);

// メッセージ送信ボタンが押されたときの処理
const addUserMessage = () => {
  // 入力欄が空でなければ処理
  if (userMsg.value) {
    // 現在時刻を取得して「hh:mm_メッセージ」の形で追加
    const date = new Date();
    const nowTime =
      date.getHours().toString().padStart(2, '0') +
      ':' +
      date.getMinutes().toString().padStart(2, '0');
    userMsgs.value.unshift(nowTime + '_' + userMsg.value);
    // 入力欄を空に戻す
    userMsg.value = '';
  }
};
</script>

<template>
  <!-- メッセージ入力欄と送信ボタン -->
  <div class="questionnaire">
    <div class="user-msg">
      <!-- 入力欄。userMsgにバインド -->
      <input
        type="text"
        class="input-msg"
        placeholder="メッセージ"
        v-model="userMsg"
      />
      <!-- 送信ボタン。クリックでaddUserMessage実行 -->
      <button class="send-msg-button" @click="addUserMessage()">送信</button>
    </div>
  </div>

  <!-- 送信済みメッセージ一覧を表示 -->
  <div class="user-msgs">
    <p v-for="msg in userMsgs">&#x1f603;{{ msg }}</p>
  </div>
</template>

<style scoped>
/* メッセージ入力欄と枠のスタイル */
.questionnaire {
  margin-bottom: 2rem;
  padding: 1rem;
  border-radius: 10px;
  background-color: lightseagreen;
}

/* 入力欄とボタンの横並びレイアウト */
.user-msg {
  display: flex;
  align-items: center;
}
.input-msg {
  flex: 1;
  border-radius: 3px 0 0 3px;
  border: 0;
  padding: 14px 1rem;
  margin-right: 0rem;
  box-sizing: border-box;
}
.send-msg-button {
  border-radius: 0 3px 3px 0;
  height: 43px;
}

/* メッセージ一覧の表示枠 */
.user-msgs {
  height: 4.7rem;
  overflow-y: auto;
  border-radius: 5px;
  background-color: #eeeeee;
  text-align: left;
  padding-left: 1rem;
  font-size: 0.7rem;
  margin-bottom: 1rem;
}
</style>
