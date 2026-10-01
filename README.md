# Approvals Assistant

This project is a web page with an AI helper for approvals. It copies the OomniEye Approvals screen.

The page shows a table of 4 items waiting for review. A small assistant window floats in the lower-right corner. It has five actions, and each one uses a real AI call:

- **Present me Summary**: lists the pending items, most urgent first.
- **Talk to me**: a chat about the approvals.
- **Help me**: answers questions using a short policy document.
- **Teach me**: a step-by-step guide for new operators. You can ask follow-up questions.
- **Replay Greeting**: a fresh greeting that says how many items are pending.

**Tools used:** Next.js 14, TypeScript (strict), Tailwind CSS, Zustand, Zod, the OpenAI SDK, Jest + Supertest (unit and route tests), Vitest + Testing Library (component test).

## How to run it

You need Node.js 18.17 or newer. I built it on Node 24.

```bash
npm install
cp .env.example .env.local     # then add your OPENAI_API_KEY inside .env.local
npm run dev                    # open http://localhost:3000
```

The API key stays on the server. The browser never sees it.

| Command | What it does |
| --- | --- |
| `npm test` | Runs all 3 test files (Jest first, then Vitest) |
| `npm run typecheck` | Checks the TypeScript code |
| `npm run lint` | Checks the code style. Using `any` is an error. |
| `npm run build` | Builds the app for production |

**Which AI model?** See the next section. In short: the code defaults to GPT-4o, but all live testing so far used Groq.

**No API key?** The app still works. Every action shows a ready-made backup answer instead. To see this, remove the key, or set `LLM_TIMEOUT_MS=1` to make every AI call time out.

## Which AI model we use, and why

**The assignment says:** use the Claude API (Anthropic) **or** GPT-4o (OpenAI).

**What we use right now:** a model called `openai/gpt-oss-120b`, served by **Groq**. We call it through the OpenAI library (the `openai` npm package). Groq accepts the same kind of requests as OpenAI, so the library works with it. These are the settings in `.env.local`:

```
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_MODEL=openai/gpt-oss-120b
OPENAI_API_KEY=<a Groq key>
```

| | Claude (Anthropic) | GPT-4o (OpenAI) | What we use now (Groq) |
| --- | --- | --- | --- |
| Named in the assignment | Yes | Yes | No |
| Used in this project | No | Code is ready, never tried with a real key | Yes, all live tests |
| Needs a paid key | Yes | Yes | No, Groq has a free plan |

**Why we did not use the two named models:** both need a paid API key with credit added. I did not have one, so I could not run them. Groq lets me test the whole app end to end for free.

**What this means**

- The app is fully built and tested with Groq. The automated tests use a fake AI, so they do not depend on any real model.
- The AI answers may read a little differently from GPT-4o, because it is a different model.
- Groq's model "thinks" before it answers. That is why the greeting call has a larger token limit (400), so the thinking does not use up the whole answer.

**How to switch to GPT-4o** (no code change): in `.env.local`, use an OpenAI key, delete the `OPENAI_BASE_URL` line, and set `OPENAI_MODEL=gpt-4o`. Then restart `npm run dev`.

**How to switch to Claude:** this needs a small code change. Claude's API is different from OpenAI's, so we would add a Claude client next to the OpenAI one in `src/backend/llm/`. Nothing else in the app changes, because every AI call goes through one small interface (`LlmClient`).

## Assessment: AI-necessary vs. unnecessary, fallback, next steps

**AI-necessary:** ranking the queue by urgency with a reason for each item, open-ended chat, wording policy answers, and Teach-me follow-ups. These need judgement or language.

**AI-unnecessary:** listing the items, counting the pending ones, and finding the right policy sections (plain keyword matching). The greeting and the first Teach-me guide could be templates; the AI only adds variety, so they are the first things to cut if cost matters.

**Fallback:** every call has an 8s time limit and one retry, only for quick failures (never after a timeout). If the AI times out, errors, has no key or returns bad JSON, the server sends a ready-made backup answer instead: a ranked list, a template greeting, a fixed guide, policy excerpts, or the plain queue. The user always gets HTTP 200 and a usable answer, never a raw 500. Help me skips the AI when no policy section matches, so it cannot invent an answer.

**With more time:** I would add a promptfoo eval suite that runs in CI on every prompt change, so prompt edits are measured instead of judged by eye.

### Each action: AI or not, and its fallback

| Action | Needs the AI? | Non-AI fallback |
| --- | --- | --- |
| Present me Summary | Yes, ranking needs judgement | List ranked by a simple rule (safety items first), same JSON shape |
| Talk to me | Yes, open-ended questions | Message plus the plain list of pending items |
| Help me | Only for wording; finding the sections is keyword matching | The matching policy sections as they are, or a "not covered" message with no AI call |
| Teach me | Follow-ups yes; the first guide could be static | A fixed step-by-step guide |
| Replay Greeting | No, a template would do | "Good morning! 4 approvals are waiting for your review." |

## How the summary stays safe

We never trust the AI's raw text for the summary. Here is what happens:

1. The AI must answer in JSON: `{ overview, items: [{ id, priority, reason }] }`.
2. While the JSON arrives, only the `overview` sentence is shown, word by word.
3. When the AI finishes, the server checks the whole JSON with Zod. It also checks that every approval appears exactly once.
4. Only a valid result is sent to the browser. If it is invalid, the backup summary is used.
5. The browser checks every message again before showing it.

## How the code is organised

All the code is inside the `src/` folder.

```
src/
├── app/
│   ├── layout.tsx, page.tsx        The main page
│   └── api/ai/                     5 API routes (one per action)
├── components/
│   ├── ApprovalsWorkspace.tsx      The page with the search box and table
│   ├── ApprovalsAssistant.tsx      The floating assistant window
│   └── assistant/                  Small parts of the window
├── store/assistantStore.ts         Zustand store: all the widget's state
├── lib/                            Code shared by the browser and the server
│   ├── schemas.ts                  ALL Zod rules in one file
│   ├── approvals.ts                Reads the approvals data
│   ├── sse.ts                      Encode/decode the live stream messages
│   └── client/streamAiAction.ts    Browser code that reads the stream
├── backend/                        ALL server-only code lives here
│   ├── createAiRoute.ts            Builds each API route
│   ├── streamWithFallback.ts       Calls the AI with a time limit and backup
│   ├── summaryOutput.ts            Checks the summary JSON
│   ├── fallbacks.ts                All the backup answers
│   ├── deps.ts                     Wires up the AI client and policy for handlers
│   ├── handlers/                   One handler per action
│   ├── prompts/                    Instructions for the AI, one file per action
│   ├── llm/                        The AI connection (OpenAI client)
│   ├── policy.ts, policy.md        Search the policy document
│   ├── env.ts                      Reads settings from .env.local
│   └── rateLimit.ts, session.ts    Limit requests per visitor
├── data/                           approvals.json
└── tests/                          unit / integration / components (3 files)
```

### What happens on each request

1. **Route**: the request arrives at an API route.
2. **Rate limit**: the server checks that the visitor is not sending too many requests.
3. **Check input**: Zod checks that the request has the right shape.
4. **Handler**: builds the prompt for that action.
5. **AI call**: the AI is called with a time limit. If it fails, a backup answer is used.
6. **Stream back**: the answer is sent to the browser piece by piece.

The last message includes the prompt version, which helps when debugging.

Talk to me and Teach me remember the conversation in the store and send it with every message.

## Tests

There are exactly 3 test files. Run them with `npm test`.

- `tests/unit/summaryHandler.test.ts` (Jest): uses a fake AI. It checks the streamed overview, the checked and sorted result, that a Hindi browser makes the prompt ask for Hindi, and that a wrongly shaped AI answer becomes the backup summary.
- `tests/integration/summary.route.test.ts` (Jest + Supertest): calls the real summary route over HTTP. A good AI answer streams and ends with a valid result. A stuck AI hits the time limit and still returns status 200 with the backup answer.
- `tests/components/ApprovalsAssistant.test.tsx` (Vitest + Testing Library): tests the Talk to me chat. It checks the loading state, the words appearing one by one, and that the conversation stays afterwards. Then it checks an error with a Retry button, followed by a "backup answer" notice.

## Where I did things differently from the brief

- **Next.js routes instead of Express.** The API lives next to the page code.
- **Supertest needs a server.** Next routes are not an Express app, so the route test wraps the route in a tiny Node server that Supertest can call.
- **Rate limiting is per session.** The server gives each visitor an anonymous cookie called `ai_session` on their first AI request. The limit is 20 requests per minute per route. There is no login. A visitor without the cookie is counted by IP address, so deleting cookies does not reset the limit. The counters live in memory, so they are not shared between servers.
- **No Swagger file.** The Zod rules in `schemas.ts` act as the API contract.
- **Prompts are in `src/backend/prompts/`**, not in a folder at the project root.
- **Groq instead of GPT-4o or Claude** for live testing, because I had no paid key (see "Which AI model we use, and why").

## Assumptions I made

- All four items were submitted on the same day, so urgency is judged from the content, not the age.
- "In the operator's language" (for Present me Summary) means the browser's language. The browser sends it, and the prompt asks for the overview and reasons in that language. There is no language picker. The backup texts and the other four actions stay in English.
- The widget copies the reference screen: a dark header (logo, title, expand, close), a row with a Replay Greeting link, a 2×2 grid of action cards, a footer with the item count, and a round button that opens and closes the widget. I used simple emoji icons instead of their pictures, and I did not reuse the OomniEye name or logo.
- The widget is narrow, so choosing an action replaces the cards with that action's view. A back link returns to the cards.

## Where I used AI tools

I used Claude Code for the first setup, the streaming and fallback code, test drafts, code comments and README drafts. I read and ran everything before keeping it. I chose the fallbacks, the prompt rules and what not to send to the AI myself.

## Known limits

- The rate limiter and the policy cache live in one server's memory. They reset on restart and are not shared between servers.
- The overview streams word by word only if the AI writes `overview` first. The prompt asks for that. If the AI does not, the text simply appears when the result arrives.
- **Live testing used Groq, not GPT-4o or Claude.** The reason and the steps to switch are in "Which AI model we use, and why". The GPT-4o path has not been tried with a real key, and there is no Claude client yet.
- **The commit history is not strictly test-first.** I wrote the first version before its tests, so the history shows how the app grew but not red-green steps.
