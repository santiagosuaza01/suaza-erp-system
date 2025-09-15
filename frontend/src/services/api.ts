// ============================================================================
// DEPENDENCIES
// ============================================================================
import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * API response interface
 */
interface ApiResponse<T = any> {
  data: T;
  message?: string;
  error?: string;
}

/**
 * Pagination interface
 */
interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/**
 * Paginated response interface
 */
interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

/**
 * API response with nested data structure
 */
interface ApiResponseWithNestedData<T> {
  [key: string]: T[] | Pagination;
  pagination: Pagination;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Base API configuration
 */
const API_CONFIG = {
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * Axios instance with base configuration
 */
const api: AxiosInstance = axios.create(API_CONFIG);

// ============================================================================
// INTERCEPTORS
// ============================================================================

/**
 * Request interceptor to add authentication token
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor to handle authentication errors
 */
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear stored authentication data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Redirect to login page
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

/**
 * Customer interface
 */
interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  taxId?: string;
  creditLimit?: number;
  isActive: boolean;
  createdAt: string;
}

/**
 * Product interface
 */
interface Product {
  id: string;
  name: string;
  code: string;
  description?: string;
  price: number;
  stock: number;
  unit?: string;
  categoryId?: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * Sale interface
 */
interface Sale {
  id: string;
  invoiceNumber: string;
  customerId?: string | null;
  customerName: string;
  totalAmount: number;
  taxAmount: number;
  subtotal: number;
  discount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  items: SaleItem[];
}

/**
 * Sale item interface
 */
interface SaleItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// ============================================================================
// API SERVICES
// ============================================================================

/**
 * Authentication service
 */
export const authService = {
  /**
   * User login
   * @param email - User email
   * @param password - User password
   * @returns Promise with login response
   */
  login: (email: string, password: string): Promise<AxiosResponse<ApiResponse<{ user: any; accessToken: string; refreshToken: string }>>> =>
    api.post('/auth/login', { username: email, password }),

  /**
   * Refresh access token
   * @param refreshToken - Refresh token
   * @returns Promise with new access token
   */
  refresh: (refreshToken: string): Promise<AxiosResponse<ApiResponse<{ accessToken: string }>>> =>
    api.post('/auth/refresh', { refreshToken }),

  /**
   * User logout
   * @param refreshToken - Refresh token to invalidate
   * @returns Promise with logout response
   */
  logout: (refreshToken: string): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/auth/logout', { refreshToken }),
};

/**
 * Customers service
 */
export const customersService = {
  /**
   * Get all customers with pagination
   * @param params - Query parameters (page, limit, search)
   * @returns Promise with paginated customers
   */
  getAll: (params?: { page?: number; limit?: number; search?: string }): Promise<AxiosResponse<{ customers: Customer[]; pagination: Pagination }>> =>
    api.get('/customers', { params }),

  /**
   * Get customer by ID
   * @param id - Customer ID
   * @returns Promise with customer data
   */
  getById: (id: string): Promise<AxiosResponse<Customer>> =>
    api.get(`/customers/${id}`),

  /**
   * Create new customer
   * @param data - Customer data
   * @returns Promise with created customer
   */
  create: (data: Partial<Customer>): Promise<AxiosResponse<Customer>> =>
    api.post('/customers', data),

  /**
   * Update customer
   * @param id - Customer ID
   * @param data - Updated customer data
   * @returns Promise with updated customer
   */
  update: (id: string, data: Partial<Customer>): Promise<AxiosResponse<Customer>> =>
    api.put(`/customers/${id}`, data),

  /**
   * Delete customer
   * @param id - Customer ID
   * @returns Promise with deletion response
   */
  delete: (id: string): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/customers/${id}`),
};

/**
 * Products service
 */
export const productsService = {
  /**
   * Get all products with pagination
   * @param params - Query parameters (page, limit, search)
   * @returns Promise with paginated products
   */
  getAll: (params?: { page?: number; limit?: number; search?: string }): Promise<AxiosResponse<{ products: Product[]; pagination: Pagination }>> =>
    api.get('/products', { params }),

  /**
   * Get product by ID
   * @param id - Product ID
   * @returns Promise with product data
   */
  getById: (id: string): Promise<AxiosResponse<Product>> =>
    api.get(`/products/${id}`),

  /**
   * Create new product
   * @param data - Product data
   * @returns Promise with created product
   */
  create: (data: Partial<Product>): Promise<AxiosResponse<Product>> =>
    api.post('/products', data),

  /**
   * Update product
   * @param id - Product ID
   * @param data - Updated product data
   * @returns Promise with updated product
   */
  update: (id: string, data: Partial<Product>): Promise<AxiosResponse<Product>> =>
    api.put(`/products/${id}`, data),

  /**
   * Delete product
   * @param id - Product ID
   * @returns Promise with deletion response
   */
  delete: (id: string): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/products/${id}`),
};

/**
 * Sales service
 */
export const salesService = {
  /**
   * Get all sales with pagination
   * @param params - Query parameters (page, limit, search)
   * @returns Promise with paginated sales
   */
  getAll: (params?: { page?: number; limit?: number; search?: string }): Promise<AxiosResponse<{ sales: Sale[]; pagination: Pagination }>> =>
    api.get('/sales', { params }),

  /**
   * Get sale by ID
   * @param id - Sale ID
   * @returns Promise with sale data
   */
  getById: (id: string): Promise<AxiosResponse<Sale>> =>
    api.get(`/sales/${id}`),

  /**
   * Create new sale
   * @param data - Sale data
   * @returns Promise with created sale
   */
  create: (data: Partial<Sale>): Promise<AxiosResponse<Sale>> =>
    api.post('/sales', data),

  /**
   * Update sale
   * @param id - Sale ID
   * @param data - Updated sale data
   * @returns Promise with updated sale
   */
  update: (id: string, data: Partial<Sale>): Promise<AxiosResponse<Sale>> =>
    api.put(`/sales/${id}`, data),

  /**
   * Delete sale
   * @param id - Sale ID
   * @returns Promise with deletion response
   */
  delete: (id: string): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/sales/${id}`),
};

/**
 * Categories service
 */
export const categoriesService = {
  /**
   * Get all categories
   * @returns Promise with categories data
   */
  getAll: (): Promise<AxiosResponse<ApiResponse>> =>
    api.get('/categories'),

  /**
   * Get category by ID
   * @param id - Category ID
   * @returns Promise with category data
   */
  getById: (id: string): Promise<AxiosResponse<ApiResponse>> =>
    api.get(`/categories/${id}`),

  /**
   * Create new category
   * @param data - Category data
   * @returns Promise with created category
   */
  create: (data: any): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/categories', data),

  /**
   * Update category
   * @param id - Category ID
   * @param data - Updated category data
   * @returns Promise with updated category
   */
  update: (id: string, data: any): Promise<AxiosResponse<ApiResponse>> =>
    api.put(`/categories/${id}`, data),

  /**
   * Delete category
   * @param id - Category ID
   * @returns Promise with deletion response
   */
  delete: (id: string): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/categories/${id}`),
};

/**
 * Reports service
 */
export const reportsService = {
  /**
   * Get dashboard statistics
   * @returns Promise with dashboard data
   */
  getDashboard: (): Promise<AxiosResponse<ApiResponse>> =>
    api.get('/dashboard'),

  /**
   * Get sales report
   * @param params - Report parameters
   * @returns Promise with sales report data
   */
  getSalesReport: (params?: any): Promise<AxiosResponse<ApiResponse>> =>
    api.get('/reports/sales', { params }),

  /**
   * Get inventory report
   * @returns Promise with inventory report data
   */
  getInventoryReport: (): Promise<AxiosResponse<ApiResponse>> =>
    api.get('/reports/inventory'),
};

// ============================================================================
// EXPORTS
// ============================================================================

export default api;
export type { Customer, Product, Sale, SaleItem, ApiResponse, Pagination, PaginatedResponse };
