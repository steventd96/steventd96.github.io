---
title: 'Hardening an MCP Server on IBM Interact Gateway: Audience Validation and Scope Authorization'
description: 'A follow-up to the OAuth guide: validating the token audience so only tokens meant for the gateway are accepted, then a look at where scope-based authorization stands today.'
pubDate: 2026-07-17
tags: ['mcp', 'ibm', 'oauth', 'api-gateway', 'security', 'authorization']
draft: false
---

In [Part 1](/blog/securing-mcp-server-interact-gateway/) I secured an MCP server on IBM Interact Gateway with OAuth bearer tokens issued by IBM Verify: every request is introspected against the provider before the backend is called. That stops *anonymous* traffic — but it accepts **any** valid token the tenant issues, including tokens minted for a completely different application.

This follow-up closes that gap in two moves: validating the **audience** (`aud`) claim so the gateway only accepts tokens actually meant for it, and then looking at **authorization** — which operations a token is allowed to perform.

> **Why audience validation matters.** A token minted for a different resource in the same IBM Verify tenant still introspects as `active`. Without an audience check, the gateway would happily accept it — a classic confused-deputy risk. The `aud` claim binds a token to its intended recipient; validating it means a token issued for some other app can't be replayed against your MCP server.

**Starting point.** This builds directly on Part 1 — a working MCP server, an OAuth provider (`ibm-verify-eval`) configured in the gateway, and an `Authenticate` policy using the `oauth2` operation with introspection.

---

## Step 1 — Emit the audience claim from IBM Verify

In IBM Verify, open your application's **Token settings** and add `gateway` under **Audiences**.

![IBM Verify Token settings with gateway added under Audiences](/blog/hardening-mcp-server-audience-scope/verify-audience-setting.png)

*Figure 1 — IBM Verify Token settings: `gateway` added under Audiences. The helper text notes the value is added to the `aud` claim in both the introspection response and the JWT payload.*

Note the helper text under the field: *"Audiences are added to the 'aud' claim in the introspection and JWT payload."* That single line is the whole reason this works with our setup.

> **Technical detail — why the introspection payload is what counts.** The gateway validates tokens by **introspection**, not by locally parsing a JWT. So it doesn't matter whether the audience is baked into a signed JWT the gateway never decodes — what matters is that `gateway` comes back in the *introspection response*. This setting adds the value to both, so introspection-based validation sees it.

Confirm it before touching the gateway: mint a fresh token and introspect it. The `aud` claim should now include `gateway`:

```json
{
  "active": true,
  "aud": ["gateway", "<client_id>"],
  "client_id": "<client_id>",
  "grant_type": "authorization_code",
  "scope": "openid",
  "token_use": "access_token"
}
```

IBM Verify lists the client's own `client_id` alongside `gateway` in `aud` — that's expected. All we care about is that `gateway` is present.

---

## Step 2 — Require the audience on the gateway

Now tell the `Authenticate` policy to require that audience. In form view, add `gateway` under **Audience claims**:

![The gateway Audience claims list including gateway alongside random-aud and abc](/blog/hardening-mcp-server-audience-scope/audclaim-with-gateway.png)

*Figure 2 — The `Authenticate` policy's Audience claims list. It holds `random-aud`, `abc`, and `gateway`; the token passes because its `aud` contains `gateway`.*

In YAML, that's the `audClaim` list on the `oauth2` operation:

```yaml
kind: Authenticate
apiVersion: api.ibm.com/v1
metadata:
  name: authenticate-oauth2
  namespace: test-mcp
  version: '1.0'
spec:
  namespace: test-mcp
  operation:
    oauth2:
      providers:
        - ibm-verify-eval
      audClaim:
        - gateway
```

> **Technical detail — matching is "any of", not "all of".** `audClaim` is a list of *accepted* audiences. The policy admits a token if the token's `aud` contains **at least one** of the listed values. In the screenshot above the list holds `random-aud`, `abc`, and `gateway` — the token passes purely because its `aud` contains `gateway`; the other two entries never have to match. This is native to the policy: no scripting or extra filter step is needed.

---

## Step 3 — The happy path

With `gateway` present on both sides — issued by Verify and required by the gateway — a token minted for the gateway sails through authentication and the MCP tools respond as before. Nothing in the client changes; the request just carries a token whose audience the gateway now trusts.

---

## Step 4 — Prove it: the negative test

A security control you haven't seen fail isn't one you can trust. Remove `gateway` from the `audClaim` list, leaving only audiences the token doesn't carry:

![The same Audience claims list with gateway removed, leaving only random-aud and abc](/blog/hardening-mcp-server-audience-scope/audclaim-without-gateway.png)

*Figure 3 — The Audience claims list with `gateway` removed. The token's `aud` now matches none of the accepted audiences, so the gateway rejects the request.*

Now the token's `aud` (`["gateway", "<client_id>"]`) matches none of the accepted audiences (`random-aud`, `abc`), and the gateway rejects the request.

> **Observed behavior — expect a 401, not a 403.** On this gateway an audience mismatch comes back as **HTTP 401**: the `Authenticate` policy treats "this token isn't valid for this resource" as an *authentication* failure rather than an authorization one. So assert `401` in your negative test.

Note the asymmetry worth remembering: **removing** `audClaim` entirely doesn't harden anything — it *disables* the check and makes the gateway accept any valid token again. Enforcement comes from listing an audience the caller must carry, not from the field's mere presence.

---

## The next question: authorization by scope

Authentication (Part 1) and audience validation (above) get you a token that is genuinely valid *and* genuinely meant for this gateway. Neither says anything about **what that token is allowed to do**. Every one of the server's tools — `listUsers`, `createPost`, `deletePost`, and the rest — is equally callable by any caller who clears authentication. The natural next layer is **authorization**: gating operations on the OAuth `scope` claim, so a read-only client can't create or delete.

### What you can do today: server-level scope enforcement

The gateway ships an `Authorize` policy that validates the token's `scope` claim. You add it to the flow after `Authenticate` and list the scopes a caller must present:

```yaml
kind: Authorize
apiVersion: api.ibm.com/v1
metadata:
  name: authorize-oauth2
  namespace: test-mcp
  version: '1.0'
spec:
  namespace: test-mcp
  operation:
    oauth2:
      requiredScopes:
        - provider: ibm-verify-eval
          scopes:
            - mcp:invoke
```

On the IBM Verify side you define the scope (e.g. `mcp:invoke`) as you did for the audience, so issued tokens carry it in the `scope` claim — confirmable with the same introspection call we used earlier (today the eval token only carries `scope: "openid"`). Register the same scope names under the OAuth provider's **Scopes** section in the gateway.

> **Technical detail — this is coarse, not per-tool.** `requiredScopes` is evaluated once for the whole MCP server: either the token carries the required scope and *every* tool is reachable, or it doesn't and the *whole* server is refused. It's all-or-nothing across the toolset. Note also that scope enforcement is the `Authorize` policy's job, not `Authenticate`'s — `Authenticate` only knows about providers and the audience claim.

### Where this ideally needs to go: per-tool scopes

The goal most people actually want is **fine-grained, per-tool** authorization — `users:read` unlocks `getUser`/`listUsers` while `users:write` is required for a mutating tool like `createPost` or `deletePost`. A single server-wide scope can't express that: ideally the gateway should let you enforce a distinct required scope on each *individual* tool, not just on the server as a whole.

The natural model for that is to attach — or override — an `Authorize` policy **directly on an individual tool** (the primitive), so each tool enforces its own required scope. Binding the policy to the tool is what makes it per-tool: the gateway already knows which primitive is executing, so there's no need to crack open the request to find out.

> **Technical detail — enforce at the tool boundary, don't parse the payload.** MCP multiplexes every tool onto a single HTTP endpoint (`POST …/mcp`); the tool name lives inside the JSON-RPC body, not the URL. It's tempting to drop a Lua script into the flow to parse that body and branch on the tool name — but that's a hack, not production-grade. The clean model is to enforce the scope at the tool boundary itself, where the gateway already knows which primitive is running, rather than inspecting payloads in a script. (For reference, the MCP authorization spec says an insufficient-scope failure should return `403` with a `WWW-Authenticate: Bearer error="insufficient_scope"` challenge — distinct from the `401` we saw for an audience mismatch.)

---

## What's next

- Consider a distinct audience value per API/resource instead of a single shared `gateway`, so each backend only accepts tokens scoped to it.
- Add a server-level `Authorize` scope check now, and aim for **per-tool scopes** so each tool enforces only the permission it needs.
