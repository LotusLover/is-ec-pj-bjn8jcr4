<script setup>
import { ref } from 'vue';

// 回答数を保持する変数
const humanities = ref(3);
const science = ref(5);

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
  <Bar :options="chartOptions" :data="chartData" />
</template>
