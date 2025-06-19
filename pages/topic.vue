<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Swiper, SwiperSlide } from "swiper/vue";
import { EffectCoverflow } from "swiper/modules";

import "swiper/css";
import "swiper/css/effect-coverflow";

const router = useRouter();
const topics = ref([]);
const selectedTopicIndex = ref(0);
const userInput = ref("");
const loadingCustomInput = ref(false);
const loading = ref(false);
const messageIndex = ref(0);
const sessionId = ref(null);
const currentQuestionIndex = ref(0);
const pastelColors = ["#D6EAF8", "#FADBD8", "#FCF3CF", "#D5F5E3"];
const loadingMessages = [
  "Collecting information...",
  "Thanks for your patience!",
  "Almost there — promise 🤞",
  "Good things take time ⏳",
];

onMounted(async () => {
  try {
    const res = await fetch(
      "https://sophiabackend-82f7d870b4bb.herokuapp.com/api/topicsV3"
    );
    const data = await res.json();
    topics.value = data.map((item) => ({
      topic: item.topic,
      questions: item.insights.map((insight) => insight.question),
      insights: item.insights,
    }));
    selectedTopicIndex.value = 0;

    localStorage.removeItem("sessionId");
    let storedSessionId = localStorage.getItem("sessionId");
    const userId = localStorage.getItem("userId");

    if (!storedSessionId) {
      const sessionRes = await fetch(
        "https://sophiabackend-82f7d870b4bb.herokuapp.com/api/persona/session",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        }
      );
      const sessionData = await sessionRes.json();
      storedSessionId = sessionData.sessionId;
      localStorage.setItem("sessionId", storedSessionId);
    }

    sessionId.value = storedSessionId;
  } catch (err) {
    console.error("Init error:", err);
  }
});

const handleStart = async () => {
  if (!topics.value[selectedTopicIndex.value] || !sessionId.value) return;

  const topic = topics.value[selectedTopicIndex.value].topic;
  const question =
    topics.value[selectedTopicIndex.value].questions[
      currentQuestionIndex.value
    ];
  loading.value = true;

  try {
    await fetch(
      "https://sophiabackend-82f7d870b4bb.herokuapp.com/api/persona/topic",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.value, topic }),
      }
    );

    await fetch(
      "https://sophiabackend-82f7d870b4bb.herokuapp.com/api/persona/question",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.value, question }),
      }
    );

    router.push({
      path: "/websocket",
      query: { topic },
    });
  } catch (err) {
    console.error("Failed to save:", err);
    alert("Something went wrong.");
  } finally {
    loading.value = false;
  }
};

const handleCustomTopicSubmit = async () => {
  const input = userInput.value.trim();
  if (!input) return;
  try {
    loadingCustomInput.value = true;
    const sessionId = localStorage.getItem("sessionId");
    await fetch(
      "https://sophiabackend-82f7d870b4bb.herokuapp.com/api/persona/extract-topic-question",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, text: input }),
      }
    );
    router.push("/reflection?from=home");
  } catch (err) {
    console.error("Failed to extract topic/question:", err);
    alert("Something went wrong.");
    loadingCustomInput.value = false;
  }
};
</script>

<template>
  <div
    class="max-w-[430px] mx-auto bg-[#FAF9F7] min-h-[92vh] flex flex-col gap-9 px-5 pb-8 font-sans"
  >
    <div class="flex flex-col justify-start mt-5">
      <h1 class="text-2xl font-bold text-[#222] mb-1">
        Choose your Content Quest for today
      </h1>
      <p class="text-sm text-[#6c6c6c] mb-3">
        Progress unlocked: You're in the game.
      </p>
      <div class="h-2 w-full bg-[#EAE7DE] rounded-full mb-4">
        <div class="h-full bg-[#A48CF1] rounded-full w-[25%]"></div>
      </div>
      <div
        class="flex overflow-x-auto gap-2 mb-4 whitespace-nowrap no-scrollbar"
      >
        <button
          v-for="(t, i) in topics"
          :key="i"
          @click="selectedTopicIndex = i"
          class="px-4 py-1.5 text-sm rounded-xl transition-all"
          :class="
            selectedTopicIndex === i
              ? 'bg-[#A48CF1] text-white'
              : 'border border-black text-black'
          "
        >
          {{ t.topic }}
        </button>
      </div>
    </div>

    <h2 class="text-3xl font-semibold text-center font-medium">
      Today’s Question
    </h2>

    <div v-if="topics[selectedTopicIndex]?.questions" class="mb-6">
      <Swiper
        :modules="[EffectCoverflow]"
        effect="coverflow"
        :grabCursor="true"
        :centeredSlides="true"
        :slidesPerView="1.2"
        :spaceBetween="-40"
        :coverflowEffect="{
          rotate: 0,
          stretch: 0,
          depth: 150,
          modifier: 1.5,
          slideShadows: false,
        }"
        class="h-[360px]"
        @slideChange="(swiper) => (currentQuestionIndex = swiper.realIndex)"
      >
        <SwiperSlide
          v-for="(question, index) in topics[selectedTopicIndex].questions"
          :key="index"
        >
          <div
            @click="handleStart"
            class="w-[280px] h-[320px] mx-auto rounded-xl border border-black shadow-[4px_4px_0px_black] relative flex flex-col items-center justify-center p-6 text-center text-lg font-semibold"
            :style="{
              backgroundColor: pastelColors[index % pastelColors.length],
            }"
          >
            <div class="text-sm text-[#444] mb-2">
              {{ topics[selectedTopicIndex].topic }}
            </div>
            <span class="z-10">{{ question }}</span>
            <img
              src="/images/quest.svg"
              alt="question icon"
              class="absolute bottom-4 right-20"
              width="96"
              height="96"
            />
            <div
              class="absolute bottom-3 right-3 z-20 bg-white bg-opacity-70 rounded-full p-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5 text-black"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </SwiperSlide>
      </Swiper>
    </div>

    <div
      class="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[90%] max-w-[430px] bg-white rounded-xl shadow-md px-4 py-3 flex items-center justify-between border border-gray-200 z-40"
    >
      <input
        type="text"
        v-model="userInput"
        placeholder="What would you like to post about today?"
        class="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-600"
      />
      <button
        @click="handleCustomTopicSubmit"
        :disabled="loadingCustomInput"
        class="ml-3 bg-[#A48CF1] p-2 rounded-full shadow flex items-center justify-center w-9 h-9"
      >
        <svg
          v-if="!loadingCustomInput"
          xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
        <svg
          v-else
          class="animate-spin h-5 w-5 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
