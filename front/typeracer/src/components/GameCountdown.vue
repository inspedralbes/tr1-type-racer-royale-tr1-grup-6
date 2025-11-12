<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  modo: { type: String, default: 'normal' },
});

const emit = defineEmits(['countdownComplete']);

const countdown = ref(5);
const isAnimating = ref(false);

onMounted(() => {
  const interval = setInterval(() => {
    if (countdown.value > 0) {
      isAnimating.value = true;
      countdown.value--;

      setTimeout(() => {
        isAnimating.value = false;
      }, 400);

      if (countdown.value === 0) {
        clearInterval(interval);
        setTimeout(() => {
          emit('countdownComplete');
        }, 500);
      }
    }
  }, 1000);
});
</script>

<template>
  <div class="countdown-container">
    <div class="countdown-content">
      <h1 class="preparados-titulo">¿Preparados?</h1>

      <div class="modo-info">
        <p class="modo-badge" :class="modo">
          Mode: {{ modo === 'muerteSubita' ? 'Muerte Súbita' : 'Normal' }}
        </p>
      </div>

      <div class="countdown-circle" :class="{ animate: isAnimating }">
        <span class="countdown-number">{{ countdown || '¡YA!' }}</span>
      </div>

      <p class="countdown-text">
        {{
          countdown > 0 ? 'El juego empieza en...' : '¡Que empiece la carrera!'
        }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.countdown-container {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    var(--color-background) 0%,
    var(--color-background-soft) 100%
  );
  overflow: hidden;
}

.countdown-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
}

.preparados-titulo {
  font-size: 4rem;
  font-weight: 900;
  color: var(--color-heading);
  text-shadow: 0 0 20px var(--shadow-color);
  margin: 0;
  animation: pulse-title 0.6s ease-in-out;
}

@keyframes pulse-title {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.modo-info {
  margin-top: 10px;
}

.modo-badge {
  display: inline-block;
  padding: 8px 20px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 1.1rem;
  background: var(--color-background-soft);
  border: 2px solid var(--color-primary);
  color: var(--color-text);
  margin: 0;
}

.modo-badge.muerteSubita {
  background: var(--color-error-bg, #ffe5e5);
  border-color: var(--color-error, #dc3545);
  color: var(--color-error, #dc3545);
  text-shadow: 0 0 5px var(--color-error, #dc3545);
  box-shadow: 0 0 10px var(--color-error, #dc3545);
}

.countdown-circle {
  width: 250px;
  height: 250px;
  border-radius: 50%;
  background: conic-gradient(
    var(--color-primary) 0deg,
    var(--color-primary) 360deg
  );
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 0 40px var(--shadow-color), inset 0 0 20px rgba(0, 0, 0, 0.1);
  animation: rotate-circle 3s linear infinite;
}

.countdown-circle.animate {
  animation: pulse-circle 0.4s ease-out;
}

@keyframes pulse-circle {
  0% {
    transform: scale(1);
    box-shadow: 0 0 40px var(--shadow-color), inset 0 0 20px rgba(0, 0, 0, 0.1);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 0 60px var(--color-primary), inset 0 0 30px rgba(0, 0, 0, 0.2);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 40px var(--shadow-color), inset 0 0 20px rgba(0, 0, 0, 0.1);
  }
}

.countdown-number {
  font-size: 5rem;
  font-weight: 900;
  color: var(--color-background);
  text-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
  z-index: 10;
  position: relative;
}

.countdown-text {
  font-size: 1.8rem;
  color: var(--color-text);
  margin: 20px 0 0;
  font-weight: 500;
  animation: fade-in 0.8s ease-in;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
