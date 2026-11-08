const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api/v1"
).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, { status = 0, code = null, data = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);

    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

function getErrorMessage(data, statusText) {
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  if (data && typeof data === "object") {
    if (typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }

    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }

    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
  }

  return statusText || "The request could not be completed.";
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      // A malformed JSON response is returned as text.
      // Do not crash while trying to parse an error response.
      return text;
    }
  }

  return text;
}

async function request(path, options = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;

  const {
    body,
    headers: customHeaders,
    ...fetchOptions
  } = options;

  const headers = new Headers(customHeaders || {});

  headers.set("Accept", "application/json");

  let requestBody;

  if (body !== undefined && body !== null) {
    const isFormData =
      typeof FormData !== "undefined" && body instanceof FormData;

    if (isFormData) {
      requestBody = body;
    } else {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      requestBody =
        typeof body === "string" ? body : JSON.stringify(body);
    }
  }

  let response;

  try {
    response = await fetch(url, {
      ...fetchOptions,
      method: String(fetchOptions.method || "GET").toUpperCase(),
      headers,
      cache: "no-store",
      body: requestBody,
      credentials: "include",
    });
  } catch (error) {
    throw new ApiError(
      `Unable to connect to the backend at ${API_BASE_URL}. Check that the backend server is running and the frontend API URL is correct.`,
      {
        cause: error,
      },
    );
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(data, response.statusText),
      {
        status: response.status,
        code:
          data && typeof data === "object"
            ? data.code || null
            : null,
        data,
      },
    );
  }

  return data;
}

export const apiClient = {
  request,

  get(path, options = {}) {
    return request(path, {
      ...options,
      method: "GET",
    });
  },

  post(path, body, options = {}) {
    return request(path, {
      ...options,
      method: "POST",
      body,
    });
  },

  patch(path, body, options = {}) {
    return request(path, {
      ...options,
      method: "PATCH",
      body,
    });
  },

  put(path, body, options = {}) {
    return request(path, {
      ...options,
      method: "PUT",
      body,
    });
  },

  delete(path, options = {}) {
    return request(path, {
      ...options,
      method: "DELETE",
    });
  },
};

export default apiClient;