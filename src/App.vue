<script setup lang="ts">
import myComponent from './components/Sample1.vue';

import { ref, onMounted } from 'vue';
const flgAsg = ref(false);
const fileName = ref('');
const argId = '-asg.vue';
onMounted(() => {
  fileName.value = myComponent.__file.replace(/^.*[\\\/]/, '');
  if (-1 < fileName.value.lastIndexOf(argId)) {
    fileName.value = fileName.value.replace(argId, '');
    flgAsg.value = true;
  }
});
</script>

<template>
  <div v-if="flgAsg" class="question-aire">
    <div class="question">
      <p>{{ fileName }}の課題</p>
    </div>
  </div>
  <myComponent />
</template>

<style scoped>
.question-aire {
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 10px;
  background-color: lightseagreen;
  p {
    margin: 0;
  }
}
.question {
  padding: 0.5rem;
  border-radius: 10px;
  background-color: white;
}
</style>
