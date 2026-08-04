import axios from 'axios';
import { ApiResponse, CreateOrderDTO, ExchangeStats, Order, OrderBook, Trade } from '../types/index';

const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
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

  async createOrder(dto: CreateOrderDTO): Promise<Order> {
    const res = await apiClient.post<ApiResponse<{ order: Order; trades: Trade[] }>>('/orders', dto);
    return res.data.data.order;
  },

  async cancelOrder(id: string): Promise<Order> {
    const res = await apiClient.delete<ApiResponse<Order>>(`/orders/${id}`);
    return res.data.data;
  },

  async resetExchange(): Promise<void> {
    await apiClient.post('/orders/reset');
  },
};
