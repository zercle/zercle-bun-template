export interface Checker {
  name: string;
  check(): Promise<void>;
}

export const HealthRegistryKey = Symbol("HealthRegistry");

export class HealthRegistry {
  private readonly liveness: Checker[] = [];
  private readonly readiness: Checker[] = [];

  addLiveness(c: Checker): void {
    this.liveness.push(c);
  }

  addReadiness(c: Checker): void {
    this.readiness.push(c);
  }

  live(): Promise<void> {
    return runCheckers(this.liveness);
  }

  ready(): Promise<void> {
    return runCheckers(this.readiness);
  }
}

async function runCheckers(checkers: readonly Checker[]): Promise<void> {
  if (checkers.length === 0) {
    return;
  }
  const results = await Promise.allSettled(checkers.map((c) => c.check()));
  const failures: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const checker = checkers[i];
    if (!r || !checker) continue;
    if (r.status === "rejected") {
      const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
      failures.push(`${checker.name}: ${reason}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}
