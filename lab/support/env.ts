import 'dotenv/config';

export interface LabEnvironment {
  readonly localBaseUrl: string;
  readonly localModel: string;
  readonly thinkModel: string;
  readonly embedModel: string;
  readonly cloudBaseUrl: string;
  readonly cloudModel: string;
  readonly apiKey?: string | undefined;
  readonly logDir: string;
}

function readEnv(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    name
  ];
}

export function getLabEnv(): LabEnvironment {
  const localModel = readEnv('OLLAMA_LOCAL_MODEL') ?? 'qwen2.5:0.5b';
  return {
    localBaseUrl: readEnv('OLLAMA_LOCAL_BASE_URL') ?? 'http://localhost:11434',
    localModel,
    thinkModel: readEnv('OLLAMA_THINK_MODEL') ?? 'deepseek-r1:1.5b',
    embedModel: readEnv('OLLAMA_EMBED_MODEL') ?? 'nomic-embed-text:latest',
    cloudBaseUrl: readEnv('OLLAMA_CLOUD_BASE_URL') ?? 'https://ollama.com',
    cloudModel: readEnv('OLLAMA_CLOUD_MODEL') ?? 'qwen2.5:0.5b',
    apiKey: readEnv('OLLAMA_API_KEY') || undefined,
    logDir: readEnv('LAB_LOG_DIR') ?? 'logs',
  };
}
