const API_BASE = '/api';

interface ApiError {
  code: string;
  message: string;
}

async function request<T>(
  endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const payload = data as Record<string, unknown> | null;
    const nestedErr =
      payload &&
      typeof payload.error === 'object' &&
      payload.error !== null &&
      'message' in (payload.error as object)
        ? (payload.error as { code?: string; message?: string })
        : null;

    const pipeMessage = (() => {
      const m = payload?.message;
      if (typeof m === 'string') return m;
      if (Array.isArray(m)) return m.join(', ');
      return undefined;
    })();

    const error: ApiError = {
      code:
        nestedErr?.code ??
        (typeof payload?.code === 'string' ? payload.code : undefined) ??
        'UNKNOWN_ERROR',
      message:
        nestedErr?.message ?? pipeMessage ?? `请求失败: ${response.status}`,
    };
    throw error;
  }

  const payload = data as Record<string, unknown> | null;
  if (
    payload &&
    typeof payload === 'object' &&
    payload.success === true &&
    'data' in payload
  ) {
    return (payload as { data: T }).data;
  }

  return data as T;
}

export interface LoginRequest {
  email: string;
  password: string;
  deviceId: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  passwordConfirm: string;
  acceptTerms: boolean;
  deviceId: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    settings: Record<string, any>;
    createdAt: string;
    lastLoginAt: string;
  };
}

export interface DiaryEntry {
  id: string;
  content: string;
  emotions: string[];
  dateKey: string;
  date?: string;
}

export interface DiaryListResponse {
  list: DiaryEntry[];
  total: number;
}

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  logout: async (token: string): Promise<void> => {
    return request('/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  me: async (token: string): Promise<any> => {
    return request('/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  checkEmail: async (email: string): Promise<{ available: boolean; exists: boolean; error?: string }> => {
    const encodedEmail = encodeURIComponent(email);
    return request(`/auth/check-email?email=${encodedEmail}`);
  },
};

export const diaryApi = {
  list: async (token: string): Promise<DiaryListResponse> => {
    return request<DiaryListResponse>('/diary', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  create: async (token: string, data: Partial<DiaryEntry>): Promise<DiaryEntry> => {
    return request<DiaryEntry>('/diary', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  },

  sync: async (token: string, deviceId: string, items: Partial<DiaryEntry>[]): Promise<any> => {
    return request('/diary/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ deviceId, items }),
    });
  },
};
