/**
 * Department Schedule Analytics Dashboard
 *
 * Comprehensive analytics dashboard showing:
 * - Coverage percentage trends (line/area chart)
 * - Overtime hours by employee (bar chart)
 * - Labor cost breakdown (pie chart)
 * - Staffing gap identification (table with recommendations)
 * - Trend analysis (week-over-week, month-over-month)
 * - Export capabilities (PDF/Excel)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { format, parseISO, startOfWeek, endOfWeek, addDays, differenceInDays } from 'date-fns';
import { getDepartmentAnalytics, exportAnalyticsReport } from '../../services/departmentService';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const DepartmentScheduleAnalytics = ({ departmentId, departmentName }) => {
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Date range state
  const [dateRange, setDateRange] = useState({
    startDate: format(addDays(new Date(), -30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });

  // Filter state
  const [filters, setFilters] = useState({
    employeeId: null,
    shiftType: null,
    metricType: 'all',
  });

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);

  /**
   * Fetch analytics data from API
   */
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getDepartmentAnalytics(
        departmentId,
        dateRange.startDate,
        dateRange.endDate,
        filters
      );

      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err.response?.data?.detail || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle export to PDF or Excel
   */
  const handleExport = async (format) => {
    try {
      setExporting(true);
      await exportAnalyticsReport(departmentId, format);
      // File download will be handled by the browser
    } catch (err) {
      console.error('Export failed:', err);
      setError(`Failed to export ${format.toUpperCase()} report`);
    } finally {
      setExporting(false);
    }
  };

  /**
   * Setup auto-refresh
   */
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchAnalytics, 60000); // Refresh every minute
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh]);

  /**
   * Initial data load and date range changes
   */
  useEffect(() => {
    if (departmentId) {
      fetchAnalytics();
    }
  }, [departmentId, dateRange, filters]);

  /**
   * Coverage percentage chart data
   */
  const coverageChartData = useMemo(() => {
    if (!analytics?.coverageTrend) return null;

    const labels = analytics.coverageTrend.map(item =>
      format(parseISO(item.date), 'MMM dd')
    );

    return {
      labels,
      datasets: [
        {
          label: 'Coverage Percentage',
          data: analytics.coverageTrend.map(item => item.coveragePercentage),
          fill: true,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
        },
        {
          label: 'Target Coverage',
          data: new Array(labels.length).fill(analytics.targetCoverage || 100),
          borderColor: 'rgb(239, 68, 68)',
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
        },
      ],
    };
  }, [analytics]);

  /**
   * Overtime hours bar chart data
   */
  const overtimeChartData = useMemo(() => {
    if (!analytics?.overtimeByEmployee) return null;

    const sortedData = [...analytics.overtimeByEmployee]
      .sort((a, b) => b.overtimeHours - a.overtimeHours)
      .slice(0, 10); // Top 10 employees

    return {
      labels: sortedData.map(item => item.employeeName),
      datasets: [
        {
          label: 'Overtime Hours',
          data: sortedData.map(item => item.overtimeHours),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
        },
      ],
    };
  }, [analytics]);

  /**
   * Labor cost pie chart data
   */
  const laborCostChartData = useMemo(() => {
    if (!analytics?.laborCostBreakdown) return null;

    const colors = [
      'rgba(239, 68, 68, 0.8)',   // Red
      'rgba(34, 197, 94, 0.8)',   // Green
      'rgba(59, 130, 246, 0.8)',  // Blue
      'rgba(251, 191, 36, 0.8)',  // Yellow
      'rgba(168, 85, 247, 0.8)',  // Purple
    ];

    return {
      labels: analytics.laborCostBreakdown.map(item => item.shiftType),
      datasets: [
        {
          label: 'Labor Cost ($)',
          data: analytics.laborCostBreakdown.map(item => item.totalCost),
          backgroundColor: colors.slice(0, analytics.laborCostBreakdown.length),
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    };
  }, [analytics]);

  /**
   * Chart options
   */
  const coverageChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Coverage Percentage Over Time',
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: (value) => `${value}%`,
        },
      },
    },
  };

  const overtimeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Top 10 Employees by Overtime Hours',
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.y.toFixed(1)} hours`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `${value}h`,
        },
      },
    },
  };

  const laborCostChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: 'Labor Cost Breakdown by Shift Type',
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: $${value.toLocaleString()} (${percentage}%)`;
          },
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error Loading Analytics</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
            <button
              onClick={fetchAnalytics}
              className="mt-3 text-sm font-medium text-red-800 hover:text-red-900"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No analytics data available for this department.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Schedule Analytics - {departmentName}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {format(parseISO(dateRange.startDate), 'MMM dd, yyyy')} - {format(parseISO(dateRange.endDate), 'MMM dd, yyyy')}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Date Range Picker */}
            <div className="flex gap-2">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Auto-refresh Toggle */}
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md bg-white">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Auto-refresh</span>
            </label>

            {/* Refresh Button */}
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Refresh
            </button>

            {/* Export Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('pdf')}
                disabled={exporting}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              >
                Export PDF
              </button>
              <button
                onClick={() => handleExport('excel')}
                disabled={exporting}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                Export Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg Coverage</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analytics.averageCoverage?.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
              <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Overtime</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analytics.totalOvertimeHours?.toFixed(1)}h
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Labor Cost</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${analytics.totalLaborCost?.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Staffing Gaps</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analytics.staffingGaps?.length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1: Coverage and Overtime */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="h-80">
            {coverageChartData && (
              <Line data={coverageChartData} options={coverageChartOptions} />
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="h-80">
            {overtimeChartData && (
              <Bar data={overtimeChartData} options={overtimeChartOptions} />
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Labor Cost and Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="h-80">
            {laborCostChartData && (
              <Pie data={laborCostChartData} options={laborCostChartOptions} />
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trend Analysis</h3>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-sm font-medium text-gray-700">Week-over-Week Change</p>
              <p className={`text-2xl font-bold ${analytics.weekOverWeekChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analytics.weekOverWeekChange >= 0 ? '+' : ''}{analytics.weekOverWeekChange?.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500">Coverage trend</p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <p className="text-sm font-medium text-gray-700">Month-over-Month Change</p>
              <p className={`text-2xl font-bold ${analytics.monthOverMonthChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analytics.monthOverMonthChange >= 0 ? '+' : ''}{analytics.monthOverMonthChange?.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500">Coverage trend</p>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <p className="text-sm font-medium text-gray-700">Cost Per Hour</p>
              <p className="text-2xl font-bold text-gray-900">
                ${analytics.costPerHour?.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">Average labor cost</p>
            </div>
          </div>
        </div>
      </div>

      {/* Staffing Gaps Table */}
      {analytics.staffingGaps && analytics.staffingGaps.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Staffing Gaps & Recommendations</h3>
            <p className="mt-1 text-sm text-gray-500">
              Periods with insufficient coverage requiring attention
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date/Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shift Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Required
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scheduled
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gap
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recommendation
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.staffingGaps.map((gap, index) => (
                  <tr key={index} className={gap.severity === 'critical' ? 'bg-red-50' : gap.severity === 'high' ? 'bg-yellow-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(parseISO(gap.date), 'MMM dd, yyyy')}
                      <br />
                      <span className="text-gray-500">{gap.timeRange}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {gap.shiftType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {gap.required}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {gap.scheduled}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                      -{gap.gap}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        gap.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        gap.severity === 'high' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {gap.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {gap.recommendation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overtime Details */}
      {analytics.overtimeByEmployee && analytics.overtimeByEmployee.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Overtime Details</h3>
            <p className="mt-1 text-sm text-gray-500">
              Complete breakdown of overtime hours and costs
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Regular Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overtime Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    OT Percentage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    OT Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Cost
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.overtimeByEmployee
                  .sort((a, b) => b.overtimeHours - a.overtimeHours)
                  .map((emp, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {emp.employeeName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {emp.regularHours?.toFixed(1)}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                        {emp.overtimeHours?.toFixed(1)}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {emp.overtimePercentage?.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${emp.overtimeCost?.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ${emp.totalCost?.toLocaleString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentScheduleAnalytics;
