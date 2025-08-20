<script setup>
import { ref } from 'vue';

const userMsg = ref('');
const userMsgs = ref([
  '09:59_どの学部が多いんだろ',
  '09:58_文系出身です！他にも居るかな',
  '09:58_理系が多いと予想',
]);

const addUserMessage = () => {
  if (userMsg.value) {
    const date = new Date();
    const nowTime =
      date.getHours().toString().padStart(2, '0') +
      ':' +
      date.getMinutes().toString().padStart(2, '0');
    userMsgs.value.unshift(nowTime + '_' + userMsg.value);
    userMsg.value = '';
  }
};
</script>

<template>
  <div class="questionnaire">
    <div class="user-msg">
      <input
        type="text"
        class="input-msg"
        placeholder="メッセージ"
        v-model="userMsg"
      />
      <button class="send-msg-button" @click="addUserMessage()">送信</button>
    </div>
  </div>

  <div class="user-msgs">
    <p v-for="msg in userMsgs">&#x1f603;{{ msg }}</p>
  </div>
</template>

<style scoped>
.questionnaire {
  margin-bottom: 2rem;
  padding: 1rem;
  border-radius: 10px;
  background-color: lightseagreen;
}

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
