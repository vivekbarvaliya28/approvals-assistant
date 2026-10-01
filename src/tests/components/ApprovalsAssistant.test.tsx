// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovalsAssistant } from "@/components/ApprovalsAssistant";
import { createInitialState, useAssistantStore } from "@/store/assistantStore";

// Component test (Vitest + Testing Library): the chat panel with a fake server.
const encoder = new TextEncoder();
const frame = (event: object) => encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

/** A response whose SSE frames the test pushes by hand, to observe intermediate UI states. */
function controllableStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
  return {
    response: new Response(body, { headers: { "Content-Type": "text/event-stream" } }),
    push: (event: object) => controller.enqueue(frame(event)),
    close: () => controller.close(),
  };
}

// A quick greeting reply, since the widget asks for one when it opens.
const greetingResponse = () =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(frame({ type: "token", text: "Good morning! 4 approvals are waiting." }));
        c.enqueue(frame({ type: "done", fallback: false, promptVersion: "greeting@1.0.0" }));
        c.close();
      },
    }),
  );

// A stream that sends all its events at once, then ends.
function completeStream(...events: object[]) {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        events.forEach((event) => c.enqueue(frame(event)));
        c.close();
      },
    }),
  );
}

/** Greeting requests get a canned answer; everything else goes to the test's handler. */
function mockFetch(handler: (body: unknown) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    String(input).endsWith("/greeting") ? greetingResponse() : handler(JSON.parse(String(init?.body ?? "{}"))),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ApprovalsAssistant chat panel", () => {
  beforeEach(() => useAssistantStore.setState(createInitialState()));
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // Opens "Talk to me", types a message and clicks Send.
  async function openChatAndSend(text: string) {
    const user = userEvent.setup();
    render(<ApprovalsAssistant />);
    expect(await screen.findByText(/4 approvals are waiting/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Talk to me" }));
    await user.type(screen.getByLabelText("Message"), text);
    await user.click(screen.getByRole("button", { name: "Send" }));
    return user;
  }

  it("shows loading, streams the reply token by token, then keeps both turns in the conversation", async () => {
    const reply = controllableStream();
    const fetchMock = mockFetch(() => reply.response);

    await openChatAndSend("Which one first?");

    // Loading: the user's turn is shown immediately, the assistant has not answered yet.
    expect(screen.getByText("Which one first?")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Thinking…");

    // Streaming: text appears as tokens arrive, and the loading state is gone.
    await act(async () => reply.push({ type: "token", text: "Start with " }));
    expect(await screen.findByText("Start with")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await act(async () => reply.push({ type: "token", text: "the safety specs." }));
    expect(await screen.findByText("Start with the safety specs.")).toBeInTheDocument();

    await act(async () => {
      reply.push({ type: "done", fallback: false, promptVersion: "chat@1.1.0" });
      reply.close();
    });

    await waitFor(() => expect(useAssistantStore.getState().conversations.chat).toHaveLength(2));
    expect(screen.getByText("Which one first?")).toBeInTheDocument();
    expect(screen.getByText("Start with the safety specs.")).toBeInTheDocument();

    const chatCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/chat"));
    expect(JSON.parse(String(chatCall?.[1]?.body))).toEqual({
      messages: [{ role: "user", content: "Which one first?" }],
    });
  });

  it("shows an error with retry, then a fallback notice when the AI is unavailable", async () => {
    let attempts = 0;
    mockFetch(() => {
      attempts += 1;
      return attempts === 1
        ? Response.json({ error: "Too many requests. Try again in 5s." }, { status: 429 })
        : completeStream(
            { type: "fallback", text: "I can't reach the assistant right now.", reason: "timeout" },
            { type: "done", fallback: true, promptVersion: "chat@1.1.0" },
          );
    });

    const user = await openChatAndSend("Any news?");

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests. Try again in 5s.");
    expect(screen.getByText("Any news?")).toBeInTheDocument(); // the user's turn is not lost

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("I can't reach the assistant right now.")).toBeInTheDocument();
    expect(screen.getByText(/The AI was unavailable/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
