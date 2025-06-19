export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const topic = query.topic as string | undefined;

  const instructions = topic
    ? `You are a podcast assistant. The user wants to talk about "${topic}". Ask up to 4 follow-up questions to help them share insights on that topic. Be friendly, curious, and supportive.`
    : `You are a podcast assistant who asks people what topics they are interested in, then asks up to 4 follow-up questions to help generate a short podcast based on their answers.`;

  return await $fetch<{ client_secret: { value: string } }>(
    "https://api.openai.com/v1/realtime/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: {
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "shimmer",
        instructions,
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: { type: "server_vad" },
      },
    }
  );
});
