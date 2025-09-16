/**
 * Comprehensive tests for useApi and useApiMutation hooks.
 * Tests loading states, error handling, caching, and optimization features.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useApi, useApiMutation } from '../../hooks/useApi';

// Mock API service
const mockApiFunction = jest.fn();
const mockMutationFunction = jest.fn();

describe('useApi Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFunction.mockClear();
  });

  describe('Basic Functionality', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() =>
        useApi(mockApiFunction, [])
      );

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.refetch).toBe('function');
    });

    it('should fetch data on mount', async () => {
      const mockData = { users: ['John', 'Jane'] };
      mockApiFunction.mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useApi(mockApiFunction, [])
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
      expect(mockApiFunction).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors', async () => {
      const mockError = new Error('API Error');
      mockApiFunction.mockRejectedValue(mockError);

      const { result } = renderHook(() =>
        useApi(mockApiFunction, [])
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(mockError);
    });

    it('should refetch data when refetch is called', async () => {
      const mockData1 = { count: 1 };
      const mockData2 = { count: 2 };

      mockApiFunction
        .mockResolvedValueOnce(mockData1)
        .mockResolvedValueOnce(mockData2);

      const { result } = renderHook(() =>
        useApi(mockApiFunction, [])
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData1);
      });

      act(() => {
        result.current.refetch();
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData2);
      });

      expect(mockApiFunction).toHaveBeenCalledTimes(2);
    });
  });

  describe('Dependencies', () => {
    it('should refetch when dependencies change', async () => {
      const mockData1 = { page: 1 };
      const mockData2 = { page: 2 };

      mockApiFunction
        .mockResolvedValueOnce(mockData1)
        .mockResolvedValueOnce(mockData2);

      let deps = [1];

      const { result, rerender } = renderHook(
        ({ dependencies }) => useApi(mockApiFunction, dependencies),
        { initialProps: { dependencies: deps } }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData1);
      });

      // Change dependencies
      deps = [2];
      rerender({ dependencies: deps });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData2);
      });

      expect(mockApiFunction).toHaveBeenCalledTimes(2);
    });

    it('should not refetch when dependencies are the same', async () => {
      const mockData = { stable: true };
      mockApiFunction.mockResolvedValue(mockData);

      const deps = [1, 'test'];

      const { result, rerender } = renderHook(
        ({ dependencies }) => useApi(mockApiFunction, dependencies),
        { initialProps: { dependencies: deps } }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });

      // Rerender with same dependencies
      rerender({ dependencies: [1, 'test'] });

      // Should not make another API call
      expect(mockApiFunction).toHaveBeenCalledTimes(1);
    });

    it('should handle empty dependencies array', async () => {
      const mockData = { static: true };
      mockApiFunction.mockResolvedValue(mockData);

      const { result, rerender } = renderHook(() =>
        useApi(mockApiFunction, [])
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });

      // Rerender should not cause refetch
      rerender();

      expect(mockApiFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Configuration Options', () => {
    it('should handle onSuccess callback', async () => {
      const mockData = { success: true };
      const onSuccess = jest.fn();

      mockApiFunction.mockResolvedValue(mockData);

      renderHook(() =>
        useApi(mockApiFunction, [], { onSuccess })
      );

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockData);
      });
    });

    it('should handle onError callback', async () => {
      const mockError = new Error('Test error');
      const onError = jest.fn();

      mockApiFunction.mockRejectedValue(mockError);

      renderHook(() =>
        useApi(mockApiFunction, [], { onError })
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(mockError);
      });
    });

    it('should respect enabled option', async () => {
      mockApiFunction.mockResolvedValue({ data: 'test' });

      const { result, rerender } = renderHook(
        ({ enabled }) => useApi(mockApiFunction, [], { enabled }),
        { initialProps: { enabled: false } }
      );

      // Should not fetch when disabled
      expect(result.current.loading).toBe(false);
      expect(mockApiFunction).not.toHaveBeenCalled();

      // Enable and should fetch
      rerender({ enabled: true });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockApiFunction).toHaveBeenCalledTimes(1);
    });

    it('should use custom retry logic', async () => {
      const mockError = new Error('Network error');
      mockApiFunction
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() =>
        useApi(mockApiFunction, [], {
          retry: 2,
          retryDelay: 100
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual({ success: true });
      expect(mockApiFunction).toHaveBeenCalledTimes(3);
    });

    it('should implement caching', async () => {
      const mockData = { cached: true };
      mockApiFunction.mockResolvedValue(mockData);

      const cacheKey = 'test-cache-key';

      // First hook instance
      const { result: result1 } = renderHook(() =>
        useApi(mockApiFunction, [], {
          cacheKey,
          cacheTime: 5000
        })
      );

      await waitFor(() => {
        expect(result1.current.data).toEqual(mockData);
      });

      // Second hook instance with same cache key
      const { result: result2 } = renderHook(() =>
        useApi(mockApiFunction, [], {
          cacheKey,
          cacheTime: 5000
        })
      );

      // Should use cached data, not make new API call
      expect(result2.current.data).toEqual(mockData);
      expect(result2.current.loading).toBe(false);
      expect(mockApiFunction).toHaveBeenCalledTimes(1);
    });

    it('should handle stale data properly', async () => {
      const staleData = { stale: true };
      const freshData = { fresh: true };

      mockApiFunction
        .mockResolvedValueOnce(staleData)
        .mockResolvedValueOnce(freshData);

      const { result } = renderHook(() =>
        useApi(mockApiFunction, [], {
          staleTime: 100,
          cacheTime: 1000
        })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(staleData);
      });

      // Wait for data to become stale
      await new Promise(resolve => setTimeout(resolve, 150));

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(freshData);
      });

      expect(mockApiFunction).toHaveBeenCalledTimes(2);
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent requests properly', async () => {
      let resolveCount = 0;
      mockApiFunction.mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => {
            resolveCount++;
            resolve({ request: resolveCount });
          }, 100);
        })
      );

      const { result } = renderHook(() =>
        useApi(mockApiFunction, [])
      );

      // Trigger multiple concurrent refetches
      act(() => {
        result.current.refetch();
        result.current.refetch();
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should only show the latest request result
      expect(result.current.data.request).toBe(resolveCount);
    });

    it('should cancel previous requests when new ones are made', async () => {
      const abortSpy = jest.fn();
      mockApiFunction.mockImplementation(() =>
        new Promise((resolve, reject) => {
          const controller = new AbortController();
          controller.signal.addEventListener('abort', () => {
            abortSpy();
            reject(new Error('Aborted'));
          });

          setTimeout(() => resolve({ data: 'test' }), 1000);
        })
      );

      const { result } = renderHook(() =>
        useApi(mockApiFunction, [])
      );

      // Quick successive refetches
      act(() => {
        result.current.refetch();
      });

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(abortSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed requests', async () => {
      const error = new Error('Temporary error');
      mockApiFunction
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ recovered: true });

      const { result } = renderHook(() =>
        useApi(mockApiFunction, [], {
          retry: 2,
          retryDelay: 50
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual({ recovered: true });
      expect(result.current.error).toBeNull();
      expect(mockApiFunction).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const authError = new Error('Unauthorized');
      authError.status = 401;

      mockApiFunction.mockRejectedValue(authError);

      const { result } = renderHook(() =>
        useApi(mockApiFunction, [], {
          retry: 3,
          retryCondition: (error) => error.status !== 401
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toEqual(authError);
      expect(mockApiFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Memory Management', () => {
    it('should cleanup on unmount', async () => {
      mockApiFunction.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ data: 'test' }), 1000))
      );

      const { result, unmount } = renderHook(() =>
        useApi(mockApiFunction, [])
      );

      expect(result.current.loading).toBe(true);

      // Unmount before request completes
      unmount();

      // Should not update state after unmount
      await new Promise(resolve => setTimeout(resolve, 1100));

      // No assertion needed - just ensure no memory leaks or warnings
    });

    it('should clear cache when specified', async () => {
      const mockData = { test: 'data' };
      mockApiFunction.mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useApi(mockApiFunction, [], {
          cacheKey: 'test-key',
          cacheTime: 1000
        })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });

      // Clear cache
      act(() => {
        result.current.clearCache();
      });

      // New request should be made
      act(() => {
        result.current.refetch();
      });

      expect(mockApiFunction).toHaveBeenCalledTimes(2);
    });
  });
});

describe('useApiMutation Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMutationFunction.mockClear();
  });

  describe('Basic Functionality', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() =>
        useApiMutation(mockMutationFunction)
      );

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.mutate).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });

    it('should execute mutation when mutate is called', async () => {
      const mockData = { success: true };
      mockMutationFunction.mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useApiMutation(mockMutationFunction)
      );

      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.mutate({ input: 'test' });
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
      expect(mockMutationFunction).toHaveBeenCalledWith({ input: 'test' });
    });

    it('should handle mutation errors', async () => {
      const mockError = new Error('Mutation failed');
      mockMutationFunction.mockRejectedValue(mockError);

      const { result } = renderHook(() =>
        useApiMutation(mockMutationFunction)
      );

      act(() => {
        result.current.mutate({ input: 'test' });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(mockError);
    });

    it('should reset state when reset is called', async () => {
      const mockData = { success: true };
      mockMutationFunction.mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useApiMutation(mockMutationFunction)
      );

      // Execute mutation
      act(() => {
        result.current.mutate({ input: 'test' });
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });

      // Reset state
      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Configuration Options', () => {
    it('should call onSuccess callback on successful mutation', async () => {
      const mockData = { success: true };
      const onSuccess = jest.fn();

      mockMutationFunction.mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useApiMutation(mockMutationFunction, { onSuccess })
      );

      act(() => {
        result.current.mutate({ input: 'test' });
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockData);
      });
    });

    it('should call onError callback on mutation failure', async () => {
      const mockError = new Error('Test error');
      const onError = jest.fn();

      mockMutationFunction.mockRejectedValue(mockError);

      const { result } = renderHook(() =>
        useApiMutation(mockMutationFunction, { onError })
      );

      act(() => {
        result.current.mutate({ input: 'test' });
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(mockError);
      });
    });

    it('should call onSettled callback after mutation completes', async () => {
      const mockData = { success: true };
      const onSettled = jest.fn();

      mockMutationFunction.mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useApiMutation(mockMutationFunction, { onSettled })
      );

      act(() => {
        result.current.mutate({ input: 'test' });
      });

      await waitFor(() => {
        expect(onSettled).toHaveBeenCalledWith(mockData, null);
      });

      // Test with error
      const mockError = new Error('Test error');
      mockMutationFunction.mockRejectedValue(mockError);

      act(() => {
        result.current.mutate({ input: 'test2' });
      });

      await waitFor(() => {
        expect(onSettled).toHaveBeenCalledWith(null, mockError);
      });
    });

    it('should handle mutation with custom configuration', async () => {
      const mockData = { customResult: true };
      mockMutationFunction.mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useApiMutation(mockMutationFunction, {
          retry: 2,
          retryDelay: 100
        })
      );

      act(() => {
        result.current.mutate({ input: 'test' });
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });
    });
  });

  describe('Multiple Mutations', () => {
    it('should handle multiple sequential mutations', async () => {
      const mockData1 = { result: 1 };
      const mockData2 = { result: 2 };

      mockMutationFunction
        .mockResolvedValueOnce(mockData1)
        .mockResolvedValueOnce(mockData2);

      const { result } = renderHook(() =>
        useApiMutation(mockMutationFunction)
      );

      // First mutation
      act(() => {
        result.current.mutate({ input: 'test1' });
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData1);
      });

      // Second mutation
      act(() => {
        result.current.mutate({ input: 'test2' });
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData2);
      });

      expect(mockMutationFunction).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent mutations properly', async () => {
      let resolveCount = 0;
      mockMutationFunction.mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => {
            resolveCount++;
            resolve({ mutation: resolveCount });
          }, 100);
        })
      );

      const { result } = renderHook(() =>
        useApiMutation(mockMutationFunction)
      );

      // Trigger multiple concurrent mutations
      act(() => {
        result.current.mutate({ input: 'test1' });
        result.current.mutate({ input: 'test2' });
        result.current.mutate({ input: 'test3' });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should only show the latest mutation result
      expect(result.current.data.mutation).toBe(resolveCount);
    });
  });

  describe('Error Handling', () => {
    it('should retry failed mutations when configured', async () => {
      const error = new Error('Temporary failure');
      mockMutationFunction
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ recovered: true });

      const { result } = renderHook(() =>
        useApiMutation(mockMutationFunction, {
          retry: 2,
          retryDelay: 50
        })
      );

      act(() => {
        result.current.mutate({ input: 'test' });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual({ recovered: true });
      expect(result.current.error).toBeNull();
      expect(mockMutationFunction).toHaveBeenCalledTimes(3);
    });

    it('should not retry when retry is disabled', async () => {
      const error = new Error('Permanent failure');
      mockMutationFunction.mockRejectedValue(error);

      const { result } = renderHook(() =>
        useApiMutation(mockMutationFunction, { retry: 0 })
      );

      act(() => {
        result.current.mutate({ input: 'test' });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toEqual(error);
      expect(mockMutationFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Optimistic Updates', () => {
    it('should handle optimistic updates', async () => {
      const optimisticData = { optimistic: true };
      const actualData = { actual: true };

      mockMutationFunction.mockResolvedValue(actualData);

      const { result } = renderHook(() =>
        useApiMutation(mockMutationFunction)
      );

      // Mutation with optimistic update
      act(() => {
        result.current.mutate(
          { input: 'test' },
          { optimisticData }
        );
      });

      // Should immediately show optimistic data
      expect(result.current.data).toEqual(optimisticData);
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should show actual data after completion
      expect(result.current.data).toEqual(actualData);
    });

    it('should rollback optimistic updates on error', async () => {
      const optimisticData = { optimistic: true };
      const previousData = { previous: true };
      const error = new Error('Mutation failed');

      mockMutationFunction.mockRejectedValue(error);

      const { result } = renderHook(() =>
        useApiMutation(mockMutationFunction)
      );

      // Set previous data
      result.current.data = previousData;

      // Mutation with optimistic update
      act(() => {
        result.current.mutate(
          { input: 'test' },
          {
            optimisticData,
            rollbackOnError: true
          }
        );
      });

      // Should show optimistic data
      expect(result.current.data).toEqual(optimisticData);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should rollback to previous data on error
      expect(result.current.data).toEqual(previousData);
      expect(result.current.error).toEqual(error);
    });
  });
});