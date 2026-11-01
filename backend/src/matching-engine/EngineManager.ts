import { MatchingEngine, matchingEngine } from './MatchingEngine.js';
import { InstrumentRegistry } from '../services/InstrumentRegistry.js';
import { logger } from '../utils/logger.js';

export class EngineManager {
  private static instance: EngineManager;
  private engines: Map<string, MatchingEngine> = new Map();

  private constructor() {
    this.initializeEngines();
  }

  public static getInstance(): EngineManager {
    if (!EngineManager.instance) {
      const gState = globalThis as any;
      if (!gState.__engineManager__) {
        gState.__engineManager__ = new EngineManager();
      }
      EngineManager.instance = gState.__engineManager__;
    }
    return EngineManager.instance;
  }

  /**
   * Initializes MatchingEngine instances for all instruments configured in the InstrumentRegistry.
   */
  private initializeEngines(): void {
    const instruments = InstrumentRegistry.getAllInstruments();
    for (const inst of instruments) {
      if (!this.engines.has(inst.symbol)) {
        if (inst.symbol === 'BYTE-USD') {
          this.engines.set(inst.symbol, matchingEngine);
        } else {
          this.engines.set(inst.symbol, new MatchingEngine(inst.symbol));
        }
      }
    }
    logger.info(`EngineManager initialized ${this.engines.size} independent matching engines.`);
  }

  /**
   * Retrieves the canonical MatchingEngine instance for a given symbol.
   * Resolves legacy aliases (e.g. 'BYTE' -> 'BYTE-USD') so they share the exact same engine.
   */
  public getEngine(symbol?: string): MatchingEngine {
    const raw = symbol || 'BYTE-USD';
    const canonical = InstrumentRegistry.getCanonicalSymbol(raw);

    let engine = this.engines.get(canonical);
    if (!engine) {
      logger.info(`Creating new MatchingEngine on-demand for canonical symbol: ${canonical}`);
      engine = new MatchingEngine(canonical);
      this.engines.set(canonical, engine);
    }

    return engine;
  }

  /**
   * Checks if an engine exists for the given symbol (resolving canonical symbol first).
   */
  public hasEngine(symbol: string): boolean {
    const canonical = InstrumentRegistry.getCanonicalSymbol(symbol);
    return this.engines.has(canonical);
  }


  /**
   * Returns list of all active canonical symbols with engines.
   */
  public getSymbols(): string[] {
    return Array.from(this.engines.keys());
  }

  /**
   * Hydrates all engines from the persistent database.
   */
  public hydrateAll(): void {
    for (const [symbol, engine] of this.engines.entries()) {
      engine.hydrateFromDatabase();
    }
  }

  /**
   * Resets all in-memory order books. Useful for testing environments.
   */
  public resetAll(): void {
    for (const [symbol, engine] of this.engines.entries()) {
      engine.reset();
    }
  }
}

export const engineManager = EngineManager.getInstance();
