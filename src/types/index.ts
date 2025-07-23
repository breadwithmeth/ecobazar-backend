// Общие типы для проекта
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SortOptions {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface PaginationOptions extends SortOptions {
  page: number;
  limit: number;
}

export interface FilterOptions {
  search?: string;
  category?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// Типы для продуктов
export interface ProductFilter extends FilterOptions {
  storeId?: number;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
}

export interface CreateProductRequest {
  name: string;
  price: number;
  storeId: number;
  image?: string;
  categoryId?: number;
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {}

// Типы для заказов
export interface OrderItem {
  productId: number;
  quantity: number;
  price?: number;
}

export interface CreateOrderRequest {
  items: OrderItem[];
  address: string;
}

export interface OrderFilter extends FilterOptions {
  userId?: number;
  status?: string;
  courierId?: number;
}

// Типы для курьеров
export interface AssignCourierRequest {
  orderId: number;
  courierId: number;
}

export interface CourierOrdersFilter extends FilterOptions {
  status?: string;
}

// Типы для пользователей
export interface CreateUserRequest {
  telegram_user_id: string;
  name?: string;
  phone_number?: string;
}

export interface UpdateUserRequest {
  name?: string;
  phone_number?: string;
}

// Типы для магазинов
export interface CreateStoreRequest {
  name: string;
  address: string;
  ownerId?: number;
}

export interface UpdateStoreRequest extends Partial<CreateStoreRequest> {}

export interface StoreFilter extends FilterOptions {
  ownerId?: number;
}

// Типы для категорий
export interface CreateCategoryRequest {
  name: string;
}

// Типы для ответов API
export interface AuthResponse {
  token: string;
  user: {
    id: number;
    telegram_user_id: string;
    role: string;
    name: string | null;
    phone_number: string | null;
  };
}

// Енумы
export enum OrderStatus {
  NEW = 'NEW',
  WAITING_PAYMENT = 'WAITING_PAYMENT',
  PREPARING = 'PREPARING',
  DELIVERING = 'DELIVERING',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
  COURIER = 'COURIER',
  SELLER = 'SELLER'
}

export enum StockMovementType {
  INCOME = 'INCOME',
  OUTCOME = 'OUTCOME'
}
