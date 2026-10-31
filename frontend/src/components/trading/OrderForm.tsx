import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CreateOrderDTO, OrderSide, OrderType } from '../../types/index';
import { apiService } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

interface OrderFormProps {
  symbol?: string;
  onOrderCreated?: () => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({ symbol = 'BYTE-USD', onOrderCreated }) => {
  const [side, setSide] = useState<OrderSide>('BUY');
  const [type, setType] = useState<OrderType>('LIMIT');
  const [price, setPrice] = useState<string>('100');
  const [quantity, setQuantity] = useState<string>('5');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const baseAsset = (symbol || 'BYTE').split('-')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const numericPrice = parseFloat(price);
    const numericQuantity = parseFloat(quantity);

    if (type === 'LIMIT' && (isNaN(numericPrice) || numericPrice <= 0)) {
      setErrorMsg('Please enter a valid price greater than 0');
      return;
    }

    if (isNaN(numericQuantity) || numericQuantity <= 0) {
      setErrorMsg('Please enter a valid quantity greater than 0');
      return;
    }

    const dto: CreateOrderDTO = {
      side,
      type,
      price: type === 'LIMIT' ? numericPrice : 0,
      quantity: numericQuantity,
    };

    try {
      setIsSubmitting(true);
      await apiService.createOrder(dto);
      setSuccessMsg(`${side} ${type} order submitted to FIFO engine!`);
      if (onOrderCreated) onOrderCreated();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setErrorMsg(error.response?.data?.error?.message || 'Failed to submit order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const estimatedTotal = (parseFloat(price) || 0) * (parseFloat(quantity) || 0);

  return (
    <div className="bg-byte-surface border border-byte-border rounded-lg p-3 select-none text-xs font-mono transition-colors">
      {/* Side Selector Tabs (Buy Green / Sell Red) matching reference image */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        <button
          type="button"
          onClick={() => setSide('BUY')}
          className={`py-1.5 rounded font-semibold text-xs transition-colors cursor-pointer ${
            side === 'BUY'
              ? 'bg-[#22B982] text-white shadow-xs'
              : 'bg-byte-secondary text-byte-muted hover:text-byte-primary'
          }`}
        >
          Buy {baseAsset}
        </button>
        <button
          type="button"
          onClick={() => setSide('SELL')}
          className={`py-1.5 rounded font-semibold text-xs transition-colors cursor-pointer ${
            side === 'SELL'
              ? 'bg-[#EF6262] text-white shadow-xs'
              : 'bg-byte-secondary text-byte-muted hover:text-byte-primary'
          }`}
        >
          Sell {baseAsset}
        </button>
      </div>

      {/* Order Type Sub-tabs (Limit / Market) */}
      <div className="flex space-x-1 mb-3 border-b border-byte-border pb-2 text-[11px]">
        <button
          type="button"
          onClick={() => setType('LIMIT')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
            type === 'LIMIT' ? 'bg-byte-secondary text-byte-primary font-bold' : 'text-byte-muted hover:text-byte-primary'
          }`}
        >
          Limit
        </button>
        <button
          type="button"
          onClick={() => setType('MARKET')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
            type === 'MARKET' ? 'bg-byte-secondary text-byte-primary font-bold' : 'text-byte-muted hover:text-byte-primary'
          }`}
        >
          Market
        </button>
      </div>

      {/* Notification Toasts */}
      {errorMsg && (
        <div className="mb-2 p-2 rounded bg-[#EF6262]/10 border border-[#EF6262]/20 text-[#EF6262] text-[11px]">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mb-2 p-2 rounded bg-[#22B982]/10 border border-[#22B982]/20 text-[#22B982] text-[11px]">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2.5">
        {/* Limit Price */}
        {type === 'LIMIT' && (
          <div>
            <div className="flex justify-between text-[10px] text-byte-muted mb-1">
              <span>Price</span>
              <span>USD</span>
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-byte-secondary border border-byte-border rounded px-2.5 py-1 text-xs text-byte-primary font-mono focus:outline-none focus:border-byte-accent tnum"
              placeholder="100.00"
              required
            />
          </div>
        )}

        {/* Quantity */}
        <div>
          <div className="flex justify-between text-[10px] text-byte-muted mb-1">
            <span>Quantity</span>
            <span>{baseAsset}</span>
          </div>
          <input
            type="number"
            step="1"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full bg-byte-secondary border border-byte-border rounded px-2.5 py-1 text-xs text-byte-primary font-mono focus:outline-none focus:border-byte-accent tnum"
            placeholder="5"
            required
          />

          {/* Preset Buttons (25%, 50%, 75%, 100%) */}
          <div className="grid grid-cols-4 gap-1 mt-1.5 text-[10px]">
            {['25%', '50%', '75%', '100%'].map((pct, idx) => {
              const vals = [1, 5, 10, 25];
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setQuantity(vals[idx].toString())}
                  className="py-0.5 rounded bg-byte-secondary hover:bg-byte-border text-byte-muted hover:text-byte-primary transition-colors cursor-pointer text-center"
                >
                  {pct}
                </button>
              );
            })}
          </div>
        </div>

        {/* Order Summary & Submit */}
        <div className="pt-2 border-t border-byte-border space-y-1.5 text-[11px]">
          <div className="flex justify-between text-byte-muted">
            <span>Available</span>
            <span className="text-byte-primary font-semibold">$10,000.00</span>
          </div>
          {type === 'LIMIT' && (
            <div className="flex justify-between text-byte-muted">
              <span>Total Value</span>
              <span className="text-byte-primary font-bold tnum">{formatCurrency(estimatedTotal)}</span>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-2 rounded font-semibold text-xs text-white flex items-center justify-center space-x-1.5 transition-opacity cursor-pointer ${
            side === 'BUY' ? 'bg-[#22B982] hover:opacity-95' : 'bg-[#EF6262] hover:opacity-95'
          } disabled:opacity-50`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Matching...</span>
            </>
          ) : (
            <span>
              {side === 'BUY' ? `Buy ${baseAsset}` : `Sell ${baseAsset}`}
            </span>
          )}
        </button>
      </form>
    </div>
  );
};
