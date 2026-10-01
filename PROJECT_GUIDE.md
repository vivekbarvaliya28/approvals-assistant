# Project Guide: Approvals Assistant

This guide explains the whole project in simple words. It is for freshers and new developers. Read it from top to bottom once, and you will know what the project does, how it works, and where everything lives.

---

## 1. What is this project?

A web page that shows a list of **approvals** (files waiting for someone to review). On the page there is a small **AI assistant** window in the lower-right corner. The assistant helps the person who reviews the files (the "operator").

**Why did we build it?** It is a take-home assignment for a Fullstack + AI job. The goal is to show that we can build a full feature (screen → server → AI → tests) and use AI wisely.

### The 4 approvals (our sample data)

| Item | Type | Submitted by |
| --- | --- | --- |
| Site Patrol Onboarding & Checklists | Folder | Sam HelpAdmin |
| Level 2 Drone Patrol Video Demo | Video | Alex HelpAdmin |
| Safety Equipment & Sensor Specs | PDF | Sam HelpAdmin |
| 360° Spatial Zone Layout & Camera Map | Image | Elena HelpAdmin |

All four are "Pending Review" from Sep 18. They live in `src/data/approvals.json`.

---

## 2. The five actions

| Button | What it does | Uses AI? |
| --- | --- | --- |
| **Present me Summary** | Shows the 4 items ranked from most to least urgent, with a reason for each | Yes |
| **Talk to me** | A free chat about the approvals. It remembers earlier messages. | Yes |
| **Help me** | Answers a question using a short policy document (`src/backend/policy.md`) | Yes (only for wording) |
| **Teach me** | A step-by-step guide for new operators. You can ask follow-up questions. | Yes |
| **Replay Greeting** | A fresh greeting that says how many items are pending | Yes |

---

## 3. Tools we use, and why

| Tool | What it is | Why we use it |
| --- | --- | --- |
| **Next.js 14** | React framework | Gives us the page and the API in one project |
| **TypeScript (strict)** | JavaScript with types | Catches mistakes early. We do not use `any`. |
| **Tailwind CSS** | Styling with small classes | Fast, consistent design |
| **Zustand** | A small state store | Keeps all the widget's data in one place, so we do not pass props down many levels |
| **Zod** | A tool to check data | Makes sure requests and AI answers have the right shape |
| **OpenAI SDK** | Library to call the AI | Works with OpenAI and with providers that work the same way. **We currently use Groq** (`gpt-oss-120b`) because it is free. The code defaults to GPT-4o. |
| **Jest + Supertest** | Test tools | Unit test and route test |
| **Vitest + Testing Library** | Test tools | Component test (the screen) |

---

## 4. The folder map

```
src/
├── app/
│   ├── layout.tsx, page.tsx        The main page
│   └── api/ai/                     5 API routes: summary, chat, help, teach, greeting
├── components/
│   ├── ApprovalsWorkspace.tsx      The page with the search box and table
│   ├── ApprovalsAssistant.tsx      The floating assistant window
│   └── assistant/                  Small parts of the window:
│       ├── AssistantHeader.tsx       dark top bar (title, expand, close)
│       ├── GreetingBar.tsx           greeting text + "Replay Greeting" link
│       ├── ActionBar.tsx             the 4 action cards
│       ├── ResponsePane.tsx          shows answers, loading and errors
│       ├── PromptInput.tsx           the text box and Send button
│       └── ApprovalList.tsx          the approvals table
├── store/assistantStore.ts         Zustand store: all the widget's state and actions
├── lib/                            Code shared by the browser and the server
│   ├── schemas.ts                  ALL Zod rules in one file
│   ├── approvals.ts                Reads the JSON data
│   ├── sse.ts                      Encode/decode the live stream messages
│   └── client/streamAiAction.ts    Browser code that calls the API and reads the stream
├── backend/                        ALL server-only code lives here
│   ├── createAiRoute.ts            Builds each API route
│   ├── streamWithFallback.ts       Calls the AI with a time limit and backup
│   ├── summaryOutput.ts            Checks the summary JSON
│   ├── fallbacks.ts                All the backup answers
│   ├── deps.ts                     Gathers what handlers need
│   ├── handlers/                   One handler per action
│   ├── prompts/                    The instructions we give the AI (one file per action)
│   ├── llm/                        The AI connection (types.ts, openai.ts)
│   ├── policy.ts, policy.md        Splits the policy and finds matching sections
│   ├── env.ts                      Reads settings from .env.local
│   └── rateLimit.ts, session.ts    Limit requests per visitor
├── data/                           approvals.json
└── tests/                          unit / integration / components
```

---

## 5. How one request flows (big picture)

```
 You click a button
        │
        ▼
 Zustand store (assistantStore.ts)
        │  sends a request to the API
        ▼
 API route (app/api/ai/...)  ──►  createAiRoute
        │   1. rate limit check
        │   2. check the input with Zod
        ▼
 Handler (backend/handlers/...)
        │   builds the prompt (backend/prompts/...)
        ▼
 streamWithFallback
        │   calls the AI with an 8 second limit
        │   AI ok?  ──► send the words one by one
        │   AI failed or slow? ──► send the backup answer
        ▼
 Stream of small messages (SSE) back to the browser
        │
        ▼
 Store updates ──► ResponsePane shows the text
```

### Example: you click "Present me Summary"

1. `ActionBar` calls `selectMode("summary")` in the store.
2. The store sends a request to `/api/ai/summary`. It includes the browser's language (like `hi-IN`).
3. `createAiRoute` checks the rate limit and the input.
4. `summaryHandler` builds the prompt from the 4 pending approvals.
5. `streamWithFallback` calls the AI in JSON mode with an 8 second limit.
6. As the AI writes, the `overview` sentence is streamed word by word.
7. When the AI finishes, `parseSummary` checks the JSON: right shape, every approval exactly once.
8. If it is valid, the server sends a `result` message. If not, it sends the backup summary.
9. The store saves it, and `ResponsePane` shows the overview and the ranked cards.

### The messages the server sends (SSE)

SSE means "Server-Sent Events": the server sends many small messages over one open connection.

| Message | Meaning |
| --- | --- |
| `token` | A few more words of the answer |
| `result` | The checked summary (only for Summary) |
| `fallback` | The backup answer. It replaces any text shown so far. |
| `done` | The answer is finished |
| `error` | Something went wrong |

---

## 6. What each action does inside

| Action | Server steps |
| --- | --- |
| **Summary** | Prompt with the 4 items → AI returns JSON → server checks it → cards |
| **Chat** | Prompt with the 4 items + last 10 messages → AI reply |
| **Help** | Find matching policy sections by keywords → if none, say "not covered" and **skip the AI** → else AI answers only from those sections |
| **Teach** | No history: AI writes a 5–7 step guide. With history: AI answers the follow-up. |
| **Greeting** | Prompt with the pending count and time of day → AI writes one or two sentences (high creativity so it changes each time) |

### How "Help me" finds answers (simple RAG)

RAG means "look up facts first, then let the AI answer using them."

1. `policy.ts` splits `policy.md` into sections (one per `##` heading).
2. It removes common words and scores each section by matching words. A match in the heading counts double.
3. The best 3 sections go into the prompt with the question.
4. The AI must answer only from those sections.

---

## 7. What if the AI fails? (Fallback)

We never show a raw error for an AI failure. `streamWithFallback` does this:

1. Start a timer: **8 seconds**.
2. If the AI fails quickly, before sending anything, **retry once**.
3. If it times out, fails again, has no API key, or returns bad JSON, send a **backup answer**.
4. The response is still status 200, so the screen never freezes.

| Action | Backup answer |
| --- | --- |
| Summary | A list ranked by a simple rule (safety items first) |
| Chat | A message plus the list of pending items |
| Help | The matching policy sections as they are |
| Teach | A fixed step-by-step guide |
| Greeting | "Good morning! 4 approvals are waiting for your review." |

The screen shows a small notice: "The AI was unavailable, so this is a simplified answer."

**Try it:** remove `OPENAI_API_KEY` from `.env.local`. The app still works.

---

## 8. Safety and quality rules

- **API key** stays on the server (`.env.local`). The browser never sees it.
- **Zod checks everything**: requests, AI output, and the messages in the browser.
- **The summary is JSON**, not free text. We check it before showing it.
- **Rate limit**: 20 requests per minute per route, per visitor. A visitor is tracked with an anonymous cookie (`ai_session`). No cookie → counted by IP address.
- **Prompts** are in `src/backend/prompts/` and have version numbers (like `summary@2.1.0`). Never write prompts inside route code.
- **No database.** Data is in JSON and markdown files.
- **No `any` types.** ESLint stops them.

---

## 9. The tests (exactly 3 files)

| File | Tool | What it checks |
| --- | --- | --- |
| `tests/unit/summaryHandler.test.ts` | Jest | Uses a fake AI. Checks the streamed overview, the checked result, the language, and that a wrong AI answer becomes the backup |
| `tests/integration/summary.route.test.ts` | Jest + Supertest | Calls the real route over HTTP. Success path, and a stuck AI that times out and still returns 200 |
| `tests/components/ApprovalsAssistant.test.tsx` | Vitest | The chat window: loading, words appearing one by one, an error with Retry, and the backup notice |

Tests never call the real AI.

---

## 10. How to run it

```bash
npm install
cp .env.example .env.local     # add your OPENAI_API_KEY
npm run dev                    # http://localhost:3000
```

Other commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

### Settings in `.env.local`

| Name | Meaning | Default |
| --- | --- | --- |
| `OPENAI_API_KEY` | Your AI key | none (app uses backups) |
| `OPENAI_MODEL` | Which model | `gpt-4o` |
| `OPENAI_BASE_URL` | Use another provider like Groq | none |
| `LLM_TIMEOUT_MS` | AI time limit | 8000 |
| `RATE_LIMIT_MAX_REQUESTS` | Requests per window | 20 |
| `RATE_LIMIT_WINDOW_MS` | Window length | 60000 |

---

## 11. Where the AI is needed, and where it is not

- **Needed:** ranking by urgency with reasons, open chat, wording policy answers, Teach follow-ups.
- **Not needed:** listing items, counting pending items, finding policy sections. Plain code does these better, faster and free.

Rule we follow: if simple code can answer reliably, do not call the AI.

---

## 12. Words you may see

| Word | Simple meaning |
| --- | --- |
| **LLM** | The AI language model (like GPT-4o) |
| **Prompt** | The instructions we send to the AI |
| **Token** | A small piece of text the AI produces |
| **Streaming** | Showing the answer piece by piece as it arrives |
| **Fallback** | The backup answer when the AI fails |
| **Zod** | A library that checks data has the right shape |
| **State / store** | The data the screen remembers |
| **Route handler** | A function that answers an API request |
| **Rate limit** | A cap on how often someone can call the API |
| **Mock / fake** | A pretend version used in tests |

---

## 13. Known limits (be honest about them)

- The assignment names Claude or GPT-4o. Both need a paid key, which we did not have, so all live testing used **Groq** (`gpt-oss-120b`, free). GPT-4o is the default in code but was never tried with a real key. Claude needs a new client (not written yet). See "Which AI model we use, and why" in `README.md`.
- The rate limiter lives in one server's memory. It is not shared across servers.
- The backup texts and the other four actions are English only. Only the summary follows the browser language.
- The git history is not strictly test-first.
