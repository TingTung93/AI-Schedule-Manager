#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class IntegrationTestRunner {
  constructor() {
    this.testResults = {
      comprehensive: null,
      performance: null,
      security: null,
      frontendBackend: null,
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        coverage: {},
        performance: {},
        security: {},
        startTime: new Date(),
        endTime: null,
        duration: 0
      }
    };
  }

  async runTestSuite(suiteName, testFile) {
    console.log(`\n🚀 Running ${suiteName} test suite...`);
    console.log(`📂 Test file: ${testFile}`);

    return new Promise((resolve) => {
      const startTime = Date.now();

      const testProcess = spawn('npm', ['test', '--', testFile, '--verbose'], {
        cwd: process.cwd(),
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        process.stdout.write(output);
      });

      testProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        process.stderr.write(output);
      });

      testProcess.on('close', (code) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        const result = {
          suiteName,
          testFile,
          exitCode: code,
          duration,
          stdout,
          stderr,
          success: code === 0,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          metrics: this.parseTestMetrics(stdout)
        };

        this.testResults[suiteName.toLowerCase().replace(/[^a-z]/g, '')] = result;

        if (code === 0) {
          console.log(`✅ ${suiteName} tests completed successfully in ${duration}ms`);
        } else {
          console.log(`❌ ${suiteName} tests failed with exit code ${code}`);
        }

        resolve(result);
      });
    });
  }

  parseTestMetrics(output) {
    const metrics = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      coverage: null,
      performance: [],
      errors: []
    };

    // Parse Jest output
    const testSummaryMatch = output.match(/Tests:\s*(\d+)\s*failed.*?(\d+)\s*passed.*?(\d+)\s*total/);
    if (testSummaryMatch) {
      metrics.failedTests = parseInt(testSummaryMatch[1]) || 0;
      metrics.passedTests = parseInt(testSummaryMatch[2]) || 0;
      metrics.totalTests = parseInt(testSummaryMatch[3]) || 0;
    }

    // Parse coverage information
    const coverageMatch = output.match(/All files.*?(\d+\.?\d*)/);
    if (coverageMatch) {
      metrics.coverage = parseFloat(coverageMatch[1]);
    }

    // Parse performance metrics
    const performanceMatches = output.matchAll(/performance.*?(\d+\.?\d*)\s*ms/gi);
    for (const match of performanceMatches) {
      metrics.performance.push({
        metric: match[0],
        value: parseFloat(match[1])
      });
    }

    // Parse error information
    const errorMatches = output.matchAll(/Error:.*$/gm);
    for (const match of errorMatches) {
      metrics.errors.push(match[0]);
    }

    return metrics;
  }

  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');

    // Ensure test database is ready
    try {
      await this.executeCommand('npm run db:test:setup', 'Setting up test database');
    } catch (error) {
      console.warn('⚠️  Test database setup failed, continuing with existing setup');
    }

    // Start backend services for integration testing
    console.log('🚀 Starting backend services...');

    return new Promise((resolve) => {
      const backendProcess = spawn('npm', ['run', 'backend:test'], {
        cwd: process.cwd(),
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test', PORT: '8001' }
      });

      // Give backend time to start
      setTimeout(() => {
        console.log('✅ Backend services started');
        resolve(backendProcess);
      }, 5000);
    });
  }

  async executeCommand(command, description) {
    console.log(`📋 ${description}...`);

    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ ${description} failed:`, error.message);
          reject(error);
        } else {
          console.log(`✅ ${description} completed`);
          resolve({ stdout, stderr });
        }
      });
    });
  }

  generateReport() {
    const { summary } = this.testResults;

    // Calculate totals
    Object.values(this.testResults).forEach(result => {
      if (result && result.metrics) {
        summary.totalTests += result.metrics.totalTests || 0;
        summary.passedTests += result.metrics.passedTests || 0;
        summary.failedTests += result.metrics.failedTests || 0;
        summary.skippedTests += result.metrics.skippedTests || 0;
      }
    });

    summary.endTime = new Date();
    summary.duration = summary.endTime - summary.startTime;

    const report = {
      summary: summary,
      testSuites: {
        comprehensive: this.testResults.comprehensive,
        performance: this.testResults.performance,
        security: this.testResults.security,
        frontendBackend: this.testResults.frontendbackend
      },
      recommendations: this.generateRecommendations(),
      productionReadiness: this.assessProductionReadiness()
    };

    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    // Check test coverage
    const coverageResults = Object.values(this.testResults)
      .filter(r => r && r.metrics && r.metrics.coverage !== null)
      .map(r => r.metrics.coverage);

    if (coverageResults.length > 0) {
      const avgCoverage = coverageResults.reduce((a, b) => a + b, 0) / coverageResults.length;
      if (avgCoverage < 80) {
        recommendations.push({
          type: 'coverage',
          priority: 'high',
          message: `Test coverage is ${avgCoverage.toFixed(1)}%. Recommend increasing to >80%`,
          action: 'Add more unit and integration tests'
        });
      }
    }

    // Check performance metrics
    if (this.testResults.performance && this.testResults.performance.metrics) {
      const performanceMetrics = this.testResults.performance.metrics.performance;
      if (performanceMetrics.some(p => p.value > 1000)) {
        recommendations.push({
          type: 'performance',
          priority: 'medium',
          message: 'Some API endpoints have response times >1000ms',
          action: 'Optimize database queries and add caching'
        });
      }
    }

    // Check security results
    if (this.testResults.security && this.testResults.security.metrics.failedTests > 0) {
      recommendations.push({
        type: 'security',
        priority: 'critical',
        message: 'Security tests failed',
        action: 'Address security vulnerabilities before production deployment'
      });
    }

    // Check frontend-backend integration
    if (this.testResults.frontendbackend && this.testResults.frontendbackend.metrics.failedTests > 0) {
      recommendations.push({
        type: 'integration',
        priority: 'high',
        message: 'Frontend-backend integration tests failed',
        action: 'Fix integration issues and API contract mismatches'
      });
    }

    return recommendations;
  }

  assessProductionReadiness() {
    const assessment = {
      ready: true,
      score: 0,
      maxScore: 100,
      criteria: []
    };

    // Test pass rate (25 points)
    const passRate = this.testResults.summary.totalTests > 0
      ? (this.testResults.summary.passedTests / this.testResults.summary.totalTests) * 100
      : 0;

    const testPoints = Math.min(25, (passRate / 100) * 25);
    assessment.score += testPoints;
    assessment.criteria.push({
      name: 'Test Pass Rate',
      score: testPoints,
      maxScore: 25,
      status: passRate >= 95 ? 'pass' : passRate >= 80 ? 'warning' : 'fail',
      details: `${passRate.toFixed(1)}% tests passing`
    });

    // Security (25 points)
    const securityPassed = this.testResults.security
      ? this.testResults.security.metrics.failedTests === 0
      : false;

    const securityPoints = securityPassed ? 25 : 0;
    assessment.score += securityPoints;
    assessment.criteria.push({
      name: 'Security Tests',
      score: securityPoints,
      maxScore: 25,
      status: securityPassed ? 'pass' : 'fail',
      details: securityPassed ? 'All security tests passed' : 'Security vulnerabilities detected'
    });

    // Performance (25 points)
    const performancePassed = this.testResults.performance
      ? this.testResults.performance.metrics.failedTests === 0
      : false;

    const performancePoints = performancePassed ? 25 : 0;
    assessment.score += performancePoints;
    assessment.criteria.push({
      name: 'Performance Tests',
      score: performancePoints,
      maxScore: 25,
      status: performancePassed ? 'pass' : 'fail',
      details: performancePassed ? 'Performance requirements met' : 'Performance issues detected'
    });

    // Integration (25 points)
    const integrationPassed = this.testResults.comprehensive
      ? this.testResults.comprehensive.metrics.failedTests === 0
      : false;

    const integrationPoints = integrationPassed ? 25 : 0;
    assessment.score += integrationPoints;
    assessment.criteria.push({
      name: 'Integration Tests',
      score: integrationPoints,
      maxScore: 25,
      status: integrationPassed ? 'pass' : 'fail',
      details: integrationPassed ? 'All integration tests passed' : 'Integration issues detected'
    });

    assessment.ready = assessment.score >= 80;

    return assessment;
  }

  async saveReport(report) {
    const reportPath = path.join(process.cwd(), 'test-results', 'integration-test-report.json');
    const reportDir = path.dirname(reportPath);

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Test report saved to: ${reportPath}`);

    // Store in memory for Claude Flow coordination
    await this.storeInMemory(report);
  }

  async storeInMemory(report) {
    try {
      const { spawn } = require('child_process');

      const memoryData = {
        timestamp: new Date().toISOString(),
        testResults: report,
        productionReadiness: report.productionReadiness,
        recommendations: report.recommendations,
        coverage: report.summary.coverage,
        performance: report.summary.performance
      };

      const hookProcess = spawn('npx', [
        'claude-flow@alpha', 'hooks', 'post-edit',
        '--file', 'integration-test-report.json',
        '--memory-key', 'development/testing/final-report',
        '--content', JSON.stringify(memoryData)
      ], { stdio: 'pipe' });

      hookProcess.on('close', (code) => {
        if (code === 0) {
          console.log('💾 Test results stored in memory');
        } else {
          console.warn('⚠️  Failed to store results in memory');
        }
      });
    } catch (error) {
      console.warn('⚠️  Memory storage failed:', error.message);
    }
  }

  async run() {
    console.log('🔥 Starting Comprehensive Integration Test Suite');
    console.log('=' * 60);

    let backendProcess;

    try {
      // Setup test environment
      backendProcess = await this.setupTestEnvironment();

      // Run test suites
      const testSuites = [
        {
          name: 'Comprehensive Integration',
          file: 'tests/integration/comprehensive-integration.test.js'
        },
        {
          name: 'Performance Testing',
          file: 'tests/integration/performance.test.js'
        },
        {
          name: 'Security Testing',
          file: 'tests/integration/security.test.js'
        },
        {
          name: 'Frontend-Backend Integration',
          file: 'tests/integration/frontend-backend.test.js'
        }
      ];

      for (const suite of testSuites) {
        await this.runTestSuite(suite.name, suite.file);
      }

      // Generate and save report
      const report = this.generateReport();
      await this.saveReport(report);

      // Print summary
      this.printSummary(report);

      return report;

    } catch (error) {
      console.error('💥 Test execution failed:', error.message);
      return null;
    } finally {
      // Cleanup
      if (backendProcess) {
        console.log('🧹 Cleaning up backend services...');
        backendProcess.kill();
      }
    }
  }

  printSummary(report) {
    console.log('\n🎯 INTEGRATION TEST SUMMARY');
    console.log('=' * 60);

    const { summary, productionReadiness } = report;

    console.log(`📊 Total Tests: ${summary.totalTests}`);
    console.log(`✅ Passed: ${summary.passedTests}`);
    console.log(`❌ Failed: ${summary.failedTests}`);
    console.log(`⏭️  Skipped: ${summary.skippedTests}`);
    console.log(`⏱️  Duration: ${(summary.duration / 1000).toFixed(1)}s`);

    console.log(`\n🎯 Production Readiness Score: ${productionReadiness.score}/${productionReadiness.maxScore}`);
    console.log(`🚀 Production Ready: ${productionReadiness.ready ? 'YES ✅' : 'NO ❌'}`);

    if (report.recommendations.length > 0) {
      console.log('\n📋 RECOMMENDATIONS:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
        console.log(`   Action: ${rec.action}`);
      });
    }

    console.log('\n🏁 Integration testing completed!');
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.run().then((report) => {
    process.exit(report && report.productionReadiness.ready ? 0 : 1);
  });
}

module.exports = IntegrationTestRunner;