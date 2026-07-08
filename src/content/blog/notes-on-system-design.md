---
title: 'A few notes on system design'
description: 'Some principles I keep coming back to when designing systems that need to survive contact with production.'
pubDate: 2026-06-28
tags: ['system-design', 'engineering']
draft: true
---

I've designed and rebuilt enough systems to notice the ideas that keep proving
themselves. None of these are novel — but they're the ones I reach for first.

## Design for failure, not for the happy path

Every network call fails eventually. Every dependency has an outage. The
question isn't *whether* something breaks, but what happens when it does. Good
systems degrade gracefully; fragile ones cascade.

## Make the boring choice

Novel technology is a liability until proven otherwise. A boring, well-understood
database will outlast three generations of the exciting one. Spend your
innovation budget where it actually differentiates you.

## Latency is a feature

Users feel milliseconds. A system that's correct but slow loses to one that's
correct and fast. Cache aggressively, precompute what you can, and measure the
tail — the p99 is where users live.

## Simplicity compounds

Every abstraction has a carrying cost. The simplest design that solves the
problem is almost always the right one, because it's the one you'll still
understand in six months.

More detailed write-ups on each of these are coming. This is the outline I keep
on the wall.
