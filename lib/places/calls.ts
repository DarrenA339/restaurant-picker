export type CallKind = "autocomplete" | "search" | "nearby" | "details" | "photo";

const ORDER: CallKind[] = ["autocomplete", "search", "nearby", "details", "photo"];

/**
 * Counts the Google calls one request makes, so every Places route can log
 * its cost. One instance per request: a module-level counter would mix
 * concurrent requests on the same server.
 */
export class CallLog {
  private counts = new Map<CallKind, number>();

  count(kind: CallKind) {
    this.counts.set(kind, (this.counts.get(kind) ?? 0) + 1);
  }

  get total(): number {
    let total = 0;
    for (const n of this.counts.values()) total += n;
    return total;
  }

  /** "0 Google calls", "1 Google call (details 1)", "2 Google calls (details 1, photo 1)". */
  summary(): string {
    const total = this.total;
    if (total === 0) return "0 Google calls";
    const parts = ORDER.filter((kind) => this.counts.has(kind)).map(
      (kind) => `${kind} ${this.counts.get(kind)}`,
    );
    return `${total} Google call${total === 1 ? "" : "s"} (${parts.join(", ")})`;
  }

  log(label: string) {
    console.info(`[places] ${label}: ${this.summary()}`);
  }
}
