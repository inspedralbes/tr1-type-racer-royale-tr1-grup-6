<script setup>
import { ref, onMounted } from 'vue';

const frases = [
  "¡Tu ets el científic en practiques! Benvingut al laboratori Atomic Syntax...",
  "El reactor sintáctic es inestable. No t'equivoquis  o explotará.",
  "Tres modes de joc , tres destinacions... ¿Quin esculls avui?",
  "Recorda: el mon es per als ràpids. Escriu més ràpid que els altres científics!",
];

const fraseActual = ref(frases[0]);

onMounted(() => {
  let idx = 0;
  setInterval(() => {
    idx = (idx + 1) % frases.length;
    fraseActual.value = frases[idx];
  }, 8000);
});
</script>

<template>
  <div class="dr-byte-panel">
    <div class="scientist">
      <img src="/img/doctorcito.png" alt="Dr. Byte" />
    </div>
    <div class="speech">
      <p>{{ fraseActual }}</p>
    </div>
  </div>
</template>

<style scoped>
.dr-byte-panel {
  position: absolute;
  left: 2%;
  bottom: 5%;
  width: 260px;
  border-radius: 10px;
  color: var(--color-text);
  font-family: 'VT323', monospace;
  padding: 12px;
  text-shadow: 0 0 4px var(--color-heading);
}

.scientist img {
  width: 100%;
  border-radius: 8px;
  margin-bottom: 6px;
  filter: brightness(1.2) drop-shadow(0 0 6px var(--color-heading));
}

.speech p {
  font-size: 1.1rem;
  line-height: 1.3;
  text-align: left;
}

@keyframes pulse {
  0% { box-shadow: 0 0 10px #00ff88; }
  50% { box-shadow: 0 0 25px #00ffaa; }
  100% { box-shadow: 0 0 10px #00ff88; }
}
</style>
