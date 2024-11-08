export interface OllamaConfig {
  model: string;
  baseUrl: string;
  path: string;
  system: string;
}

export interface OllamaResponseCommon {
  done: boolean;
  model: string;
  response: string;
  created_at: string;
}

export interface OllamaResponsePartial extends OllamaResponseCommon {
  done: false;
}

export interface OllamaResponseEnd extends OllamaResponseCommon {
  done: true;
  context: number[];
  total_duration: number;
  load_duration: number;
  prompt_eval_count: number;
  eval_count: number;
  eval_duration: number;
}

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

export type OllamaResponse = OllamaResponsePartial | OllamaResponseEnd;

export const isEndResponse = (d: OllamaResponse): d is OllamaResponseEnd =>
  d.done;

export type Conversation = (prompt: string) => AsyncGenerator<OllamaResponse>;

const getResponse = (d?: Uint8Array) => {
  if (!d) return;
  try {
    return JSON.parse(new TextDecoder().decode(d)) as OllamaResponse;
  } catch {
    return;
  }
};

export const initOllamaChat = (config: OllamaConfig) => {
  const { baseUrl, model, path, system } = config;
  let context: number[] = [];
  let running = false;

  return async function* (prompt: string) {
    if (running) return;

    running = true;
    const res = await fetch(baseUrl + path, {
      method: "POST",
      body: JSON.stringify({
        model,
        prompt,
        context,
        options: { temperature: 0.1 },
        system,
      }),
    });

    const reader = res.body?.getReader();
    if (!reader) return;

    while (running) {
      const { value } = await reader.read();
      const response = getResponse(value);
      if (response) {
        if (isEndResponse(response)) {
          context = response.context;
        }
        yield response;
      } else {
        running = false;
        return;
      }
    }
  };
};

export const listModels = async (baseUrl: string): Promise<OllamaModel[]> => {
  try {
    const res = await fetch(baseUrl + "/api/tags");
    const json = await res.json();
    return json.models || [];
  } catch (e) {
    console.error("[lisModels]", e);
    return [];
  }
};

export const initConversations = async (
  config: Omit<OllamaConfig, "model">,
) => {
  const models = await listModels(config.baseUrl);
  if (!models.length) {
    throw "No models found";
  }

  const conversations = new Map<string, Conversation>();

  const start = (id: string, model?: string, system?: string) => {
    const _model_ = (models.find((d) => d.name === model) || models[0]).name;
    const _system_ = system || config.system;
    const _config_ = {
      ...config,
      model: _model_,
      system: _system_,
    };
    const conversation = initOllamaChat(_config_);
    conversations.set(id, conversation);
  };

  const get = (id: string) => conversations.get(id);

  const remove = (id: string) => {
    conversations.delete(id);
  };

  return {
    start,
    get,
    remove,
    models,
  };
};
