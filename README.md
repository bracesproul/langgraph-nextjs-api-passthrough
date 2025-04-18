# LangGraph Next.js API Passthrough

# 🟠 Notice 🟠

**This is no longer the recommended way of handling authentication with LangGraph servers. Now that both Python, and TypeScript graphs support custom authentication and routes, we recommend you implement that in your LangGraph deployment. Using custom authentication will allow for much greater security and control over your authentication flow. Please read the documentation for more information. [Python Docs](https://langchain-ai.github.io/langgraph/how-tos/auth/custom_auth/), [TypeScript Docs](https://langchain-ai.github.io/langgraphjs/how-tos/auth/custom_auth/).**

This is a small package which exports API endpoint handlers to allow calling LangGraph servers from the client, without exposing API keys, or deployment URLs. This is useful when calling a LangGraph deployment from the client-side, so you can avoid setting secrets on the client.

## Table of Contents

- [Installation](#installation)
- [Setup](#setup)
- [Usage](#usage)
  - [With `Client`](#with-client)
  - [With `useStream`](#with-usestream)
- [Nested API endpoint](#nested-api-endpoint)
- [Custom body parameters](#custom-body-parameters)

## Installation

```bash
npm install langgraph-nextjs-api-passthrough
```

## Setup

First, define the wildcard API endpoint inside your `api` directory:

`/api/[..._path]/route.ts`

This will catch _all_ requests to `/api/*`. Then, inside the `route.ts` file, import the `initApiPassthrough` function from this package:

```typescript route.ts
import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
  initApiPassthrough({
    apiUrl: process.env.LANGGRAPH_API_URL, // default, if not defined it will attempt to read process.env.LANGGRAPH_API_URL
    apiKey: process.env.LANGSMITH_API_KEY, // default, if not defined it will attempt to read process.env.LANGSMITH_API_KEY
    runtime: "edge", // default
  });
```

This function returns an object, with the following properties:

- `GET` - A request handler for `GET` requests to the API.
- `POST` - A request handler for `POST` requests to the API.
- `PUT` - A request handler for `PUT` requests to the API.
- `PATCH` - A request handler for `PATCH` requests to the API.
- `DELETE` - A request handler for `DELETE` requests to the API.
- `OPTIONS` - A request handler for `OPTIONS` requests to the API.
- `runtime` - The runtime environment for the API. Defaults to `edge`.

Once the `initApiPassthrough` function is returned, any API requests made by the LangGraph client (e.g. the `Client` class from `@langchain/langgraph-sdk`, or the `useStream` hook from `@langchain/langgraph-sdk/react`) will first passthrough this endpoint, where the actual API URL & key will be injected so that it is able to make secure, authenticated requests to your LangGraph server.

## Usage

After defining the above endpoint, you can test it out on the client. Below are two examples, one using the `Client` class, and the other using the `useStream` hook.

First, ensure you have a LangGraph server running, or deployed, and you've set the required environment variables (`LANGGRAPH_API_URL` and `LANGSMITH_API_KEY`).

Next, define a simple `test` page, where we'll render a button to trigger the API call.

### With `Client`:

```tsx test/page.tsx
"use client";

import { useState } from "react";
import { Client, Thread } from "@langchain/langgraph-sdk";

export default function TestPage() {
  const [thread, setThread] = useState<Thread>();
  const [loading, setLoading] = useState(false);
  const client = new Client({
    apiUrl: "http://localhost:3000/api", // Update this with your domain URL (e.g process.env.NEXT_PUBLIC_API_URL)
  });

  const callApi = async () => {
    setLoading(true);
    const thread = await client.threads.create();
    setThread(thread);
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-4 items-center justify-center w-full p-6">
      <button
        onClick={(e) => {
          e.preventDefault();
          callApi();
        }}
      >
        Create Thread
      </button>
      <p className="text-sm">Loading: {loading ? "Yes" : "No"}</p>
      {thread && (
        <div className="flex flex-col gap-2 items-center">
          <p className="text-lg font-medium">Thread</p>
          <code className="bg-gray-100 rounded-2xl p-2 max-w-lg">
            {JSON.stringify(thread, null, 2)}
          </code>
        </div>
      )}
    </div>
  );
}
```

### With `useStream`:

```tsx test/page.tsx
"use client";

import { useState } from "react";
import { Thread } from "@langchain/langgraph-sdk";
import { useStream } from "@langchain/langgraph-sdk/react";

export default function TestPage() {
  const [thread, setThread] = useState<Thread>();
  const [loading, setLoading] = useState(false);
  const stream = useStream({
    apiUrl: "http://localhost:3000/api", // Update this with your domain URL (e.g process.env.NEXT_PUBLIC_API_URL)
    assistantId: "agent", // Update this with your assistant/graph ID
  });

  const callApi = async () => {
    setLoading(true);
    const thread = await stream.client.threads.create();
    setThread(thread);
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-4 items-center justify-center w-full p-6">
      <button
        onClick={(e) => {
          e.preventDefault();
          callApi();
        }}
      >
        Create Thread
      </button>
      <p className="text-sm">Loading: {loading ? "Yes" : "No"}</p>
      {thread && (
        <div className="flex flex-col gap-2 items-center">
          <p className="text-lg font-medium">Thread</p>
          <code className="bg-gray-100 rounded-2xl p-2 max-w-lg">
            {JSON.stringify(thread, null, 2)}
          </code>
        </div>
      )}
    </div>
  );
}
```

Then, start your local web server, visit `http://localhost:3000/test`, (or swap with your local port if not `3000`), and you should see a button to create a thread. Click the button, and you should see the thread object returned from the API. If that works, it means you have the passthrough endpoint working correctly!

### Nested API endpoint

If your LangGraph catchall passthrough route is nested inside another route (e.g `/api/some_route/[..._path]` instead of `/api/[..._path]`) you can pass the `baseRoute` option to the `initApiPassthrough` function to handle this case.

Let's say you have the endpoint nested inside `/langgraph`. Your file structure would look like this:

```
/api
  /langgraph
    [..._path]
      route.ts
```

You should pass `baseRoute: "langgraph"` to the `initApiPassthrough` function:

```typescript
export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
  initApiPassthrough({
    baseRoute: "langgraph",
  });
```

### Custom body parameters

If you need to modify the body parameters before sending them to the LangGraph API, you can pass a `bodyParameters` function to the `initApiPassthrough` function. You can use this to remove, add, or modify parameters before they are sent to the API.

Example, which modifies the `configurable` fields of a request to include additional credentials:

```typescript
initApiPassthrough({
  bodyParameters: async (req, body) => {
    if (
      req.nextUrl.pathname.endsWith("/runs/stream") &&
      req.method === "POST"
    ) {
      return {
        ...body,
        config: {
          configurable: {
            _credentials: {
              accessToken: await getUserAccessToken(),
            },
          },
        },
      };
    }

    return body;
  },
});
```
