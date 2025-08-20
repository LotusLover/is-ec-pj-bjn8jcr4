<script setup>
import { ref } from 'vue';

// 回答数を保持する変数
const humanities = ref(0);
const science = ref(0);

// 実況コメント用変数
const liveComment = ref('');

// 回答があった時に実行される関数
const answer = (field) => {
  // 回答のあった系統学部の回答数を+1
  if (field === '文系') {
    humanities.value++;
  } else if (field === '理系') {
    science.value++;
  }

  // 実況コメント更新
  if (humanities.value > science.value) {
    liveComment.value = '文系の学部が多いようです！';
  } else if (humanities.value < science.value) {
    liveComment.value = '理系の学部が多いようです！';
  } else {
    liveComment.value = 'どちらの学部も拮抗しています。';
  }
};

// 回答リセットボタンが押された時に実行される関数
const resetAnswer = () => {
  humanities.value = 0;
  science.value = 0;
  liveComment.value = 'さあ、どのような回答が集まるのか注目です。';
};
resetAnswer(); // 変数初期化

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
    labels: ['文系', '理系'],
    datasets: [
      {
        data: [humanities.value, science.value],
        backgroundColor: ['red', 'blue'],
      },
    ],
  };
});
</script>

<template>
  <p>何系の学部出身ですか？</p>
  <button class="button-red" @click="answer('文系')">文系</button>
  <button class="button-blue" @click="answer('理系')">理系</button>
  <hr />
  <p>回答状況</p>
  <Bar :options="chartOptions" :data="chartData" />
  <p>{{ liveComment }}</p>
  <img src="../assets/jikkyou.png" />
  <button @click="resetAnswer()">回答リセット</button>
</template>

<style scoped>
button {
  margin: 1rem;
}

.button-red {
  background: red;
  color: #ffe5e2;
}

.button-blue {
  background: blue;
  color: #e2ebff;
}
</style>
