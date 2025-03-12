import { NextRequest, NextResponse } from "next/server";

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

async function handleRequest(
  apiKey: string,
  apiUrl: string,
  req: NextRequest,
  method: string,
) {
  try {
    const path = req.nextUrl.pathname.replace(/^\/?api\//, "");
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    searchParams.delete("_path");
    searchParams.delete("nxtP_path");
    const queryString = searchParams.toString()
      ? `?${searchParams.toString()}`
      : "";

    const options: RequestInit = {
      method,
      headers: {
        "x-api-key": apiKey,
      },
    };

    if (["POST", "PUT", "PATCH"].includes(method)) {
      options.body = await req.text();
    }

    const res = await fetch(`${apiUrl}/${path}${queryString}`, options);

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: {
        ...res.headers,
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
  runtime?: string;
}) {
  const { apiKey, apiUrl, runtime } = {
    apiKey: inputs?.apiKey ?? process.env.LANGSMITH_API_KEY ?? "",
    apiUrl: inputs?.apiUrl ?? process.env.LANGGRAPH_API_URL,
    runtime: inputs?.runtime ?? "edge",
  };

  if (!apiUrl) {
    throw new Error(
      "API URL is required. Either pass it when initializing the function, or set it under the environment variable 'LANGGRAPH_API_URL'",
    );
  }

  const GET = (req: NextRequest) => handleRequest(apiKey, apiUrl, req, "GET");
  const POST = (req: NextRequest) => handleRequest(apiKey, apiUrl, req, "POST");
  const PUT = (req: NextRequest) => handleRequest(apiKey, apiUrl, req, "PUT");
  const PATCH = (req: NextRequest) =>
    handleRequest(apiKey, apiUrl, req, "PATCH");
  const DELETE = (req: NextRequest) =>
    handleRequest(apiKey, apiUrl, req, "DELETE");
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
