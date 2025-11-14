<template>
  <div class="lab-background">
    <div ref="container" class="falling-objects"></div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'

const container = ref(null)

onMounted(() => {
  const icons = [
    "🧪", // tubo de ensayo
    "⚗️", // matraz
    "🔬", // microscopio
    "🧬", // ADN
    "💉", // jeringa
  ]

  function spawnObject() {
    const el = document.createElement("div")
    el.className = "falling-icon"
    el.textContent = icons[Math.floor(Math.random() * icons.length)]

    // posición aleatoria
    el.style.left = Math.random() * 100 + "vw"

    // tamaño aleatorio
    const size = 20 + Math.random() * 40
    el.style.fontSize = size + "px"

    // duración aleatoria
    const duration = 5 + Math.random() * 8
    el.style.animationDuration = duration + "s"

    container.value.appendChild(el)

    // eliminar cuando termine
    setTimeout(() => el.remove(), duration * 1000)
  }

  // crear objetos cayendo cada cierto tiempo
  setInterval(spawnObject, 600)
})
</script>

<style>
.lab-background {
  position: fixed;
  inset: 0;
  z-index: -10;
  pointer-events: none;
  background: radial-gradient(
    circle at center,
    var(--color-background-soft) 0%,
    var(--color-background) 100%
  );
  overflow: hidden;
}

/* CONTENEDOR DE OBJETOS */
.falling-objects {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

/* ICONOS QUE CAEN */
.falling-icon {
  position: absolute;
  top: -60px;
  color: rgba(255, 140, 0, 0.6);
  filter: drop-shadow(0 0 10px #ff8c00);
  animation-name: fall;
  animation-timing-function: linear;
}

@keyframes fall {
  0% {
    transform: translateY(-10vh) rotate(0deg);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    transform: translateY(120vh) rotate(360deg);
    opacity: 0;
  }
}
</style>
