import { initConversations, OllamaConfig } from "./ollama.ts";

export const readArgs = () =>
  Deno.args
    .filter((d) => d.startsWith("--"))
    .reduce(
      (
        r: Record<string, string>,
        d: string,
      ): Record<string, string> => {
        const [arg, value] = d.split("=");
        return value === "" ? r : { ...r, [arg.substring(2)]: value };
      },
      {},
    );

const DEFAULT_CONFIG: Omit<OllamaConfig, "model"> = {
  baseUrl: "http://localhost:11434",
  path: "/api/generate",
  system:
    "Be concise, no more than 200 characters in each response. Do not moralize. Do not hallucinate.",
};

const getConfig = () => {
  const args = readArgs();
  const config = DEFAULT_CONFIG;
  if (args.baseUrl) config.baseUrl = args.baseUrl;
  if (args.path) config.path = args.path;
  if (args.system) config.system = args.system;
  return config;
};

const conversations = await initConversations(getConfig());

const onMessage = async (socket: WebSocket, event: MessageEvent) => {
  try {
    const { action, prompt, model, system, id } = JSON.parse(event.data);

    if (!action || !id) return;

    if (action === "start") {
      conversations.start(
        id,
        String(model),
        system ? String(system) : undefined,
      );
    }

    if (action === "question" && prompt) {
      const conversation = conversations.get(id);
      if (!conversation) {
        console.warn("[question]: unknown conversation " + id);
        return;
      }

      for await (const res of conversation(prompt)) {
        socket.send(
          JSON.stringify({
            action: "answer",
            response: res.response,
            done: res.done,
          }),
        );
      }
    }

    if (action === "end") {
      conversations.remove(id);
    }
  } catch (e) {
    console.warn("[websocket error]", e);
    return;
  }
};

const serveFile = async (fileName: string) => {
  try {
    const file = await Deno.open(`./public/${fileName}`, { read: true });
    return new Response(file.readable);
  } catch {
    return new Response("", { status: 404 });
  }
};

Deno.serve({
  port: 8000,
  handler: (request) => {
    if (request.headers.get("upgrade") === "websocket") {
      const { socket, response } = Deno.upgradeWebSocket(request);

      socket.onmessage = (event) => {
        onMessage(socket, event);
      };

      socket.onerror = (error) => {
        console.error("ERROR:", error);
      };

      return response;
    } else {
      const { pathname } = new URL(request.url);
      switch (pathname) {
        case "/":
          return serveFile("index.html");
        case "/models":
          return new Response(JSON.stringify(conversations.models));
        case "/chat":
          return serveFile("chat.html");
        case "/style.css":
          return serveFile("style.css");
        default:
          return new Response("", { status: 404 });
      }
    }
  },
});
