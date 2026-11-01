import { MathPrecision } from '../utils/MathPrecision.js';

export type AssetClass = 'EQUITY' | 'CRYPTO' | 'UTILITY';
export type ExchangeVenue = 'NASDAQ' | 'NYSE' | 'NSE' | 'CRYPTO_SIM' | 'BYTE_SIM' | 'BINANCE';
export type MarketSessionType = 'US_EQUITY' | 'NSE_EQUITY' | 'CRYPTO_24_7';

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
  providerKey?: string; // Provider-specific key, e.g. 'NSE_EQ|INE002A01018'
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
  if (clean.endsWith('.NS') || clean.endsWith('.NSE')) {
    return clean.replace(/\.(NS|NSE)$/, '');
  }
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

  // --- INDIAN EQUITIES (NSE / Asia/Kolkata Session) ---
  {
    symbol: 'RELIANCE',
    aliases: ['RELIANCE.NS', 'RELIANCE.NSE'],
    name: 'Reliance Industries Ltd',
    assetClass: 'EQUITY',
    venue: 'NSE',
    sessionType: 'NSE_EQUITY',
    currency: 'INR',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 1,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1'),
    quantityStep: 1,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1'),
    fractionalAllowed: false,
    baselinePrice: 2985.50,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('2985.50'),
    providerKey: 'NSE_EQ|INE002A01018',
    fundamentals: {
      ceo: 'Mukesh Ambani',
      headquarters: 'Mumbai, Maharashtra',
      founded: 1957,
      marketCap: '₹20.20T',
      peRatio: 28.4,
      dividendYield: 0.35,
      week52High: 3217.90,
      week52Low: 2220.30,
      sector: 'Energy & Conglomerate',
      industry: 'Oil, Retail & Telecom',
      about: 'Reliance Industries is India’s largest private enterprise with businesses spanning petrochemicals, refining, retail, and telecommunications (Jio).',
      _isFixture: true,
    },
  },
  {
    symbol: 'TCS',
    aliases: ['TCS.NS', 'TCS.NSE'],
    name: 'Tata Consultancy Services Ltd',
    assetClass: 'EQUITY',
    venue: 'NSE',
    sessionType: 'NSE_EQUITY',
    currency: 'INR',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 1,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1'),
    quantityStep: 1,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1'),
    fractionalAllowed: false,
    baselinePrice: 4120.00,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('4120.00'),
    providerKey: 'NSE_EQ|INE467B01029',
    fundamentals: {
      ceo: 'K. Krithivasan',
      headquarters: 'Mumbai, Maharashtra',
      founded: 1968,
      marketCap: '₹14.90T',
      peRatio: 30.1,
      dividendYield: 1.15,
      week52High: 4585.90,
      week52Low: 3313.00,
      sector: 'Technology',
      industry: 'IT Services & Consulting',
      about: 'Tata Consultancy Services is a leading Indian multinational IT services, consulting, and business solutions organization.',
      _isFixture: true,
    },
  },
  {
    symbol: 'HDFCBANK',
    aliases: ['HDFCBANK.NS', 'HDFCBANK.NSE'],
    name: 'HDFC Bank Ltd',
    assetClass: 'EQUITY',
    venue: 'NSE',
    sessionType: 'NSE_EQUITY',
    currency: 'INR',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 1,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1'),
    quantityStep: 1,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1'),
    fractionalAllowed: false,
    baselinePrice: 1680.00,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('1680.00'),
    providerKey: 'NSE_EQ|INE040A01034',
    fundamentals: {
      ceo: 'Sashidhar Jagdishan',
      headquarters: 'Mumbai, Maharashtra',
      founded: 1994,
      marketCap: '₹12.80T',
      peRatio: 19.5,
      dividendYield: 1.16,
      week52High: 1794.00,
      week52Low: 1363.55,
      sector: 'Financial Services',
      industry: 'Private Banking',
      about: 'HDFC Bank is India’s largest private sector bank by assets and market capitalization.',
      _isFixture: true,
    },
  },
  {
    symbol: 'INFY',
    aliases: ['INFY.NS', 'INFY.NSE'],
    name: 'Infosys Ltd',
    assetClass: 'EQUITY',
    venue: 'NSE',
    sessionType: 'NSE_EQUITY',
    currency: 'INR',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 1,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1'),
    quantityStep: 1,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1'),
    fractionalAllowed: false,
    baselinePrice: 1850.00,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('1850.00'),
    providerKey: 'NSE_EQ|INE009A01021',
    fundamentals: {
      ceo: 'Salil Parekh',
      headquarters: 'Bengaluru, Karnataka',
      founded: 1981,
      marketCap: '₹7.68T',
      peRatio: 29.8,
      dividendYield: 2.10,
      week52High: 1991.45,
      week52Low: 1358.35,
      sector: 'Technology',
      industry: 'IT Consulting & Software',
      about: 'Infosys is a global leader in next-generation digital services and consulting.',
      _isFixture: true,
    },
  },
  {
    symbol: 'ICICIBANK',
    aliases: ['ICICIBANK.NS', 'ICICIBANK.NSE'],
    name: 'ICICI Bank Ltd',
    assetClass: 'EQUITY',
    venue: 'NSE',
    sessionType: 'NSE_EQUITY',
    currency: 'INR',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 1,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1'),
    quantityStep: 1,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1'),
    fractionalAllowed: false,
    baselinePrice: 1240.00,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('1240.00'),
    providerKey: 'NSE_EQ|INE090A01021',
    fundamentals: {
      ceo: 'Sandeep Bakhshi',
      headquarters: 'Mumbai, Maharashtra',
      founded: 1994,
      marketCap: '₹8.72T',
      peRatio: 18.2,
      dividendYield: 0.81,
      week52High: 1362.40,
      week52Low: 914.00,
      sector: 'Financial Services',
      industry: 'Private Banking',
      about: 'ICICI Bank is a leading Indian private sector bank offering diversified banking and financial products.',
      _isFixture: true,
    },
  },
  {
    symbol: 'SBIN',
    aliases: ['SBIN.NS', 'SBIN.NSE'],
    name: 'State Bank of India',
    assetClass: 'EQUITY',
    venue: 'NSE',
    sessionType: 'NSE_EQUITY',
    currency: 'INR',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 1,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1'),
    quantityStep: 1,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1'),
    fractionalAllowed: false,
    baselinePrice: 825.00,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('825.00'),
    providerKey: 'NSE_EQ|INE062A01020',
    fundamentals: {
      ceo: 'Challa Sreenivasulu Setty',
      headquarters: 'Mumbai, Maharashtra',
      founded: 1955,
      marketCap: '₹7.36T',
      peRatio: 10.9,
      dividendYield: 1.66,
      week52High: 912.10,
      week52Low: 543.20,
      sector: 'Financial Services',
      industry: 'Public Banking',
      about: 'State Bank of India is a Fortune 500 Indian multinational public sector banking and financial services institution.',
      _isFixture: true,
    },
  },
  {
    symbol: 'BHARTIARTL',
    aliases: ['BHARTIARTL.NS', 'BHARTIARTL.NSE'],
    name: 'Bharti Airtel Ltd',
    assetClass: 'EQUITY',
    venue: 'NSE',
    sessionType: 'NSE_EQUITY',
    currency: 'INR',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 1,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1'),
    quantityStep: 1,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1'),
    fractionalAllowed: false,
    baselinePrice: 1650.00,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('1650.00'),
    providerKey: 'NSE_EQ|INE397D01024',
    fundamentals: {
      ceo: 'Gopal Vittal',
      headquarters: 'New Delhi',
      founded: 1995,
      marketCap: '₹9.40T',
      peRatio: 72.4,
      dividendYield: 0.48,
      week52High: 1779.00,
      week52Low: 911.30,
      sector: 'Telecommunication',
      industry: 'Wireless & Broadband Services',
      about: 'Bharti Airtel is a leading global telecommunications company operating across 18 countries.',
      _isFixture: true,
    },
  },
  {
    symbol: 'ITC',
    aliases: ['ITC.NS', 'ITC.NSE'],
    name: 'ITC Ltd',
    assetClass: 'EQUITY',
    venue: 'NSE',
    sessionType: 'NSE_EQUITY',
    currency: 'INR',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 1,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1'),
    quantityStep: 1,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1'),
    fractionalAllowed: false,
    baselinePrice: 490.00,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('490.00'),
    providerKey: 'NSE_EQ|INE154A01025',
    fundamentals: {
      ceo: 'Sanjiv Puri',
      headquarters: 'Kolkata, West Bengal',
      founded: 1910,
      marketCap: '₹6.12T',
      peRatio: 29.4,
      dividendYield: 2.80,
      week52High: 528.55,
      week52Low: 399.30,
      sector: 'Consumer Goods',
      industry: 'FMCG, Hotels & Paperboards',
      about: 'ITC is one of India’s foremost multi-business private sector companies with diversified presence in FMCG, hotels, and paperboards.',
      _isFixture: true,
    },
  },
  {
    symbol: 'LT',
    aliases: ['LT.NS', 'LT.NSE'],
    name: 'Larsen & Toubro Ltd',
    assetClass: 'EQUITY',
    venue: 'NSE',
    sessionType: 'NSE_EQUITY',
    currency: 'INR',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 1,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1'),
    quantityStep: 1,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1'),
    fractionalAllowed: false,
    baselinePrice: 3620.00,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('3620.00'),
    providerKey: 'NSE_EQ|INE018A01030',
    fundamentals: {
      ceo: 'S. N. Subrahmanyan',
      headquarters: 'Mumbai, Maharashtra',
      founded: 1938,
      marketCap: '₹4.98T',
      peRatio: 36.8,
      dividendYield: 0.94,
      week52High: 3948.60,
      week52Low: 2872.00,
      sector: 'Industrials',
      industry: 'Engineering & Construction',
      about: 'Larsen & Toubro is an Indian multinational conglomerate engaged in EPC projects, manufacturing, and tech services.',
      _isFixture: true,
    },
  },
  {
    symbol: 'WIPRO',
    aliases: ['WIPRO.NS', 'WIPRO.NSE'],
    name: 'Wipro Ltd',
    assetClass: 'EQUITY',
    venue: 'NSE',
    sessionType: 'NSE_EQUITY',
    currency: 'INR',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 1,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1'),
    quantityStep: 1,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1'),
    fractionalAllowed: false,
    baselinePrice: 560.00,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('560.00'),
    providerKey: 'NSE_EQ|INE075A01022',
    fundamentals: {
      ceo: 'Srini Pallia',
      headquarters: 'Bengaluru, Karnataka',
      founded: 1945,
      marketCap: '₹2.93T',
      peRatio: 25.4,
      dividendYield: 0.18,
      week52High: 580.00,
      week52Low: 375.05,
      sector: 'Technology',
      industry: 'IT Services & Consulting',
      about: 'Wipro is a prominent global information technology, consulting, and business process services company.',
      _isFixture: true,
    },
  },
  {
    symbol: 'AXISBANK',
    aliases: ['AXISBANK.NS', 'AXISBANK.NSE'],
    name: 'Axis Bank Ltd',
    assetClass: 'EQUITY',
    venue: 'NSE',
    sessionType: 'NSE_EQUITY',
    currency: 'INR',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 1,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1'),
    quantityStep: 1,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1'),
    fractionalAllowed: false,
    baselinePrice: 1190.00,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('1190.00'),
    providerKey: 'NSE_EQ|INE238A01034',
    fundamentals: {
      ceo: 'Amitabh Chaudhry',
      headquarters: 'Mumbai, Maharashtra',
      founded: 1993,
      marketCap: '₹3.68T',
      peRatio: 14.1,
      dividendYield: 0.08,
      week52High: 1339.65,
      week52Low: 933.50,
      sector: 'Financial Services',
      industry: 'Private Banking',
      about: 'Axis Bank is the third largest private sector bank in India offering comprehensive financial solutions to large corporations and retail clients.',
      _isFixture: true,
    },
  },
  {
    symbol: 'BAJFINANCE',
    aliases: ['BAJFINANCE.NS', 'BAJFINANCE.NSE'],
    name: 'Bajaj Finance Ltd',
    assetClass: 'EQUITY',
    venue: 'NSE',
    sessionType: 'NSE_EQUITY',
    currency: 'INR',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 1,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1'),
    quantityStep: 1,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1'),
    fractionalAllowed: false,
    baselinePrice: 7150.00,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('7150.00'),
    providerKey: 'NSE_EQ|INE296A01024',
    fundamentals: {
      ceo: 'Rajeev Jain',
      headquarters: 'Pune, Maharashtra',
      founded: 1987,
      marketCap: '₹4.42T',
      peRatio: 30.6,
      dividendYield: 0.50,
      week52High: 8192.00,
      week52Low: 6187.80,
      sector: 'Financial Services',
      industry: 'Non-Banking Financial Company (NBFC)',
      about: 'Bajaj Finance is one of India’s leading and diversified non-banking financial companies, catering to over 80 million customers.',
      _isFixture: true,
    },
  },
  {
    symbol: 'MARUTI',
    aliases: ['MARUTI.NS', 'MARUTI.NSE'],
    name: 'Maruti Suzuki India Ltd',
    assetClass: 'EQUITY',
    venue: 'NSE',
    sessionType: 'NSE_EQUITY',
    currency: 'INR',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 1,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1'),
    quantityStep: 1,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1'),
    fractionalAllowed: false,
    baselinePrice: 12450.00,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('12450.00'),
    providerKey: 'NSE_EQ|INE585B01010',
    fundamentals: {
      ceo: 'Hisashi Takeuchi',
      headquarters: 'New Delhi',
      founded: 1981,
      marketCap: '₹3.91T',
      peRatio: 27.5,
      dividendYield: 1.00,
      week52High: 13680.00,
      week52Low: 9675.00,
      sector: 'Consumer Discretionary',
      industry: 'Automotive Manufacturing',
      about: 'Maruti Suzuki is India’s largest passenger car maker, holding the leading market share in automobiles.',
      _isFixture: true,
    },
  },
  {
    symbol: 'HINDUNILVR',
    aliases: ['HINDUNILVR.NS', 'HINDUNILVR.NSE'],
    name: 'Hindustan Unilever Ltd',
    assetClass: 'EQUITY',
    venue: 'NSE',
    sessionType: 'NSE_EQUITY',
    currency: 'INR',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 1,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1'),
    quantityStep: 1,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1'),
    fractionalAllowed: false,
    baselinePrice: 2480.00,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('2480.00'),
    providerKey: 'NSE_EQ|INE030A01027',
    fundamentals: {
      ceo: 'Rohit Jawa',
      headquarters: 'Mumbai, Maharashtra',
      founded: 1933,
      marketCap: '₹5.83T',
      peRatio: 57.2,
      dividendYield: 1.70,
      week52High: 3035.00,
      week52Low: 2172.05,
      sector: 'Consumer Goods',
      industry: 'FMCG & Personal Care',
      about: 'Hindustan Unilever is India’s largest fast-moving consumer goods company with brands touching 9 out of 10 households.',
      _isFixture: true,
    },
  },
  {
    symbol: 'TATAMOTORS',
    aliases: ['TATAMOTORS.NS', 'TATAMOTORS.NSE'],
    name: 'Tata Motors Ltd',
    assetClass: 'EQUITY',
    venue: 'NSE',
    sessionType: 'NSE_EQUITY',
    currency: 'INR',
    tickSize: 0.05,
    tickSizeBasis: MathPrecision.parsePriceToBasis('0.05'),
    minOrderQuantity: 1,
    minOrderQuantityMicro: MathPrecision.parseQtyToMicro('1'),
    quantityStep: 1,
    quantityStepMicro: MathPrecision.parseQtyToMicro('1'),
    fractionalAllowed: false,
    baselinePrice: 920.00,
    baselinePriceBasis: MathPrecision.parsePriceToBasis('920.00'),
    providerKey: 'NSE_EQ|INE155A01022',
    fundamentals: {
      ceo: 'Girish Wagh',
      headquarters: 'Mumbai, Maharashtra',
      founded: 1945,
      marketCap: '₹3.39T',
      peRatio: 10.3,
      dividendYield: 0.65,
      week52High: 1179.00,
      week52Low: 636.25,
      sector: 'Consumer Discretionary',
      industry: 'Automotive & Commercial Vehicles',
      about: 'Tata Motors is a leading global automobile manufacturer with a portfolio including cars, SUVs, trucks, and luxury cars (JLR).',
      _isFixture: true,
    },
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
   * Returns instruments filtered by exchange venue.
   */
  public static getInstrumentsByVenue(venue: ExchangeVenue): Instrument[] {
    return this.getAllInstruments().filter((inst) => inst.venue === venue);
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
