export const demoQuestions = [
  { id: "hours", title: "Opening hours", question: "What time do you open?", paraphrases: ["What are your opening hours?", "When is the bakery open?"], answer: "Sweet Crumbs Bakery is open Monday to Saturday, 10:00 AM to 6:00 PM. We are closed on Sundays.", input: 520, output: 38, cost: 0.003337 },
  { id: "cakes", title: "Cake prices", question: "What cakes do you sell?", paraphrases: ["Which cakes are available?", "Can you show me your cake menu?"], answer: "Our demo menu includes Vanilla Cloud Cake (RM55), Midnight Chocolate Cake (RM70), and Red Velvet Cake (RM75). Sizes and availability should be confirmed with the bakery.", input: 535, output: 55, cost: 0.003807 },
  { id: "pickup", title: "Pickup", question: "Can I pick up my cake?", paraphrases: ["Do you offer cake pickup?", "Can I collect my cake from the bakery?"], answer: "Yes, pickup is available at Sweet Crumbs Bakery during opening hours: Monday to Saturday, 10:00 AM to 6:00 PM. Please confirm your pickup arrangements with the bakery.", input: 528, output: 49, cost: 0.0036281 },
  { id: "delivery", title: "Delivery", question: "Do you offer delivery?", paraphrases: ["Can you deliver my cake?", "Is cake delivery available?"], answer: "Delivery is available within our illustrative service area. Please contact Sweet Crumbs Bakery to confirm your location, delivery fee, and arrangements. This demo does not place real orders.", input: 532, output: 51, cost: 0.0036939 },
  { id: "chocolate", title: "Chocolate cake", question: "How much is the chocolate cake?", paraphrases: ["What is the price of Midnight Chocolate Cake?", "How much does your chocolate cake cost?"], answer: "Midnight Chocolate Cake is RM70 on our demo menu. Please confirm sizes and availability with Sweet Crumbs Bakery before arranging an order.", input: 525, output: 42, cost: 0.0034545 },
] as const;

const answerVariants: Record<string, string[]> = {
  hours: ["You can visit Sweet Crumbs Bakery from 10:00 AM until 6:00 PM, Monday through Saturday. The bakery is closed on Sunday.", "Our opening hours are 10:00 AM–6:00 PM every Monday to Saturday. We do not open on Sundays."],
  cakes: ["The demo cake menu has Vanilla Cloud Cake for RM55, Midnight Chocolate Cake for RM70, and Red Velvet Cake for RM75. Please check sizes and availability with the bakery.", "We have three cakes on the demo menu: Vanilla Cloud (RM55), Midnight Chocolate (RM70), and Red Velvet (RM75). Contact the bakery to confirm available sizes and stock."],
  pickup: ["Absolutely! You can collect your cake during our Monday–Saturday opening hours, 10:00 AM–6:00 PM. Please arrange the pickup details directly with Sweet Crumbs Bakery.", "Cake pickup is available at the bakery. We are open Monday to Saturday from 10:00 AM to 6:00 PM; confirm your collection arrangements with us beforehand."],
  delivery: ["Yes, we offer delivery within our illustrative service area. Contact Sweet Crumbs Bakery to check coverage for your location and confirm the fee and arrangements. No real orders are placed through this demo.", "Cake delivery is available in the illustrative service area. The bakery can confirm your address coverage, delivery charges, and arrangements directly. This demo cannot submit real orders."],
  chocolate: ["The demo price for Midnight Chocolate Cake is RM70. Get in touch with Sweet Crumbs Bakery to check sizes and availability before arranging an order.", "Our Midnight Chocolate Cake costs RM70 on the demo menu. Sizes and availability need to be confirmed with the bakery before you arrange an order."],
};

export type DemoReply = { answer: string; input: number; output: number; cost: number; mode: "generated" | "exact_hit" | "semantic_hit" };
export type DemoTurn = { question: string; topic: string; baseline: DemoReply; tokenguard: DemoReply; lookup_ms: number };
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
export function createDemoTurn(question: string, history: DemoTurn[], random = Math.random): DemoTurn | null {
  const started = performance.now();
  const normalized = normalize(question);
  const example = demoQuestions.find((item) => [item.question, ...item.paraphrases].some((text) => normalize(text) === normalized));
  if (!example) return null;
  const previous = history.filter((turn) => turn.topic === example.id);
  const mode = previous.length === 0 ? "generated" : previous.some((turn) => normalize(turn.question) === normalized) ? "exact_hit" : "semantic_hit";
  const lookup_ms = performance.now() - started;
  const factor = previous.length ? 1 + (previous.length % 2 ? 1 : -1) * (0.05 + random() * 0.05) : 1;
  const input = Math.round(example.input * factor);
  const output = Math.round(example.output * factor);
  const cost = (input + output * 5) / 1e6 * 4.7;
  const variants = [example.answer, ...answerVariants[example.id]];
  const baseline: DemoReply = { answer: variants[(previous.length + 1) % variants.length], input, output, cost, mode: "generated" };
  return { question: question.trim(), topic: example.id, baseline, lookup_ms, tokenguard: mode === "generated" ? { ...baseline, answer: example.answer } : { answer: previous[0].tokenguard.answer, input: 0, output: 0, cost: 0, mode } };
}
export function demoTotals(history: DemoTurn[], arm: "baseline" | "tokenguard") {
  return history.reduce((total, turn) => ({ input: total.input + turn[arm].input, output: total.output + turn[arm].output, cost: total.cost + turn[arm].cost, hits: total.hits + Number(turn[arm].mode !== "generated") }), { input: 0, output: 0, cost: 0, hits: 0 });
}
