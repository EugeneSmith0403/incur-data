<template>
  <div class="relative">
    <button
      class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
      @click="toggleDropdown"
      :aria-label="$t('language.switch')"
    >
      <LanguageIcon class="w-5 h-5" />
      <span class="min-w-16 text-left">{{ currentLocaleLabel }}</span>
      <ChevronDownIcon class="w-4 h-4 transition-transform duration-200" :class="{ 'rotate-180': isOpen }" />
    </button>
    
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="isOpen" class="absolute top-[calc(100%+0.5rem)] right-0 min-w-48 bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden z-50">
        <button
          v-for="locale in availableLocales"
          :key="locale.code"
          class="flex items-center justify-between w-full px-4 py-3 text-sm text-gray-700 bg-transparent border-none cursor-pointer transition-colors duration-150 text-left hover:bg-gray-50"
          :class="{ 'bg-gray-50 text-primary-500 font-semibold': locale.code === currentLocale }"
          @click="switchLanguage(locale.code)"
        >
          <span class="flex-1">{{ locale.name }}</span>
          <CheckIcon v-if="locale.code === currentLocale" class="w-4 h-4 text-primary-500" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { LanguageIcon, ChevronDownIcon, CheckIcon } from '@heroicons/vue/24/outline';

const { locale, locales, setLocale } = useI18n();

const isOpen = ref(false);

const currentLocale = computed(() => locale.value);

const availableLocales = computed(() => {
  return locales.value as Array<{ code: string; name: string; file: string }>;
});

const currentLocaleLabel = computed(() => {
  const current = availableLocales.value.find(l => l.code === currentLocale.value);
  return current?.name || 'English';
});

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

const switchLanguage = (code: string) => {
  setLocale(code as 'en' | 'ru' | 'de');
  isOpen.value = false;
};

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.relative')) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
