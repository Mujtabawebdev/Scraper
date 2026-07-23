import { beforeEach, describe, expect, it, vi } from "vitest";

type MockHeaders = {
  get: (name: string) => string | undefined;
  set: (name: string, value: string) => void;
};

type MockRequestConfig = {
  baseURL?: string;
  data?: unknown;
  headers: MockHeaders;
  method?: string;
  url?: string;
  _authRetry?: boolean;
};

type MockResponse<TData = unknown> = {
  config: MockRequestConfig;
  data: TData;
  status: number;
};

type MockAxiosFailure = Error & {
  config: MockRequestConfig;
  isAxiosError: true;
  response: MockResponse<{
    success: false;
    message: string;
    error: {
      code: string;
    };
  }>;
};

type MockResponder = (
  config: MockRequestConfig,
) => MockResponse | Promise<MockResponse>;

type MockRequestInterceptor = (
  config: MockRequestConfig,
) => MockRequestConfig | Promise<MockRequestConfig>;

type MockResponseFulfilled = (
  response: MockResponse,
) => MockResponse | Promise<MockResponse>;

type MockResponseRejected = (error: unknown) => unknown | Promise<unknown>;

type MockClient = {
  calls: MockRequestConfig[];
  responder: MockResponder;
};

type AxiosHarness = {
  clients: MockClient[];
  create: () => unknown;
  failure: (
    status: number,
    config: MockRequestConfig,
    code?: string,
  ) => MockAxiosFailure;
  isAxiosError: (error: unknown) => boolean;
  reset: () => void;
};

const axiosHarness = vi.hoisted((): AxiosHarness => {
  const clients: MockClient[] = [];

  const createHeaders = (
    initial?: Readonly<Record<string, string>>,
  ): MockHeaders => {
    const values = new Map<string, string>();
    for (const [name, value] of Object.entries(initial ?? {})) {
      values.set(name.toLowerCase(), value);
    }

    return {
      get: (name) => values.get(name.toLowerCase()),
      set: (name, value) => {
        values.set(name.toLowerCase(), value);
      },
    };
  };

  const create = (): unknown => {
    let requestInterceptor: MockRequestInterceptor | null = null;
    let responseFulfilled: MockResponseFulfilled | null = null;
    let responseRejected: MockResponseRejected | null = null;

    const state: MockClient = {
      calls: [],
      responder: (config) =>
        Promise.resolve({
          config,
          data: {},
          status: 200,
        }),
    };

    const execute = async (input: MockRequestConfig): Promise<MockResponse> => {
      let config = input;
      if (requestInterceptor) {
        config = await requestInterceptor(config);
      }
      state.calls.push(config);

      try {
        const response = await state.responder(config);
        return responseFulfilled
          ? await responseFulfilled(response)
          : response;
      } catch (error: unknown) {
        if (responseRejected) {
          return (await responseRejected(error)) as MockResponse;
        }
        throw error;
      }
    };

    const callable = Object.assign(
      (config: MockRequestConfig) => execute(config),
      {
        defaults: {},
        get: (url: string) =>
          execute({
            headers: createHeaders(),
            method: "get",
            url,
          }),
        post: (url: string, data?: unknown) =>
          execute({
            data,
            headers: createHeaders(),
            method: "post",
            url,
          }),
        interceptors: {
          request: {
            use: (handler: MockRequestInterceptor) => {
              requestInterceptor = handler;
              return 0;
            },
          },
          response: {
            use: (
              fulfilled: MockResponseFulfilled,
              rejected: MockResponseRejected,
            ) => {
              responseFulfilled = fulfilled;
              responseRejected = rejected;
              return 0;
            },
          },
        },
      },
    );

    clients.push(state);
    return callable;
  };

  const failure = (
    status: number,
    config: MockRequestConfig,
    code = "INVALID_ACCESS_TOKEN",
  ): MockAxiosFailure => {
    const error = new Error("Unsafe mocked transport detail") as MockAxiosFailure;
    error.config = config;
    error.isAxiosError = true;
    error.response = {
      config,
      data: {
        success: false,
        message: "Unsafe mocked backend detail",
        error: { code },
      },
      status,
    };
    return error;
  };

  return {
    clients,
    create,
    failure,
    isAxiosError: (error) =>
      typeof error === "object" &&
      error !== null &&
      "isAxiosError" in error &&
      error.isAxiosError === true,
    reset: () => {
      clients.splice(0, clients.length);
    },
  };
});

vi.mock("axios", () => ({
  AxiosError: class MockAxiosError extends Error {},
  default: {
    create: axiosHarness.create,
    isAxiosError: axiosHarness.isAxiosError,
  },
}));

type ApiClientModule = typeof import("./api-client");

const requireClient = (index: number): MockClient => {
  const client = axiosHarness.clients[index];
  if (!client) {
    throw new Error(`Expected mocked Axios client at index ${index}`);
  }
  return client;
};

describe("apiClient authentication recovery", () => {
  let apiClientModule: ApiClientModule;

  beforeEach(async () => {
    axiosHarness.reset();
    vi.resetModules();
    apiClientModule = await import("./api-client");
  });

  it("refreshes once and retries a 401 request with the new access token", async () => {
    const applicationClient = requireClient(0);
    const refreshClient = requireClient(1);
    let accessToken = "expired-access-token";
    const observedAuthorization: Array<string | undefined> = [];
    const setAccessToken = vi.fn((token: string) => {
      accessToken = token;
    });
    const clearAuthentication = vi.fn();

    apiClientModule.connectApiClientToAuth({
      clearAuthentication,
      getAccessToken: () => accessToken,
      setAccessToken,
    });

    applicationClient.responder = (config) => {
      observedAuthorization.push(config.headers.get("Authorization"));
      if (config._authRetry === true) {
        return {
          config,
          data: { result: "protected data" },
          status: 200,
        };
      }
      throw axiosHarness.failure(401, config);
    };
    refreshClient.responder = (config) => ({
      config,
      data: {
        success: true,
        data: {
          accessToken: "fresh-access-token",
          accessTokenExpiresIn: 900,
        },
      },
      status: 200,
    });

    const response = await apiClientModule.apiClient.get("/protected-resource");

    expect(response.data).toEqual({ result: "protected data" });
    expect(refreshClient.calls).toHaveLength(1);
    expect(applicationClient.calls).toHaveLength(2);
    expect(observedAuthorization).toEqual([
      "Bearer expired-access-token",
      "Bearer fresh-access-token",
    ]);
    expect(setAccessToken).toHaveBeenCalledOnce();
    expect(setAccessToken).toHaveBeenCalledWith("fresh-access-token");
    expect(clearAuthentication).not.toHaveBeenCalled();
  });

  it("shares one refresh request across concurrent 401 responses", async () => {
    const applicationClient = requireClient(0);
    const refreshClient = requireClient(1);
    let accessToken = "expired-access-token";
    let releaseRefresh: ((response: MockResponse) => void) | undefined;
    const refreshGate = new Promise<MockResponse>((resolve) => {
      releaseRefresh = resolve;
    });

    apiClientModule.connectApiClientToAuth({
      clearAuthentication: vi.fn(),
      getAccessToken: () => accessToken,
      setAccessToken: (token) => {
        accessToken = token;
      },
    });

    applicationClient.responder = (config) => {
      if (config._authRetry === true) {
        return {
          config,
          data: { url: config.url },
          status: 200,
        };
      }
      throw axiosHarness.failure(401, config);
    };
    refreshClient.responder = () => refreshGate;

    const firstRequest = apiClientModule.apiClient.get("/first-resource");
    const secondRequest = apiClientModule.apiClient.get("/second-resource");

    await vi.waitFor(() => {
      expect(applicationClient.calls).toHaveLength(2);
      expect(refreshClient.calls).toHaveLength(1);
    });

    const refreshConfig = refreshClient.calls[0];
    if (!refreshConfig || !releaseRefresh) {
      throw new Error("Expected a pending refresh request");
    }
    releaseRefresh({
      config: refreshConfig,
      data: {
        success: true,
        data: {
          accessToken: "shared-fresh-access-token",
          accessTokenExpiresIn: 900,
        },
      },
      status: 200,
    });

    const [firstResponse, secondResponse] = await Promise.all([
      firstRequest,
      secondRequest,
    ]);

    expect(firstResponse.data).toEqual({ url: "/first-resource" });
    expect(secondResponse.data).toEqual({ url: "/second-resource" });
    expect(refreshClient.calls).toHaveLength(1);
    expect(applicationClient.calls).toHaveLength(4);
  });

  it("clears authentication when refresh fails and does not retry indefinitely", async () => {
    const applicationClient = requireClient(0);
    const refreshClient = requireClient(1);
    const clearAuthentication = vi.fn();
    const setAccessToken = vi.fn();

    apiClientModule.connectApiClientToAuth({
      clearAuthentication,
      getAccessToken: () => "expired-access-token",
      setAccessToken,
    });

    applicationClient.responder = (config) => {
      throw axiosHarness.failure(401, config);
    };
    refreshClient.responder = (config) => {
      throw axiosHarness.failure(401, config, "INVALID_REFRESH_TOKEN");
    };

    await expect(
      apiClientModule.apiClient.get("/protected-resource"),
    ).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
      message: "Your session has expired. Please sign in again.",
      status: 401,
    });

    expect(clearAuthentication).toHaveBeenCalledOnce();
    expect(setAccessToken).not.toHaveBeenCalled();
    expect(refreshClient.calls).toHaveLength(1);
    expect(applicationClient.calls).toHaveLength(1);
  });

  it("can refresh and retry the protected logout-all endpoint", async () => {
    const applicationClient = requireClient(0);
    const refreshClient = requireClient(1);
    let accessToken = "expired-access-token";

    apiClientModule.connectApiClientToAuth({
      clearAuthentication: vi.fn(),
      getAccessToken: () => accessToken,
      setAccessToken: (token) => {
        accessToken = token;
      },
    });

    applicationClient.responder = (config) => {
      if (config._authRetry === true) {
        return {
          config,
          data: {
            success: true,
            message: "Logged out from all devices successfully",
          },
          status: 200,
        };
      }
      throw axiosHarness.failure(401, config);
    };
    refreshClient.responder = (config) => ({
      config,
      data: {
        success: true,
        data: {
          accessToken: "fresh-access-token",
          accessTokenExpiresIn: 900,
        },
      },
      status: 200,
    });

    const response = await apiClientModule.apiClient.post(
      "/auth/logout-all",
      {},
    );

    expect(response.status).toBe(200);
    expect(refreshClient.calls).toHaveLength(1);
    expect(applicationClient.calls).toHaveLength(2);
  });
});
