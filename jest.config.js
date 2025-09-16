/**
 * Jest Configuration for AI Schedule Manager
 * Comprehensive test configuration with coverage reporting
 */

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module file extensions
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],

  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript'
      ],
      plugins: [
        '@babel/plugin-proposal-private-property-in-object'
      ]
    }],
    '^.+\\.css$': 'jest-transform-stub',
    '^.+\\.(jpg|jpeg|png|gif|svg)$': 'jest-transform-stub'
  },

  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(axios|@fullcalendar|date-fns)/)'
  ],

  // Module name mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // Test match patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.(js|jsx|ts|tsx)',
    '<rootDir>/src/**/*.(test|spec).(js|jsx|ts|tsx)',
    '<rootDir>/backend/tests/**/*.py',
    '<rootDir>/tests/**/*.(test|spec).(js|jsx|ts|tsx)'
  ],

  // Test path ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/build/',
    '<rootDir>/dist/',
    '<rootDir>/backend/venv/',
    '<rootDir>/e2e-tests/'
  ],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    // Frontend coverage
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/index.js',
    '!src/reportWebVitals.js',
    '!src/setupTests.js',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',

    // Backend coverage (if using coverage.py with Jest)
    'backend/src/**/*.py',
    '!backend/src/__pycache__/**',
    '!backend/src/**/migrations/**',
    '!backend/venv/**'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Specific thresholds for critical modules
    './src/services/': {
      branches: 85,
      functions: 90,
      lines: 85,
      statements: 85
    },
    './src/hooks/': {
      branches: 80,
      functions: 85,
      lines: 80,
      statements: 80
    },
    './backend/src/core/': {
      branches: 90,
      functions: 95,
      lines: 90,
      statements: 90
    }
  },

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
    'cobertura'
  ],

  // Coverage directory
  coverageDirectory: '<rootDir>/coverage',

  // Test results processor
  testResultsProcessor: 'jest-sonar-reporter',

  // Global setup and teardown
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',

  // Module directories
  moduleDirectories: [
    'node_modules',
    '<rootDir>/src',
    '<rootDir>/tests'
  ],

  // Verbose output
  verbose: true,

  // Test timeout
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Error on deprecated APIs
  errorOnDeprecated: true,

  // Notify mode
  notify: false,

  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Projects configuration for multi-language support
  projects: [
    // Frontend project
    {
      displayName: 'Frontend',
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.(js|jsx|ts|tsx)',
        '<rootDir>/src/**/*.(test|spec).(js|jsx|ts|tsx)'
      ],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      collectCoverageFrom: [
        'src/**/*.{js,jsx,ts,tsx}',
        '!src/index.js',
        '!src/reportWebVitals.js',
        '!src/**/*.d.ts'
      ]
    },
    // Backend project (if using jest for Python tests)
    {
      displayName: 'Backend',
      testMatch: ['<rootDir>/backend/tests/**/*.py'],
      testEnvironment: 'node',
      runner: 'jest-runner-python',
      collectCoverageFrom: [
        'backend/src/**/*.py',
        '!backend/src/__pycache__/**'
      ]
    }
  ],

  // Reporters
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './coverage/html-report',
      filename: 'report.html',
      expand: true
    }],
    ['jest-junit', {
      outputDirectory: './coverage',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }],
    ['jest-sonar', {
      outputDirectory: './coverage',
      outputName: 'sonar-report.xml',
      reportedFilePath: 'relative'
    }]
  ],

  // Max workers for parallel execution
  maxWorkers: '50%',

  // Cache directory
  cacheDirectory: '<rootDir>/.jest-cache',

  // Dependency extraction
  dependencyExtractor: '<rootDir>/tests/dependencyExtractor.js',

  // Snapshot serializers
  snapshotSerializers: [
    'enzyme-to-json/serializer'
  ],

  // Globals
  globals: {
    'ts-jest': {
      useESM: true
    },
    '__DEV__': true,
    '__TEST__': true
  }
};