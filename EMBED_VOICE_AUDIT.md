# Embed + Voice Deep-Dive Audit & Fix Checklist

> Goal: Embed script jo external websites pe lagta hai — uski **config, CSS, styling, icons, auto-open
> aur voice (greeting + voice command/mic)** sab sahi se kaam kare. Niche har issue ek **checkpoint**
> hai with: severity, root cause, fix, aur status.

**Date:** 2026-06-27
**Scope reviewed:**
- `public/embed.js` (real multi-mode loader — 1354 lines)
- `src/app/api/embed/route.ts` (OLD duplicate loader)
- `src/app/embed/widget/[chatbotId]/page.tsx` + `src/components/features/chatbot-widget.tsx` (iframe app)
- `src/hooks/useSpeechToText.ts` (voice command / mic)
- `src/app/api/chatbots/[id]/route.ts` (public config API)
- `src/app/(user)/chatbots/[id]/integrations/page.tsx` (snippet generator)
- `next.config.ts` (headers / Permissions-Policy), `.env` / `.env.production`

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` needs YOUR verification (env/device)

---

## 🔴 CRITICAL

### CP-1 — Do alag embed scripts (conflict / confusion)
- **Severity:** Critical (footgun)
- **Finding:** Do loaders exist:
  1. `public/embed.js` — naya, sahi, multi-mode, DB se config fetch karta hai, voice + sab modes. **Yahi
     integrations page deta hai.**
  2. `src/app/api/embed/route.ts` — purana duplicate `/api/embed` pe serve hota hai: hardcoded
     `process.env.NEXT_PUBLIC_APP_URL` (server pe undefined hua to `undefined/embed/widget/...`), hamesha
     emoji `💬` button, **DB config fetch hi nahi karta**, koi voice/teaser/sticky/drawer/inline mode nahi.
- **Impact:** Agar koi purana snippet `/api/embed` use karta hai to **koi bhi dashboard config apply nahi
  hogi** (yehi "config wahan nahi hota" ka ek bada karan ho sakta hai). Codebase me sirf
  `CHATBOT_MANAGEMENT.md` me referenced hai, kahin actively nahi — yani dead but dangerous.
- **Fix:** `/api/embed/route.ts` delete karo; `CHATBOT_MANAGEMENT.md` se reference hatao. Sirf `/embed.js`
  canonical rahe.
- **Status:** `[x]` DONE — `/api/embed` ab `/embed.js` pe 308-redirect; docs updated.

### CP-2 — `NEXT_PUBLIC_APP_URL` build-time mismatch (sabse bada "config nahi aata" suspect)
- **Severity:** Critical
- **Finding:** `.env` → `http://localhost:3000`, `.env.production` → `https://chatbots.prabisha.com`.
  `NEXT_PUBLIC_*` Next.js me **build time pe inline** hota hai. Integrations snippet ka `baseUrl` aur iframe
  ka `src` isi var se banta hai. Agar production build galat env (`.env`/`NODE_ENV != production`) se bana,
  to har external site pe snippet `http://localhost:3000/embed.js` aur `baseUrl: 'http://localhost:3000'`
  point karega → script load hi nahi hoga, config fetch fail, iframe blank.
- **Impact:** Pure embed ka silent failure on live sites.
- **Fix / verify:** Production deploy `NODE_ENV=production` ke saath `.env.production` se build kare. Build ke
  baad ek deployed `embed.js`/snippet me URL check karo ki `chatbots.prabisha.com` hai, `localhost` nahi.
  Extra safety: integrations fallback already `'https://chatbots.prabisha.com'` hai — wahi default rakho.
- **Status:** `[!]` (aapko deploy env confirm karna hoga)

### CP-3 — Voice greeting auto-open pe bolta hi nahi (autoplay gesture block)
- **Severity:** Critical (voice feature)
- **Finding:** `popup_onload` auto-open `speakGreeting()` ko **bina user gesture** ke call karta hai.
  Chrome/Safari `speechSynthesis.speak()` ko first user interaction tak block karte hain. Isliye auto-open
  pe greeting silent rehta hai; sirf jab user khud button click kare tab bolta hai.
- **Fix:** First user interaction (pointerdown/keydown/touchstart) pe `speechSynthesis` ko "prime" karo aur
  pending greeting ko us gesture pe ya resume pe bolwao. embed.js + widget fallback dono me.
- **Status:** `[x]` DONE — `armVoiceGreeting()` first-gesture fallback added in embed.js.

### CP-4 — Voice command / mic cross-origin iframe me fail + silent failure
- **Severity:** Critical (voice feature)
- **Finding (do hisse):**
  - **(a) Silent failure:** `useSpeechToText` me `getUserMedia` reject hone par sirf
    `setIsMicrophoneAvailable(false)` + `return` — user ko koi feedback nahi. `policyBlocked`/`policyMessage`
    state **declare to hai par kahin set nahi hota** (hamesha false) → blocked-message UI dead hai. Mic
    button bas chup-chaap gayab/no-op ho jata hai. (yehi "permission issue, kuch hota hi nahi".)
  - **(b) Cross-origin limitation:** Widget ek **cross-origin iframe** me chalta hai. Chrome ka
    `webkitSpeechRecognition` cross-origin iframes me aksar `not-allowed`/`service-not-allowed` deta hai
    chahe `allow="microphone"` ho. Insecure (HTTP) parent pe `navigator.mediaDevices` undefined → mic dead.
- **Fix (a):** Hook me `getUserMedia` aur `recognition.onerror` ke errors ko `policyBlocked`+`policyMessage`
  me map karo (denied / insecure-context / not-allowed). Widget me ek chhota inline hint dikhao silent-hide
  ke bajaye.
- **Fix (b):** HTTPS enforce (parent site HTTPS hona chahiye); insecure-context detect karke clear message.
  Long-term option: recognition parent (embed.js) me chalakar transcript postMessage se iframe me bhejna,
  ya server-side STT. (Decision needed — niche CP-12.)
- **Status:** `[x]` (a) DONE — hook ab denied/insecure/not-allowed errors surface karta hai · `[!]` (b) architecture decision pending.

---

## 🟠 HIGH

### CP-5 — Mic blocked hone par koi user message nahi
- **Severity:** High (UX)
- **Finding:** `micAllowed` false hote hi mic button render hi nahi hota (`showMic &&
  browserSupportsSpeechRecognition` jisme `browserSupportsSpeechRecognition` actually `micAllowed` pass hota
  hai). User ko pata hi nahi chalta voice kyun nahi.
- **Fix:** Jab `policyBlocked`/insecure/denied ho to mic ke jagah disabled icon + tooltip/hint "Mic blocked —
  allow microphone / site HTTPS chahiye".
- **Status:** `[x]` DONE — blocked hone par disabled mic + reason tooltip dikhta hai.

### CP-6 — Parent permission probe galat origin
- **Severity:** Medium-High
- **Finding:** embed.js `createIframe` me `navigator.permissions.query({name:'microphone'})` **parent site ke
  origin** ka state padhta hai aur `parent_permission` me bhejta hai. Iframe alag origin ka hai — parent ne
  apne liye deny kiya ho to widget ka mic galat tareeke se disable ho sakta hai.
- **Fix:** `parent_permission=denied` ko hard-block ki jagah soft-hint banao; ya sirf `prompt`/`granted` ko
  positive signal maano, `denied` pe block mat karo (iframe khud prompt kar sakta hai).
- **Status:** `[x]` DONE — parent-origin `denied` ab hard-block nahi; user try kar sakta hai, asli error surface hota hai.

### CP-7 — Auto-open ("chat khud khul jata hai") — DB `popup_onload` driven
- **Severity:** High (reported behaviour)
- **Finding:** Generated snippet me `autoOpen` nahi hota → embed.js `config.autoOpen = th.popup_onload ??
  db.popup_onload ?? false`. Yani auto-open **poori tarah dashboard ke `popup_onload` toggle** pe hai. Agar
  woh DB me `true` hai to har site pe khulega, chahe aap na chahein. Snippet se override karne ka saaf
  raasta nahi (sirf `data-auto-open="false"` raw-script path pe).
- **Fix:** (1) Verify karo theme me `popup_onload` ki actual value. (2) Agar nahi chahiye to dashboard
  (Theme) me off karo. (3) Code side: rebuild + non-rebuild dono auto-open branches double-fire na karein —
  ek `_autoOpened` guard add karo.
- **Status:** `[~]` PARTIAL — double-fire guard add (CP-8); `popup_onload` ki actual DB value aapko Theme me verify/off karni hai.

### CP-8 — Auto-open double-fire risk (rebuild + post-patch dono)
- **Severity:** Medium
- **Finding:** init() me agar DB embedMode default se alag hua to **rebuild branch** auto-open schedule karta
  hai (L421-426) aur `return`. Non-rebuild path alag se L550 pe schedule karta hai. Build functions
  (`buildFloating` etc.) bhi L780 pe schedule karte hain agar `config.autoOpen` true ho. Multiple timers se
  flicker/double-open ho sakta hai.
- **Fix:** Single `openOnce()` guard (`config._autoOpened`).
- **Status:** `[x]` DONE — single `autoOpenOnce()` guard saare paths pe.

---

## 🟡 MEDIUM / POLISH

### CP-9 — `closeBtn` sirf desktop build-time pe banta hai
- **Finding:** `buildFloating` me `if (window.innerWidth > 768) buildCloseBtn()`. Tablet/resize edge cases
  me close button missing. Minor.
- **Status:** `[ ]`

### CP-10 — Teaser "stale defaults" me bada inline block duplicate
- **Finding:** init() ke andar teaser ko dobara banane ka ~40 line block `buildTeaserBubble` ki copy hai —
  maintainability risk (do jagah change karni padti hai).
- **Fix:** Ek `renderTeaser()` helper bana ke dono jagah use karo.
- **Status:** `[ ]`

### CP-11 — `allow` attribute me unnecessary `camera`
- **Finding:** embed.js iframe `allow='microphone *; camera *; speaker-selection *'`. App camera use nahi
  karta. `microphone *` valid hai; `camera` hatana surface kam karega.
- **Fix:** `allow='microphone *; autoplay; speaker-selection *'` (autoplay TTS ke liye useful).
- **Status:** `[x]` DONE — `allow='microphone *; autoplay *; speaker-selection *'`.

### CP-12 — (Decision) Voice command architecture
- **Finding:** `webkitSpeechRecognition` cross-origin iframe me unreliable hai. Do raaste:
  - **A:** Jaisa hai rakho + clear messaging (CP-4a/CP-5). Sasta, partial.
  - **B:** Recognition embed.js (parent) me chalao, transcript postMessage se iframe ko do. Reliable, par
    embed.js + widget dono me kaam.
- **Decision needed from you:** A ya B?
- **Status:** `[!]`

### CP-13 — Docs cleanup
- **Finding:** `CHATBOT_MANAGEMENT.md` still lists `/api/embed`. `AUDIT_FIXES.md` purana hai.
- **Fix:** Update after CP-1.
- **Status:** `[x]` DONE — CHATBOT_MANAGEMENT.md updated.

---

## Verified OK (koi action nahi)
- ✅ **CORS:** `/api/chatbots/[id]` `Access-Control-Allow-Origin: *` + `no-cache` deta hai → cross-origin
  config fetch sahi.
- ✅ **Iframe embedding:** koi `X-Frame-Options`/`frame-ancestors` block nahi → external sites embed kar
  sakte hain.
- ✅ **Permissions-Policy:** `next.config.ts` widget doc pe `microphone=*` set karta hai.
- ✅ **embedMode propagation:** init() `th.embedMode || config.embedMode` — DB mode snippet se jeet jata hai,
  to dashboard me mode change wahan reflect hota hai (rebuild path). Snippet me baked hone ke bawajood theek.
- ✅ **Icon/colors/text patch:** API load ke baad button/teaser/sticky/drawer sab patch hote hain.

---

---

## 🟣 GENERAL / NON-VOICE BUGS (round 2 — full widget + hooks review)

### CP-14 — Real-time streaming OFF (replies ek saath aate hain, slow lagta hai)
- **Severity:** High (UX / "feels broken")
- **Finding:** `useChatbot` me `mode` default `'standard'` hai aur `setMode` **kabhi call nahi hota**
  (poore codebase me). Isliye `/api/chat/stream` (token-by-token streaming) **kabhi use nahi hota** — hamesha
  `/api/chat` (standard) chalta hai jo poora jawab ek saath laata hai, phir artificially 500ms baad dikhata
  hai. Typewriter/streaming effect poori tarah dead hai.
- **Fix (decision):** Agar streaming chahiye to default `'streaming'` karo (ya jab user message bheje tab
  `setMode('streaming')`). Yeh server load/cost change karta hai — isliye **aapki confirmation chahiye**.
- **Status:** `[x]` DONE — default `'streaming'` kar diya; ab replies live type hote hain. Redundant
  streaming loader bhi hata diya (inline placeholder + streaming text hi indicator hain).

### CP-15 — Inline component definitions → remount churn + state loss (perf)
- **Severity:** High (perf / subtle bugs)
- **Finding:** `ChatMessages` ke andar `MessageBubble`, `ChatbotAvatar`, `LoadingDots`, `LeadCard`
  **render ke andar define** hain (nested function components). Har render pe inki identity badalti hai →
  React inhe **remount** karta hai. Effects: (1) `MessageBubble` ka local `copied` state reset, (2) har
  message bubble har render pe DOM se hatt ke dobara banta hai → flicker/jank, especially streaming ke
  dauraan, (3) Image dobara load. Yeh classic React anti-pattern hai.
- **Fix:** In components ko `ChatMessages` ke bahar hoist karo aur props se data pass karo. Mechanical par
  thoda bada refactor (production file 2000 lines) — isliye separate, careful change.
- **Status:** `[x]` DONE — `ChatbotAvatar`, `MessageBubble`, `LoadingDots`, `LeadCard` ko module-scope pe
  hoist karke props se wire kiya. Ab remount churn / flicker / lost-state nahi. Typecheck clean.

### CP-16 — `fetchChatbotData` absolute URL (localhost env break)
- **Severity:** Medium
- **Finding:** Widget ke andar `${NEXT_PUBLIC_APP_URL || ''}/api/chatbots/...` use hota tha — agar build
  galat env (localhost) se bana to refetch toot jata. Widget hamesha same-origin hai.
- **Fix:** Relative URL `/api/chatbots/${id}` kar diya.
- **Status:** `[x]` DONE.

### CP-17 — `initialChatbotData.suggestions` string parse nahi hoti
- **Severity:** Medium
- **Finding:** Init path string suggestions ko `.map()` karta tha (string pe map → galat), fetch path JSON
  parse karta hai. Inconsistent → kabhi quick-suggestions gayab.
- **Fix:** Init path me bhi array/JSON-string dono handle.
- **Status:** `[x]` DONE.

### CP-18 — TTS "speaking" state (jaancha — actual bug nahi)
- **Severity:** N/A
- **Finding:** Lagta tha `activeSpeakingId` stuck rehta hai, par button ka icon `activeSpeakingId === id &&
  isPlaying` se derive hota hai — `isPlaying` false hote hi apne aap reset ho jata hai. Koi real bug nahi.
- **Status:** `~~[x]~~` N/A — koi change nahi (effect add kiya tha to wo hata diya, lint-clean).

### CP-19 — `markdownToHtml`: koi bhi stray HTML tag poora markdown disable kar deta hai
- **Severity:** Low
- **Finding:** `if (/<[a-z][\s\S]*>/i.test(text)) return DOMPurify.sanitize(text)` — agar reply me ek bhi
  `<...>` aaya (e.g. `use <div>`), to bold/list/heading markdown render nahi hota, raw treat hota hai.
- **Fix (optional):** Sirf known-safe HTML detect karo, ya markdown + sanitize dono chalao. Low priority.
- **Status:** `[ ]` (optional)

### CP-20 — postMessage `'*'` target + listener origin check nahi
- **Severity:** Low (security hardening)
- **Finding:** Widget `window.parent.postMessage(..., '*')` bhejta hai aur incoming `message` listener origin
  verify nahi karta. Functional theek, par koi bhi frame `theme-update` inject kar sakta hai.
- **Fix (optional):** Known parent origin set karo / incoming origin allowlist.
- **Status:** `[ ]` (optional hardening)

---

## Fix order (execution plan)
1. CP-1 — `/api/embed` delete + docs (safe, removes confusion)
2. CP-4a + CP-5 + CP-6 — `useSpeechToText` error surfacing + widget mic hint (core voice permission fix)
3. CP-3 — voice greeting gesture priming (embed.js + widget)
4. CP-8 + CP-7 — auto-open single-guard
5. CP-11 — `allow` cleanup
6. CP-10 / CP-9 — polish
7. CP-2 / CP-12 — aapse confirm (env build + voice architecture)
