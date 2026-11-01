import {
  IFundsReservationAdapter,
  ReservationRequest,
  ReservationResult,
} from '../types/index.js';
import { MathPrecision } from '../utils/MathPrecision.js';
import { logger } from '../utils/logger.js';

/**
 * NoOpFundsReservationAdapter implements the IFundsReservationAdapter interface
 * for Phase 02 development and testing.
 *
 * IMPORTANT ARCHITECTURAL DISCLOSURE:
 * This adapter returns status 'SIMULATED_NOOP' and calculates preview notional cash amounts in BigInt cents.
 * It does NOT lock real paper wallet cash or mutate persistent ledger balances.
 * Real wallet balance locking, unlocking, and settlement are scheduled for Phase 05 (Wallet & Ledger).
 */
export class NoOpFundsReservationAdapter implements IFundsReservationAdapter {
  private activeReservations = new Map<string, ReservationRequest & { notionalCents: bigint }>();

  public reserveFundsSync(req: ReservationRequest): ReservationResult {
    const reservationId = `noop_res_${req.orderId}`;

    let notionalCents = req.notionalCashCents;
    if (notionalCents === undefined) {
      try {
        const priceBasis = MathPrecision.parsePriceToBasis(req.price);
        const qtyMicro = MathPrecision.parseQtyToMicro(req.quantity);
        notionalCents = MathPrecision.calculateNotionalCents(priceBasis, qtyMicro);
      } catch (err) {
        logger.warn(`Failed to parse BigInt financial units for reservation ${req.orderId}:`, err);
        notionalCents = 0n;
      }
    }

    this.activeReservations.set(reservationId, { ...req, notionalCents });

    logger.debug(`[FundsReservation] Created SIMULATED_NOOP reservation ${reservationId} for ${notionalCents} cents`);

    return {
      success: true,
      reservationId,
      status: 'SIMULATED_NOOP',
      reservedAmountCents: notionalCents,
      message: 'Simulated NoOp reservation preview (Phase 02). Guaranteed wallet backing activates in Phase 05.',
    };
  }

  public releaseReservationSync(idOrReservationId: string): boolean {
    const key = idOrReservationId.startsWith('noop_res_') ? idOrReservationId : `noop_res_${idOrReservationId}`;
    const existed = this.activeReservations.delete(key) || this.activeReservations.delete(idOrReservationId);
    logger.debug(`[FundsReservation] Released SIMULATED_NOOP reservation ${idOrReservationId} (existed: ${existed})`);
    return true;
  }

  public commitReservationSync(idOrReservationId: string): boolean {
    const key = idOrReservationId.startsWith('noop_res_') ? idOrReservationId : `noop_res_${idOrReservationId}`;
    const existed = this.activeReservations.delete(key) || this.activeReservations.delete(idOrReservationId);
    logger.debug(`[FundsReservation] Committed SIMULATED_NOOP reservation ${idOrReservationId} (existed: ${existed})`);
    return true;
  }

  public async reserveFunds(req: ReservationRequest): Promise<ReservationResult> {
    return this.reserveFundsSync(req);
  }

  public async releaseReservation(idOrReservationId: string): Promise<boolean> {
    return this.releaseReservationSync(idOrReservationId);
  }

  public async commitReservation(idOrReservationId: string): Promise<boolean> {
    return this.commitReservationSync(idOrReservationId);
  }

  public getActiveReservation(reservationId: string) {
    return this.activeReservations.get(reservationId);
  }

  public getActiveCount(): number {
    return this.activeReservations.size;
  }

  public clear(): void {
    this.activeReservations.clear();
  }
}

/**
 * Global singleton factory for the funds reservation adapter.
 */
let reservationAdapterInstance: IFundsReservationAdapter = new NoOpFundsReservationAdapter();

export class FundsReservationAdapterFactory {
  public static getAdapter(): IFundsReservationAdapter {
    return reservationAdapterInstance;
  }

  public static setAdapter(customAdapter: IFundsReservationAdapter): void {
    reservationAdapterInstance = customAdapter;
  }

  public static resetToDefault(): void {
    reservationAdapterInstance = new NoOpFundsReservationAdapter();
  }
}
