import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Loader2, Zap } from 'lucide-react';
import { CreateOrderDTO, OrderSide, OrderType } from '../types/index';
import { apiService } from '../services/api';
import { formatCurrency } from '../utils/formatters';

interface OrderFormProps {
  onOrderCreated?: () => void;
}

export function OrderForm({ onOrderCreated }: OrderFormProps) {
  const [side, setSide] = useState<OrderSide>('BUY');
  const [type, setType] = useState<OrderType>('LIMIT');
  const [price, setPrice] = useState<string>('100');
  const [quantity, setQuantity] = useState<string>('5');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
      setSuccessMsg(`${side} ${type} order submitted successfully!`);
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
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
        <h2 className="font-semibold text-white flex items-center space-x-2">
          <span>Place Order</span>
        </h2>
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setType('LIMIT')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              type === 'LIMIT' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            LIMIT
          </button>
          <button
            type="button"
            onClick={() => setType('MARKET')}
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center space-x-1 ${
              type === 'MARKET' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>MARKET</span>
          </button>
        </div>
      </div>

      {/* Side Selector Buttons */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-4">
        <button
          type="button"
          onClick={() => setSide('BUY')}
          className={`py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center space-x-2 transition-all ${
            side === 'BUY'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>BUY BYTE</span>
        </button>
        <button
          type="button"
          onClick={() => setSide('SELL')}
          className={`py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center space-x-2 transition-all ${
            side === 'SELL'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ArrowDownRight className="w-4 h-4" />
          <span>SELL BYTE</span>
        </button>
      </div>

      {/* Error & Success Toasts */}
      {errorMsg && (
        <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Price Input (Hidden for Market Orders) */}
        {type === 'LIMIT' && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Price (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-4 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                placeholder="100.00"
                required
              />
            </div>
          </div>
        )}

        {/* Quantity Input */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Quantity (BYTE)</label>
          <input
            type="number"
            step="1"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
            placeholder="5"
            required
          />

          {/* Quick Preset Buttons */}
          <div className="flex space-x-2 mt-2">
            {[1, 5, 10, 25, 50].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setQuantity(preset.toString())}
                className="flex-1 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono transition-colors"
              >
                +{preset}
              </button>
            ))}
          </div>
        </div>

        {/* Estimated Order Total */}
        {type === 'LIMIT' && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <span className="text-slate-400">Total Value</span>
            <span className="font-mono font-bold text-white">{formatCurrency(estimatedTotal)}</span>
          </div>
        )}

        {/* Submit Order Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center space-x-2 transition-all ${
            side === 'BUY'
              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/25'
              : 'bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/25'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <span>Submit {side} Order</span>
          )}
        </button>
      </form>
    </div>
  );
}
