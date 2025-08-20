<script setup>
import { ref } from 'vue';

// 回答数を保持する変数
const humanities = ref(0);
const science = ref(0);
const information = ref(0);
const livecomment = ref('どのような回答が集まるか！');

// 棒グラフ
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js';

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
);



// 入力されたメッセージを保持する変数
const userMsg = ref('');
// 画面に表示するメッセージ一覧（初期値あり）
const userMsgs = ref([
  '09:59_どの学部が多いんだろ',
  '09:58_文系出身です！他にも居るかな',
  '09:58_理系が多いと予想',
]);

const chartOptions = computed(() => {
  return {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        border: {
          color: '#eeeeee',
        },
        grid: {
          display: false,
        },
      },
      y: {
        suggestedMax: 5,
        border: {
          dash: [4],
          color: '#eeeeee',
        },
        ticks: {
          stepSize: 1,
        },
      },
    },
  };
});

const chartData = computed(() => {
  return {
    labels: ['文系', '理系', '情報系'],
    datasets: [
      {
        data: [humanities.value, science.value, information.value],
        backgroundColor: ['red', 'blue', 'green'],
      },
    ],
  };
});

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
<div class="question-area">
  <p>何系の学部出身ですか？</p>
  <button @click="answer('文系')">文系</button>
  <button @click="answer('理系')">理系</button>
  <button @click="answer('情報系')">情報系</button>
  <hr />
    <Bar :options="chartOptions" :data="chartData" />
  <div class='arrow_box'>{{ livecomment }}</div>
  <img src="../assets/jikkyou.png" alt="実況者" />
  <p>回答状況</p>
  <p>文系：{{ humanities }}　理系：{{ science }}　情報系：{{ information }}</p>
  <button @click="resetAnswer()">回答リセット</button>
</div>

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

img {
  display: block;
  margin: auto;
}

.arrow_box{
    position:relative;
    width:500px;
    height:80px;
    background:#0099FF;
    padding:10px;
    text-align:center;
    color:#FFFFFF;
    font-size:30px;
    font-weight:bold;
    border-radius:10px;
    -webkit-border-radius:10px;
    -moz-border-radius:10px;
}

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
