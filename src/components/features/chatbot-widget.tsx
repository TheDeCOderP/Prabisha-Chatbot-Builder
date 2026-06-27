'use client';
import Image from 'next/image';
import DOMPurify from 'dompurify';
import { useEffect, useRef, useState, startTransition } from 'react';
import { createPortal } from 'react-dom';
import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import {
  Loader2,
  XIcon,
  MicIcon,
  MicOffIcon,
  RefreshCw,
  Send,
  UserPlus,
  CheckCircle2,
  VolumeX,
  Volume2,
  MessageCircle,
  SmilePlus,
  Copy,
  Check,
} from 'lucide-react';
import { Message } from '@/types/chat';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
} from '@/components/ui/shadcn-io/ai/prompt-input';
import { useChatbot } from '@/hooks/useChatbot';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { useLeadGeneration } from '@/hooks/useLeadGeneration';
import { LeadForm } from '@/components/forms/lead-form';
import { Button } from '@/components/ui/button';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { EmojiClickData } from 'emoji-picker-react';
import type { MultilingualSuggestion } from '@/hooks/useChatbot'

// ─────────────────────────────────────────────────────────────────────────────
// i18n — isolated instance
// ─────────────────────────────────────────────────────────────────────────────

const chatbotI18n = i18n.createInstance();

// Load all language resources including Indian regional languages
const languageResources = {
  en: {
    translation: {
      online: 'Online • Typically replies instantly',
      thinking: 'Thinking',
      searching: 'Searching…',
      quickSuggestions: 'Quick suggestions',
      typeMessage: 'Type your message here…',
      typeAnswer: 'Type your answer…',
      readyToStart: 'Ready to get started?',
      collectingDetails: 'Collecting your details…',
      shareDetails: "Share your details and we'll help you get the best solution.",
      askQuestions: "I'll ask you a few quick questions right here in the chat.",
      answerAbove: 'Please answer the questions in the chat above.',
      startChatForm: 'Start Chat Form',
      getStarted: 'Get Started Now',
      selectEmoji: 'Select Emoji',
      search: 'Search...',
      poweredBy: 'Powered by',
      openChat: 'Open chatbot',
      closeChat: 'Close chat',
      live: 'Live',
    },
  },
  ja: {
    translation: {
      online: 'オンライン • すぐに返信します',
      thinking: '考え中',
      searching: '検索中…',
      quickSuggestions: 'クイック提案',
      typeMessage: 'メッセージを入力してください…',
      typeAnswer: '回答を入力してください…',
      readyToStart: '始める準備はできていますか？',
      collectingDetails: '詳細を収集中…',
      shareDetails: '詳細を共有してください。最適なソリューションを提供します。',
      askQuestions: 'チャットでいくつか質問させていただきます。',
      answerAbove: '上のチャットの質問に答えてください。',
      startChatForm: 'チャットフォームを開始',
      getStarted: '今すぐ始める',
      selectEmoji: '絵文字を選択',
      search: '検索...',
      poweredBy: 'Powered by',
      openChat: 'チャットを開く',
      closeChat: 'チャットを閉じる',
      live: 'ライブ',
    },
  },
  hi: {
    translation: {
      online: 'ऑनलाइन • तुरंत जवाब देता है',
      thinking: 'सोच रहा है',
      searching: 'खोज रहा है…',
      quickSuggestions: 'त्वरित सुझाव',
      typeMessage: 'यहाँ अपना संदेश लिखें…',
      typeAnswer: 'अपना उत्तर लिखें…',
      readyToStart: 'शुरू करने के लिए तैयार हैं?',
      collectingDetails: 'विवरण एकत्र हो रहा है…',
      shareDetails: 'अपना विवरण साझा करें और हम आपको सर्वोत्तम समाधान दिलाएंगे।',
      askQuestions: 'मैं यहीं चैट में कुछ त्वरित प्रश्न पूछूंगा।',
      answerAbove: 'कृपया ऊपर चैट के प्रश्नों का उत्तर दें।',
      startChatForm: 'चैट फॉर्म शुरू करें',
      getStarted: 'अभी शुरू करें',
      selectEmoji: 'इमोजी चुनें',
      search: 'खोजें...',
      poweredBy: 'Powered by',
      openChat: 'चैट खोलें',
      closeChat: 'चैट बंद करें',
      live: 'लाइव',
    },
  },
  fr: {
    translation: {
      online: 'En ligne • Répond instantanément',
      thinking: 'En train de réfléchir',
      searching: 'Recherche…',
      quickSuggestions: 'Suggestions rapides',
      typeMessage: 'Tapez votre message ici…',
      typeAnswer: 'Tapez votre réponse…',
      readyToStart: 'Prêt à commencer ?',
      collectingDetails: 'Collecte de vos informations…',
      shareDetails: 'Partagez vos coordonnées et nous vous aiderons à trouver la meilleure solution.',
      askQuestions: 'Je vais vous poser quelques questions rapides ici dans le chat.',
      answerAbove: 'Veuillez répondre aux questions dans le chat ci-dessus.',
      startChatForm: 'Démarrer le formulaire de chat',
      getStarted: 'Commencer maintenant',
      selectEmoji: 'Sélectionner un emoji',
      search: 'Rechercher...',
      poweredBy: 'Propulsé par',
      openChat: 'Ouvrir le chat',
      closeChat: 'Fermer le chat',
      live: 'En direct',
    },
  },
  es: {
    translation: {
      online: 'En línea • Responde al instante',
      thinking: 'Pensando',
      searching: 'Buscando…',
      quickSuggestions: 'Sugerencias rápidas',
      typeMessage: 'Escribe tu mensaje aquí…',
      typeAnswer: 'Escribe tu respuesta…',
      readyToStart: '¿Listo para empezar?',
      collectingDetails: 'Recopilando tus datos…',
      shareDetails: 'Comparte tus datos y te ayudaremos a encontrar la mejor solución.',
      askQuestions: 'Te haré algunas preguntas rápidas aquí en el chat.',
      answerAbove: 'Por favor responde las preguntas en el chat de arriba.',
      startChatForm: 'Iniciar formulario de chat',
      getStarted: 'Empezar ahora',
      selectEmoji: 'Seleccionar emoji',
      search: 'Buscar...',
      poweredBy: 'Desarrollado por',
      openChat: 'Abrir chat',
      closeChat: 'Cerrar chat',
      live: 'En vivo',
    },
  },
  ar: {
    translation: {
      online: 'متصل • يرد فورًا',
      thinking: 'يفكر',
      searching: 'يبحث…',
      quickSuggestions: 'اقتراحات سريعة',
      typeMessage: 'اكتب رسالتك هنا…',
      typeAnswer: 'اكتب إجابتك…',
      readyToStart: 'هل أنت مستعد للبدء؟',
      collectingDetails: 'جاري جمع بياناتك…',
      shareDetails: 'شارك بياناتك وسنساعدك في الحصول على أفضل حل.',
      askQuestions: 'سأطرح عليك بعض الأسئلة السريعة هنا في الدردشة.',
      answerAbove: 'يرجى الإجابة على الأسئلة في الدردشة أعلاه.',
      startChatForm: 'بدء نموذج الدردشة',
      getStarted: 'ابدأ الآن',
      selectEmoji: 'اختر رمزًا تعبيريًا',
      search: 'بحث...',
      poweredBy: 'مدعوم من',
      openChat: 'فتح الدردشة',
      closeChat: 'إغلاق الدردشة',
      live: 'مباشر',
    },
  },
  // Indian Regional Languages
  pa: {
    translation: {
      online: "ਆਨਲਾਈਨ • ਆਮ ਤੌਰ 'ਤੇ ਤੁਰੰਤ ਜਵਾਬ ਦਿੰਦਾ ਹੈ",
      thinking: 'ਸੋਚ ਰਿਹਾ ਹੈ',
      searching: 'ਖੋਜ ਕਰ ਰਿਹਾ ਹੈ…',
      quickSuggestions: 'ਤੁਰੰਤ ਸੁਝਾਅ',
      typeMessage: 'ਆਪਣਾ ਸੁਨੇਹਾ ਇੱਥੇ ਲਿਖੋ…',
      typeAnswer: 'ਆਪਣਾ ਜਵਾਬ ਲਿਖੋ…',
      readyToStart: 'ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਤਿਆਰ ਹੋ?',
      collectingDetails: 'ਤੁਹਾਡੇ ਵੇਰਵੇ ਇਕੱਠੇ ਕੀਤੇ ਜਾ ਰਹੇ ਹਨ…',
      shareDetails: 'ਆਪਣੇ ਵੇਰਵੇ ਸਾਂਝੇ ਕਰੋ ਅਤੇ ਅਸੀਂ ਤੁਹਾਨੂੰ ਸਭ ਤੋਂ ਵਧੀਆ ਹੱਲ ਦਿਵਾਵਾਂਗੇ।',
      askQuestions: 'ਮੈਂ ਤੁਹਾਨੂੰ ਇੱਥੇ ਚੈਟ ਵਿੱਚ ਕੁਝ ਤੁਰੰਤ ਸਵਾਲ ਪੁੱਛਾਂਗਾ।',
      answerAbove: 'ਕਿਰਪਾ ਕਰਕੇ ਉੱਪਰ ਚੈਟ ਵਿੱਚ ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਦਿਓ।',
      startChatForm: 'ਚੈਟ ਫਾਰਮ ਸ਼ੁਰੂ ਕਰੋ',
      getStarted: 'ਹੁਣੇ ਸ਼ੁਰੂ ਕਰੋ',
      selectEmoji: 'ਇਮੋਜੀ ਚੁਣੋ',
      search: 'ਖੋਜ...',
      poweredBy: 'ਦੁਆਰਾ ਸੰਚਾਲਿਤ',
      openChat: 'ਚੈਟ ਖੋਲ੍ਹੋ',
      closeChat: 'ਚੈਟ ਬੰਦ ਕਰੋ',
      live: 'ਲਾਈਵ',
    },
  },
  kn: {
    translation: {
      online: 'ಆನ್‌ಲೈನ್ • ಸಾಮಾನ್ಯವಾಗಿ ತಕ್ಷಣ ಉತ್ತರಿಸುತ್ತದೆ',
      thinking: 'ಯೋಚಿಸುತ್ತಿದೆ',
      searching: 'ಹುಡುಕುತ್ತಿದೆ…',
      quickSuggestions: 'ತ್ವರಿತ ಸಲಹೆಗಳು',
      typeMessage: 'ನಿಮ್ಮ ಸಂದೇಶವನ್ನು ಇಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ…',
      typeAnswer: 'ನಿಮ್ಮ ಉತ್ತರವನ್ನು ಟೈಪ್ ಮಾಡಿ…',
      readyToStart: 'ಪ್ರಾರಂಭಿಸಲು ಸಿದ್ಧರಿದ್ದೀರಾ?',
      collectingDetails: 'ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಸಂಗ್ರಹಿಸಲಾಗುತ್ತಿದೆ…',
      shareDetails: 'ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಹಂಚಿಕೊಳ್ಳಿ ಮತ್ತು ನಾವು ನಿಮಗೆ ಉತ್ತಮ ಪರಿಹಾರವನ್ನು ಪಡೆಯಲು ಸಹಾಯ ಮಾಡುತ್ತೇವೆ.',
      askQuestions: 'ನಾನು ನಿಮಗೆ ಇಲ್ಲಿ ಚಾಟ್‌ನಲ್ಲಿ ಕೆಲವು ತ್ವರಿತ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳುತ್ತೇನೆ.',
      answerAbove: 'ದಯವಿಟ್ಟು ಮೇಲಿನ ಚಾಟ್‌ನಲ್ಲಿರುವ ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಿಸಿ.',
      startChatForm: 'ಚಾಟ್ ಫಾರ್ಮ್ ಅನ್ನು ಪ್ರಾರಂಭಿಸಿ',
      getStarted: 'ಈಗ ಪ್ರಾರಂಭಿಸಿ',
      selectEmoji: 'ಎಮೋಜಿ ಆಯ್ಕೆಮಾಡಿ',
      search: 'ಹುಡುಕು...',
      poweredBy: 'ಇವರಿಂದ ಸಂಚಾಲಿತ',
      openChat: 'ಚಾಟ್ ತೆರೆಯಿರಿ',
      closeChat: 'ಚಾಟ್ ಮುಚ್ಚಿ',
      live: 'ಲೈವ್',
    },
  },
  te: {
    translation: {
      online: 'ఆన్‌లైన్ • సాధారణంగా తక్షణమే సమాధానం ఇస్తుంది',
      thinking: 'ఆలోచిస్తోంది',
      searching: 'శోధిస్తోంది…',
      quickSuggestions: 'త్వరిత సూచనలు',
      typeMessage: 'మీ సందేశాన్ని ఇక్కడ టైప్ చేయండి…',
      typeAnswer: 'మీ సమాధానాన్ని టైప్ చేయండి…',
      readyToStart: 'ప్రారంభించడానికి సిద్ధంగా ఉన్నారా?',
      collectingDetails: 'మీ వివరాలను సేకరిస్తోంది…',
      shareDetails: 'మీ వివరాలను భాగస్వామ్యం చేయండి మరియు మేము మీకు ఉత్తమ పరిష్కారాన్ని పొందడంలో సహాయం చేస్తాము.',
      askQuestions: 'నేను మీకు ఇక్కడ చాట్‌లో కొన్ని త్వరిత ప్రశ్నలు అడుగుతాను.',
      answerAbove: 'దయచేసి పైన ఉన్న చాట్‌లోని ప్రశ్నలకు సమాధానం ఇవ్వండి.',
      startChatForm: 'చాట్ ఫారమ్ ప్రారంభించండి',
      getStarted: 'ఇప్పుడే ప్రారంభించండి',
      selectEmoji: 'ఎమోజీని ఎంచుకోండి',
      search: 'శోధించు...',
      poweredBy: 'ద్వారా ఆధారితం',
      openChat: 'చాట్ తెరవండి',
      closeChat: 'చాట్ మూసివేయండి',
      live: 'ప్రత్యక్ష ప్రసారం',
    },
  },
  bn: {
    translation: {
      online: 'অনলাইন • সাধারণত তাৎক্ষণিক উত্তর দেয়',
      thinking: 'ভাবছি',
      searching: 'খুঁজছি…',
      quickSuggestions: 'দ্রুত পরামর্শ',
      typeMessage: 'আপনার বার্তা এখানে টাইপ করুন…',
      typeAnswer: 'আপনার উত্তর টাইপ করুন…',
      readyToStart: 'শুরু করতে প্রস্তুত?',
      collectingDetails: 'আপনার বিবরণ সংগ্রহ করা হচ্ছে…',
      shareDetails: 'আপনার বিবরণ শেয়ার করুন এবং আমরা আপনাকে সেরা সমাধান পেতে সাহায্য করব।',
      askQuestions: 'আমি আপনাকে এখানে চ্যাটে কয়েকটি দ্রুত প্রশ্ন জিজ্ঞাসা করব।',
      answerAbove: 'দয়া করে উপরের চ্যাটের প্রশ্নগুলির উত্তর দিন।',
      startChatForm: 'চ্যাট ফর্ম শুরু করুন',
      getStarted: 'এখনই শুরু করুন',
      selectEmoji: 'ইমোজি নির্বাচন করুন',
      search: 'অনুসন্ধান...',
      poweredBy: 'দ্বারা চালিত',
      openChat: 'চ্যাট খুলুন',
      closeChat: 'চ্যাট বন্ধ করুন',
      live: 'লাইভ',
    },
  },
  gu: {
    translation: {
      online: 'ઓનલાઇન • સામાન્ય રીતે તાત્કાલિક જવાબ આપે છે',
      thinking: 'વિચારી રહ્યો છે',
      searching: 'શોધી રહ્યો છે…',
      quickSuggestions: 'ઝડપી સૂચનો',
      typeMessage: 'તમારો સંદેશ અહીં લખો…',
      typeAnswer: 'તમારો જવાબ લખો…',
      readyToStart: 'શરૂ કરવા માટે તૈયાર છો?',
      collectingDetails: 'તમારી વિગતો એકત્રિત કરી રહ્યા છીએ…',
      shareDetails: 'તમારી વિગતો શેર કરો અને અમે તમને શ્રેષ્ઠ ઉકેલ મેળવવામાં મદદ કરીશું.',
      askQuestions: 'હું તમને અહીં ચેટમાં થોડા ઝડપી પ્રશ્નો પૂછીશ.',
      answerAbove: 'કૃપા કરીને ઉપરની ચેટમાં પ્રશ્નોના જવાબ આપો.',
      startChatForm: 'ચેટ ફોર્મ શરૂ કરો',
      getStarted: 'હમણાં પ્રારંભ કરો',
      selectEmoji: 'ઇમોજી પસંદ કરો',
      search: 'શોધો...',
      poweredBy: 'દ્વારા સંચાલિત',
      openChat: 'ચેટ ખોલો',
      closeChat: 'ચેટ બંધ કરો',
      live: 'લાઇવ',
    },
  },
  zh: {
    translation: {
      online: '在线 • 通常立即回复',
      thinking: '思考中',
      searching: '搜索中…',
      quickSuggestions: '快速建议',
      typeMessage: '在此输入您的消息…',
      typeAnswer: '输入您的答案…',
      readyToStart: '准备好开始了吗？',
      collectingDetails: '正在收集您的详细信息…',
      shareDetails: '分享您的详细信息，我们将帮助您找到最佳解决方案。',
      askQuestions: '我将在聊天中问您几个快速问题。',
      answerAbove: '请回答上面聊天中的问题。',
      startChatForm: '开始聊天表单',
      getStarted: '立即开始',
      selectEmoji: '选择表情符号',
      search: '搜索...',
      poweredBy: '技术支持',
      openChat: '打开聊天',
      closeChat: '关闭聊天',
      live: '在线',
    },
  },
};

chatbotI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: languageResources,
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ChatbotWidgetProps {
  chatbotId: string;
  initialChatbotData?: any;
  onLanguageChange?: (languageCode: string) => void;
}

// All supported languages (combined pool)
const ALL_LANGUAGES = [
  { name: 'English',    code: 'en', img: '/flags/en.png', dir: 'ltr' },
  { name: 'हिन्दी',     code: 'hi', img: '/flags/hi.svg', dir: 'ltr' },
  { name: 'ਪੰਜਾਬੀ',    code: 'pa', img: '/flags/hi.svg', dir: 'ltr' },
  { name: 'ಕನ್ನಡ',     code: 'kn', img: '/flags/hi.svg', dir: 'ltr' },
  { name: 'తెలుగు',    code: 'te', img: '/flags/hi.svg', dir: 'ltr' },
  { name: 'বাংলা',     code: 'bn', img: '/flags/hi.svg', dir: 'ltr' },
  { name: 'ગુજરાતી',   code: 'gu', img: '/flags/hi.svg', dir: 'ltr' },
  { name: '日本語',     code: 'ja', img: '/flags/ja.png', dir: 'ltr' },
  { name: 'Français',  code: 'fr', img: '/flags/fr.png', dir: 'ltr' },
  { name: 'Español',   code: 'es', img: '/flags/es.png', dir: 'ltr' },
  { name: 'العربية',   code: 'ar', img: '/flags/ar.png', dir: 'rtl' },
  { name: '中文',       code: 'zh', img: '/flags/zh.svg', dir: 'ltr' },
];

// Keep backward compat references
const INDIAN_LANGUAGES = ALL_LANGUAGES.filter(l => ['hi','pa','kn','te','bn','gu','en'].includes(l.code));
const GLOBAL_LANGUAGES = ALL_LANGUAGES.filter(l => ['en','ja','fr','es','ar','zh'].includes(l.code));

// Helper function to get location-based languages (used when defaultLanguage = 'auto')
const getLocationBasedLanguages = async (): Promise<{
  languages: typeof ALL_LANGUAGES;
  defaultLang: string;
}> => {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    const countryCode = data.country_code;
    if (countryCode === 'IN') {
      return { languages: INDIAN_LANGUAGES, defaultLang: 'hi' };
    }
    return { languages: GLOBAL_LANGUAGES, defaultLang: 'en' };
  } catch {
    return { languages: GLOBAL_LANGUAGES, defaultLang: 'en' };
  }
};

const DEFAULT_SUGGESTIONS: MultilingualSuggestion[] = [
  { en: "What services do you offer?",  fr: "Quels services proposez-vous ?",   ar: "ما الخدمات التي تقدمونها؟",    es: "¿Qué servicios ofrecen?",          ja: "どのようなサービスを提供していますか？", hi: "आप कौन सी सेवाएं प्रदान करते हैं?", pa: "ਤੁਸੀਂ ਕਿਹੜੀਆਂ ਸੇਵਾਵਾਂ ਪ੍ਰਦਾਨ ਕਰਦੇ ਹੋ?", kn: "ನೀವು ಯಾವ ಸೇವೆಗಳನ್ನು ಒದಗಿಸುತ್ತೀರಿ?", te: "మీరు ఏ సేవలు అందిస్తారు?", bn: "আপনি কোন সেবা প্রদান করেন?", gu: "તમે કઈ સેવાઓ પ્રદાન કરો છો?", zh: "你们提供什么服务？" },
  { en: "How can I contact support?",   fr: "Comment contacter le support ?",    ar: "كيف يمكنني التواصل مع الدعم؟", es: "¿Cómo puedo contactar al soporte?", ja: "サポートに連絡するには？", hi: "सहायता से कैसे संपर्क करें?", pa: "ਸਹਾਇਤਾ ਨਾਲ ਕਿਵੇਂ ਸੰਪਰਕ ਕਰੀਏ?", kn: "ಸಹಾಯವಾಣಿಯನ್ನು ಹೇಗೆ ಸಂಪರ್ಕಿಸುವುದು?", te: "సహాయాన్ని ఎలా సంప్రదించాలి?", bn: "সহায়তার সাথে কীভাবে যোগাযোগ করবেন?", gu: "સહાયતાનો સંપર્ક કેવી રીતે કરવો?", zh: "如何联系支持团队？" },
  { en: "How do I get started?",        fr: "Comment commencer ?",               ar: "كيف أبدأ؟",                     es: "¿Cómo empiezo?",                   ja: "どうすれば始められますか？", hi: "मैं कैसे शुरू करूं?", pa: "ਮੈਂ ਕਿਵੇਂ ਸ਼ੁਰੂ ਕਰਾਂ?", kn: "ನಾನು ಹೇಗೆ ಪ್ರಾರಂಭಿಸುವುದು?", te: "నేను ఎలా ప్రారంభించాలి?", bn: "আমি কীভাবে শুরু করব?", gu: "હું કેવી રીતે શરૂ કરું?", zh: "如何开始？" },
];

type LanguageCode = string;

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function markdownToHtml(text: string): string {
  if (!text) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return DOMPurify.sanitize(text);

  const lines = text.split('\n');
  const out: string[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length) {
      out.push(`<ul style="margin:8px 0;padding-left:20px;">${listBuffer.join('')}</ul>`);
      listBuffer = [];
    }
  };

  const inlineFormat = (s: string) =>
    s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
     .replace(/\*([^*]+)\*/g, '<em>$1</em>')
     .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:0.85em;">$1</code>');

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushList(); continue; }

    if (/^### /.test(line)) { flushList(); out.push(`<p style="font-weight:700;margin:12px 0 4px;font-size:0.95em;">${inlineFormat(line.slice(4))}</p>`); continue; }
    if (/^## /.test(line))  { flushList(); out.push(`<p style="font-weight:700;margin:14px 0 4px;">${inlineFormat(line.slice(3))}</p>`); continue; }
    if (/^# /.test(line))   { flushList(); out.push(`<p style="font-weight:700;margin:14px 0 4px;font-size:1.05em;">${inlineFormat(line.slice(2))}</p>`); continue; }

    if (/^\*\*[^*]+\*\*$/.test(line.trim())) { flushList(); out.push(`<p style="font-weight:700;margin:12px 0 4px;">${line.trim().replace(/^\*\*|\*\*$/g, '')}</p>`); continue; }

    if (/^[-*•] /.test(line.trim()) || /^\d+\. /.test(line.trim())) {
      const txt = line.trim().replace(/^[-*•] /, '').replace(/^\d+\. /, '');
      listBuffer.push(`<li style="margin-bottom:4px;">${inlineFormat(txt)}</li>`);
      continue;
    }

    flushList();
    out.push(`<p style="margin:6px 0;">${inlineFormat(line.trim())}</p>`);
  }

  flushList();
  return DOMPurify.sanitize(out.join(''));
}

const sanitizeHtml = (html: string): string => {
  return markdownToHtml(html).replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
};

function resolveSuggestion(
  item: MultilingualSuggestion | string,
  lang: LanguageCode
): string | null {
  if (typeof item === 'string') return item || null;

  const direct = item[lang]?.trim();
  if (direct) return direct;

  const english = item['en']?.trim();
  if (english) return english;

  // Try to find any available language
  for (const key in item) {
    const fallback = item[key]?.trim();
    if (fallback) return fallback;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme helpers — all visual sizing/shaping comes from ChatbotTheme
// ─────────────────────────────────────────────────────────────────────────────

function getWidgetSize(theme: any, isMobile: boolean): number {
  return isMobile
    ? (theme?.widgetSizeMobile || 60)
    : (theme?.widgetSize || 70);
}

function getWidgetShapeClass(theme: any): string {
  const shape = theme?.widgetShape?.toLowerCase() || 'round';
  switch (shape) {
    case 'round':          return 'rounded-full';
    case 'square':         return 'rounded-none';
    case 'rounded_square': return 'rounded-xl';
    default:               return 'rounded-full';
  }
}

function getIconShapeClass(theme: any): string {
  // Icon in the chat header / message bubbles uses widgetShape too
  return getWidgetShapeClass(theme);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared small components
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonBlock = ({ className }: { className: string }) => (
  <div className={`bg-gray-200 rounded animate-pulse ${className}`} />
);

const LoadingSpinner = () => (
  <div className="flex flex-col h-full min-h-[400px] bg-background">
    <div className="flex items-stretch p-4 border-b gap-3">
      <SkeletonBlock className="w-16 h-16 rounded-full shrink-0" />
      <div className="flex-1 space-y-2 flex flex-col justify-center">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-3 w-48" />
      </div>
    </div>
    <div className="flex-1 p-4 space-y-4">
      <div className="flex gap-3">
        <SkeletonBlock className="w-12 h-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-4 w-3/4" />
          <SkeletonBlock className="h-4 w-1/2" />
        </div>
      </div>
      <div className="space-y-2 mt-6">
        <SkeletonBlock className="h-3 w-24" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-8 w-28 rounded-lg" />
          <SkeletonBlock className="h-8 w-32 rounded-lg" />
        </div>
      </div>
    </div>
    <div className="border-t p-3 flex gap-2">
      <SkeletonBlock className="flex-1 h-12 rounded-xl" />
      <SkeletonBlock className="h-12 w-12 rounded-xl" />
    </div>
  </div>
);

const ErrorDisplay = ({ error, onRetry }: { error: string; onRetry?: () => void }) => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="text-center p-4">
      <p className="text-destructive">{error}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="mt-2">Retry</Button>
      )}
    </div>
  </div>
);

const ErrorBanner = ({ error }: { error: string }) => (
  <div className="mx-4 mb-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg animate-in slide-in-from-bottom">
    <p className="text-sm text-destructive flex items-center gap-2">
      <XIcon className="h-3 w-3 shrink-0" />
      {error}
    </p>
  </div>
);

const LeadFormOverlay = ({
  activeLeadForm, chatbotId, conversationId, onClose, onSuccess, onSubmitLead,
}: {
  activeLeadForm: any;
  chatbotId: string;
  conversationId: string;
  onClose: () => void;
  onSuccess: () => void;
  onSubmitLead: (formData: Record<string, string>) => Promise<boolean>;
}) => (
  <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="w-full max-w-md max-h-[90vh] overflow-y-auto">
      <LeadForm
        config={activeLeadForm}
        chatbotId={chatbotId}
        conversationId={conversationId}
        onClose={onClose}
        onSuccess={onSuccess}
        onSubmitLead={onSubmitLead}
      />
    </div>
  </div>
);

const Picker = dynamic(() => import('emoji-picker-react'), { ssr: false });

// ─────────────────────────────────────────────────────────────────────────────
// LanguageSelector
// ─────────────────────────────────────────────────────────────────────────────

function LanguageSelector({
  currentLang,
  onChange,
  languages,
}: {
  currentLang: LanguageCode;
  onChange: (code: LanguageCode) => void;
  languages: typeof GLOBAL_LANGUAGES;
}) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({
    position: 'fixed', top: 0, left: 0, zIndex: 99999,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = languages.find(l => l.code === currentLang) ?? languages[0];

  // Position is computed inside the click handler (event handler, not an effect)
  // so there are no cascading-render or ref-during-render linter issues.
  const handleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const DROPDOWN_HEIGHT = languages.length * 44;
      const openUpward = rect.top > DROPDOWN_HEIGHT || rect.top > window.innerHeight - rect.bottom;
      setDropdownStyle(
        openUpward
          ? { position: 'fixed', bottom: window.innerHeight - rect.top + 4, left: rect.left, zIndex: 99999 }
          : { position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 99999 },
      );
    }
    setOpen(o => !o);
  };

  const dropdownEl = open ? (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setOpen(false)} />
      <div
        style={dropdownStyle}
        className="bg-popover border border-border rounded-xl shadow-2xl overflow-hidden w-44 animate-in fade-in zoom-in-95"
      >
        {languages.map(lang => (
          <button
            key={lang.code}
            type="button"
            onClick={() => { onChange(lang.code as LanguageCode); setOpen(false); }}
            className={[
              'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left cursor-pointer',
              lang.code === currentLang
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-muted text-foreground',
            ].join(' ')}
          >
            <Image src={lang.img} width={18} height={14} alt={lang.name} className="rounded-sm object-cover shrink-0" unoptimized />
            <span>{lang.name}</span>
            {lang.code === currentLang && (
              <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />
            )}
          </button>
        ))}
      </div>
    </>
  ) : null;

  return (
    <div className="relative m-2 hover:bg-muted transition-colors">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="h-4 w-4 flex items-center justify-center aspect-square rounded-full text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
        aria-label="Select language"
      >
        <Image
          fill
          src={current.img}
          alt={current.name}
          className="rounded-full object-cover"
          unoptimized
        />
        <span className="hidden">{current.name}</span>
      </button>

      {typeof document !== 'undefined' && dropdownEl
        ? createPortal(dropdownEl, document.body)
        : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatbotWidget — root export
// ─────────────────────────────────────────────────────────────────────────────

export default function ChatbotWidget({
  chatbotId,
  initialChatbotData,
  onLanguageChange,
}: ChatbotWidgetProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [liveTheme, setLiveTheme] = useState<any>(null);
  const [selectedLang, setSelectedLang] = useState<LanguageCode>('en');
  const [availableLanguages, setAvailableLanguages] = useState(GLOBAL_LANGUAGES);

  // Resolve language list and default from theme settings, falling back to IP detection
  useEffect(() => {
    const theme = initialChatbotData?.theme;
    const configuredDefault   = theme?.defaultLanguage;       // 'auto' | 'en' | 'hi' | ...
    const configuredRestricted: string[] = theme?.restrictedLanguages ?? [];

    const applyLanguages = (langs: typeof ALL_LANGUAGES, lang: string) => {
      // If admin restricted languages, filter to only those (always keep the default in the list)
      const filtered = configuredRestricted.length > 0
        ? ALL_LANGUAGES.filter(l => configuredRestricted.includes(l.code) || l.code === lang)
        : langs;
      setAvailableLanguages(filtered.length > 0 ? filtered : langs);
      setSelectedLang(lang);
      chatbotI18n.changeLanguage(lang);
      onLanguageChange?.(lang);
    };

    if (!configuredDefault || configuredDefault === 'auto') {
      // Auto-detect via IP (original behavior)
      getLocationBasedLanguages().then(({ languages, defaultLang }) => {
        applyLanguages(languages, defaultLang);
      });
    } else {
      // Admin set a specific default language — no IP call needed
      applyLanguages(ALL_LANGUAGES, configuredDefault);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChatbotData?.theme?.defaultLanguage, initialChatbotData?.theme?.restrictedLanguages]);
 
  const handleLanguageChange = (code: LanguageCode) => {
    setSelectedLang(code);
    chatbotI18n.changeLanguage(code);
    onLanguageChange?.(code);
  };
 
  const {
    activeLeadForm,
    isLeadFormVisible,
    shouldShowLeadForm,
    isLoadingLeadConfig,
    hasSubmittedLead,
    conversationalLeadConfig,
    isConversationalMode,
    showLeadForm,
    hideLeadForm,
    submitLeadForm,       
    checkLeadRequirements,
    markLeadAsSubmitted,
  } = useLeadGeneration({
    chatbotId,
    onLeadCollected: (data) => console.log('Lead collected:', data),
  });
 
  const {
    chatbot,
    isLoadingChatbot,
    chatbotError,
    text,
    setText,
    status,
    messages,
    loading,
    error,
    hasLoadedInitialMessages,
    quickQuestions,
    conversationId,
    mode,
    setMode,
    handleSubmit,
    handleQuickQuestion,
    handleNewChat,
    formatTime,
    messagesEndRef,
    inputRef,
    chatContainerRef,
    lastBotMessageRef,
    startLeadCollection,
    isAwaitingLeadAnswer,
    leadCollectionStatus,
  } = useChatbot({
    chatbotId,
    initialChatbotData,
    conversationalLeadConfig: isConversationalMode ? conversationalLeadConfig : null,
    onLeadCollected: (data) => {
      console.log('Conversational lead submitted:', data);
      markLeadAsSubmitted();
    },
    language: selectedLang,
  });
 
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'theme-update') setLiveTheme(e.data.theme);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);
 
  useEffect(() => {
    if (!chatbotId) return;
    const sid =
      localStorage.getItem(`chatbot_session_${chatbotId}`) ||
      `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(`chatbot_session_${chatbotId}`, sid);
    setIsInitialized(true);
    window.parent.postMessage({ type: 'chatbot-loaded', chatbotId }, '*');
  }, [chatbotId]);  // Once chatbot data is loaded, send theme sizing/position to parent embed script
  useEffect(() => {
    if (!chatbot || !chatbotId) return;
    const th = chatbot.theme || {};
    window.parent.postMessage({
      type: 'chatbot-theme',
      chatbotId,
      theme: {
        windowWidth:         th.windowWidth         ?? 420,
        windowHeight:        th.windowHeight        ?? 600,
        windowBorderRadius:  th.windowBorderRadius  ?? 16,
        widgetCustomPosition: th.widgetCustomPosition ?? false,
        widgetTop:    th.widgetTop    ?? null,
        widgetBottom: th.widgetBottom ?? 20,
        widgetLeft:   th.widgetLeft   ?? null,
        widgetRight:  th.widgetRight  ?? 20,
        widgetPosition: th.widgetPosition ?? 'BottomRight',
        widgetMargin:   th.widgetMargin   ?? 20,
        widgetColor:    th.widgetColor    ?? '#3b82f6',
        widgetSize:     th.widgetSize     ?? 70,
        widgetSizeMobile: th.widgetSizeMobile ?? 60,
        widgetShape:    th.widgetShape    ?? 'ROUND',
        widgetBgColor:  th.widgetBgColor  ?? '#FFFFFF',
        popup_onload:   th.popup_onload   ?? false,
      },
    }, '*');
  }, [chatbot, chatbotId]);

  // Voice greeting inside the widget — fires once when the greeting message is shown.
  // This covers dashboard preview and any direct /embed/widget/[id] usage where embed.js
  // is NOT present to handle speakGreeting(). The embed.js script handles this for external
  // embeds, but we guard with _widget_greeting_spoken in sessionStorage to prevent double-play.
  useEffect(() => {
    if (!chatbot || !chatbotId) return;
    const th = chatbot.theme || {};
    if (!th.voiceGreeting) return;
    if (!window.speechSynthesis) return;

    // Only play if this is NOT embedded in an iframe (embed.js handles the iframe case)
    if (window.self !== window.top) return;

    const sessionKey = `chatbot_${chatbotId}_greeting_spoken`;
    if (sessionStorage.getItem(sessionKey)) return;

    // Wait until greeting message is rendered
    const timer = setTimeout(() => {
      try {
        const greetingArr = chatbot.greeting;
        let greetingText = '';
        if (Array.isArray(greetingArr) && greetingArr.length > 0) {
          const g = greetingArr[0];
          const browserLang = (navigator.language || 'en').split('-')[0];
          greetingText = (typeof g === 'string' ? g : (g[browserLang] || g['en'] || Object.values(g as Record<string, string>)[0])) || '';
        }
        if (!greetingText) return;

        const VOICE_LANG_MAP: Record<string, string> = {
          en: 'en-US', hi: 'hi-IN', ar: 'ar-SA', fr: 'fr-FR',
          es: 'es-ES', de: 'de-DE', ja: 'ja-JP', zh: 'zh-CN',
          pa: 'pa-IN', kn: 'kn-IN', te: 'te-IN', bn: 'bn-IN', gu: 'gu-IN',
          pt: 'pt-BR', it: 'it-IT', nl: 'nl-NL', ru: 'ru-RU', ko: 'ko-KR',
        };
        const browserLang = (navigator.language || 'en').split('-')[0];
        const targetLang = VOICE_LANG_MAP[browserLang] || 'en-US';
        const gender = th.voiceGender || 'female';

        const doSpeak = (voices: SpeechSynthesisVoice[]) => {
          window.speechSynthesis.cancel();
          const utt = new SpeechSynthesisUtterance(greetingText);
          utt.lang   = targetLang;
          utt.volume = Math.min(Math.max(th.voiceGreetingVolume ?? 0.8, 0), 1);
          utt.rate   = Math.min(Math.max(th.voiceGreetingRate ?? 1.0, 0.5), 2);
          if (voices.length > 0) {
            const femaleRe = /female|woman|zira|samantha|karen|moira|tessa|fiona|vicki|victoria|lisa|sarah|susan|allison|ava|nicky|siri/i;
            const maleRe   = /male|man|david|mark|daniel|alex|fred|ralph|albert|bruce|jorge|diego|pablo|thomas/i;
            const matchGender = (v: SpeechSynthesisVoice) => {
              if (gender === 'neutral') return true;
              if (gender === 'female')  return femaleRe.test(v.name);
              return maleRe.test(v.name);
            };
            const langExact  = voices.filter(v => v.lang === targetLang);
            const langPrefix = voices.filter(v => v.lang.startsWith(browserLang));
            const fallbackEn = voices.filter(v => v.lang.startsWith('en'));
            const pick = (pool: SpeechSynthesisVoice[]) => pool.find(matchGender) || pool[0];
            const chosen = pick(langExact) || pick(langPrefix) || pick(fallbackEn) || voices[0];
            if (chosen) utt.voice = chosen;
          }
          window.speechSynthesis.speak(utt);
          sessionStorage.setItem(sessionKey, '1');
        };

        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          doSpeak(voices);
        } else {
          const onReady = () => {
            window.speechSynthesis.onvoiceschanged = null;
            doSpeak(window.speechSynthesis.getVoices());
          };
          window.speechSynthesis.onvoiceschanged = onReady;
          setTimeout(() => {
            if ((window.speechSynthesis.onvoiceschanged as any) === onReady) {
              window.speechSynthesis.onvoiceschanged = null;
              doSpeak(window.speechSynthesis.getVoices());
            }
          }, 300);
        }
      } catch (_) { /* non-fatal */ }
    }, 800);

    return () => clearTimeout(timer);
  }, [chatbot, chatbotId]);
 
  useEffect(() => {
    if (messages.length > 0 && !hasSubmittedLead && conversationId) {
      checkLeadRequirements(conversationId);
    }
  }, [messages, hasSubmittedLead, conversationId, checkLeadRequirements]);
 
  useEffect(() => {
    if (!shouldShowLeadForm || !activeLeadForm || isLeadFormVisible || loading)
      return;
    const timer = setTimeout(() => {
      if (isConversationalMode) startLeadCollection();
      else showLeadForm();
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    shouldShowLeadForm,
    activeLeadForm,
    isLeadFormVisible,
    loading,
    isConversationalMode,
    startLeadCollection,
    showLeadForm,
  ]);
 
  if (!isInitialized || isLoadingChatbot) return <LoadingSpinner />;
  if (chatbotError)
    return (
      <ErrorDisplay
        error="Failed to load chatbot"
        onRetry={() => window.location.reload()}
      />
    );
  if (!chatbot) return null;
 
  const effectiveChatbot = liveTheme
    ? { ...chatbot, theme: { ...chatbot.theme, ...liveTheme } }
    : chatbot;
 
  const boundSubmitLeadForm = async (
    formData: Record<string, string>
  ): Promise<boolean> => {
    if (!conversationId) return false;
    return submitLeadForm(formData, conversationId);
  };
 
  return (
    <ChatBot
      chatbot={effectiveChatbot}
      onClose={() =>
        window.parent.postMessage({ type: 'chatbot-close', chatbotId }, '*')
      }
      text={text}
      setText={setText}
      status={status}
      messages={messages}
      loading={loading}
      error={error}
      hasLoadedInitialMessages={hasLoadedInitialMessages}
      quickQuestions={quickQuestions}
      conversationId={conversationId}
      mode={mode}
      setMode={setMode}
      handleSubmit={handleSubmit}
      handleQuickQuestion={handleQuickQuestion}
      handleNewChat={handleNewChat}
      formatTime={formatTime}
      messagesEndRef={messagesEndRef}
      inputRef={inputRef}
      chatContainerRef={chatContainerRef}
      lastBotMessageRef={lastBotMessageRef}
      activeLeadForm={activeLeadForm}
      isLeadFormVisible={isLeadFormVisible}
      isLoadingLeadConfig={isLoadingLeadConfig}
      hasSubmittedLead={hasSubmittedLead}
      isConversationalMode={isConversationalMode}
      isAwaitingLeadAnswer={isAwaitingLeadAnswer}
      leadCollectionStatus={leadCollectionStatus}
      showLeadForm={showLeadForm}
      hideLeadForm={hideLeadForm}
      submitLeadForm={boundSubmitLeadForm}
      startLeadCollection={startLeadCollection}
      markLeadAsSubmitted={markLeadAsSubmitted}
      selectedLang={selectedLang}
      onLanguageChange={handleLanguageChange}
      availableLanguages={availableLanguages}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatBot — layout shell
// ─────────────────────────────────────────────────────────────────────────────

interface ChatBotProps {
  chatbot: any;
  onClose: () => void;
  text: string;
  setText: (text: string) => void;
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  messages: Message[];
  loading: boolean;
  error: string;
  hasLoadedInitialMessages: boolean;
  quickQuestions: MultilingualSuggestion[];
  conversationId: string | null;
  mode: 'streaming' | 'standard';
  setMode: (mode: 'streaming' | 'standard') => void;
  handleSubmit: (e?: React.FormEvent, overrideText?: string) => Promise<void>;
  handleQuickQuestion: (question: string) => Promise<void>;
  handleNewChat: () => void;
  formatTime: (date?: Date) => string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  lastBotMessageRef: React.RefObject<HTMLDivElement | null>;
  activeLeadForm: any;
  isLeadFormVisible: boolean;
  isLoadingLeadConfig: boolean;
  hasSubmittedLead: boolean;
  isConversationalMode: boolean;
  isAwaitingLeadAnswer: boolean;
  leadCollectionStatus: 'idle' | 'collecting' | 'submitting' | 'done' | 'error';
  showLeadForm: () => void;
  hideLeadForm: () => void;
  submitLeadForm: (formData: Record<string, string>) => Promise<boolean>;
  startLeadCollection: () => void;
  markLeadAsSubmitted: () => void;
  selectedLang: LanguageCode;
  onLanguageChange: (code: LanguageCode) => void;
  availableLanguages: typeof GLOBAL_LANGUAGES;
}

function ChatBot({
  chatbot, onClose,
  text, setText, status, messages, loading, error,
  hasLoadedInitialMessages, quickQuestions, conversationId, mode, setMode,
  handleSubmit, handleQuickQuestion, handleNewChat, formatTime,
  messagesEndRef, inputRef, chatContainerRef, lastBotMessageRef,
  activeLeadForm, isLeadFormVisible, isLoadingLeadConfig, hasSubmittedLead,
  isConversationalMode, isAwaitingLeadAnswer, leadCollectionStatus,
  showLeadForm, hideLeadForm, submitLeadForm, startLeadCollection, markLeadAsSubmitted,
  selectedLang, onLanguageChange, availableLanguages,
}: ChatBotProps) {
  const { t } = useTranslation('translation', { i18n: chatbotI18n });
  const [isOpen, setIsOpen] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;
  const isDashboardPreview =
    typeof window !== 'undefined' &&
    window.location.pathname.includes('/chatbots/');

  const SPEECH_LANG_MAP: Record<string, string> = {
    en: 'en-US', hi: 'hi-IN', pa: 'pa-IN', kn: 'kn-IN', te: 'te-IN',
    bn: 'bn-IN', gu: 'gu-IN', ja: 'ja-JP', fr: 'fr-FR', es: 'es-ES',
    ar: 'ar-SA', zh: 'zh-CN', de: 'de-DE', pt: 'pt-BR', it: 'it-IT',
    nl: 'nl-NL', ru: 'ru-RU', ko: 'ko-KR',
  };

  const {
    transcript, startListening, stopListening,
    resetTranscript, browserSupportsSpeechRecognition,
    policyBlocked, policyMessage,
  } = useSpeechToText({ continuous: true, lang: SPEECH_LANG_MAP[selectedLang] || 'en-US' });
  const [isMicrophoneOn, setIsMicrophoneOn] = useState(false);
  const [isAutoSendPending, setIsAutoSendPending] = useState(false);
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingVoiceTextRef = useRef<string>('');
  const [parentPolicyInfo, setParentPolicyInfo] = useState<{
    blocked: boolean;
    permission?: string;
  } | null>(() => {
    // Read URL params once at mount — lazy initializer runs outside render so no effect needed.
    if (typeof window === 'undefined') return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const blocked = params.get('parent_policy_blocked');
      const permission = params.get('parent_permission');
      if (blocked === 'true' || permission === 'denied') {
        return { blocked: blocked === 'true', permission: permission || undefined };
      }
    } catch { /* ignore */ }
    return null;
  });

  // NOTE: `parentPolicyInfo.permission` reflects the PARENT page's origin, not this
  // cross-origin iframe — so a parent 'denied' must NOT hard-disable the mic here.
  // We only hard-block on an explicit Permissions-Policy block (`parent_policy_blocked`)
  // or once our own getUserMedia/recognition attempt fails (policyBlocked). Otherwise we
  // let the user try and surface the real reason via the hook.
  const micAllowed =
    browserSupportsSpeechRecognition &&
    !policyBlocked &&
    (isDashboardPreview ? true : !parentPolicyInfo?.blocked);

  

  useEffect(() => {
    if (!isEmbedded) return;
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    // dvh shrinks when the iOS virtual keyboard opens; fall back to vh on old browsers
    const h = (typeof CSS !== 'undefined' && CSS.supports('height', '100dvh')) ? '100dvh' : '100vh';
    document.body.style.height = h;
    document.documentElement.style.height = h;
    document.documentElement.style.overflow = 'hidden';
  }, [isEmbedded]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkMobile = () => {
      const params = new URLSearchParams(window.location.search);
      const isMobileParam = params.get('is_mobile');

      if (isMobileParam !== null) {
        setIsMobile(isMobileParam === 'true');
      } else {
        setIsMobile(window.innerWidth < 768);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!transcript) return;

    // Accumulate the transcript into the input field so the user can see it growing.
    // Do NOT call resetTranscript() here — that would wipe the accumulated text before
    // the next recognition result arrives, causing only the last chunk to be sent.
    pendingVoiceTextRef.current = transcript;
    setText(transcript);

    // Reset the auto-send countdown every time new speech arrives.
    if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);

    startTransition(() => setIsAutoSendPending(true));
    autoSendTimerRef.current = setTimeout(() => {
      setIsAutoSendPending(false);
      setIsMicrophoneOn(false);
      const toSend = pendingVoiceTextRef.current;
      pendingVoiceTextRef.current = '';
      // Reset transcript AFTER we've captured the final text, not before.
      resetTranscript();
      if (toSend.trim()) {
        // overrideText bypasses the stale `text` state inside handleSubmit's closure
        handleSubmit(undefined, toSend);
      }
    }, 1500);
  }, [transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isMicrophoneOn) {
      // Clear any leftover text from a previous session before starting fresh
      pendingVoiceTextRef.current = '';
      startListening();
    } else {
      stopListening();
      resetTranscript();
      pendingVoiceTextRef.current = '';
      // Cancel pending auto-send if user manually turned off mic
      if (autoSendTimerRef.current) {
        clearTimeout(autoSendTimerRef.current);
        autoSendTimerRef.current = null;
        startTransition(() => setIsAutoSendPending(false));
      }
    }
  }, [isMicrophoneOn, startListening, stopListening, resetTranscript]);

  const handleClose = () => {
    if (isEmbedded) { onClose(); return; }
    setIsClosing(true);
    setTimeout(() => { setIsOpen(false); setIsClosing(false); }, 300);
  };

  const handleLeadAction = () => {
    if (isConversationalMode) startLeadCollection();
    else showLeadForm();
  };

  const handleSkipLead = () => {
    localStorage.setItem(`chatbot_${chatbot.id}_lead_submitted`, 'true');
    markLeadAsSubmitted();
  };

  const currentLangMeta = availableLanguages.find(l => l.code === selectedLang);
  const dir = currentLangMeta?.dir ?? 'ltr';

  // All visual theme values come from chatbot.theme
  const th = chatbot.theme || {};
  const primaryLight = th.inputBgColor   || '#f8fafc';
  const borderColor  = th.inputBorderColor || '#e2e8f0';
  const windowW = th.windowWidth || 420;
  const windowH = th.windowHeight || 600;
  const borderR = th.windowBorderRadius ?? 16;

  const shellClass = [
    isMobile || isEmbedded ? 'w-full h-full rounded-none' : `rounded-[${borderR}px]`,
    'flex flex-col relative overflow-hidden',
  ].join(' ');

  const shellStyle = (!isMobile && !isEmbedded)
    ? { width: `${windowW}px`, height: `${windowH}px`, borderRadius: `${borderR}px` }
    : {};

  const getPositionStyle = (): React.CSSProperties => {
    if (isEmbedded || isMobile) return {};
    if (th.widgetCustomPosition) {
      const style: React.CSSProperties = { position: 'fixed', zIndex: 50 };
      if (th.widgetTop    != null) style.top    = `${th.widgetTop}px`;
      if (th.widgetBottom != null) style.bottom = `${th.widgetBottom}px`;
      if (th.widgetLeft   != null) style.left   = `${th.widgetLeft}px`;
      if (th.widgetRight  != null) style.right  = `${th.widgetRight}px`;
      return style;
    }
    const pos = th.widgetPosition || 'BottomRight';
    const margin = `${th.widgetMargin ?? 20}px`;
    const style: React.CSSProperties = { position: 'fixed', zIndex: 50 };
    if (pos.includes('Bottom')) style.bottom = margin; else style.top = margin;
    if (pos.includes('Right'))  style.right  = margin; else style.left = margin;
    return style;
  };

  const positionClass = isEmbedded
    ? 'w-full h-full'
    : isMobile ? 'fixed inset-0 z-50' : 'fixed z-50';

  if (!hasLoadedInitialMessages) {
    return (
      <div className={positionClass} style={getPositionStyle()}>
        <div className={shellClass} style={shellStyle}><LoadingSpinner /></div>
      </div>
    );
  }

  return (
    <div className={positionClass} style={getPositionStyle()} dir={dir}>
      {isOpen ? (
        <div
          className={[
            shellClass,
            'transition-all duration-300 ease-out',
            isClosing ? 'animate-out slide-out-to-bottom-full' : 'animate-in slide-in-from-bottom-full',
          ].join(' ')}
          style={{ backgroundColor: primaryLight, border: `1px solid ${borderColor}`, ...shellStyle }}
        >
          <ChatHeader
            onClose={handleClose}
            chatbot={chatbot}
            isMobile={isMobile}
            isEmbedded={isEmbedded}
            closeLabel={t('closeChat')}
            liveLabel={t('live')}
          />

          {isLeadFormVisible && activeLeadForm && !isConversationalMode && (
            <LeadFormOverlay
              activeLeadForm={activeLeadForm}
              chatbotId={chatbot.id}
              conversationId={conversationId || ''}
              onClose={hideLeadForm}
              onSuccess={markLeadAsSubmitted}
              onSubmitLead={submitLeadForm}
            />
          )}

          <ChatMessages
            messages={messages}
            loading={loading}
            status={status}
            quickQuestions={quickQuestions}
            onQuickQuestion={handleQuickQuestion}
            chatContainerRef={chatContainerRef}
            messagesEndRef={messagesEndRef}
            lastBotMessageRef={lastBotMessageRef}
            formatTime={formatTime}
            chatbot={chatbot}
            hasSubmittedLead={hasSubmittedLead}
            isConversationalMode={isConversationalMode}
            leadCollectionStatus={leadCollectionStatus}
            onLeadAction={!hasSubmittedLead && activeLeadForm ? handleLeadAction : undefined}
            onSkipLead={!hasSubmittedLead && activeLeadForm ? handleSkipLead : undefined}
            t={t}
            selectedLang={selectedLang}
          />

          {error && !isDashboardPreview && <ErrorBanner error={error} />}

          <ChatInput
            text={text}
            setText={setText}
            loading={loading}
            isMicrophoneOn={isMicrophoneOn}
            isAutoSendPending={isAutoSendPending}
            browserSupportsSpeechRecognition={micAllowed}
            voiceBlockedMessage={
              !micAllowed && browserSupportsSpeechRecognition
                ? (policyMessage ||
                    (parentPolicyInfo?.permission === 'denied' || parentPolicyInfo?.blocked
                      ? 'Microphone is blocked for this site. Allow it in your browser settings to use voice.'
                      : null))
                : null
            }
            onSubmit={handleSubmit}
            onNewChat={handleNewChat}
            status={status}
            inputRef={inputRef}
            onToggleMicrophone={() => { if (micAllowed) setIsMicrophoneOn(p => !p); }}
            hasLeadForm={!hasSubmittedLead && !!activeLeadForm}
            onLeadAction={handleLeadAction}
            isLoadingLeadConfig={isLoadingLeadConfig}
            isAwaitingLeadAnswer={isAwaitingLeadAnswer}
            isConversationalMode={isConversationalMode}
            chatbot={chatbot}
            selectedLang={selectedLang}
            onLanguageChange={onLanguageChange}
            t={t}
            availableLanguages={availableLanguages}
          />

          {(chatbot.theme?.showPoweredBy ?? true) && (
            <div className="flex items-center justify-end gap-1.5 p-1 mr-4">
              <span className="text-xs font-medium tracking-wide text-gray-400 lowercase">
                {t('poweredBy')}
              </span>
              <Link target="_blank" rel="noopener noreferrer" href='https://prabisha.com/' className="cursor-pointer text-sm font-bold text-[#1320AA] hover:text-[#1320AA] transition-colors">
                Prabisha
              </Link>
            </div>
          )}
        </div>
      ) : (
        !isEmbedded && !isMobile && (
          <ChatToggleButton onClick={() => setIsOpen(true)} chatbot={chatbot} isMobile={isMobile} openLabel={t('openChat')} />
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatHeader — reads everything from chatbot.theme
// ─────────────────────────────────────────────────────────────────────────────

function ChatHeader({
  onClose, chatbot, isMobile, isEmbedded, closeLabel, liveLabel,
}: {
  onClose: () => void;
  chatbot: any;
  isMobile?: boolean;
  isEmbedded?: boolean;
  closeLabel: string;
  liveLabel: string;
}) {
  const th = chatbot?.theme || {};
  const headerBg      = th.headerBgColor      || '#111CA8';
  const headerText    = th.headerTextColor    || '#ffffff';
  const accentColor   = th.inputButtonColor   || '#DF6A2E';
  const closeBtnBg    = th.closeButtonBgColor || '#DF6A2E';
  const closeBtnColor = th.closeButtonColor   || '#ffffff';

  // Icon image: prefer theme widgetIcon (if IMAGE type), then avatar, then icon
  const th_icon = chatbot?.theme || {};
  const iconType_h = th_icon.widgetIconType || 'EMOJI';
  const iconSrc = (iconType_h === 'IMAGE' && th_icon.widgetIcon)
    ? th_icon.widgetIcon
    : (chatbot.avatar || chatbot.icon || '/icons/logo.png');

  return (
    <div
      className={[
        'flex items-center justify-between px-5 py-4 border-b border-black/10',
        isMobile || isEmbedded ? 'rounded-none' : 'rounded-t-2xl',
      ].join(' ')}
      style={{ backgroundColor: headerBg, color: headerText }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <Image
          src={iconSrc}
          height={48} width={48}
          alt={chatbot.name || 'Assistant'}
          className="h-12 w-12 rounded-xl object-contain border border-black/10"
          unoptimized
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold truncate">
              {chatbot.name || 'Customer Support'}
            </h3>
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50"
                  style={{ animation: 'softPulse 2s ease-in-out infinite' }}
                />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
              </span>
              <span className="text-xs font-semibold truncate tracking-wide">{liveLabel}</span>
              <style jsx>{`
                @keyframes softPulse {
                  0%   { transform: scale(1);   opacity: 0.5; }
                  50%  { transform: scale(1.8); opacity: 0.2; }
                  100% { transform: scale(1);   opacity: 0.5; }
                }
              `}</style>
            </span>
          </div>
          <p className="text-xs font-semibold truncate mt-0.5" style={{ color: headerText, opacity: 0.8 }}>
            {chatbot.description || 'Typically replies instantly'}
          </p>
        </div>
      </div>

      {isMobile && (
        <button
          onClick={onClose}
          className="border-2 border-solid border-white/40 h-9 w-9 rounded-full flex items-center justify-center hover:opacity-90 transition cursor-pointer"
          style={{ backgroundColor: closeBtnBg, color: closeBtnColor }}
          aria-label={closeLabel}
        >
          <XIcon size={16} strokeWidth={5} />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatToggleButton — reads size/shape/colors entirely from chatbot.theme
// ─────────────────────────────────────────────────────────────────────────────

function ChatToggleButton({
  onClick, chatbot, isMobile, openLabel,
}: {
  onClick: () => void;
  chatbot: any;
  isMobile: boolean;
  openLabel: string;
}) {
  const size = getWidgetSize(chatbot.theme, isMobile);
  const shapeClass = getWidgetShapeClass(chatbot.theme);
  const th = chatbot.theme || {};
  const iconType = th.widgetIconType || 'EMOJI';
  const widgetIcon = th.widgetIcon || null;

  // Determine what to render as the icon
  const resolvedIconUrl = iconType !== 'EMOJI' ? (widgetIcon || chatbot.avatar || chatbot.icon || null) : null;
  const resolvedEmoji   = iconType === 'EMOJI'  ? (widgetIcon || null) : null;

  return (
    <button
      onClick={onClick}
      className={`fixed bottom-6 right-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer overflow-hidden flex items-center justify-center ${shapeClass}`}
      aria-label={openLabel}
      style={{
        width: `${size}px`, height: `${size}px`,
        backgroundColor: th.widgetBgColor || '#FFFFFF',
        border: `3px solid ${th.widgetColor || '#111CA8'}`,
      }}
    >
      {resolvedEmoji ? (
        <span style={{ fontSize: `${Math.round(size * 0.4)}px`, lineHeight: 1, userSelect: 'none' }}>{resolvedEmoji}</span>
      ) : resolvedIconUrl ? (
        <Image
          src={resolvedIconUrl}
          height={size} width={size}
          alt={chatbot.name || 'Chat'}
          className={`w-full h-full object-contain ${shapeClass}`}
          unoptimized
        />
      ) : (
        /* Default chat bubble SVG */
        <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill={th.widgetColor || '#111CA8'} xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/>
        </svg>
      )}
      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatMessages
// ─────────────────────────────────────────────────────────────────────────────

interface ChatMessagesProps {
  messages: Message[];
  loading: boolean;
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  quickQuestions: MultilingualSuggestion[];
  onQuickQuestion: (q: string) => void;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  lastBotMessageRef: React.RefObject<HTMLDivElement | null>;
  formatTime: (date?: Date) => string;
  chatbot: any;
  hasSubmittedLead: boolean;
  isConversationalMode: boolean;
  leadCollectionStatus: 'idle' | 'collecting' | 'submitting' | 'done' | 'error';
  onLeadAction?: () => void;
  onSkipLead?: () => void;
  t: (key: string) => string;
  selectedLang: LanguageCode;
}

// ── Hoisted message-list subcomponents ──────────────────────────────────────
// Defined at module scope (NOT inside ChatMessages' render) so React keeps the same
// component identity across renders — prevents full remount of every bubble on each
// render, which was causing flicker, lost local state (e.g. "copied"), and image reloads.

function ChatbotAvatar({ src, name, shapeClass, small = false }: {
  src: string; name?: string; shapeClass: string; small?: boolean;
}) {
  const size = small ? 24 : 36;
  return (
    <div className="shrink-0 flex flex-col items-center" style={{ width: size }}>
      <Image
        src={src}
        height={size} width={size}
        alt={name || 'Assistant'}
        className={`${small ? 'p-0' : 'p-0.5'} rounded-full bg-primary/10 object-cover ${shapeClass}`}
      />
    </div>
  );
}

function LoadingDots({ label, small = false, avatarSrc, avatarName, avatarShape }: {
  label: string; small?: boolean; avatarSrc: string; avatarName?: string; avatarShape: string;
}) {
  return (
    <div className="flex items-center gap-3 animate-in fade-in">
      <ChatbotAvatar small={small} src={avatarSrc} name={avatarName} shapeClass={avatarShape} />
      <div className="bg-card border rounded-2xl rounded-tl-none p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {small ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm font-medium">{label}</p>
            </>
          ) : (
            <div className="flex space-x-1.5">
              {[0, 150, 300].map(delay => (
                <div
                  key={delay}
                  className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${delay}ms`, animationDuration: '1s' }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message, isUser, isLastBot, lastBotMessageRef,
  userBg, userText, botBg, botText, formatTime, showTTS,
  isSpeaking, onSpeak, avatarSrc, avatarName, avatarShape,
}: {
  message: Message; isUser: boolean; isLastBot: boolean;
  lastBotMessageRef: React.RefObject<HTMLDivElement | null>;
  userBg: string; userText: string; botBg: string; botText: string;
  formatTime: (date?: Date) => string; showTTS: boolean;
  isSpeaking: boolean; onSpeak: () => void;
  avatarSrc: string; avatarName?: string; avatarShape: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const plain = message.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    navigator.clipboard.writeText(plain).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <div
      ref={isLastBot ? lastBotMessageRef : undefined}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {!isUser && <ChatbotAvatar src={avatarSrc} name={avatarName} shapeClass={avatarShape} />}
      <div className={`relative group min-w-0 ${isUser ? 'ml-auto max-w-[85%]' : 'max-w-[85%]'}`}>
        <div
          className={[
            'rounded-2xl px-5 py-3.5 text-[14.5px] leading-relaxed',
            'transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]',
            isUser
              ? 'rounded-tr-md shadow-[0_4px_16px_rgba(0,0,0,0.15)]'
              : 'border border-black/5 rounded-tl-md shadow-[0_4px_16px_rgba(0,0,0,0.05)]',
          ].join(' ')}
          style={{
            backgroundColor: isUser ? userBg : botBg,
            color: isUser ? userText : botText,
          }}
        >
          <div
            className="prose prose-sm max-w-none text-[13px] overflow-hidden min-w-0 [&_*]:max-w-full [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_a]:break-words [&_img]:h-auto [&_img]:block [&_table]:block [&_table]:overflow-x-auto [&_div]:box-border"
            style={{ color: isUser ? userText : botText }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.content) }}
          />
          <div className="flex items-center justify-between mt-2 gap-4">
            {message.createdAt && (
              <div className="text-[10px] opacity-70">{formatTime(message.createdAt)}</div>
            )}
            {!isUser && (
              <div className="flex items-center gap-0.5">
                {/* Copy button */}
                <button
                  onClick={handleCopy}
                  className={[
                    'p-1.5 rounded-full transition-all duration-200 cursor-pointer',
                    copied
                      ? 'text-emerald-500'
                      : 'hover:bg-primary/10 text-muted-foreground opacity-0 group-hover:opacity-100',
                  ].join(' ')}
                  title={copied ? 'Copied!' : 'Copy message'}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                {/* TTS button */}
                {showTTS && (
                  <button
                    onClick={onSpeak}
                    className={[
                      'p-1.5 rounded-full transition-all duration-200 cursor-pointer',
                      isSpeaking
                        ? 'bg-primary/20 text-primary scale-110'
                        : 'hover:bg-primary/10 text-muted-foreground opacity-0 group-hover:opacity-100',
                    ].join(' ')}
                    title={isSpeaking ? 'Stop reading' : 'Read aloud'}
                  >
                    {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadCard({
  leadCollectionStatus, hasSubmittedLead, botBg, botText, accentColor,
  message, onLeadAction, onSkipLead, avatarSrc, avatarName, avatarShape,
}: {
  leadCollectionStatus: 'idle' | 'collecting' | 'submitting' | 'done' | 'error';
  hasSubmittedLead: boolean; botBg: string; botText: string; accentColor: string;
  message: string; onLeadAction?: () => void; onSkipLead?: () => void;
  avatarSrc: string; avatarName?: string; avatarShape: string;
}) {
  if (leadCollectionStatus === 'done' || hasSubmittedLead) return null;
  const isCollecting = leadCollectionStatus === 'collecting' || leadCollectionStatus === 'submitting';
  if (isCollecting) return null; // conversational lead hook handles the chat messages

  return (
    <div className="flex gap-3 animate-in fade-in">
      <ChatbotAvatar src={avatarSrc} name={avatarName} shapeClass={avatarShape} />
      <div className="max-w-[85%]">
        <div
          className="rounded-2xl rounded-tl-none px-4 py-3 border border-black/5 shadow-[0_4px_16px_rgba(0,0,0,0.05)] text-[13.5px] leading-relaxed"
          style={{ backgroundColor: botBg, color: botText }}
        >
          <p className="mb-3">{message}</p>
          <div className="flex gap-2">
            <button
              onClick={onLeadAction}
              className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-opacity hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: accentColor, color: '#fff' }}
            >
              Sure, go ahead
            </button>
            <button
              onClick={() => onSkipLead?.()}
              className="py-1.5 px-3 rounded-lg text-xs font-medium border transition-colors hover:bg-muted cursor-pointer"
              style={{ borderColor: botText + '30', color: botText }}
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatMessages({
  messages, loading, status, quickQuestions, onQuickQuestion,
  chatContainerRef, messagesEndRef, lastBotMessageRef, formatTime, chatbot,
  hasSubmittedLead, isConversationalMode, leadCollectionStatus, onLeadAction, onSkipLead, t, selectedLang,
}: ChatMessagesProps) {
  const { speak, stop, isPlaying } = useTextToSpeech();
  const [activeSpeakingId, setActiveSpeakingId] = useState<string | null>(null);
  // Note: the "speaking" icon derives from `activeSpeakingId === id && isPlaying`, so it
  // resets automatically when playback ends — no effect needed to clear activeSpeakingId.

  const th = chatbot.theme || {};
  const botBg    = th.botMessageBgColor    || '#FFFFFF';
  const botText  = th.botMessageTextColor  || '#1E293B';
  const userBg   = th.userMessageBgColor   || '#111CA8';
  const userText = th.userMessageTextColor || '#ffffff';
  const accentColor = th.inputButtonColor  || '#DF6A2E';
  const msgBg    = th.messageBgColor       || '#f8fafc';
  const fontSize = th.fontSize             || 14;
  const showTTS  = th.showTTS              ?? true;

  // Icon src: prefer theme widgetIcon (IMAGE type), then avatar, then icon
  const thIcon = th;
  const iconType_m = thIcon.widgetIconType || 'EMOJI';
  const chatIconSrc = (iconType_m === 'IMAGE' && thIcon.widgetIcon)
    ? thIcon.widgetIcon
    : (chatbot.avatar || chatbot.icon || '/icons/logo1.png');
  const iconShapeClass = getIconShapeClass(th);

  const hasUserMessages     = messages.some(m => m.senderType === 'USER');
  const hasMultipleMessages = messages.length >= 2;

  const lastBotIndex = messages.reduce<number>(
    (acc, m, i) => (m.senderType === 'BOT' ? i : acc),
    -1
  );

  const handleSpeak = async (id: string, content: string) => {
    if (activeSpeakingId === id && isPlaying) { stop(); setActiveSpeakingId(null); }
    else {
      setActiveSpeakingId(id);
      // Strip HTML tags before sending to TTS so it reads clean text
      const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      await speak(plainText);
    }
  };

  // Shared avatar props for the hoisted subcomponents below
  const avatarProps = { avatarSrc: chatIconSrc, avatarName: chatbot.name as string | undefined, avatarShape: iconShapeClass };

  return (
    <div
      ref={chatContainerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden relative"
      style={{ backgroundColor: msgBg, fontSize: `${fontSize}px` }}
    >
      <div className="p-4 space-y-6">
        {messages.map((message, index) => {
          // Empty bot placeholder — show typing indicator inline instead of empty bubble
          if (message.senderType === 'BOT' && !message.content && index === messages.length - 1) {
            return <LoadingDots key={index} label={t('thinking')} {...avatarProps} />;
          }
          const id = `msg-${index}`;
          return (
            <MessageBubble
              key={index}
              message={message}
              isUser={message.senderType === 'USER'}
              isLastBot={index === lastBotIndex}
              lastBotMessageRef={lastBotMessageRef}
              userBg={userBg} userText={userText} botBg={botBg} botText={botText}
              formatTime={formatTime} showTTS={showTTS}
              isSpeaking={activeSpeakingId === id && isPlaying}
              onSpeak={() => handleSpeak(id, message.content)}
              {...avatarProps}
            />
          );
        })}

        {onLeadAction && hasMultipleMessages && !hasSubmittedLead && !loading && (
          <LeadCard
            leadCollectionStatus={leadCollectionStatus}
            hasSubmittedLead={hasSubmittedLead}
            botBg={botBg} botText={botText} accentColor={accentColor}
            message={chatbot.theme?.leadCardMessage || "Before we continue, mind sharing a few quick details? Totally optional."}
            onLeadAction={onLeadAction} onSkipLead={onSkipLead}
            {...avatarProps}
          />
        )}

        {/* "Thinking" indicator while waiting for the first token. Once streaming starts the
            inline empty-bot placeholder (in the map above) and then the streaming text itself
            are the indicators, so no separate streaming loader is needed here. */}
        {loading && status === 'submitted' && messages[messages.length - 1]?.content !== '' && <LoadingDots label={t('thinking')} {...avatarProps} />}

        {/* Quick suggestions — shown only before any user message */}
        {!hasUserMessages && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(quickQuestions.length > 0 ? quickQuestions : DEFAULT_SUGGESTIONS)
              .map((item, i) => {
                const label = resolveSuggestion(item, selectedLang);
                if (!label) return null;
                return (
                  <button
                    key={i}
                    onClick={() => onQuickQuestion(label)}
                    disabled={loading}
                    className="py-2 px-4 rounded-full border text-[13px] font-medium transition-all hover:opacity-80 hover:shadow-sm disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor: th.quickSuggestionBgColor || '#ffffff',
                      color: th.quickSuggestionTextColor || '#0f172a',
                      borderColor: th.inputBorderColor || '#e2e8f0',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
          </div>
        )}

        <div ref={messagesEndRef} className="h-4" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatInput
// ─────────────────────────────────────────────────────────────────────────────

interface ChatInputProps {
  text: string;
  setText: (text: string) => void;
  loading: boolean;
  isMicrophoneOn: boolean;
  isAutoSendPending?: boolean;
  browserSupportsSpeechRecognition: boolean;
  voiceBlockedMessage?: string | null;
  onSubmit: (e?: React.FormEvent) => Promise<void>;
  onNewChat: () => void;
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onToggleMicrophone: () => void;
  hasLeadForm: boolean;
  onLeadAction: () => void;
  isLoadingLeadConfig: boolean;
  isAwaitingLeadAnswer: boolean;
  isConversationalMode: boolean;
  chatbot?: any;
  selectedLang: LanguageCode;
  onLanguageChange: (code: LanguageCode) => void;
  t: (key: string) => string;
  availableLanguages: typeof GLOBAL_LANGUAGES;
}

function ChatInput({
  text, setText, loading, isMicrophoneOn, isAutoSendPending = false, browserSupportsSpeechRecognition,
  voiceBlockedMessage = null,
  onSubmit, onNewChat, status, inputRef, onToggleMicrophone,
  hasLeadForm, onLeadAction, isLoadingLeadConfig,
  isAwaitingLeadAnswer, isConversationalMode, chatbot,
  selectedLang, onLanguageChange, t, availableLanguages,
}: ChatInputProps) {
  const th = chatbot?.theme || {};
  const accentColor  = th.inputButtonColor  || '#DD692E';
  const inputBg      = th.inputBgColor      || '#ffffff';
  const borderColor  = th.inputBorderColor  || '#e2e8f0';
  const showMic      = th.showMic           ?? true;
  const showEmoji    = th.showEmoji         ?? true;
  const showNewChat  = th.showNewChat       ?? true;
  const showLangSwitch = th.showLanguageSwitcher ?? true;
  const [showPicker, setShowPicker] = useState(false);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setText(text + emojiData.emoji);
  };

  return (
    <div
      className="border-t px-2 pt-2 shrink-0 relative transition-all duration-200"
      style={{ backgroundColor: inputBg, borderColor }}
    >
      {showPicker && showEmoji && (
        <div className="absolute bottom-full left-0 w-full z-50 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex flex-col border-t bg-card shadow-2xl">
            <div className="flex items-center justify-between p-2 border-b bg-muted/50">
              <span className="text-xs font-medium px-2">{t('selectEmoji')}</span>
              <Button
                variant="ghost" size="sm"
                className="h-8 w-8 p-0 rounded-full cursor-pointer"
                onClick={() => setShowPicker(false)}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
            <Picker
              onEmojiClick={onEmojiClick}
              autoFocusSearch={false}
              width="100%"
              height="60vh"
              previewConfig={{ showPreview: false }}
              skinTonesDisabled
              searchPlaceHolder={t('search')}
            />
          </div>
        </div>
      )}

      {/* Listening / auto-send indicator */}
      {isMicrophoneOn && (
        <div className={`flex items-center gap-3 px-3 py-2 mb-2 mx-1 border rounded-xl transition-colors duration-300 ${
          isAutoSendPending
            ? 'bg-orange-50 border-orange-200'
            : 'bg-red-50 border-red-100'
        }`}>
          {/* Animated sound-wave bars */}
          <div className="flex items-end gap-[3px] h-5 flex-shrink-0">
            {([12, 18, 22, 18, 12] as number[]).map((h, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full animate-bounce"
                style={{
                  height: h,
                  backgroundColor: isAutoSendPending ? '#f97316' : '#ef4444',
                  animationDelay: `${i * 80}ms`,
                  animationDuration: isAutoSendPending ? '0.4s' : '0.65s',
                }}
              />
            ))}
          </div>
          <span className={`text-xs font-medium flex-1 leading-tight ${
            isAutoSendPending ? 'text-orange-600' : 'text-red-600'
          }`}>
            {isAutoSendPending ? 'Sending… tap mic to cancel' : 'Listening… speak now'}
          </span>
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            isAutoSendPending ? 'bg-orange-500 animate-ping' : 'bg-red-500 animate-pulse'
          }`} />
        </div>
      )}

      <PromptInput
        onSubmit={async (e: React.FormEvent) => {
          e.preventDefault();
          setShowPicker(false);
          await onSubmit(e);
        }}
      >
        <div className="flex items-stretch gap-2 w-full">
          <div className="flex flex-col flex-1 min-w-0 w-full">
            <PromptInputTextarea
              ref={inputRef}
              value={text}
              onChange={e => { if (e.target.value.length <= 2000) setText(e.target.value); }}
              placeholder={isAwaitingLeadAnswer ? t('typeAnswer') : t('typeMessage')}
              disabled={loading || isMicrophoneOn}
              className="min-h-10 max-h-32 w-full text-[14px] bg-white/60 backdrop-blur-sm rounded-lg px-3 py-2 resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />
            {text.length > 1500 && (
              <div className={`text-right text-[10px] px-1 pb-0.5 ${text.length >= 2000 ? 'text-red-500' : 'text-muted-foreground'}`}>
                {text.length}/2000
              </div>
            )}

            <PromptInputToolbar>
              <PromptInputTools>
                {showEmoji && (
                  <PromptInputButton
                    type="button" size="sm" variant="ghost"
                    onClick={(e) => { e.preventDefault(); setShowPicker(!showPicker); }}
                    className={`${showPicker ? 'bg-muted' : ''} cursor-pointer`}
                  >
                    <SmilePlus className="h-4 w-4" />
                  </PromptInputButton>
                )}

                {showMic && browserSupportsSpeechRecognition && (
                  <PromptInputButton
                    type="button" size="sm" variant="ghost"
                    onClick={onToggleMicrophone}
                    className={`cursor-pointer transition-all ${isMicrophoneOn ? 'bg-red-100 text-red-600 ring-2 ring-red-400 ring-offset-1 animate-pulse rounded-md' : ''}`}
                  >
                    {isMicrophoneOn ? <MicOffIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
                  </PromptInputButton>
                )}

                {/* Mic blocked (denied / insecure context) — show a disabled icon with reason
                    instead of silently hiding voice so the user knows why it's unavailable. */}
                {showMic && !browserSupportsSpeechRecognition && voiceBlockedMessage && (
                  <PromptInputButton
                    type="button" size="sm" variant="ghost" disabled
                    title={voiceBlockedMessage}
                    aria-label={voiceBlockedMessage}
                    className="opacity-50 cursor-not-allowed text-muted-foreground"
                  >
                    <MicOffIcon className="h-4 w-4" />
                  </PromptInputButton>
                )}

                {showNewChat && (
                  <PromptInputButton
                    type="button" size="sm" variant="ghost"
                    className={`rounded-full cursor-pointer ${isMicrophoneOn ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100'}`}
                    onClick={onNewChat}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </PromptInputButton>
                )}

                {showLangSwitch && (
                  <LanguageSelector
                    currentLang={selectedLang}
                    onChange={onLanguageChange}
                    languages={availableLanguages}
                  />
                )}
              </PromptInputTools>
            </PromptInputToolbar>
          </div>

          <PromptInputSubmit
            size="icon"
            disabled={(!text.trim() && !isMicrophoneOn) || loading || text.length >= 2000}
            status={status}
            className="h-12 w-12 shrink-0 rounded-full m-1 shadow-lg hover:scale-105 transition-all"
            style={{ backgroundColor: accentColor, color: '#ffffff' }}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </PromptInputSubmit>
        </div>
      </PromptInput>
    </div>
  );
}