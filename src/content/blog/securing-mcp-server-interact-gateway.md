---
title: 'Securing an MCP Server on IBM Interact Gateway with IBM Verify'
description: 'A step-by-step guide to adding OAuth bearer-token authentication (IBM Verify) to an MCP server on the DataPower Nano Gateway, with the technical details called out along the way.'
pubDate: 2026-07-15
tags: ['mcp', 'ibm', 'oauth', 'api-gateway', 'security']
draft: false
---

IBM's **Interact Gateway** is a new gateway product that runs the **DataPower Nano Gateway** under the hood. One of its capabilities is hosting **MCP (Model Context Protocol) servers**: you upload an OpenAPI spec and the gateway scaffolds an MCP server that exposes each operation as an MCP tool.

This guide walks through adding **OAuth bearer-token authentication** (tokens issued by **IBM Verify**) to such a server, step by step. The technical details worth knowing are called out as notes at the step where they matter.

**Starting point:** a working but unauthenticated MCP server. It wraps the public [JSONPlaceholder](https://jsonplaceholder.typicode.com) API and exposes tools like `listUsers`, `getUser`, `listPosts`, and `createPost`. When you create the MCP server from an OpenAPI spec, API Studio generates linked YAML resources — `MCPServer`, `MCPTools`, a `FreeFlowPolicySequence` (the policy flow), an `Invoke` policy (the backend call), plus `Quota` and `Telemetry`. Out of the box the flow just calls the backend, with no security:

> **Prerequisite:** If you don't already have an MCP server running, follow IBM's guide to [create an MCP server in form view](https://www.ibm.com/docs/en/dp-interact-gateway/12.1.1?topic=tools-creating-mcp-server-in-form-view) — import a simple OpenAPI spec, generate the MCP tools, and publish. That gives you a working MCP server with the default policies. **Test that it works before adding any of the policies below**, so you have a known-good baseline to build on.

```yaml
spec:
  main:
    - $ref: test-mcp:invoke-pptcg:1.0   # call the backend
  monitoring:
    $ref: test-mcp:telemetry-pptcg:1.0
```

**End goal:** require a valid IBM Verify bearer token on every request, validated by the gateway before the backend is called.

---

## Step 1 — Register a client application in IBM Verify

In IBM Verify, create an OAuth/OIDC application that will issue tokens and note its **client_id** and **client_secret**. For this guide:

- **Client type:** confidential (has a client_secret)
- **Grant type:** `authorization_code` (a user logs in; the token represents them)
- **Redirect URI:** registered (e.g. `http://localhost:3000/oauth/callback`)
- **PKCE:** disabled for the eval

> **Technical detail — confidential vs. public client.** This app must be a **confidential** client, and it matters because of how token validation works later. IBM Verify's default rule is that **a client can only introspect its *own* tokens**, and **non-confidential (public) clients can't introspect at all**. The gateway will validate tokens by calling IBM Verify's introspection endpoint, authenticating as a client — so use **one confidential client for both roles**: it issues the tokens *and* the gateway uses its credentials to introspect them. Introspecting its own tokens satisfies the default rule with no extra configuration. (Introspecting with a *different* client requires modifying a token mapping rule to allow cross-client introspection — avoid unless you need it.)

> **Technical detail — PKCE.** Disabling PKCE is acceptable here because the client is confidential (the client_secret protects the code exchange). OAuth 2.1 and the MCP spec recommend PKCE for all clients, so plan to enable it before production.

---

## Step 2 — Configure the OAuth provider in the gateway

In the Interact Gateway, go to **Settings → OAuth providers** and add a third-party provider (named `ibm-verify-eval` here) pointing at IBM Verify's endpoints:

| Field | Value |
|---|---|
| Authorization URL | `https://eval.verify.ibm.com/oauth2/authorize` |
| Token URL | `https://eval.verify.ibm.com/oauth2/token` |
| **Introspect URL** | `https://eval.verify.ibm.com/oauth2/introspect` |
| Security | **Basic Authentication** |
| OAuth version | OAuth 2.0 |

> **Technical detail — the introspecting client's credentials.** The **Introspect URL** is the only endpoint the gateway uses to validate tokens. Set **Security** to **Basic Authentication**, and enter the **client_id and client_secret of the introspecting client** (the confidential client from Step 1) as the username/password. Per RFC 7662 the introspection endpoint authenticates its caller — leaving Security at `None` means IBM Verify rejects the call and every token is treated as invalid.

![OAuth provider configuration in the Interact Gateway, with the introspect URL and Basic Authentication](/blog/securing-mcp-server-interact-gateway/oauth-provider-config.png)

*Figure 1 — OAuth provider configuration pointing at IBM Verify, using Basic Authentication for introspection.*

---

## Step 3 — Add the Extract Identity policy

Add an `ExtractIdentity` policy that reads the bearer token from the `Authorization` header:

```yaml
kind: ExtractIdentity
apiVersion: api.ibm.com/v1
metadata:
  name: extract-identity-oauth2
  namespace: test-mcp
  version: "1.0"
  labels:
    gatewayTypes: [nano]
spec:
  namespace: test-mcp
  credentialType:            # the type nests under credentialType
    oauth2:
      httpHeader:
        name: Authorization
```

---

## Step 4 — Add the Authenticate policy

Add an `Authenticate` policy that validates the extracted token against the OAuth provider from Step 2:

```yaml
kind: Authenticate
apiVersion: api.ibm.com/v1
metadata:
  name: authenticate-oauth2
  namespace: test-mcp
  version: "1.0"
  labels:
    gatewayTypes: [nano]
spec:
  namespace: test-mcp
  operation:                 # the type nests under operation
    oauth2:
      providers:
        - ibm-verify-eval    # the OAuth provider configured in Step 2
```

> **Technical detail — use the built-in security policies.** It's tempting to reach for a **Lua Script** (custom validation) or an **Invoke** (manually call the introspection endpoint), but both are unnecessary. `Extract Identity` + `Authenticate` do this natively — Lua is a fallback for logic the built-ins can't express, and Invoke would just re-implement what Authenticate already does.

> **Technical detail — JWT validation vs. introspection.** The lightweight option is normally *local* JWT validation (verify the signature against the issuer's JWKS, no per-request network call). IBM **API Connect** supports this via a JWT provider, but the **Interact Gateway doesn't yet — it's a roadmap item**. So the path today is *remote token introspection* through an OAuth provider (`operation: oauth2`), which works even when the token itself is a JWT.

> **Technical detail — the wrapper keys.** The credential type nests under a `credentialType` wrapper for Extract Identity and an `operation` wrapper for Authenticate. The two policies are symmetric; putting `oauth2` directly under `spec` is rejected by the validator.

---

## Step 5 — Order the policy sequence

Place the two new policies **before** the generated `Invoke`, so authentication runs first and an invalid token is rejected before the backend is called:

```yaml
spec:
  main:
    - $ref: test-mcp:extract-identity-oauth2:1.0   # grab the bearer token
    - $ref: test-mcp:authenticate-oauth2:1.0        # introspect it
    - $ref: test-mcp:invoke-pptcg:1.0               # call the backend
  monitoring:
    $ref: test-mcp:telemetry-pptcg:1.0
```

![The policy flow in the API Studio canvas: Extract Identity, then Authenticate, then Invoke](/blog/securing-mcp-server-interact-gateway/policy-flow.png)

*Figure 2 — The policy sequence in the canvas: Extract Identity → Authenticate → Invoke.*

> **Technical detail — keep the auto-generated `Invoke`.** The `FreeFlowPolicySequence` and its default `Invoke` are generated and owned by API Studio, which re-serializes the file on save/publish. Hand-editing the YAML to add the auth policies can drop the `Invoke` — and without it there's no backend call, so every tool returns an empty response and fails with `Parse Error on 'response': Empty Message`. **Add the auth policies through the API Studio canvas** (insert them before the Invoke), never by hand-editing the file, and confirm the order — Extract Identity → Authenticate → Invoke — survives the publish.

---

## Step 6 — Publish

Publish the project to the gateway. After publishing, re-check the policy sequence to confirm all three policies are present in the right order (see the note above).

---

## Step 7 — Get a token from IBM Verify

With the `authorization_code` grant, obtain a token via a browser authorize step followed by a code exchange:

```bash
curl -X POST 'https://eval.verify.ibm.com/oauth2/token' \
  -u 'CLIENT_ID:CLIENT_SECRET' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=authorization_code' \
  -d 'code=THE_CODE' \
  -d 'redirect_uri=http://localhost:3000/oauth/callback'
```

> **Technical detail — two small requirements.** IBM Verify requires the authorize request's `state` parameter to be **at least 8 characters**. And the `access_token` it returns is **opaque** (not a JWT) — which is exactly why introspection is the right validation method.

---

## Step 8 — Test with MCP Inspector

Paste the token into **MCP Inspector → Authentication → Bearer Token** and connect to the MCP endpoint.

- **Without a token** → a clean `401`. That confirms the `Authenticate` policy is doing its job.

![MCP Inspector failing to connect with a 401 when no token is supplied](/blog/securing-mcp-server-interact-gateway/mcp-inspector-without-auth.png)

*Figure 3 — Without a token, the connection is rejected with a 401.*

- **With a valid token** → the connection initializes, tools list, and calls return data.

![MCP Inspector connected successfully and listing tools with a valid bearer token](/blog/securing-mcp-server-interact-gateway/mcp-inspector-with-auth.png)

*Figure 4 — With a valid IBM Verify token pasted into the Bearer Token field, the connection succeeds and tools are listed.*

At this point authentication is working end-to-end: the gateway extracts the bearer token, introspects it against IBM Verify, and only then calls the backend.

---

## Known issue — arrays vs. MCP structured content

One protocol issue remains after auth is working. `getUser` (a single object) works, but `listUsers` fails:

```
MCP error -32603: MCP structuredContent must be a JSON object or omitted.
Received: [{"id":1,"name":"Leanne Graham",...}, ...]
```

MCP requires a tool's `structuredContent` to be a **JSON object**, but JSONPlaceholder's list endpoints return a **top-level array**. The fix is to wrap the array in an object (e.g. `{ "items": [...] }`) via a response-side `Transform`, ideally only when the payload is an array so object-returning tools are untouched. Arguably a gateway gap — a spec-compliant MCP server should auto-wrap bare arrays.

---

## What's next

- Add `audClaim` to the Authenticate policy for tighter validation once the audience is finalized.
- Add an **`Authorize`** policy for scope/role enforcement.
- Wrap array responses to satisfy MCP structured content.
- Turn PKCE back on before production.

Authentication itself is solved — bearer tokens from IBM Verify, validated by introspection, enforced on every MCP call.
