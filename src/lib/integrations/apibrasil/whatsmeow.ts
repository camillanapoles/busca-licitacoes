export type APIBrasilWhatsMeowTextRequest = {
  number: string;
  text: string;
  homolog?: boolean;
  time_typing?: number;
  options?: {
    createChat?: boolean;
    delay?: number;
    detectMentioned?: boolean;
    markIsRead?: boolean;
    waitForAck?: boolean;
  };
};

export type APIBrasilWhatsMeowTextResponse = Array<{
  mensagem?: string;
  retorno?: {
    code?: number;
    success?: boolean;
    data?: {
      Details?: string;
      Id?: string;
      Timestamp?: string;
    };
    error?: string;
    message?: string;
  };
}>;

export type APIBrasilWhatsMeowClientConfig = {
  bearerToken: string;
  deviceToken: string;
  baseUrl?: string;
  timeoutMs?: number;
  httpClient?: typeof fetch;
};

export type APIBrasilErrorDetails = {
  message: string;
  code?: string | number;
  payload?: unknown;
};

export class APIBrasilWhatsMeowError extends Error {
  readonly statusCode?: number;
  readonly code?: string | number;
  readonly payload?: unknown;
  readonly request?: {
    method: string;
    url: string;
    body: APIBrasilWhatsMeowTextRequest;
  };

  constructor(
    message: string,
    options: {
      statusCode?: number;
      code?: string | number;
      payload?: unknown;
      request?: {
        method: string;
        url: string;
        body: APIBrasilWhatsMeowTextRequest;
      };
    }
  ) {
    super(message);
    this.name = "APIBrasilWhatsMeowError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.payload = options.payload;
    this.request = options.request;
  }
}

export class APIBrasilWhatsMeowClient {
  private readonly bearerToken: string;
  private readonly deviceToken: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly httpClient: typeof fetch;

  constructor(config: APIBrasilWhatsMeowClientConfig) {
    this.bearerToken = config.bearerToken;
    this.deviceToken = config.deviceToken;
    this.baseUrl = config.baseUrl ?? "https://gateway.apibrasil.io";
    this.timeoutMs = config.timeoutMs ?? 15000;
    this.httpClient = config.httpClient ?? fetch;
  }

  async sendText(payload: APIBrasilWhatsMeowTextRequest): Promise<APIBrasilWhatsMeowTextResponse> {
    const response = await this.request("/api/v2/whatsmeow/send/text", payload);
    return response as APIBrasilWhatsMeowTextResponse;
  }

  private async request(path: string, payload: APIBrasilWhatsMeowTextRequest): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = new URL(path, this.baseUrl).toString();
    const requestDebug = {
      method: "POST",
      url,
      body: payload,
    };

    try {
      const response = await this.httpClient(url, {
        method: requestDebug.method,
        headers: {
          "Content-Type": "application/json",
          DeviceToken: this.deviceToken,
          Authorization: `Bearer ${this.bearerToken}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const body = await parseJsonResponse(response);

      if (!response.ok) {
        const details = extractErrorDetails(body);
        throw new APIBrasilWhatsMeowError(details.message, {
          statusCode: response.status,
          code: details.code,
          payload: details.payload,
          request: requestDebug,
        });
      }

      assertSuccessfulWhatsMeowResponse(body, requestDebug);

      return body;
    } catch (error) {
      if (error instanceof APIBrasilWhatsMeowError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new APIBrasilWhatsMeowError("Timeout ao enviar mensagem pela APIBrasil.", {
          code: "TIMEOUT",
          request: requestDebug,
        });
      }

      throw new APIBrasilWhatsMeowError(
        error instanceof Error ? error.message : "Erro inesperado ao chamar APIBrasil.",
        { code: "REQUEST_FAILED", payload: error, request: requestDebug }
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractErrorDetails(payload: unknown): APIBrasilErrorDetails {
  if (isRecord(payload)) {
    const message = getString(payload.message) ?? getString(payload.error) ?? "Erro retornado pela APIBrasil.";
    const code = getString(payload.code) ?? getString(payload.statusCode) ?? getNumber(payload.code);

    return { message, code, payload };
  }

  if (typeof payload === "string") {
    return { message: payload, payload };
  }

  return { message: "Erro retornado pela APIBrasil.", payload };
}

function assertSuccessfulWhatsMeowResponse(
  payload: unknown,
  request?: {
    method: string;
    url: string;
    body: APIBrasilWhatsMeowTextRequest;
  }
) {
  if (!Array.isArray(payload)) {
    return;
  }

  const failedItem = payload.find((item) => {
    if (!isRecord(item) || !isRecord(item.retorno)) {
      return false;
    }

    return item.retorno.success === false;
  });

  if (!failedItem || !isRecord(failedItem)) {
    return;
  }

  const retorno = isRecord(failedItem.retorno) ? failedItem.retorno : {};
  const message =
    getString(retorno.message) ??
    getString(retorno.error) ??
    getString(failedItem.mensagem) ??
    "APIBrasil retornou falha no envio da mensagem.";

  throw new APIBrasilWhatsMeowError(message, {
    statusCode: getNumber(retorno.code),
    code: getString(retorno.error) ?? getNumber(retorno.code),
    payload,
    request,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}
