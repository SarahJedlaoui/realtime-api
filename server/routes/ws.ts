import { WebSocket } from "ws";

const connections: { [id: string]: WebSocket } = {};

export default defineWebSocketHandler({
  open(peer) {
    let topic: string | undefined;

    if (peer.request?.url) {
      const urlObj = new URL(peer.request.url, "http://localhost");
      topic = urlObj.searchParams.get("topic") || undefined;
    } else {
      topic = undefined;
    }

    const instructions = topic
      ? `You are a podcast assistant. The user wants to talk about "${topic}". Ask up to 4 engaging follow-up questions to help create a short podcast. Be warm, curious, and conversational.`
      : `You are a podcast assistant. Ask the user what topic they’re interested in, then ask up to 4 engaging follow-up questions.`;

    const url =
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17";
    const openaiSocket = new WebSocket(url, {
      headers: {
        Authorization: "Bearer " + process.env.OPENAI_API_KEY,
        "OpenAI-Beta": "realtime=v1",
        "Content-Type": "application/json",
      },
    });

    connections[peer.id] = openaiSocket;

    openaiSocket.on("open", () => {
      openaiSocket.send(
        JSON.stringify({
          type: "session.update",
          session: {
            voice: "shimmer",
            instructions,
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: { type: "server_vad" },
          },
        })
      );
    });

    openaiSocket.on("message", (message) => {
      peer.send(message.toString());
    });
  },

  message(peer, message) {
    connections[peer.id]?.send(message.text());
  },

  close(peer) {
    connections[peer.id]?.close();
    delete connections[peer.id];
  },

  error(peer, error) {
    console.error("WebSocket error:", error);
  },
});
