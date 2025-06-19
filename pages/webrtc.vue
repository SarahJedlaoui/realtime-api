<script setup lang="ts">
let peerConn: RTCPeerConnection | null = null;
let channel: RTCDataChannel | null = null;
let audioContext: AudioContext | null = null;
const { initCanvas } = useAudioVisualizer();
let audioWaveform: ReturnType<typeof initCanvas> | null = null;
let analyser: AnalyserNode | null = null;

const audioCanvas = useTemplateRef("audio-canvas");
const isConnected = ref(false);
const connecting = ref(false);

function initAudioWaveFormCanvas(mediaStream: MediaStream) {
  audioContext = new window.AudioContext({ sampleRate: 24000 });
  analyser = new AnalyserNode(audioContext, {
    fftSize: 2048,
  });
  const inputSource = audioContext.createMediaStreamSource(mediaStream);
  inputSource.connect(analyser);
  audioWaveform = initCanvas(audioCanvas, analyser);
  audioWaveform.drawWaveform();
}

function connectStreamToAnalyser(remoteStream: MediaStream) {
  if (audioContext && analyser) {
    const outputSource = audioContext.createMediaStreamSource(remoteStream);
    outputSource.connect(analyser);
  }
}

async function connect() {
  connecting.value = true;
  try {
    // Get temporary auth key
    const tokenResponse = await $fetch("/session");
    const ephemeralKey = tokenResponse.client_secret.value;

    // Get input audio (permission)
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    initAudioWaveFormCanvas(mediaStream); // Initialize canvas for waveform display

    peerConn = new RTCPeerConnection();

    // Output audio (audio tag)
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    peerConn.ontrack = (event) => {
      console.log("receive audio track", event.track);
      const remoteStream = event.streams[0];
      // Display waveform of output audio
      connectStreamToAnalyser(remoteStream);
      // Set output audio to srcObject of audio tag
      return (audioEl.srcObject = remoteStream);
    };

    // Input audio (microphone)
    peerConn.addTrack(mediaStream.getTracks()[0]);

    // Data channel for event send/receive
    channel = peerConn.createDataChannel("oai-events");
    channel.addEventListener("message", (e) => {
      const event = JSON.parse(e.data);
      logEvent(event.type);
      switch (event.type) {
        case "response.audio_transcript.done":
          setTimeout(() => logMessage(`🤖: ${event.transcript}`), 100);
          break;
        case "conversation.item.input_audio_transcription.completed":
          if (event.transcript) logMessage(`😄: ${event.transcript}`);
          break;
        case "error":
          logEvent(event.error);
          if (event.code === "session_expired") disconnect();
          break;
        default:
          break;
      }
    });

    // Establish session with RealtimeAPI using SDP
    const offer = await peerConn.createOffer();
    await peerConn.setLocalDescription(offer);

    const sdpResponse = await $fetch<string>(
      "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
      {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
      }
    );

    await peerConn.setRemoteDescription({
      type: "answer",
      sdp: sdpResponse,
    });

    channel.onopen = () => {
      channel?.send(
        JSON.stringify({
          // Supposed to be set on server API, but might not be?
          type: "session.update",
          session: {
            input_audio_transcription: { model: "whisper-1" },
          },
        })
      );
    };
    peerConn.onconnectionstatechange = () => {
      console.log("Connection State:", peerConn?.connectionState);
      if (peerConn?.connectionState === "connected") {
        logMessage("Connected to server🍻");
        isConnected.value = true;
        connecting.value = false;
      }
    };
  } catch (e) {
    console.error({ e });
    connecting.value = false;
  }
}

function disconnect() {
  channel?.close();
  channel = null;
  peerConn?.close();
  peerConn = null;
  analyser?.disconnect();
  analyser = null;
  audioContext?.close();
  audioContext = null;
  audioWaveform?.stop();
  audioWaveform = null;
  logMessage("Disconnected👋");
  isConnected.value = false;
}

onUnmounted(disconnect);

// Output message and event logs
const messageContainer = useTemplateRef("message-container");
const logContainer = useTemplateRef("log-container");
const messageLog = ref<string[]>([]);
const eventLog = ref<string[]>([]);

function logMessage(message: string) {
  messageLog.value.push(message);
  if (messageContainer.value) scroll(messageContainer);
}

function logEvent(message: string) {
  eventLog.value.push(message);
  if (logContainer.value) scroll(logContainer);
}

function scroll(containerRef: Ref<HTMLElement | null>) {
  nextTick(() => {
    const container = containerRef.value;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  });
}
</script>

<template>
  <div
    class="app p-6 bg-gray-100 min-h-screen flex flex-col items-center justify-center"
  >
    <div class="flex gap-4 mb-6">
      <button
        :disabled="isConnected"
        class="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-all flex items-center gap-2"
        @click="connect"
      >
        <i class="fas fa-plug" /> Connect
      </button>
      <button
        :disabled="!isConnected"
        class="px-6 py-3 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 transition-all flex items-center gap-2"
        @click="disconnect"
      >
        <i class="fas fa-times-circle" /> Disconnect
      </button>
    </div>

    <canvas
      ref="audio-canvas"
      width="500"
      height="150"
      class="border border-gray-400 rounded shadow-md mb-6"
    />

    <div
      ref="message-container"
      class="w-full max-w-lg h-60 overflow-y-auto bg-white rounded-lg shadow-md p-4"
    >
      <div
        v-for="msg in messageLog"
        :key="msg"
        class="p-2 mb-2 bg-gray-100 rounded border border-gray-200 break-words"
      >
        {{ msg }}
      </div>
    </div>
    <hr />
    <div
      ref="log-container"
      class="w-full mt-4 max-w-lg h-80 overflow-y-auto bg-white rounded-lg shadow-md p-4"
    >
      <div
        v-for="event in eventLog"
        :key="event"
        class="p-1 mb-1 bg-gray-100 break-words"
      >
        {{ event }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  font-family: "Roboto", sans-serif;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button i {
  font-size: 1.2em;
}
</style>
