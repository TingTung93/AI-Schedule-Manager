import { renderHook, act, waitFor } from '@testing-library/react';
import { useApi, useApiMutation, usePaginatedApi, useRealTimeApi } from '../../hooks/useApi';

// Mock API functions
const mockApiCall = jest.fn();
const mockApiMutation = jest.fn();

describe('useApi Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should fetch data successfully', async () => {
    const mockData = { id: 1, name: 'Test Data' };
    mockApiCall.mockResolvedValue(mockData);

    const { result } = renderHook(() => useApi(mockApiCall));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
    });

    expect(mockApiCall).toHaveBeenCalledTimes(1);
  });

  test('should handle API errors', async () => {
    const errorMessage = 'API Error';
    mockApiCall.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useApi(mockApiCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.data).toBeNull();
    });
  });

  test('should refetch data', async () => {
    const mockData1 = { id: 1, name: 'Data 1' };
    const mockData2 = { id: 2, name: 'Data 2' };
    
    mockApiCall
      .mockResolvedValueOnce(mockData1)
      .mockResolvedValueOnce(mockData2);

    const { result } = renderHook(() => useApi(mockApiCall));

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData1);
    });

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData2);
    });

    expect(mockApiCall).toHaveBeenCalledTimes(2);
  });

  test('should not fetch immediately when immediate is false', async () => {
    const { result } = renderHook(() => 
      useApi(mockApiCall, [], { immediate: false })
    );

    expect(result.current.loading).toBe(true);
    expect(mockApiCall).not.toHaveBeenCalled();
  });

  test('should retry on failure', async () => {
    mockApiCall
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockRejectedValueOnce(new Error('Error 2'))
      .mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => 
      useApi(mockApiCall, [], { retryCount: 2, retryDelay: 100 })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ success: true });
    }, { timeout: 3000 });

    expect(mockApiCall).toHaveBeenCalledTimes(3);
  });

  test('should call onSuccess callback', async () => {
    const mockData = { id: 1 };
    const onSuccess = jest.fn();
    mockApiCall.mockResolvedValue(mockData);

    renderHook(() => useApi(mockApiCall, [], { onSuccess }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockData);
    });
  });

  test('should call onError callback', async () => {
    const error = new Error('Test error');
    const onError = jest.fn();
    mockApiCall.mockRejectedValue(error);

    renderHook(() => useApi(mockApiCall, [], { onError }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});

describe('useApiMutation Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should perform mutation successfully', async () => {
    const mockData = { id: 1, created: true };
    mockApiMutation.mockResolvedValue(mockData);

    const { result } = renderHook(() => useApiMutation(mockApiMutation));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();

    await act(async () => {
      const response = await result.current.mutate({ name: 'Test' });
      expect(response).toEqual(mockData);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
    expect(mockApiMutation).toHaveBeenCalledWith({ name: 'Test' });
  });

  test('should handle mutation errors', async () => {
    const errorMessage = 'Mutation failed';
    mockApiMutation.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useApiMutation(mockApiMutation));

    await act(async () => {
      try {
        await result.current.mutate({ name: 'Test' });
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.data).toBeNull();
  });

  test('should reset mutation state', async () => {
    const mockData = { id: 1 };
    mockApiMutation.mockResolvedValue(mockData);

    const { result } = renderHook(() => useApiMutation(mockApiMutation));

    await act(async () => {
      await result.current.mutate();
    });

    expect(result.current.data).toEqual(mockData);

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  test('should call callbacks', async () => {
    const mockData = { id: 1 };
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const onSettled = jest.fn();
    
    mockApiMutation.mockResolvedValue(mockData);

    const { result } = renderHook(() => 
      useApiMutation(mockApiMutation, { onSuccess, onError, onSettled })
    );

    await act(async () => {
      await result.current.mutate();
    });

    expect(onSuccess).toHaveBeenCalledWith(mockData);
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalled();
  });
});

describe('usePaginatedApi Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should fetch paginated data', async () => {
    const mockPage1 = {
      items: [{ id: 1 }, { id: 2 }],
      total: 5,
      totalPages: 3
    };

    mockApiCall.mockResolvedValue(mockPage1);

    const { result } = renderHook(() => 
      usePaginatedApi(mockApiCall, { pageSize: 2 })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockPage1.items);
      expect(result.current.totalPages).toBe(3);
      expect(result.current.hasMore).toBe(true);
      expect(result.current.page).toBe(1);
    });
  });

  test('should load more pages', async () => {
    const mockPage1 = {
      items: [{ id: 1 }, { id: 2 }],
      total: 5,
      totalPages: 3
    };
    const mockPage2 = {
      items: [{ id: 3 }, { id: 4 }],
      total: 5,
      totalPages: 3
    };

    mockApiCall
      .mockResolvedValueOnce(mockPage1)
      .mockResolvedValueOnce(mockPage2);

    const { result } = renderHook(() => 
      usePaginatedApi(mockApiCall, { pageSize: 2 })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockPage1.items);
    });

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([
        ...mockPage1.items,
        ...mockPage2.items
      ]);
      expect(result.current.page).toBe(2);
    });
  });

  test('should refresh pagination', async () => {
    const mockPage1 = {
      items: [{ id: 1 }],
      totalPages: 2
    };
    const mockPage1Updated = {
      items: [{ id: 10 }],
      totalPages: 2
    };

    mockApiCall
      .mockResolvedValueOnce(mockPage1)
      .mockResolvedValueOnce(mockPage1Updated);

    const { result } = renderHook(() => usePaginatedApi(mockApiCall));

    await waitFor(() => {
      expect(result.current.data).toEqual(mockPage1.items);
    });

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockPage1Updated.items);
      expect(result.current.page).toBe(1);
    });
  });

  test('should handle no more pages', async () => {
    const mockLastPage = {
      items: [{ id: 5 }],
      total: 5,
      totalPages: 1
    };

    mockApiCall.mockResolvedValue(mockLastPage);

    const { result } = renderHook(() => usePaginatedApi(mockApiCall));

    await waitFor(() => {
      expect(result.current.hasMore).toBe(false);
    });

    act(() => {
      result.current.loadMore();
    });

    expect(mockApiCall).toHaveBeenCalledTimes(1);
  });
});

describe('useRealTimeApi Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should fetch data initially', async () => {
    const mockData = { value: 1 };
    mockApiCall.mockResolvedValue(mockData);

    const { result } = renderHook(() => 
      useRealTimeApi(mockApiCall, 5000)
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
      expect(result.current.loading).toBe(false);
    });
  });

  test('should poll for updates', async () => {
    const mockData1 = { value: 1 };
    const mockData2 = { value: 2 };

    mockApiCall
      .mockResolvedValueOnce(mockData1)
      .mockResolvedValueOnce(mockData2);

    const { result } = renderHook(() => 
      useRealTimeApi(mockApiCall, 1000)
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData1);
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData2);
    });

    expect(mockApiCall).toHaveBeenCalledTimes(2);
  });

  test('should stop and start polling', async () => {
    const mockData = { value: 1 };
    mockApiCall.mockResolvedValue(mockData);

    const { result } = renderHook(() => 
      useRealTimeApi(mockApiCall, 1000)
    );

    await waitFor(() => {
      expect(result.current.isPolling).toBe(true);
    });

    act(() => {
      result.current.stopPolling();
    });

    expect(result.current.isPolling).toBe(false);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Should only be called once (initial fetch)
    expect(mockApiCall).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.startPolling();
    });

    expect(result.current.isPolling).toBe(true);
  });

  test('should call onUpdate when data changes', async () => {
    const mockData1 = { value: 1 };
    const mockData2 = { value: 2 };
    const onUpdate = jest.fn();

    mockApiCall
      .mockResolvedValueOnce(mockData1)
      .mockResolvedValueOnce(mockData2);

    renderHook(() => 
      useRealTimeApi(mockApiCall, 1000, { onUpdate })
    );

    await waitFor(() => {
      expect(onUpdate).not.toHaveBeenCalled();
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(mockData2, mockData1);
    });
  });

  test('should handle polling errors', async () => {
    const error = new Error('Polling error');
    const onError = jest.fn();
    
    mockApiCall
      .mockResolvedValueOnce({ value: 1 })
      .mockRejectedValueOnce(error);

    const { result } = renderHook(() => 
      useRealTimeApi(mockApiCall, 1000, { onError })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ value: 1 });
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Polling error');
      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});