import axios from 'axios';
import { ApiResponse, CreateOrderDTO, ExchangeStats, Order, OrderBook, Trade } from '../types/index';

const RENDER_BACKEND_URL = 'https://byte-exchange-backend.onrender.com';

const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')
  ? `${RENDER_BACKEND_URL}/api`
  : '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  async getOrderBook(): Promise<OrderBook> {
    const res = await apiClient.get<ApiResponse<OrderBook>>('/orderbook');
    return res.data.data;
  },

  async getTrades(limit = 50): Promise<Trade[]> {
    const res = await apiClient.get<ApiResponse<Trade[]>>(`/trades?limit=${limit}`);
    return res.data.data;
  },

  async getStats(): Promise<ExchangeStats> {
    const res = await apiClient.get<ApiResponse<ExchangeStats>>('/stats');
    return res.data.data;
  },

  async getAllOrders(): Promise<Order[]> {
    const res = await apiClient.get<ApiResponse<Order[]>>('/orders');
    return res.data.data;
  },

  async createOrder(order: CreateOrderDTO): Promise<{ order: Order; trades: Trade[] }> {
    const res = await apiClient.post<ApiResponse<{ order: Order; trades: Trade[] }>>('/orders', order);
    return res.data.data;
  },

  async cancelOrder(orderId: string): Promise<Order> {
    const res = await apiClient.delete<ApiResponse<Order>>(`/orders/${orderId}`);
    return res.data.data;
  },

  async resetEngine(): Promise<void> {
    await apiClient.post('/orders/reset');
  },

  async resetExchange(): Promise<void> {
    await apiClient.post('/orders/reset');
  },
};
