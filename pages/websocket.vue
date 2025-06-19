<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, Ref } from "vue";
import { useRoute } from "vue-router";

const audioCanvas = useTemplateRef("audio-canvas");
const messageContainer = useTemplateRef("message-container");
const selfVideoRef = ref<HTMLVideoElement | null>(null);
const selectedTopic = ref<string | null>(null);

const messageLog = ref<string[]>([]);

function logMessage(message: string) {
  messageLog.value.push(message);
  if (messageContainer.value) scroll(messageContainer);
}

function scroll(containerRef: Ref<HTMLElement | null>) {
  nextTick(() => {
    const container = containerRef.value;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  });
}

function handleWebSocketMessage(message: MessageEvent) {
  const event = JSON.parse(message.data);
  switch (event.type) {
    case "response.audio.delta": {
      enqueueAudio(base64ToArrayBuffer(event.delta));
      break;
    }
    case "response.audio_transcript.done":
      setTimeout(() => logMessage(`🤖: ${event.transcript}`), 100);
      break;
    case "response.input_audio_transcription.done":
      logMessage(`😄: ${event.transcript}`);
      break;
    case "error":
      if (isRecording.value) stopRecording();
      if (event.code === "session_expired") disconnect();
      break;
    default:
      break;
  }
}

const isLocal = window.location.hostname === 'localhost';

const { connect, isConnected, disconnect, sendMessage } = useRealtimeApi({
  url: isLocal
    ? 'ws://localhost:3000/ws' // ✅ For local testing
    : 'wss://realtime-api-lake.vercel.app/ws', // ✅ For production
  logMessage,
  onMessageCallback: handleWebSocketMessage,
});


function handleAudioFlush(buffer: ArrayBuffer) {
  sendMessage({
    type: "input_audio_buffer.append",
    audio: arrayBufferToBase64(buffer),
  });
}

const { startRecording, stopRecording, enqueueAudio, isRecording } = useAudio({
  audioCanvas,
  logMessage,
  onFlushCallback: handleAudioFlush,
});

async function toggleRecording() {
  if (isRecording.value) {
    await stopRecording();
  } else {
    await startRecording();
  }
}

const route = useRoute();

onMounted(async () => {
  selectedTopic.value = (route.query.topic as string) || null;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: true,
    });
    if (selfVideoRef.value) {
      selfVideoRef.value.srcObject = stream;
    }
  } catch (err) {
    logMessage("Error occurred😭");
    console.error("Camera/Mic error:", err);
  }
});

onUnmounted(() => {
  disconnect();
});

async function handleConnect() {
  await connect();
  if (isConnected.value) {
    console.log('✅ Connected to WebSocket');
    // ❌ Don't send session.update here — it's already sent by server
  }
};



</script>

<template>
  <div class="video-call">
    <div class="main-video">
      <video ref="selfVideoRef" autoplay muted playsinline class="self-video" />
    </div>

    <div class="control-bar">
      <button
        @click="handleConnect"
        :disabled="isConnected"
        class="control-btn blue"
      >
        <i class="fas fa-plug"></i>
        <span>Connect</span>
      </button>

      <button
        @click="disconnect"
        :disabled="!isConnected"
        class="control-btn red"
      >
        <i class="fas fa-phone-slash"></i>
        <span>Disconnect</span>
      </button>
      <button @click="toggleRecording" class="control-btn green">
        <i :class="isRecording ? 'fas fa-stop' : 'fas fa-microphone'"></i>
        <span>{{ isRecording ? "Stop" : "Record" }}</span>
      </button>
    </div>

    <div ref="message-container" class="conversation-box">
      <div class="waveform-small">
        <canvas
          ref="audio-canvas"
          width="60"
          height="60"
          class="waveform-circle"
        />
      </div>
      <div v-for="msg in messageLog" :key="msg" class="message">
        {{ msg }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-call {
  font-family: "Roboto", sans-serif;
  background: #1e1e1e;
  color: white;
  height: 100vh;
  padding: 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
}

.main-video {
  width: 100%;
  max-width: 600px;
  aspect-ratio: 4/3;
  background: black;
  border-radius: 1rem;
  overflow: hidden;
  align-self: center;
}

.self-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.control-bar {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.control-btn {
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 999px;
  font-size: 1rem;
  color: white;
  background: #444;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.control-btn.blue {
  background: #2563eb;
}
.control-btn.red {
  background: #dc2626;
}
.control-btn.green {
  background: #16a34a;
}

.conversation-box {
  background: #4c8c3b;
  color: white;
  padding: 1.5rem;
  border-radius: 1.5rem;
  text-align: left;
  max-width: 600px;
  width: 100%;
  flex: 1;
  overflow-y: auto;
  align-self: center;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.waveform-small {
  display: flex;
  justify-content: flex-start;
}

.waveform-circle {
  background: white;
  width: 60px;
  height: 60px;
  border-radius: 50%;
}

.message {
  margin-bottom: 0.5rem;
}
</style>
