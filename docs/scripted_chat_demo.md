# Scripted BakeryBot comparison

Open `/demo/chat`. This browser-only demo uses fixed answers, token counts and costs.
It makes no backend/provider calls and needs no API key. Each topic starts cold.
Send the original question twice, then either listed paraphrase: both sides consume
the same simulated tokens first; TokenGuard then shows an exact hit followed by a
semantic hit with zero input/output tokens and zero cost. The baseline consumes
generation tokens on every request; subsequent generation estimates vary 5-10% around the initial count (rounded to whole tokens). The baseline cycles through three similar phrasings per topic; TokenGuard always reuses its first answer. Reset/reload clears the cache.
Matching only recognizes these predefined variants (case/whitespace insensitive).
Unsupported questions show guidance without changing counters.

| Topic | Original question | Paraphrase 1 | Paraphrase 2 | Input / output | Cost per generation (MYR) |
|---|---|---|---|---|---|
| Hours | What time do you open? | What are your opening hours? | When is the bakery open? | 520 / 38 | 0.003337 |
| Cakes | What cakes do you sell? | Which cakes are available? | Can you show me your cake menu? | 535 / 55 | 0.003807 |
| Pickup | Can I pick up my cake? | Do you offer cake pickup? | Can I collect my cake from the bakery? | 528 / 49 | 0.0036281 |
| Delivery | Do you offer delivery? | Can you deliver my cake? | Is cake delivery available? | 532 / 51 | 0.0036939 |
| Chocolate | How much is the chocolate cake? | What is the price of Midnight Chocolate Cake? | How much does your chocolate cake cost? | 525 / 42 | 0.0034545 |

## Expected answers

**Hours:** Sweet Crumbs Bakery is open Monday to Saturday, 10:00 AM to 6:00 PM. We are closed on Sundays.

**Cakes:** Our demo menu includes Vanilla Cloud Cake (RM55), Midnight Chocolate Cake (RM70), and Red Velvet Cake (RM75). Sizes and availability should be confirmed with the bakery.

**Pickup:** Yes, pickup is available at Sweet Crumbs Bakery during opening hours: Monday to Saturday, 10:00 AM to 6:00 PM. Please confirm your pickup arrangements with the bakery.

**Delivery:** Delivery is available within our illustrative service area. Please contact Sweet Crumbs Bakery to confirm your location, delivery fee, and arrangements. This demo does not place real orders.

**Chocolate:** Midnight Chocolate Cake is RM70 on our demo menu. Please confirm sizes and availability with Sweet Crumbs Bakery before arranging an order.

## Three-message hours example

| Message | Without TokenGuard | With TokenGuard |
|---|---|---|
| What time do you open? | 520 input, 38 output, RM0.003337 | Same usage; simulated generation |
| What time do you open? | 520 input, 38 output, RM0.003337 | 0 input, 0 output, RM0; exact hit |
| What are your opening hours? | 520 input, 38 output, RM0.003337 | 0 input, 0 output, RM0; semantic hit |
| Cumulative | 1560 input, 114 output, RM0.010011 | 520 input, 38 output, RM0.003337 |

Simulated cost saved: RM0.006674. Fixed illustrative rates: $1 input / $5 output
per million tokens and RM4.70/USD. Tokens are not measured from answer text. The table shows initial values; repeated generations vary. Generation animation waits 2.8-3.2 seconds. Cache hits have no added delay and show measured browser lookup time only, not model/production latency.
No simulated traffic is written to the real usage ledger; backend caching and
owner approval remain separate. All bakery facts are fictional.

Run frontend only: `cd apps/web` then `npm run dev -- --port 3003`.
Browser verification: `node tests/scripted-chat.e2e.mjs` from `apps/web` (defaults
to port 3003; override `E2E_WEB_URL` for another port).
