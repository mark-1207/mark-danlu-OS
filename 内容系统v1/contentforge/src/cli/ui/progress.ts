/**
 * Simple progress display: step name + status + optional sub-text.
 */
export class ProgressDisplay {
  private currentStep = '';

  startStep(name: string, description?: string): void {
    this.currentStep = name;
    const label = description ? `${name} — ${description}` : name;
    console.log(`\n▶ ${label}`);
  }

  completeStep(name: string, durationMs: number, extra?: string): void {
    const duration = durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`;
    const extraStr = extra ? ` | ${extra}` : '';
    console.log(`  ✓ ${name} (${duration})${extraStr}`);
    this.currentStep = '';
  }

  failStep(name: string, error: string): void {
    console.log(`  ✗ ${name} — ${error}`);
    this.currentStep = '';
  }

  info(message: string): void {
    console.log(`  ℹ ${message}`);
  }
}
