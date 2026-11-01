/**
 * MathPrecision.ts
 * Scaled-integer and BigInt financial precision utility for BYTE Exchange.
 * Eliminates JavaScript floating-point arithmetic errors and prevents Number.MAX_SAFE_INTEGER overflow.
 */

export class MathPrecision {
  // Scale Factors
  public static readonly PRICE_SCALE: bigint = 10_000n; // 1 USD = 10,000 basis points (4 decimals)
  public static readonly QTY_SCALE: bigint = 1_000_000n; // 1 share/coin = 1,000,000 micro-units (6 decimals)
  public static readonly CASH_SCALE: bigint = 100n; // 1 USD = 100 cents (2 decimals)
  public static readonly MIN_NOTIONAL_CENTS: bigint = 100n; // $1.00 USD minimum order value

  /**
   * Safely parses a price into basis units (10^4 scale) without floating-point conversion.
   * Example: "228.10" -> 2281000n
   */
  public static parsePriceToBasis(input: number | string): bigint {
    const str = typeof input === 'number' ? input.toFixed(4) : input.trim();
    if (!str || !/^-?\d+(\.\d+)?$/.test(str)) {
      throw new Error(`Invalid price format: "${input}"`);
    }
    const isNegative = str.startsWith('-');
    const cleanStr = isNegative ? str.slice(1) : str;
    const [wholePart, fracPart = ''] = cleanStr.split('.');
    const paddedFrac = (fracPart + '0000').slice(0, 4);
    const result = BigInt(wholePart) * this.PRICE_SCALE + BigInt(paddedFrac);
    return isNegative ? -result : result;
  }

  /**
   * Safely parses a quantity into micro-units (10^6 scale) without floating-point conversion.
   * Example: "0.001" -> 1000n
   */
  public static parseQtyToMicro(input: number | string): bigint {
    const str = typeof input === 'number' ? input.toFixed(6) : input.trim();
    if (!str || !/^-?\d+(\.\d+)?$/.test(str)) {
      throw new Error(`Invalid quantity format: "${input}"`);
    }
    const isNegative = str.startsWith('-');
    const cleanStr = isNegative ? str.slice(1) : str;
    const [wholePart, fracPart = ''] = cleanStr.split('.');
    const paddedFrac = (fracPart + '000000').slice(0, 6);
    const result = BigInt(wholePart) * this.QTY_SCALE + BigInt(paddedFrac);
    return isNegative ? -result : result;
  }

  /**
   * Formats basis units into exact price string (2 or 4 decimal places).
   * Example: 2281000n -> "228.10"
   */
  public static formatBasisToPrice(basis: bigint, decimals: number = 2): string {
    const isNegative = basis < 0n;
    const absBasis = isNegative ? -basis : basis;
    const whole = absBasis / this.PRICE_SCALE;
    const remainder = absBasis % this.PRICE_SCALE;
    const fracStr = remainder.toString().padStart(4, '0');
    const selectedFrac = fracStr.slice(0, decimals);
    return `${isNegative ? '-' : ''}${whole}.${selectedFrac}`;
  }

  /**
   * Formats micro-units into exact quantity string.
   * Example: 1000n -> "0.001"
   */
  public static formatMicroToQty(micro: bigint, maxDecimals: number = 6): string {
    const isNegative = micro < 0n;
    const absMicro = isNegative ? -micro : micro;
    const whole = absMicro / this.QTY_SCALE;
    const remainder = absMicro % this.QTY_SCALE;
    let fracStr = remainder.toString().padStart(6, '0');
    
    // Trim trailing zeros beyond minimum needed, or up to maxDecimals
    fracStr = fracStr.slice(0, maxDecimals).replace(/0+$/, '');
    if (!fracStr) {
      return `${isNegative ? '-' : ''}${whole}`;
    }
    return `${isNegative ? '-' : ''}${whole}.${fracStr}`;
  }

  /**
   * Formats cash cents into standard USD string ("100.00").
   */
  public static formatCentsToCash(cents: bigint): string {
    const isNegative = cents < 0n;
    const absCents = isNegative ? -cents : cents;
    const dollars = absCents / this.CASH_SCALE;
    const remCents = (absCents % this.CASH_SCALE).toString().padStart(2, '0');
    return `${isNegative ? '-' : ''}${dollars}.${remCents}`;
  }

  /**
   * Calculates total notional cash in cents using BigInt multiplication and Half-Up rounding.
   * Product scale = Price (10^4) * Qty (10^6) = 10^10.
   * Target scale = Cents (10^2).
   * Divisor = 10^10 / 10^2 = 10^8 = 100,000,000n.
   * Half-up addition: + 50,000,000n.
   */
  public static calculateNotionalCents(priceBasis: bigint, qtyMicro: bigint): bigint {
    if (priceBasis < 0n || qtyMicro < 0n) {
      throw new Error('Price and quantity must be non-negative for notional calculation');
    }
    const product = priceBasis * qtyMicro; // 10^10 scale
    // Add half the divisor (50_000_000n) for exact Round Half-Up
    const cents = (product + 50_000_000n) / 100_000_000n;
    return cents;
  }

  /**
   * Calculates total notional USD string from inputs.
   */
  public static calculateNotionalUsd(price: number | string, qty: number | string): string {
    const pBasis = this.parsePriceToBasis(price);
    const qMicro = this.parseQtyToMicro(qty);
    const cents = this.calculateNotionalCents(pBasis, qMicro);
    return this.formatCentsToCash(cents);
  }

  /**
   * Validates if a price conforms to the instrument's tick size.
   */
  public static isValidTickSize(priceBasis: bigint, tickSizeBasis: bigint): boolean {
    if (priceBasis <= 0n || tickSizeBasis <= 0n) return false;
    return priceBasis % tickSizeBasis === 0n;
  }

  /**
   * Validates if a quantity conforms to minimum lot and fractional step size.
   */
  public static isValidQuantity(
    qtyMicro: bigint,
    minLotMicro: bigint,
    stepMicro: bigint
  ): { valid: boolean; error?: string } {
    if (qtyMicro <= 0n) {
      return { valid: false, error: 'Quantity must be strictly positive' };
    }
    if (qtyMicro < minLotMicro) {
      return {
        valid: false,
        error: `Quantity ${this.formatMicroToQty(qtyMicro)} is below minimum lot size ${this.formatMicroToQty(minLotMicro)}`,
      };
    }
    if (qtyMicro % stepMicro !== 0n) {
      return {
        valid: false,
        error: `Quantity ${this.formatMicroToQty(qtyMicro)} does not conform to step size ${this.formatMicroToQty(stepMicro)}`,
      };
    }
    return { valid: true };
  }

  /**
   * Validates if total order notional meets the minimum requirement ($1.00 USD).
   */
  public static isValidMinimumNotional(
    notionalCents: bigint,
    minCents: bigint = this.MIN_NOTIONAL_CENTS
  ): boolean {
    return notionalCents >= minCents;
  }
}
