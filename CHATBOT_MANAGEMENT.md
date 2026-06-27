# Chatbot Management — Feature Overview

> **Stack:** Next.js · PostgreSQL (Prisma + pgvector) · NextAuth · Gemini API · Cloudinary · LangChain

---

## 1. Data Models

| Model | Purpose |
|---|---|
| `Chatbot` | Core entity: name, model, temperature, greeting, directive, icon, avatar, suggestions |
| `ChatbotForm` | Lead collection form configuration (1:1) |
| `ChatbotLogic` | Lead collection, link buttons, meeting scheduling, triggers (1:1) |
| `ChatbotTheme` | Widget and window appearance (1:1) |
| `KnowledgeBase` | Training data repositories (PRODUCT, PAGE, FAQ, DOC) |
| `Document` | Individual files within a knowledge base |
| `DocumentVector` | pgvector embeddings for semantic search |
| `QuestionCache` | Cached FAQ answers with hit counts |
| `Lead` | Captured lead data from forms |
| `Conversation` | User sessions with chatbots |
| `Message` | Individual messages in a conversation |
| `Connections` | Social platform integrations (Facebook, Instagram, LinkedIn) |
| `ConnectionConfiguration` | Auto-reply rules and scheduling |
| `WorkspaceInvitation` | Team member invitations |

---

## 2. Pages (UI)

### Chatbot List — `/chatbots`
- List all chatbots with search and filter
- Create new chatbot (dialog form)
- Delete chatbot (with confirmation)
- Duplicate chatbot
- Displays: name, conversation count, model, knowledge base count, last modified

### Instructions — `/chatbots/[id]/instructions`
- Set chatbot name, directive, and greeting messages
- Pre-built templates: e-commerce, healthcare, SaaS, real estate, education
- Multilingual greeting support (6+ languages)

### Knowledge — `/chatbots/[id]/knowledge`
- Create and delete knowledge bases
- Upload documents (PDF, text, tables)
- Scrape web pages for content
- Auto-update configuration
- Document management with metadata

### Logic — `/chatbots/[id]/logic`
- Lead collection configuration (timing, style, fields)
- Link / CTA button configuration
- Meeting scheduling (Calendly, Google Calendar, Outlook)
- Trigger management: keyword, end-of-conversation, message count, time delay
- Multilingual quick suggestions

### Theme — `/chatbots/[id]/theme`
- Widget: size, position, color, shape, border style
- Window: header colors, message colors, input styling
- Real-time live preview

### Models — `/chatbots/[id]/models`
- AI model picker: Gemini 2.5 Pro / Flash / Flash-Lite, Gemini 1.5
- Temperature slider (0–1)
- Max tokens adjustment
- Context window info display

### FAQs — `/chatbots/[id]/faqs`
- Create, edit, delete FAQs
- Rich text editor
- Question cache management
- View created timestamps

### Connections — `/chatbots/[id]/connections`
- Connect Facebook, Instagram, LinkedIn via OAuth
- Display connection status per platform
- Manage connected accounts

### Integrations — `/chatbots/[id]/integrations`
- Embed code for: Vanilla JS, React, Next.js, Vue, Angular, WordPress, Shopify
- HTML snippet generation
- Download integration files
- Copy-to-clipboard

### Other Management Pages
| Page | Purpose |
|---|---|
| `/conversations` | View all conversations with leads |
| `/leads` | Lead management — search, filter, export |
| `/dashboard` | Analytics overview |
| `/members` | Workspace member management |
| `/invites` | Manage team invitations |

---

## 3. API Endpoints

### Chatbot CRUD
| Method | Route | Action |
|---|---|---|
| POST | `/api/chatbots` | Create chatbot (with default form, logic, theme) |
| GET | `/api/chatbots` | List chatbots for workspace |
| GET | `/api/chatbots/[id]` | Get chatbot details |
| PUT | `/api/chatbots/[id]` | Update chatbot |
| DELETE | `/api/chatbots/[id]` | Delete chatbot and all related data |

### Configuration
| Method | Route | Action |
|---|---|---|
| GET/POST | `/api/chatbots/[id]/config` | Fetch/update chatbot configuration |
| GET/POST | `/api/chatbots/[id]/theme` | Widget and window theme |
| GET/POST | `/api/chatbots/[id]/logic` | Logic features |
| GET/DELETE | `/api/chatbots/[id]/logic/[logicId]` | Specific logic item |
| GET/POST | `/api/chatbots/[id]/faqs` | FAQ management |

### Knowledge Base
| Method | Route | Action |
|---|---|---|
| GET/POST | `/api/chatbots/[id]/knowledge` | Create/list knowledge bases |
| GET/DELETE | `/api/knowledge/[knowledgeId]` | Manage specific KB |
| GET/DELETE | `/api/knowledge/[knowledgeId]/document/[documentId]` | Document management |

### Chat & Conversations
| Method | Route | Action |
|---|---|---|
| POST | `/api/chat` | Create new conversation |
| GET/POST | `/api/chat/[id]` | Get/update conversation |
| POST | `/api/chat/stream` | Streaming chat responses |
| POST | `/api/chat/new` | Initiate new chat |
| POST | `/api/chat/demo` | Demo/test chat |
| POST | `/api/chatbots/[id]/chat` | Chat with specific chatbot |

### Leads
| Method | Route | Action |
|---|---|---|
| GET/POST | `/api/chatbots/[id]/lead` | Lead form submission |
| GET | `/api/chatbots/[id]/check-lead-requirements` | Validate lead form |
| GET/POST | `/api/leads` | List/manage all leads |

### Social Connections
| Method | Route | Action |
|---|---|---|
| GET/POST | `/api/connect` | List social connections |
| POST | `/api/connect/[platform]/auth` | OAuth authentication |
| POST | `/api/connect/[platform]/callback` | OAuth callback |

### Cron / Automation
| Method | Route | Action |
|---|---|---|
| POST | `/api/cron/auto-reply` | Auto-reply scheduling |
| POST | `/api/cron/update-knowledge` | Knowledge base auto-update |

### Other
| Method | Route | Action |
|---|---|---|
| GET | `/api/dashboard` | Analytics data |
| GET | `/api/embed` | **Deprecated** — 308-redirects to `/embed.js` (canonical loader) |
| GET | `/embed.js` | Canonical embed loader (multi-mode, fetches live DB config) |
| POST | `/api/ai/tts` | Text-to-speech synthesis |

---

## 4. Components

### Forms (`src/components/forms/`)
- `chatbot-form.tsx` — Basic chatbot creation
- `collect-leads-form.tsx` — Lead collection form builder
- `knowledge-form.tsx` — Knowledge base upload
- `lead-form.tsx` — Dynamic lead capture
- `link-button-form.tsx` — CTA button configuration
- `schedule-meeting-form.tsx` — Calendar integration
- `widget-form.tsx` — Widget appearance customizer
- `window-form.tsx` — Chat window theme customizer
- `workspace-form.tsx` — Workspace creation/update

### Features (`src/components/features/`)
- `chatbot-widget.tsx` — Embedded chatbot widget
- `chat-preview.tsx` — Live preview of chatbot
- `text-editor.tsx` — Rich text editor
- `theme-toggle.tsx` — Dark/light mode toggle
- `GoogleOneTap.tsx` — Google authentication

### Layout
- `app-sidebar.tsx` — Main navigation sidebar
- `nav-main.tsx` — Primary navigation
- `nav-projects.tsx` — Chatbot navigation
- `header.tsx` — Page header with chatbot context

---

## 5. Custom Hooks (`src/hooks/`)

| Hook | Purpose |
|---|---|
| `useChatbot.tsx` | Load and manage chatbot state |
| `useKnowledgeUpload.ts` | Handle knowledge base uploads |
| `useLeadGeneration.tsx` | Lead form logic |
| `useConversationalLead.ts` | Conversational lead collection |
| `useTextToSpeech.ts` | TTS functionality |
| `useSpeechToText.ts` | STT functionality |
| `useTypewriter.ts` | Text animation effect |
| `use-mobile.ts` | Mobile detection |

---

## 6. State Management

### `ChatbotProvider` (`src/providers/chatbot-provider.tsx`)
- Manages global chatbot configuration state
- Multilingual support: EN, AR, FR, ES, DE, PT, IT, NL, RU, ZH, JA, KO, HI
- Methods: `updateConfig`, `addSuggestion`, `removeSuggestion`, `updateGreetingField`
- Tracks active language selection

### `WorkspaceProvider`
- Manages workspace context and active workspace selection

---

## 7. Key Types & Enums (`src/types/chatbot-logic.ts`)

### Enums
| Enum | Values |
|---|---|
| `FieldType` | TEXT, EMAIL, PHONE, NUMBER, CURRENCY, DATE, LINK, SELECT, RADIO, CHECKBOX, TEXTAREA, MULTISELECT |
| `LeadTiming` | BEGINNING, MIDDLE, END |
| `LeadFormStyle` | EMBEDDED, MESSAGES |
| `TriggerType` | KEYWORD, ALWAYS, MANUAL, END_OF_CONVERSATION, MESSAGE_COUNT, TIME_DELAY |
| `KBType` | PRODUCT, PAGE, FAQ, DOC |
| `Cadence` | ALL_AT_ONCE, ONE_BY_ONE, GROUPED |
| `Platform` | INSTAGRAM, FACEBOOK, MESSENGER, LINKEDIN |

---

## 8. Services & Libraries

### Services (`src/services/`)
- `mailing.service.ts` — Email notifications
- `email-template.ts` — Email template generation
- `instagram.service.ts` — Instagram API integration
- `linkedin.service.ts` — LinkedIn API integration

### Libraries (`src/lib/`)
- `prisma.ts` — Database client
- `auth.ts` — NextAuth configuration
- `cloudinary.ts` — Media upload service
- `crypto.ts` — Encryption utilities
- `utils.ts` — Shared helper functions

### LangChain (`src/lib/langchain/`)
- Vector store for embeddings
- Web scraper for knowledge base URLs
- PDF / document processor
- Semantic search chains

---

## 9. Default Configuration

| Setting | Value |
|---|---|
| Default AI Model | Gemini 2.5 Flash |
| Max Tokens | 2048 |
| Temperature | 0.7 |
| Default Language | English |
| Database | PostgreSQL + pgvector |
| Auth | NextAuth (OAuth) |
| Media Storage | Cloudinary |

---

## 10. Special Features

1. **Multi-language Support** — Auto-translation of suggestions and greetings via Gemini
2. **Smart Lead Collection** — Configurable timing (beginning/middle/end), style (embedded/messages), cadence
3. **Social Media Auto-reply** — Automated replies to comments/DMs on Facebook, Instagram, LinkedIn
4. **Knowledge Base Training** — PDF, webpage scraping, FAQs, product docs with scheduled auto-update
5. **Vector Search** — pgvector-based semantic search across knowledge bases
6. **Full Theme Customization** — Widget and chat window appearance control
7. **Multi-framework Embed** — Vanilla JS, React, Next.js, Vue, Angular, WordPress, Shopify
8. **Conversation & Lead Tracking** — Associate leads with specific conversations
9. **FAQ Caching** — Quick responses for frequently asked questions with hit count tracking
10. **Workspace Collaboration** — Team member management with invitations and role-based access
