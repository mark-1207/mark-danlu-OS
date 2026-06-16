import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerCreateCommand } from '../../../src/cli/commands/create.js';

// ─── create command --short flag ─────────────────────────────────

describe('create command --short flag', () => {
  it('T1: create command is registered', () => {
    const program = new Command();
    registerCreateCommand(program);
    const createCmd = program.commands.find((c) => c.name() === 'create');
    expect(createCmd).toBeDefined();
  });

  it('T2: --short option is registered on create command', () => {
    const program = new Command();
    registerCreateCommand(program);
    const createCmd = program.commands.find((c) => c.name() === 'create');
    const shortOpt = createCmd?.options.find((o) => o.long === '--short');
    expect(shortOpt).toBeDefined();
  });

  it('T3: --short option is a boolean flag (no required argument)', () => {
    const program = new Command();
    registerCreateCommand(program);
    const createCmd = program.commands.find((c) => c.name() === 'create');
    const shortOpt = createCmd?.options.find((o) => o.long === '--short');
    expect(shortOpt?.isBoolean?.()).toBe(true);
  });
});
