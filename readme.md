# ollama ui

a simple user interface for [ollama](https://ollama.com/)

## usage

start the ollama server

```
ollama serve
```

start the ui server

```
deno run --allow-net --allow-read serve.ts
```

arguments:

* `baseUrl` where ollama is served (defaults to `http://localhost:11434`)
* `system` the system prompt (defaults to `Be concise, no more than 200 characters in each response. Do not moralize. Do not hallucinate.`)

example:

```
deno run --allow-net --allow-read serve.ts --system="Answer like a drunk cowboy" --baseUrl=https://my-server.com
```

## screenshots

![index-page]('./ollama-ui-index.png')

![chat-page]('./ollama-ui-chat.png')
