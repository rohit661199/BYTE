import { MathPrecision } from '../utils/MathPrecision.js';

export type AssetClass = 'EQUITY' | 'CRYPTO' | 'UTILITY';
export type ExchangeVenue = 'NASDAQ' | 'NYSE' | 'CRYPTO_SIM' | 'BYTE_SIM';
export type MarketSessionType = 'US_EQUITY' | 'CRYPTO_24_7';

export interface CompanyFundamentals {
  ceo: string;
  headquarters: string;
  founded: number;
  marketCap: string; // e.g. "$3.48T" (Temporary fixture)
  peRatio: number; // e.g. 34.2 (Temporary fixture)
  dividendYield: number; // e.g. 0.52% (Temporary fixture)
  week52High: number;
  week52Low: number;
  sector: string;
  industry: string;
  about: string;
  _isFixture: true;
}

export interface Instrument {
  symbol: string; // Canonical symbol
  aliases: string[]; // Legacy or shorthand aliases
  name: string;
  assetClass: AssetClass;
  venue: ExchangeVenue;
  sessionType: MarketSessionType;
  currency: string;
  tickSize: number;
  tickSizeBasis: bigint;
  minOrderQuantity: number;
  minOrderQuantityMicro: bigint;
  quantityStep: number;
  quantityStepMicro: bigint;
  fractionalAllowed: boolean;
  baselinePrice: number; // Temporary baseline reference price fixture
  baselinePriceBasis: bigint;
  fundamentals?: CompanyFundamentals;
}

/**
 * Normalizes input symbol to its canonical form.
 * Ensures legacy symbols (e.g. 'BYTE') transparently resolve to canonical ('BYTE-USD').
 */
export function normalizeSymbol(input: string): string {
  if (!input) return 'BYTE-USD';
  const clean = input.trim().toUpperCase();
  if (clean === 'BYTE') return 'BYTE-USD';
  if (clean === 'BTC') return 'BTC-USD';
  if (clean === 'ETH') return 'ETH-USD';
  if (clean === 'SOL') return 'SOL-USD';
  return clean;
}

/**
 * Static registry of supported instruments.
 * Baseline reference prices and company fundamentals are development fixtures until Phase 03 verified feeds.
 */
const LAUNCH_INSTRUMENTS: Instrument[] = [
  // --- EQUITIES (NASDAQ / US Session) ---
  {
    symbol: 'AAPL',
    aliases: [],
    name: 'Apple Inc',
    assetClass: 'EQUITY',
    venue: 'NASDAQ',
    sessionType: 'US_EQUITY',
    currency: 'USD',
    tickSize: 0.01,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.01'),
    minOrderQuantity: 0.001,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('0.001'),
    quantityStep: 0.001,
    quantityStepMicro: MathPrecision.parseQtyToMicro('0.001'),
    fractionalAllowed: true,
    baselinePrice: 228.1,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('228.10'),
    fundamentals: {
      ceo: 'Tim Cook',
      headquarters: 'Cupertino, California',
      founded: 1976,
      marketCap: '$3.48T',
      peRatio: 34.2,
      dividendYield: 0.52,
      week52High: 237.23,
      week52Low: 164.08,
      sector: 'Technology',
      industry: 'Consumer Electronics',
      about: 'Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories.',
      _isFixture: true,
    },
  },
  {
    symbol: 'MSFT',
    aliases: [],
    name: 'Microsoft Corp',
    assetClass: 'EQUITY',
    venue: 'NASDAQ',
    sessionType: 'US_EQUITY',
    currency: 'USD',
    tickSize: 0.01,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.01'),
    minOrderQuantity: 0.001,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('0.001'),
    quantityStep: 0.001,
    quantityStepMicro: MathPrecision.parseQtyToMicro('0.001'),
    fractionalAllowed: true,
    baselinePrice: 416.2,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('416.20'),
    fundamentals: {
      ceo: 'Satya Nadella',
      headquarters: 'Redmond, Washington',
      founded: 1975,
      marketCap: '$3.09T',
      peRatio: 35.8,
      dividendYield: 0.72,
      week52High: 468.35,
      week52Low: 366.5,
      sector: 'Technology',
      industry: 'Software - Infrastructure',
      about: 'Microsoft Corporation develops and supports software, services, devices and solutions including Azure cloud and Microsoft 365.',
      _isFixture: true,
    },
  },
  {
    symbol: 'NVDA',
    aliases: [],
    name: 'NVIDIA Corp',
    assetClass: 'EQUITY',
    venue: 'NASDAQ',
    sessionType: 'US_EQUITY',
    currency: 'USD',
    tickSize: 0.01,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.01'),
    minOrderQuantity: 0.001,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('0.001'),
    quantityStep: 0.001,
    quantityStepMicro: MathPrecision.parseQtyToMicro('0.001'),
    fractionalAllowed: true,
    baselinePrice: 135.5,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('135.50'),
    fundamentals: {
      ceo: 'Jensen Huang',
      headquarters: 'Santa Clara, California',
      founded: 1993,
      marketCap: '$3.32T',
      peRatio: 64.5,
      dividendYield: 0.03,
      week52High: 144.42,
      week52Low: 39.23,
      sector: 'Technology',
      industry: 'Semiconductors',
      about: 'NVIDIA Corporation provides graphics, compute, and networking solutions powering accelerated computing and generative AI.',
      _isFixture: true,
    },
  },
  {
    symbol: 'TSLA',
    aliases: [],
    name: 'Tesla Inc',
    assetClass: 'EQUITY',
    venue: 'NASDAQ',
    sessionType: 'US_EQUITY',
    currency: 'USD',
    tickSize: 0.01,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.01'),
    minOrderQuantity: 0.001,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('0.001'),
    quantityStep: 0.001,
    quantityStepMicro: MathPrecision.parseQtyToMicro('0.001'),
    fractionalAllowed: true,
    baselinePrice: 260.8,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('260.80'),
    fundamentals: {
      ceo: 'Elon Musk',
      headquarters: 'Austin, Texas',
      founded: 2003,
      marketCap: '$832.4B',
      peRatio: 72.1,
      dividendYield: 0.0,
      week52High: 271.0,
      week52Low: 138.8,
      sector: 'Consumer Cyclical',
      industry: 'Auto Manufacturers',
      about: 'Tesla, Inc. designs, develops, manufactures, sells, and leases electric vehicles, energy generation and storage systems.',
      _isFixture: true,
    },
  },
  {
    symbol: 'AMZN',
    aliases: [],
    name: 'Amazon.com Inc',
    assetClass: 'EQUITY',
    venue: 'NASDAQ',
    sessionType: 'US_EQUITY',
    currency: 'USD',
    tickSize: 0.01,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.01'),
    minOrderQuantity: 0.001,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('0.001'),
    quantityStep: 0.001,
    quantityStepMicro: MathPrecision.parseQtyToMicro('0.001'),
    fractionalAllowed: true,
    baselinePrice: 186.4,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('186.40'),
    fundamentals: {
      ceo: 'Andy Jassy',
      headquarters: 'Seattle, Washington',
      founded: 1994,
      marketCap: '$1.94T',
      peRatio: 43.8,
      dividendYield: 0.0,
      week52High: 201.2,
      week52Low: 118.35,
      sector: 'Consumer Cyclical',
      industry: 'Internet Retail',
      about: 'Amazon.com, Inc. focuses on retail, cloud computing, online advertising, digital streaming, and artificial intelligence.',
      _isFixture: true,
    },
  },

  // --- CRYPTO (BYTE / 24/7/365) ---
  {
    symbol: 'BTC-USD',
    aliases: ['BTC'],
    name: 'Bitcoin',
    assetClass: 'CRYPTO',
    venue: 'CRYPTO_SIM',
    sessionType: 'CRYPTO_24_7',
    currency: 'USD',
    tickSize: 0.5,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.50'),
    minOrderQuantity: 0.0001,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('0.0001'),
    quantityStep: 0.0001,
    quantityStepMicro: MathPrecision.parseQtyToMicro('0.0001'),
    fractionalAllowed: true,
    baselinePrice: 88532.41,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('88532.41'),
  },
  {
    symbol: 'ETH-USD',
    aliases: ['ETH'],
    name: 'Ethereum',
    assetClass: 'CRYPTO',
    venue: 'CRYPTO_SIM',
    sessionType: 'CRYPTO_24_7',
    currency: 'USD',
    tickSize: 0.1,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.10'),
    minOrderQuantity: 0.001,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('0.001'),
    quantityStep: 0.001,
    quantityStepMicro: MathPrecision.parseQtyToMicro('0.001'),
    fractionalAllowed: true,
    baselinePrice: 3240.5,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('3240.50'),
  },
  {
    symbol: 'SOL-USD',
    aliases: ['SOL'],
    name: 'Solana',
    assetClass: 'CRYPTO',
    venue: 'CRYPTO_SIM',
    sessionType: 'CRYPTO_24_7',
    currency: 'USD',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 0.01,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('0.01'),
    quantityStep: 0.01,
    quantityStepMicro: MathPrecision.parseQtyToMicro('0.01'),
    fractionalAllowed: true,
    baselinePrice: 184.2,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('184.20'),
  },

  // --- UTILITY (BYTE FIFO Engine / 24/7/365) ---
  {
    symbol: 'BYTE-USD',
    aliases: ['BYTE'],
    name: 'BYTE Token',
    assetClass: 'UTILITY',
    venue: 'BYTE_SIM',
    sessionType: 'CRYPTO_24_7',
    currency: 'USD',
    tickSize: 0.01,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.01'),
    minOrderQuantity: 1.0,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1.0'),
    quantityStep: 1.0,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1.0'),
    fractionalAllowed: false,
    baselinePrice: 100.0,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('100.00'),
  },
];

export class InstrumentRegistry {
  private static readonly instrumentsMap = new Map<string, Instrument>();
  private static readonly aliasMap = new Map<string, string>();

  static {
    for (const inst of LAUNCH_INSTRUMENTS) {
      this.instrumentsMap.set(inst.symbol, inst);
      // Map canonical symbol to itself
      this.aliasMap.set(inst.symbol, inst.symbol);
      // Map all aliases
      for (const alias of inst.aliases) {
        this.aliasMap.set(alias.toUpperCase(), inst.symbol);
      }
    }
  }

  /**
   * Resolves canonical symbol from any input (canonical or alias).
   */
  public static getCanonicalSymbol(input: string): string {
    const normalized = normalizeSymbol(input);
    return this.aliasMap.get(normalized) || normalized;
  }

  /**
   * Retrieves an instrument by its canonical symbol or registered alias.
   */
  public static getInstrument(symbolOrAlias: string): Instrument | null {
    const canonical = this.getCanonicalSymbol(symbolOrAlias);
    return this.instrumentsMap.get(canonical) || null;
  }

  /**
   * Returns all supported instruments.
   */
  public static getAllInstruments(): Instrument[] {
    return Array.from(this.instrumentsMap.values());
  }

  /**
   * Returns instruments filtered by asset class.
   */
  public static getInstrumentsByAssetClass(assetClass: AssetClass): Instrument[] {
    return this.getAllInstruments().filter((inst) => inst.assetClass === assetClass);
  }

  /**
   * Checks if an instrument is supported and tradable.
   */
  public static isSymbolTradable(symbolOrAlias: string): boolean {
    const canonical = this.getCanonicalSymbol(symbolOrAlias);
    return this.instrumentsMap.has(canonical);
  }

  /**
   * Checks if a symbol string is a legacy alias (e.g. 'BYTE').
   */
  public static isLegacyAlias(symbol: string): boolean {
    const upper = symbol.trim().toUpperCase();
    const inst = this.getInstrument(upper);
    return inst !== null && inst.symbol !== upper;
  }
}
