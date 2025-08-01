import { NextRequest, NextResponse } from "next/server";

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "content-location",
  };
}

async function handleRequest(
  args: {
    apiKey: string;
    apiUrl: string;
    baseRoute?: string;
    bodyParameters?: (req: NextRequest, body: any) => any | Promise<any>;
    headers?: (
      req: NextRequest,
    ) => Record<string, string> | Promise<Record<string, string>>;
  },
  req: NextRequest,
  method: string,
) {
  const { apiKey, apiUrl, baseRoute, headers } = args;
  try {
    let path = req.nextUrl.pathname.replace(/^\/?api\//, "");
    if (baseRoute) {
      const formattedBaseRoute = baseRoute.endsWith("/")
        ? baseRoute
        : `${baseRoute}/`;
      path = path.replace(formattedBaseRoute, "");
    }
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    searchParams.delete("_path");
    searchParams.delete("nxtP_path");
    const queryString = searchParams.toString()
      ? `?${searchParams.toString()}`
      : "";

    const originalHeaders: Record<string, string | null> = {};
    req.headers.forEach((value, key) => {
      if (
        key.toLowerCase().startsWith("x-") ||
        key.toLowerCase() === "authorization"
      ) {
        originalHeaders[key] = value;
      }
    });

    const options: RequestInit = {
      method,
      headers: {
        ...originalHeaders,
        "x-api-key": apiKey,
        ...(await headers?.(req)),
      },
    };

    if (["POST", "PUT", "PATCH"].includes(method)) {
      options.body = await req.text();
    }

    if (args.bodyParameters) {
      const body = (options.body as string) || "{}";
      options.body = JSON.stringify(
        await args.bodyParameters(req, JSON.parse(body)),
      );
    }

    const res = await fetch(`${apiUrl}/${path}${queryString}`, options);

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: {
        ...responseHeaders,
        ...getCorsHeaders(),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export function initApiPassthrough(inputs?: {
  /**
   * The LangGraph deployment URL. Can be a local URL, or deployed URL.
   * If not passed, and not defined in the environment, and error will be thrown.
   * @default {process.env.LANGGRAPH_API_URL}
   */
  apiUrl?: string;
  /**
   * The LangSmith API key used to authenticate requests to the LangGraph server.
   * Not required, unless connecting to a deployed graph.
   * @default {process.env.LANGSMITH_API_KEY}
   */
  apiKey?: string;
  /**
   * The Next.js API runtime to use.
   * @default edge
   */
  runtime?: "edge" | "nodejs" | "experimental-edge";
  /**
   * The base route to use for the API passthrough. This should be used
   * if your catchall API endpoint is nested inside another route.
   * E.g `api/langgraph/[..._path]` instead of `api/[..._path]`
   */
  baseRoute?: string;
  /**
   * Provide additional parameters to the API call.
   */
  bodyParameters?: (req: NextRequest, body: any) => any;

  /**
   * Provide additional headers to the API call.
   */
  headers?: (
    req: NextRequest,
  ) => Record<string, string> | Promise<Record<string, string>>;

  /**
   * Disable the warning log about using the recommended method of authentication.
   */
  disableWarningLog?: boolean;
}) {
  const {
    apiKey,
    apiUrl,
    runtime,
    baseRoute,
    bodyParameters,
    headers,
    disableWarningLog,
  } = {
    apiKey: inputs?.apiKey ?? process.env.LANGSMITH_API_KEY ?? "",
    apiUrl: inputs?.apiUrl ?? process.env.LANGGRAPH_API_URL,
    runtime: inputs?.runtime ?? "edge",
    baseRoute: inputs?.baseRoute,
    bodyParameters: inputs?.bodyParameters,
    headers: inputs?.headers,
    disableWarningLog: inputs?.disableWarningLog,
  };

  if (!apiUrl) {
    throw new Error(
      "API URL is required. Either pass it when initializing the function, or set it under the environment variable 'LANGGRAPH_API_URL'",
    );
  }

  if (!disableWarningLog) {
    const message = `🟠 Notice 🟠
  
This is no longer the recommended way of handling authentication with LangGraph servers.
Now that both Python, and TypeScript graphs support custom authentication and routes, we recommend you implement that in your LangGraph deployment.
Please read the documentation for more information.

You can disable this warning by passing the \`disableWarningLog\` option to the \`initApiPassthrough\` function.

Python Docs: https://langchain-ai.github.io/langgraph/how-tos/auth/custom_auth/
TypeScript Docs: https://langchain-ai.github.io/langgraphjs/how-tos/auth/custom_auth/`;
    console.log(message);
  }

  const GET = (req: NextRequest) =>
    handleRequest({ apiKey, apiUrl, baseRoute, headers }, req, "GET");
  const POST = (req: NextRequest) =>
    handleRequest(
      { apiKey, apiUrl, baseRoute, bodyParameters, headers },
      req,
      "POST",
    );
  const PUT = (req: NextRequest) =>
    handleRequest(
      { apiKey, apiUrl, baseRoute, bodyParameters, headers },
      req,
      "PUT",
    );
  const PATCH = (req: NextRequest) =>
    handleRequest(
      { apiKey, apiUrl, baseRoute, bodyParameters, headers },
      req,
      "PATCH",
    );
  const DELETE = (req: NextRequest) =>
    handleRequest({ apiKey, apiUrl, baseRoute, headers }, req, "DELETE");
  const OPTIONS = () => {
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...getCorsHeaders(),
      },
    });
  };

  return { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime };
}
