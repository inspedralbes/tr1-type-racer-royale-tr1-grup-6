<script setup>
import { ref, computed, onMounted, onUnmounted, defineEmits, watch } from 'vue';
import communicationManager from '../services/communicationManager.js';
import GameResult from '@/components/GameResult.vue';
import { useSounds } from '@/composables/useSounds';

const startTime = ref(null);
const endTime = ref(null);

const props = defineProps({
  initialWords: { type: Array, default: () => [] },
  intervalMs: { type: Number, default: 1500 },
  maxStack: { type: Number, default: 20 },
  players: { type: Array, default: () => [] },
  modo: { type: String, default: 'normal' },
  isSpectator: { type: Boolean, default: false },
  spectatorTargetId: { type: String, default: null },
});
const emit = defineEmits(['volverInicio', 'switchSpectatorTarget']);

const { playSound } = useSounds();

const isShaking = ref(false);
const perdedor = ref(false);
const ganador = ref(false);
const perdidoMensaje = ref('');
const filesDelTeclat = ref([
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]);
const teclaPremuda = ref('');
const JuegoTerminado = ref(false);
const eliminado = ref(false);

const estatDelJoc = ref({
  paraules: [],
  estadistiques: [],
});
const textEntratLocal = ref('');

const palabrasCompletadas = ref(0);
const remainingWords = ref([]);
let revealTimer = null;
let tempsIniciParaula = 0;

// --- ESTADOS DE POWERUPS (MEJORADOS) ---
const isFiebreActiva = ref(false); // (Fiebre del Oro)
const isInkSplatActive = ref(false); // (Tinta Pegajosa)
const isTintaBloqueado = ref(false); // (Bloqueo de Tinta)
const isVertigoActive = ref(false); // (Vértigo)
const isTeclasBailarinasActive = ref(false); // (Teclas Bailarinas)

// Lista de powerups para este modo
const powerupList = [
  'BOMBA',
  'SIMPLIFICADOR',
  'DOBLE_O_RES',
  'TINTA',
  'TECLAT_BOIG',
  'TERRATREMOL',
];
// --- FIN ESTADOS POWERUPS ---

const localPlayers = ref([]);

watch(
  () => props.players,
  (propPlayers) => {
    propPlayers.forEach((propP) => {
      let localP = localPlayers.value.find((p) => p.id === propP.id);
      if (localP) {
        Object.assign(localP, propP);
      } else {
        localPlayers.value.push(JSON.parse(JSON.stringify(propP)));
      }
    });
  },
  { deep: true, immediate: true },
);

const watchedPlayer = computed(() => {
  if (!props.isSpectator || !props.spectatorTargetId) return null;
  const target = localPlayers.value.find(
    (p) => p.id === props.spectatorTargetId,
  );
  return target || localPlayers.value[0] || null;
});

const wordStack = computed(() => {
  if (props.isSpectator) {
    return watchedPlayer.value?.wordStack || [];
  } else {
    return estatDelJoc.value.paraules;
  }
});

const sortedPlayers = computed(() => {
  return [...localPlayers.value].sort(
    (a, b) => (b.completedWords || 0) - (a.completedWords || 0),
  );
});

const paraulaActiva = computed(() => {
  if (wordStack.value.length === 0) {
    return null;
  }
  return wordStack.value[wordStack.value.length - 1];
});

const displayedText = computed(() => {
  if (props.isSpectator) {
    return watchedPlayer.value?.currentWordProgress || '';
  } else {
    return textEntratLocal.value;
  }
});

const totalErrors = ref(0);

function handleVolverInicio() {
  emit('volverInicio');
}

function convertirEnEspectador() {
  console.log('Sol·licitant convertir-se en espectador...');
  communicationManager.requestSpectate();
}

// --- UTILIDAD SHUFFLE (Para Bomba de Escombros) ---
function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
}

// --- CEREBRO DE POWERUPS (ACTIVACIÓN MEJORADA) ---
function getOponentPerAtacar() {
  const oponents = localPlayers.value.filter(
    (p) => p.id !== communicationManager.getId() && !p.eliminated,
  );
  if (oponents.length === 0) return null;
  oponents.sort((a, b) => (b.completedWords || 0) - (a.completedWords || 0));
  return oponents[0].id;
}

function activarPowerup(powerupType) {
  console.log('Activant Powerup:', powerupType);
  const targetId = getOponentPerAtacar();

  switch (powerupType) {
    case 'BOMBA': // Bomba de Escombros
      const numAEliminar = Math.min(estatDelJoc.value.paraules.length - 1, 3);
      if (numAEliminar > 0) {
        estatDelJoc.value.paraules.splice(0, numAEliminar);
        estatDelJoc.value.paraules = shuffle(estatDelJoc.value.paraules);
        playSound('bomba_shuffle');
      }
      break;

    case 'SIMPLIFICADOR': // Amnesia Temporal
      estatDelJoc.value.paraules.forEach((p) => {
        if (p !== paraulaActiva.value && p.text.length > 3) {
          p.text = 'PAU';
        }
      });
      textEntratLocal.value = '';
      playSound('amnesia_flash');
      break;

    case 'DOBLE_O_RES': // Fiebre del Oro
      isFiebreActiva.value = true;
      playSound('fiebre_activada');
      setTimeout(() => {
        isFiebreActiva.value = false;
      }, 10000);
      break;

    case 'TINTA': // Tinta Pegajosa
    case 'TECLAT_BOIG': // Teclas Bailarinas
    case 'TERRATREMOL': // Vértigo
      if (targetId) {
        communicationManager.sendPowerupAttack(targetId, powerupType);
      }
      break;
  }
}
// --- FIN CEREBRO POWERUPS ---

// --- CEREBRO DE POWERUPS (RECEPCIÓN MEJORADA) ---
function rebreAtacPowerup(effectType, payload) {
  console.log('Atac rebut:', effectType);
  switch (effectType) {
    case 'TINTA': // Tinta Pegajosa
      isInkSplatActive.value = true;
      isTintaBloqueado.value = true;
      playSound('tinta_splat');
      break;

    case 'TERRATREMOL': // Vértigo
      isVertigoActive.value = true;
      playSound('vertigo_rumble');
      setTimeout(() => {
        isVertigoActive.value = false;
      }, 3000);
      break;

    case 'TECLAT_BOIG': // Teclas Bailarinas
      isTeclasBailarinasActive.value = true;
      playSound('teclas_locas');
      setTimeout(() => {
        isTeclasBailarinasActive.value = false;
      }, 5000);
      break;
  }
}

// --- HANDLEKEYDOWN (MEJORADO) ---
function handleKeyDown(event) {
  if (JuegoTerminado.value || props.isSpectator || perdedor.value) return;

  const key = event.key;

  // --- Lógica Tinta Pegajosa ---
  if (isTintaBloqueado.value) {
    event.preventDefault();
    if (key === 'Backspace') {
      textEntratLocal.value = textEntratLocal.value.slice(0, -1);
    } else if (key.length === 1 && /^[a-zA-Z]$/.test(key)) {
      textEntratLocal.value += key;
    }

    if (textEntratLocal.value.toLowerCase() === 'net') {
      isTintaBloqueado.value = false;
      isInkSplatActive.value = false;
      textEntratLocal.value = '';
      playSound('tinta_limpiar');
    }
    return;
  }
  // --- Fin Lógica Tinta ---

  if (key.length === 1 && /^[a-zA-Z]$/.test(key)) {
    teclaPremuda.value = key.toUpperCase();
    setTimeout(() => {
      teclaPremuda.value = '';
    }, 100);
  }

  // --- Lógica Teclas Bailarinas ---
  let finalKey = key;
  if (isTeclasBailarinasActive.value) {
    if (key.length === 1 && /^[a-zA-Z]$/.test(key)) {
      const charCode = key.toLowerCase().charCodeAt(0);
      if (charCode >= 97 && charCode <= 122) {
        const newCode = 122 - (charCode - 97);
        finalKey = String.fromCharCode(newCode);
        if (key === key.toUpperCase()) {
          finalKey = finalKey.toUpperCase();
        }
      }
    }
  }
  // --- Fin Lógica Teclas Bailarinas ---

  if (finalKey === 'Backspace') {
    event.preventDefault();
    textEntratLocal.value = textEntratLocal.value.slice(0, -1);
  } else if (finalKey.length === 1 && /^[a-zA-Z]$/.test(finalKey)) {
    event.preventDefault();
    textEntratLocal.value += finalKey;
  } else {
    event.preventDefault();
    return;
  }
  validarProgres();
}
function iniciarCronometreParaula() {
  tempsIniciParaula = Date.now();
}

// --- VALIDARPROGRES (MEJORADO) ---
function validarProgres() {
  if (isTintaBloqueado.value) return;
  if (JuegoTerminado.value || props.isSpectator || perdedor.value) return;

  if (textEntratLocal.value.length === 1 && tempsIniciParaula === 0) {
    iniciarCronometreParaula();
  }
  if (!startTime.value && textEntratLocal.value.length === 1) {
    startTime.value = Date.now();
  }

  const typed = textEntratLocal.value;
  const paraula =
    estatDelJoc.value.paraules[estatDelJoc.value.paraules.length - 1];

  communicationManager.updatePlayerProgress({
    currentWordProgress: typed,
    wordStack: estatDelJoc.value.paraules,
  });

  if (!paraula) {
    textEntratLocal.value = '';
    return;
  }
  if (typed.length > 0) {
    const lastCharIndex = typed.length - 1;
    if (lastCharIndex < paraula.text.length) {
      if (typed[lastCharIndex] !== paraula.text[lastCharIndex]) {
        playSound('keyError');
        isShaking.value = true;
        setTimeout(() => {
          isShaking.value = false;
        }, 400);
      } else {
        playSound('keyPress');
      }
    } else {
      playSound('keyError');
      isShaking.value = true;
      setTimeout(() => {
        isShaking.value = false;
      }, 400);
    }
  }
  if (
    !Array.isArray(paraula.letterErrors) ||
    paraula.letterErrors.length !== paraula.text.length
  ) {
    paraula.letterErrors = Array.from(
      { length: paraula.text.length },
      () => false,
    );
  }
  let errorCount = 0;
  for (let i = 0; i < typed.length; i++) {
    if (i >= paraula.text.length) break;
    const isError = typed[i] !== paraula.text[i];
    if (isError) {
      if (!paraula.letterErrors[i]) {
        totalErrors.value++;
        if (isFiebreActiva.value) {
          // Fiebre del Oro (Penalización)
          totalErrors.value++;
        }
      }
      paraula.letterErrors[i] = true;
      errorCount++;
    } else {
      paraula.letterErrors[i] = false;
    }
  }
  paraula.errors = errorCount;

  if (typed === paraula.text) {
    palabrasCompletadas.value++;
    if (isFiebreActiva.value) {
      // Fiebre del Oro (Recompensa)
      palabrasCompletadas.value++;
      playSound('fiebre_puntua');
    }

    const powerupActivat = paraula.powerup;

    estatDelJoc.value.paraules.pop();
    textEntratLocal.value = '';
    tempsIniciParaula = 0;

    const progressPayload = {
      completedWords: palabrasCompletadas.value,
      totalErrors: totalErrors.value,
      playTime: (endTime.value || Date.now()) - (startTime.value || Date.now()),
      currentWordProgress: '',
      wordStack: estatDelJoc.value.paraules,
    };

    communicationManager.updatePlayerProgress(progressPayload);

    if (powerupActivat) {
      activarPowerup(powerupActivat);
    }

    const nextParaula =
      estatDelJoc.value.paraules[estatDelJoc.value.paraules.length - 1];
    if (nextParaula) {
      if (
        !Array.isArray(nextParaula.letterErrors) ||
        nextParaula.letterErrors.length !== nextParaula.text.length
      ) {
        nextParaula.letterErrors = Array.from(
          { length: nextParaula.text.length },
          () => false,
        );
        nextParaula.errors = 0;
      }
    }
  }
}
function onGameEnd() {
  if (!endTime.value) {
    endTime.value = Date.now();
  }
}

function getClasseLletra(indexLletra) {
  if (!paraulaActiva.value) return '';
  const typed = displayedText.value;
  const target = paraulaActiva.value.text;

  const classes = [];

  if (indexLletra === typed.length) {
    classes.push('caret');
  }

  if (indexLletra >= typed.length) {
    if (paraulaActiva.value.letterErrors[indexLletra]) {
      classes.push('incorrecte');
    }
  } else {
    classes.push(
      typed[indexLletra] === target[indexLletra] ? 'correcte' : 'incorrecte',
    );
  }

  return classes.join(' ');
}

onMounted(() => {
  if (!props.isSpectator) {
    window.addEventListener('keydown', handleKeyDown);
  }

  communicationManager.onPowerupAttacked((effectType, payload) => {
    rebreAtacPowerup(effectType, payload);
  });

  if (
    !props.isSpectator &&
    estatDelJoc.value.paraules.length === 0 &&
    Array.isArray(props.initialWords) &&
    props.initialWords.length > 0
  ) {
    remainingWords.value = props.initialWords.slice();
  }

  const ownPlayer = localPlayers.value.find(
    (p) => p.id === communicationManager.getId(),
  );
  if (ownPlayer) {
    ownPlayer.completedWords = palabrasCompletadas.value;
  }

  if (
    !JuegoTerminado.value &&
    estatDelJoc.value.paraules.length >= props.maxStack
  ) {
    if (!props.isSpectator) {
      communicationManager.reportPlayerLost();
    }
  }

  communicationManager.onPlayerEliminated((data) => {
    if (JuegoTerminado.value) return;

    if (data.playerId === communicationManager.getId() && !props.isSpectator) {
      perdedor.value = true;
      ganador.value = false;
      eliminado.value = true;

      onGameEnd();

      const finalPlayTime =
        (endTime.value || Date.now()) - (startTime.value || Date.now());
      const finalCompletedWords = palabrasCompletadas.value;
      const finalTotalErrors = totalErrors.value;

      communicationManager.updatePlayerProgress({
        completedWords: finalCompletedWords,
        totalErrors: finalTotalErrors,
        playTime: finalPlayTime,
        eliminated: true,
      });

      const self = localPlayers.value.find((p) => p.id === data.playerId);
      if (self) {
        self.completedWords = finalCompletedWords;
        self.totalErrors = finalTotalErrors;
        self.playTime = finalPlayTime;
        self.eliminated = true;
      }

      perdidoMensaje.value =
        data?.message || 'Has perdut: massa paraules acumulades.';
      playSound('gameLose');
      if (revealTimer) {
        clearInterval(revealTimer);
        revealTimer = null;
      }
    }
  });

  communicationManager.onPlayerWon((data) => {
    if (JuegoTerminado.value) return;

    if (data.winnerId === communicationManager.getId() && !props.isSpectator) {
      ganador.value = true;
      perdedor.value = false;
      perdidoMensaje.value =
        data?.message || 'Has guanyat! Tots els altres han estat eliminats.';
      playSound('gameWin');
    }

    JuegoTerminado.value = true;
    if (revealTimer) {
      clearInterval(revealTimer);
      revealTimer = null;
    }
  });

  communicationManager.onGameOver((data) => {
    if (JuegoTerminado.value) return;
    onGameEnd();

    if (props.isSpectator) {
      ganador.value = false;
      perdidoMensaje.value =
        data.message || `La partida ha acabat. Guanyador: ${data.winnerName}.`;
    } else {
      if (!props.isSpectator) {
        const finalPlayTime =
          (endTime.value || Date.now()) - (startTime.value || Date.now());
        const finalCompletedWords = palabrasCompletadas.value;
        const finalTotalErrors = totalErrors.value;

        communicationManager.updatePlayerProgress({
          completedWords: finalCompletedWords,
          totalErrors: finalTotalErrors,
          playTime: finalPlayTime,
        });

        const self = localPlayers.value.find(
          (p) => p.id === communicationManager.getId(),
        );
        if (self && !self.eliminated) {
          self.completedWords = finalCompletedWords;
          self.totalErrors = finalTotalErrors;
          self.playTime = finalPlayTime;
        }
      }

      if (data.winnerId === communicationManager.getId()) {
        ganador.value = true;
        perdedor.value = false;
        playSound('gameWin');
        perdidoMensaje.value =
          data.message || 'Has guanyat! Tots els altres han estat eliminats.';
      } else {
        ganador.value = false;
        perdedor.value = true;
        playSound('gameLose');
        perdidoMensaje.value =
          data.message || `Has perdut. ${data.winnerName} ha guanyat.`;
      }
    }

    JuegoTerminado.value = true;
    if (revealTimer) {
      clearInterval(revealTimer);
      revealTimer = null;
    }
  });

  if (!JuegoTerminado.value && !props.isSpectator) {
    revealTimer = setInterval(() => {
      if (JuegoTerminado.value || perdedor.value) return;
      try {
        if (
          remainingWords.value.length > 0 &&
          estatDelJoc.value.paraules.length < props.maxStack
        ) {
          const nextText = remainingWords.value.shift();

          let powerupType = null;
          // Solo genera powerups en modo normal
          if (props.modo === 'normal' && Math.random() < 0.15) {
            powerupType =
              powerupList[Math.floor(Math.random() * powerupList.length)];
          }

          const newParaula = {
            id: Date.now() + Math.random(),
            text: nextText,
            estat: 'pendent',
            errors: 0,
            letterErrors: Array.from({ length: nextText.length }, () => false),
            powerup: powerupType,
          };
          estatDelJoc.value.paraules.unshift(newParaula);
          playSound('newWord');

          communicationManager.updatePlayerProgress({
            wordStack: estatDelJoc.value.paraules,
          });
        }

        if (
          estatDelJoc.value.paraules.length >= props.maxStack &&
          !perdedor.value &&
          !JuegoTerminado.value
        ) {
          communicationManager.reportPlayerLost();
        }
      } catch (e) {
        console.error('Error en revealTimer:', e);
      }
    }, props.intervalMs || 3000);
  }
});

onUnmounted(() => {
  if (!props.isSpectator) {
    window.removeEventListener('keydown', handleKeyDown);
  }
  if (revealTimer) {
    clearInterval(revealTimer);
    revealTimer = null;
  }
});
</script>

<template>
  <div>
    <div v-if="isFiebreActiva" class="powerup-indicator-doble">
      FEBRE DE L'OR ACTIVADA! (x2)
    </div>

    <div class="game-header">
      <h2 class="modo-titulo">
        Mode de joc:
        <span :class="['modo-text', props.modo]">
          {{ props.modo === 'muerteSubita' ? 'Muerte Súbita' : 'Normal' }}
        </span>
      </h2>
    </div>

    <div v-if="isInkSplatActive" class="powerup-overlay-tinta">
      <div class="tinta-clear-box">Escriu <span>NET</span> per netejar</div>
    </div>

    <div v-if="isTeclasBailarinasActive" class="powerup-indicator-boig">
      TECLES BAILARINES!
    </div>

    <div
      class="game-layout"
      :class="{ 'shake-animation-continuous': isVertigoActive }"
    >
      <div class="game-main">
        <TransitionGroup
          name="fall"
          tag="div"
          class="paraules-container"
          :class="{
            'danger-zone': wordStack.length > props.maxStack * 0.75,
          }"
        >
          <div
            v-for="(paraula, index) in wordStack"
            :key="paraula.id"
            class="paraula"
            :class="{
              'paraula-activa': index === wordStack.length - 1,
              'powerup-vertigo-blur':
                isVertigoActive && index === wordStack.length - 1,
              [`powerup-${paraula.powerup}`]:
                paraula.powerup && props.modo === 'normal',
            }"
          >
            <template v-if="index === wordStack.length - 1">
              <span
                v-for="(lletra, i) in paraula.text.split('')"
                :key="i"
                class="lletra"
                :class="getClasseLletra(i)"
              >
                {{ lletra }}
              </span>
            </template>
            <template v-else>
              {{ paraula.text }}
            </template>
          </div>
        </TransitionGroup>

        <input
          type="text"
          class="text-input"
          :class="{
            'shake-animation': isShaking,
            'tinta-input-blocked': isTintaBloqueado,
          }"
          :value="displayedText"
          @input="textEntratLocal = $event.target.value"
          :placeholder="
            isTintaBloqueado
              ? '¡ESCRIBE &quot;NET&quot;!'
              : props.isSpectator
              ? 'MODO ESPECTADOR'
              : '> Comença a escriure...'
          "
          :disabled="JuegoTerminado || perdedor"
          :readonly="props.isSpectator || isTintaBloqueado"
        />

        <div class="teclat" v-if="!props.isSpectator">
          <div
            v-for="(fila, fIndex) in filesDelTeclat"
            :key="fIndex"
            class="fila"
          >
            <div
              v-for="lletra in fila"
              :key="lletra"
              class="tecla"
              :class="{ 'tecla-premuda': teclaPremuda === lletra }"
            >
              {{ lletra }}
            </div>
          </div>
        </div>
      </div>

      <aside class="players-sidebar">
        <h3 v-if="props.isSpectator" class="spectator-banner">
          [MODO ESPECTADOR]
        </h3>
        <div
          v-if="props.isSpectator && !JuegoTerminado"
          class="spectator-controls"
        >
          <h4>Mirant a: {{ watchedPlayer?.name || '...' }}</h4>
          <div class="spectator-targets">
            <button
              v-for="p in localPlayers"
              :key="p.id"
              @click="emit('switchSpectatorTarget', p.id)"
              :class="{ 'target-active': p.id === props.spectatorTargetId }"
              :title="
                p.eliminated ? `${p.name} (Eliminat)` : `Canviar a ${p.name}`
              "
              :disabled="p.eliminated"
            >
              {{ p.name.substring(0, 3) }}
            </button>
          </div>
        </div>

        <div
          v-if="props.isSpectator && !JuegoTerminado"
          class="spectator-controls"
        >
          <h4>Mirant a: {{ watchedPlayer?.name || '...' }}</h4>
          <div class="spectator-targets">
            <button
              v-for="p in localPlayers"
              :key="p.id"
              @click="emit('switchSpectatorTarget', p.id)"
              :class="{ 'target-active': p.id === props.spectatorTargetId }"
              :title="
                p.eliminated ? `${p.name} (Eliminat)` : `Canviar a ${p.name}`
              "
              :disabled="p.eliminated"
            >
              {{ p.name.substring(0, 3) }}
            </button>
          </div>
          <button @click="handleVolverInicio" class="spectator-exit-btn">
            Sortir al Lobby
          </button>
        </div>

        <h3>[CIENTÍFICS]</h3>
        <ul>
          <li
            v-for="p in sortedPlayers"
            :key="p.id"
            class="player-name-inline"
            :class="{ eliminado: p.eliminated }"
          >
            <span
              class="color-dot"
              :style="{
                backgroundColor: p.color,
                filter: `brightness(1.5) drop-shadow(0 0 5px ${p.color})`,
              }"
              aria-hidden="true"
            ></span>
            <span class="player-name-text">{{ p.name }}</span>
            <span
              v-if="p.eliminated"
              style="color: #dc3545; font-weight: bold; margin-left: 10px"
            >
              Eliminat
            </span>
            <span class="completed-count">
              [Paraules: {{ p.completedWords || 0 }}]
            </span>
          </li>
        </ul>
        <div v-if="props.modo === 'normal'" class="powerup-legend">
          <h4 class="legend-title">[ POWERUPS ]</h4>
          <ul class="legend-list">
            <li class="legend-item">
              <span class="color-dot powerup-BOMBA"></span>
              <div>
                <strong>Bomba Escombros:</strong> Elimina 3 paraules, però
                barreja la resta.
              </div>
            </li>
            <li class="legend-item">
              <span class="color-dot powerup-SIMPLIFICADOR"></span>
              <div>
                <strong>Amnesia:</strong> Fa fàcils les paraules en espera, però
                buida el teu text.
              </div>
            </li>
            <li class="legend-item">
              <span class="color-dot powerup-DOBLE_O_RES"></span>
              <div>
                <strong>Fiebre del Oro:</strong> Punts x2 (i errors x2) durant
                10s.
              </div>
            </li>
            <li class="legend-item">
              <span class="color-dot powerup-ATAQUE"></span>
              <div>
                <strong>Atac (Morat):</strong> Llança un atac (Tinta, Vértigo,
                Teclas) al líder.
              </div>
            </li>
          </ul>
        </div>
      </aside>
    </div>

    <div
      v-if="perdedor && !JuegoTerminado && !isSpectator"
      class="overlay-eliminado"
    >
      <div class="overlay-content">
        <h2>Has estat eliminat</h2>
        <p>{{ perdidoMensaje || 'Mala sort!' }}</p>
        <div class="opciones-perdedor">
          <button @click="convertirEnEspectador" class="btn btn-espectador">
            Veure Partida
          </button>
          <button @click="handleVolverInicio" class="btn btn-salir">
            Salir al Lobby
          </button>
        </div>
      </div>
    </div>

    <GameResult
      v-if="JuegoTerminado"
      :winner="ganador"
      :loser="perdedor"
      :message="perdidoMensaje"
      :players="localPlayers"
      @volverInicio="handleVolverInicio"
      :modo="props.modo"
      :isSpectator="props.isSpectator"
    />
    <div v-if="JuegoTerminado && !isSpectator" class="final-actions">
      <button @click="handleVolverInicio" class="btn btn-salir">
        Sortir al Lobby
      </button>
    </div>
  </div>
</template>

<style scoped>
/* --- ESTILOS LLEGENDA POWERUPS --- */
.powerup-legend {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px dashed var(--color-border, #ccc);
}
.legend-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-heading);
  text-align: center;
  margin-bottom: 12px;
}
.legend-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.legend-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.95rem;
  color: var(--color-text);
  margin-bottom: 10px;
}
.legend-item strong {
  color: var(--color-heading);
  font-weight: 700;
}
.legend-item .color-dot {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.2);
  margin-top: 3px;
} /* <-- *** CORRECCIÓN 2: Llave cerrada *** */

/* --- Colores de la Leyenda --- */
.color-dot.powerup-BOMBA {
  background-color: var(--color-error, #dc3545);
}
.color-dot.powerup-SIMPLIFICADOR {
  background-color: var(--color-success, #28a745);
}
.color-dot.powerup-DOBLE_O_RES {
  background: linear-gradient(
    90deg,
    var(--color-primary),
    var(--color-success)
  );
}
.color-dot.powerup-ATAQUE {
  background-color: #4b016d;
}

/* --- ESTILOS DE POWERUPS --- */

/* --- Colores de Palabras --- */
.paraula.powerup-BOMBA {
  background-color: var(--color-error, #dc3545);
  color: white;
  border-color: #ffc107;
  animation: pulse-danger-border 1.5s infinite;
}
.paraula.powerup-SIMPLIFICADOR {
  background-color: var(--color-success, #28a745);
  color: white;
  border-color: #a7f3d0;
}
.paraula.powerup-DOBLE_O_RES {
  background: linear-gradient(
    90deg,
    var(--color-primary),
    var(--color-success)
  );
  color: white;
  border-color: white;
  animation: pulse-focus 1s infinite;
}
.paraula.powerup-TINTA,
.paraula.powerup-TECLAT_BOIG,
.paraula.powerup-TERRATREMOL {
  background-color: #4b016d;
  color: white;
  border-color: #c490e7;
  animation: flicker-danger 2s infinite;
}

/* --- Efectos de Ataque (Mejorados) --- */

.powerup-overlay-tinta {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    circle at 50% 50%,
    rgba(0, 0, 0, 0.8) 30%,
    rgba(0, 0, 0, 0.6) 60%,
    rgba(0, 0, 0, 0) 80%
  );
  z-index: 200;
  pointer-events: none;
  opacity: 0.9;
  display: flex;
  justify-content: center;
  align-items: center;
}
.tinta-clear-box {
  pointer-events: all;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  padding: 20px 30px;
  border-radius: 12px;
  font-size: 1.5rem;
  font-weight: 700;
  border: 3px solid var(--color-primary);
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
}
.tinta-clear-box span {
  color: var(--color-primary);
  font-family: 'Courier New', Courier, monospace;
}
.tinta-input-blocked {
  border-color: #333 !important;
  background: #6c757d !important;
  color: #ccc !important;
}

.powerup-indicator-boig {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  background-color: var(--color-error);
  color: white;
  border-radius: 8px;
  z-index: 200;
  font-weight: bold;
  font-size: 1.5rem;
  animation: flicker-danger 1s infinite;
}

.shake-animation-continuous {
  animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both infinite;
}

.paraula-activa.powerup-vertigo-blur {
  filter: blur(1.5px);
  transform: scale(1.05);
}

.powerup-indicator-doble {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 15px;
  background: linear-gradient(
    90deg,
    var(--color-primary),
    var(--color-success)
  );
  color: white;
  border-radius: 8px;
  z-index: 200;
  font-weight: bold;
  font-size: 1.2rem;
  animation: pulse-focus 1s infinite;
}

.spectator-banner {
  color: var(--color-warning, #ffc107);
  background: var(--color-background);
  border: 1px solid var(--color-warning, #ffc107);
  padding: 5px;
  text-align: center;
  border-radius: 4px;
  margin-bottom: 10px !important;
}
.spectator-controls {
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--color-border);
}
.spectator-controls h4 {
  margin: 0 0 8px;
  color: var(--color-text);
  font-size: 1.5rem;
  text-align: center;
}
.spectator-targets {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  justify-content: center;
}
.spectator-targets button {
  padding: 4px 8px;
  font-size: 1.2rem;
  background-color: var(--color-background-soft);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  cursor: pointer;
}
.spectator-targets button:hover {
  background-color: var(--color-border);
}
.spectator-targets button.target-active {
  background-color: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
  font-weight: bold;
}
/* *** CORRECCIÓN 3: Estilo .spectator-exit-btn eliminado *** */

.correcte {
  color: var(--color-success);
  font-weight: bold;
}
.incorrecte {
  color: var(--color-background);
  background-color: var(--color-heading);
  border-radius: 3px;
}
.teclat {
  position: sticky;
  bottom: 0;
  margin-top: 12px;
  display: block;
  max-width: 100%;
  padding: 10px 0 16px;
  z-index: 30;
}
.fila {
  margin-bottom: 5px;
  display: flex;
  justify-content: center;
}
.tecla {
  display: inline-flex;
  padding: 10px;
  border-radius: 8px;
  border: 2px solid var(--color-text-muted);
  min-width: 40px;
  height: 45px;
  margin: 2px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.1s ease-out;
  font-weight: bold;
  background: transparent;
  color: var(--color-text);
  font-size: 1.5rem;
}
.tecla:hover {
  background-color: var(--color-border);
}
.tecla-premuda {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-background);
  transform: scale(0.95);
  text-shadow: none;
}
.game-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  flex-wrap: nowrap;
  justify-content: center;
}
.game-main {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  min-height: calc(60vh);
  max-height: calc(80vh);
}
.players-sidebar {
  width: 300px;
  background: var(--color-background-soft);
  border-radius: 12px;
  padding: 12px 16px;
  border: 2px solid var(--color-border);
  box-shadow: 0 0 18px var(--shadow-color), inset 0 0 10px var(--shadow-color);
  max-height: calc(80vh);
  display: flex;
  flex-direction: column;
}
.players-sidebar h3 {
  margin: 0 0 12px 0;
  color: var(--color-heading);
  font-weight: 700;
  font-size: 1.5rem;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
  text-align: center;
}

.players-sidebar ul {
  overflow-y: auto;
  flex-grow: 1;
  padding-right: 5px; /* Add some space for the scrollbar */
  margin-right: -5px; /* Compensate for the padding */
  scrollbar-width: thin;
  scrollbar-color: var(--color-primary) var(--color-background);
}

.players-sidebar ul::-webkit-scrollbar {
  width: 8px;
}

.players-sidebar ul::-webkit-scrollbar-track {
  background: var(--color-background);
}

.players-sidebar ul::-webkit-scrollbar-thumb {
  background-color: var(--color-primary);
  border-radius: 4px;
  border: 2px solid var(--color-background);
}
.player-name-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  border-radius: 6px;
  color: var(--color-text);
  font-weight: 700;
  font-size: 1.3rem;
  transition: opacity 0.3s ease;
}
.player-name-inline.eliminado {
  opacity: 0.5;
}
.player-name-text {
  font-weight: 700;
  color: var(--color-heading);
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.completed-count {
  font-size: 1.1rem;
  color: var(--color-text-muted);
  background: var(--color-background);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  flex-shrink: 0;
}
.color-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-right: 8px;
  flex-shrink: 0;
  border: 1px solid var(--color-text-muted);
}
.paraules-container {
  border: 2px solid var(--color-text-muted);
  background: rgba(32, 255, 32, 0.05);
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-radius: 12px;
  box-shadow: inset 0 0 10px var(--shadow-color);
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.paraula {
  padding: 8px 12px;
  margin-bottom: 6px;
  border-radius: 8px;
  background: var(--color-border);
  border: 1px solid var(--color-text-muted);
  transition: all 0.3s ease;
  font-size: 1.8rem;
  color: var(--color-text-muted);
  opacity: 0.8;
  text-align: center;
  font-weight: 500;
}
.paraula-activa {
  background: var(--color-background-soft);
  color: var(--color-heading);
  opacity: 1;
  font-size: 2.2rem;
  font-weight: bold;
  border: 2px solid var(--color-primary);
  box-shadow: 0 0 12px var(--shadow-color);
  transform: scale(1.02);
  transition: filter 0.2s ease-out, transform 0.2s ease-out; /* Para Vértigo */
}
.text-input {
  width: 100%;
  box-sizing: border-box;
  font-size: 3rem;
  padding: 12px 16px;
  border-radius: 8px;
  border: 3px solid var(--color-primary);
  margin: 14px 0 6px;
  background: var(--color-background);
  color: var(--color-heading);
  font-family: var(--font-main);
  text-align: center;
  box-shadow: 0 0 20px var(--shadow-color);
  outline: none;
  transition: border-color 0.15s;
}
.game-header {
  width: 100%;
  text-align: center;
  margin-bottom: 12px;
  position: relative;
}

.spectator-back-btn {
  position: absolute;
  top: 8px;
  right: 70px;
  background-color: var(--color-primary, #007bff);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 1rem;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
  cursor: pointer;
}
.spectator-back-btn:hover {
  transform: translateY(-1px);
  opacity: 0.9;
}
.text-input:focus {
  border-color: var(--color-success);
}
.text-input:disabled {
  background: #444851;
  color: #b3b3b3;
  opacity: 0.7;
}
.fall-enter-active {
  transition: all 0.5s ease-in;
}
.fall-enter-from {
  opacity: 0;
  transform: translateY(-40px);
}
.fall-enter-to {
  opacity: 1;
  transform: translateY(0);
}
.fall-leave-active {
  transition: all 0.3s ease-out;
  position: absolute;
}
.fall-leave-from {
  opacity: 1;
  transform: scale(1);
}
.fall-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
.fall-move {
  transition: transform 0.4s ease;
}
.shake-animation {
  animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}
@keyframes shake {
  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }
  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }
  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }
  40%,
  60% {
    transform: translate3d(4px, 0, 0);
  }
}
.modo-text {
  display: inline-block;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: var(--color-border);
  transition: all 0.3s ease;
}
.modo-text.muerteSubita {
  background-color: var(--color-error-bg);
  color: var(--color-error);
  border: 1px solid var(--color-error);
  text-shadow: 0 0 5px var(--color-error);
  animation: flicker-danger 2s infinite;
}
@keyframes flicker-danger {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 5px var(--color-error);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 10px var(--color-error);
  }
}
.lletra {
  position: relative;
  transition: all 0.1s ease;
}
.lletra.caret {
  border-left: 3px solid var(--color-primary);
  animation: blink-caret 1s step-end infinite;
}
@keyframes blink-caret {
  0%,
  100% {
    border-left-color: var(--color-primary);
  }
  50% {
    border-left-color: transparent;
  }
}
.paraules-container.danger-zone {
  border-color: var(--color-error);
  animation: pulse-danger-border 1s infinite alternate;
}
@keyframes pulse-danger-border {
  from {
    box-shadow: inset 0 0 10px var(--shadow-color);
  }
  to {
    border-color: var(--color-error);
    box-shadow: inset 0 0 20px var(--color-error), 0 0 10px var(--color-error);
  }
}
@keyframes pulse-focus {
  0% {
    box-shadow: 0 0 20px var(--shadow-color);
    border-color: var(--color-success);
  }
  50% {
    box-shadow: 0 0 30px var(--color-success), 0 0 20px var(--shadow-color);
    border-color: var(--color-success);
  }
  100% {
    box-shadow: 0 0 20px var(--shadow-color);
    border-color: var(--color-success);
  }
}
.text-input:focus {
  animation: pulse-focus 1.5s infinite;
}

/* --- NOU ESTILS AFEGITS --- */
.overlay-eliminado {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
  color: white;
}
.overlay-content {
  text-align: center;
  background: var(--color-background-soft);
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}
.overlay-content h2 {
  color: var(--color-error);
  font-size: 2.5rem;
  margin-bottom: 10px;
}
.overlay-content p {
  font-size: 1.2rem;
  margin-bottom: 30px;
}
.opciones-perdedor {
  display: flex;
  gap: 20px;
}
.opciones-perdedor .btn {
  padding: 12px 24px;
  font-size: 1.1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-family: var(--font-main);
}
.btn-espectador {
  background-color: var(--color-primary);
  color: white;
}
.btn-salir {
  background-color: var(--color-background-mute);
  color: var(--color-text);
}

.spectator-exit-btn {
  width: 100%;
  margin-top: 15px;
  padding: 10px 12px;
  font-size: 1.1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-family: var(--font-main);
  background-color: var(--color-background-mute);
  color: var(--color-text);
  transition: background-color 0.2s;
}
.spectator-exit-btn:hover {
  background-color: var(--color-border);
}
</style>
