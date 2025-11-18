/**
 * Unit tests for data transformation utilities
 */

import { transformUtils } from '../api';

const {
  snakeToCamel,
  camelToSnake,
  snakeToCamelCase,
  camelToSnakeCase,
  isPlainObject,
  shouldSkipTransformation
} = transformUtils;

describe('String transformation utilities', () => {
  describe('snakeToCamelCase', () => {
    it('should convert snake_case to camelCase', () => {
      expect(snakeToCamelCase('user_name')).toBe('userName');
      expect(snakeToCamelCase('first_name')).toBe('firstName');
      expect(snakeToCamelCase('created_at')).toBe('createdAt');
    });

    it('should handle single words', () => {
      expect(snakeToCamelCase('user')).toBe('user');
      expect(snakeToCamelCase('name')).toBe('name');
    });

    it('should handle multiple underscores', () => {
      expect(snakeToCamelCase('user_first_name')).toBe('userFirstName');
      expect(snakeToCamelCase('a_b_c_d')).toBe('aBCD');
    });
  });

  describe('camelToSnakeCase', () => {
    it('should convert camelCase to snake_case', () => {
      expect(camelToSnakeCase('userName')).toBe('user_name');
      expect(camelToSnakeCase('firstName')).toBe('first_name');
      expect(camelToSnakeCase('createdAt')).toBe('created_at');
    });

    it('should handle single words', () => {
      expect(camelToSnakeCase('user')).toBe('user');
      expect(camelToSnakeCase('name')).toBe('name');
    });

    it('should handle multiple capital letters', () => {
      expect(camelToSnakeCase('userFirstName')).toBe('user_first_name');
      expect(camelToSnakeCase('aBCD')).toBe('a_b_c_d');
    });
  });
});

describe('Object transformation utilities', () => {
  describe('snakeToCamel', () => {
    it('should transform simple object keys', () => {
      const input = {
        user_name: 'John',
        first_name: 'John',
        last_name: 'Doe'
      };

      const expected = {
        userName: 'John',
        firstName: 'John',
        lastName: 'Doe'
      };

      expect(snakeToCamel(input)).toEqual(expected);
    });

    it('should transform nested objects', () => {
      const input = {
        user_data: {
          first_name: 'John',
          contact_info: {
            email_address: 'john@example.com'
          }
        }
      };

      const expected = {
        userData: {
          firstName: 'John',
          contactInfo: {
            emailAddress: 'john@example.com'
          }
        }
      };

      expect(snakeToCamel(input)).toEqual(expected);
    });

    it('should transform arrays of objects', () => {
      const input = {
        user_list: [
          { user_name: 'John', first_name: 'John' },
          { user_name: 'Jane', first_name: 'Jane' }
        ]
      };

      const expected = {
        userList: [
          { userName: 'John', firstName: 'John' },
          { userName: 'Jane', firstName: 'Jane' }
        ]
      };

      expect(snakeToCamel(input)).toEqual(expected);
    });

    it('should handle null and undefined', () => {
      expect(snakeToCamel(null)).toBe(null);
      expect(snakeToCamel(undefined)).toBe(undefined);
      expect(snakeToCamel({ user_name: null })).toEqual({ userName: null });
    });

    it('should preserve primitive values', () => {
      expect(snakeToCamel('string')).toBe('string');
      expect(snakeToCamel(123)).toBe(123);
      expect(snakeToCamel(true)).toBe(true);
    });

    it('should preserve Date objects', () => {
      const date = new Date('2025-11-18');
      expect(snakeToCamel(date)).toBe(date);
      expect(snakeToCamel({ created_at: date })).toEqual({ createdAt: date });
    });
  });

  describe('camelToSnake', () => {
    it('should transform simple object keys', () => {
      const input = {
        userName: 'John',
        firstName: 'John',
        lastName: 'Doe'
      };

      const expected = {
        user_name: 'John',
        first_name: 'John',
        last_name: 'Doe'
      };

      expect(camelToSnake(input)).toEqual(expected);
    });

    it('should transform nested objects', () => {
      const input = {
        userData: {
          firstName: 'John',
          contactInfo: {
            emailAddress: 'john@example.com'
          }
        }
      };

      const expected = {
        user_data: {
          first_name: 'John',
          contact_info: {
            email_address: 'john@example.com'
          }
        }
      };

      expect(camelToSnake(input)).toEqual(expected);
    });

    it('should transform arrays of objects', () => {
      const input = {
        userList: [
          { userName: 'John', firstName: 'John' },
          { userName: 'Jane', firstName: 'Jane' }
        ]
      };

      const expected = {
        user_list: [
          { user_name: 'John', first_name: 'John' },
          { user_name: 'Jane', first_name: 'Jane' }
        ]
      };

      expect(camelToSnake(input)).toEqual(expected);
    });

    it('should handle null and undefined', () => {
      expect(camelToSnake(null)).toBe(null);
      expect(camelToSnake(undefined)).toBe(undefined);
      expect(camelToSnake({ userName: null })).toEqual({ user_name: null });
    });

    it('should preserve primitive values', () => {
      expect(camelToSnake('string')).toBe('string');
      expect(camelToSnake(123)).toBe(123);
      expect(camelToSnake(true)).toBe(true);
    });

    it('should preserve Date objects', () => {
      const date = new Date('2025-11-18');
      expect(camelToSnake(date)).toBe(date);
      expect(camelToSnake({ createdAt: date })).toEqual({ created_at: date });
    });
  });

  describe('File and FormData handling', () => {
    it('should skip File transformation', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      expect(shouldSkipTransformation(file)).toBe(true);
      expect(camelToSnake(file)).toBe(file);
    });

    it('should skip FormData transformation', () => {
      const formData = new FormData();
      formData.append('test', 'value');
      expect(shouldSkipTransformation(formData)).toBe(true);
      expect(camelToSnake(formData)).toBe(formData);
    });
  });
});

describe('Type checking utilities', () => {
  describe('isPlainObject', () => {
    it('should identify plain objects', () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ key: 'value' })).toBe(true);
    });

    it('should reject non-plain objects', () => {
      expect(isPlainObject([])).toBe(false);
      expect(isPlainObject(null)).toBe(false);
      expect(isPlainObject(undefined)).toBe(false);
      expect(isPlainObject(new Date())).toBe(false);
      expect(isPlainObject(new File([], 'test.txt'))).toBe(false);
    });
  });

  describe('shouldSkipTransformation', () => {
    it('should skip File objects', () => {
      const file = new File(['content'], 'test.txt');
      expect(shouldSkipTransformation(file)).toBe(true);
    });

    it('should skip FormData', () => {
      const formData = new FormData();
      expect(shouldSkipTransformation(formData)).toBe(true);
    });

    it('should skip Date objects', () => {
      const date = new Date();
      expect(shouldSkipTransformation(date)).toBe(true);
    });

    it('should not skip plain objects', () => {
      expect(shouldSkipTransformation({})).toBe(false);
      expect(shouldSkipTransformation({ key: 'value' })).toBe(false);
    });
  });
});

describe('Edge cases', () => {
  it('should handle empty objects', () => {
    expect(snakeToCamel({})).toEqual({});
    expect(camelToSnake({})).toEqual({});
  });

  it('should handle empty arrays', () => {
    expect(snakeToCamel([])).toEqual([]);
    expect(camelToSnake([])).toEqual([]);
  });

  it('should handle mixed content arrays', () => {
    const input = [
      { user_name: 'John' },
      'string',
      123,
      null,
      { nested_data: { value: true } }
    ];

    const expected = [
      { userName: 'John' },
      'string',
      123,
      null,
      { nestedData: { value: true } }
    ];

    expect(snakeToCamel(input)).toEqual(expected);
  });

  it('should handle deeply nested structures', () => {
    const input = {
      level_1: {
        level_2: {
          level_3: {
            level_4: {
              deep_value: 'test'
            }
          }
        }
      }
    };

    const expected = {
      level1: {
        level2: {
          level3: {
            level4: {
              deepValue: 'test'
            }
          }
        }
      }
    };

    expect(snakeToCamel(input)).toEqual(expected);
  });

  it('should handle arrays within nested objects', () => {
    const input = {
      user_data: {
        task_list: [
          { task_name: 'Task 1', is_completed: false },
          { task_name: 'Task 2', is_completed: true }
        ]
      }
    };

    const expected = {
      userData: {
        taskList: [
          { taskName: 'Task 1', isCompleted: false },
          { taskName: 'Task 2', isCompleted: true }
        ]
      }
    };

    expect(snakeToCamel(input)).toEqual(expected);
  });
});
