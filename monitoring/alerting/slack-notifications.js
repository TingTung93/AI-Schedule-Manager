/**
 * Slack Notification Service
 * Real-time alerts and notifications to Slack channels
 */

const { WebClient } = require('@slack/web-api');

class SlackNotificationService {
  constructor() {
    this.slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    this.channels = {
      alerts: process.env.SLACK_ALERTS_CHANNEL || '#alerts',
      errors: process.env.SLACK_ERRORS_CHANNEL || '#errors',
      monitoring: process.env.SLACK_MONITORING_CHANNEL || '#monitoring',
      business: process.env.SLACK_BUSINESS_CHANNEL || '#business-metrics'
    };
  }

  async sendAlert(channel, severity, title, message, details = {}) {
    const color = this.getSeverityColor(severity);
    const emoji = this.getSeverityEmoji(severity);

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${title}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message
        }
      }
    ];

    if (details.metrics) {
      blocks.push({
        type: 'section',
        fields: details.metrics.map(metric => ({
          type: 'mrkdwn',
          text: `*${metric.name}:* ${metric.value}`
        }))
      });
    }

    if (details.runbook) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Runbook'
            },
            url: details.runbook,
            style: 'primary'
          }
        ]
      });
    }

    if (details.dashboard) {
      blocks[blocks.length - 1].elements.push({
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View Dashboard'
        },
        url: details.dashboard
      });
    }

    try {
      const result = await this.slack.chat.postMessage({
        channel,
        blocks,
        attachments: [{
          color,
          footer: 'AI Schedule Manager Monitoring',
          ts: Math.floor(Date.now() / 1000)
        }]
      });

      return result;
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
      throw error;
    }
  }

  async sendSystemAlert(severity, component, issue, metrics = [], runbook = null) {
    const message = `*Component:* ${component}\n*Issue:* ${issue}\n*Time:* ${new Date().toISOString()}`;

    await this.sendAlert(
      this.channels.alerts,
      severity,
      `System Alert - ${component}`,
      message,
      {
        metrics: metrics.map(m => ({ name: m.name, value: m.value })),
        runbook,
        dashboard: 'https://monitoring.ai-schedule-manager.com/dashboard/system'
      }
    );
  }

  async sendErrorAlert(error, context = {}) {
    const message = `*Error:* ${error.message}\n*Stack:* \`\`\`${error.stack?.slice(0, 500) || 'No stack trace'}\`\`\`\n*Context:* ${JSON.stringify(context, null, 2)}`;

    await this.sendAlert(
      this.channels.errors,
      'error',
      'Application Error',
      message,
      {
        dashboard: 'https://monitoring.ai-schedule-manager.com/dashboard/errors'
      }
    );
  }

  async sendPerformanceAlert(metric, value, threshold, trend = null) {
    const trendText = trend ? `\n*Trend:* ${trend}` : '';
    const message = `*Metric:* ${metric}\n*Current Value:* ${value}\n*Threshold:* ${threshold}${trendText}`;

    await this.sendAlert(
      this.channels.monitoring,
      'warning',
      'Performance Alert',
      message,
      {
        dashboard: 'https://monitoring.ai-schedule-manager.com/dashboard/performance'
      }
    );
  }

  async sendBusinessMetricAlert(metric, value, change, timeframe) {
    const changeDirection = change > 0 ? '📈' : '📉';
    const message = `*Metric:* ${metric}\n*Current Value:* ${value}\n*Change:* ${changeDirection} ${Math.abs(change)}% over ${timeframe}`;

    await this.sendAlert(
      this.channels.business,
      'info',
      'Business Metric Update',
      message,
      {
        dashboard: 'https://monitoring.ai-schedule-manager.com/dashboard/business'
      }
    );
  }

  async sendIncidentUpdate(incidentId, status, description, assignee = null) {
    const statusEmoji = {
      'investigating': '🔍',
      'identified': '✅',
      'monitoring': '👀',
      'resolved': '✅'
    };

    const assigneeText = assignee ? `\n*Assignee:* <@${assignee}>` : '';
    const message = `*Incident ID:* ${incidentId}\n*Status:* ${status}\n*Description:* ${description}${assigneeText}`;

    await this.sendAlert(
      this.channels.alerts,
      'info',
      `${statusEmoji[status] || '📢'} Incident Update`,
      message,
      {
        dashboard: `https://monitoring.ai-schedule-manager.com/incidents/${incidentId}`
      }
    );
  }

  async sendDeploymentNotification(version, environment, status, deployer) {
    const statusEmoji = status === 'success' ? '🚀' : '❌';
    const severity = status === 'success' ? 'info' : 'error';
    const message = `*Version:* ${version}\n*Environment:* ${environment}\n*Status:* ${status}\n*Deployed by:* ${deployer}`;

    await this.sendAlert(
      this.channels.monitoring,
      severity,
      `${statusEmoji} Deployment ${status}`,
      message
    );
  }

  async sendMaintenanceNotification(type, startTime, duration, description) {
    const message = `*Type:* ${type}\n*Start Time:* ${startTime}\n*Duration:* ${duration}\n*Description:* ${description}`;

    await this.sendAlert(
      this.channels.alerts,
      'info',
      '🔧 Scheduled Maintenance',
      message
    );
  }

  async sendSecurityAlert(threatType, severity, details) {
    const message = `*Threat Type:* ${threatType}\n*Severity:* ${severity}\n*Details:* ${details}\n*Time:* ${new Date().toISOString()}`;

    await this.sendAlert(
      this.channels.alerts,
      'critical',
      '🚨 Security Alert',
      message,
      {
        runbook: 'https://runbooks.ai-schedule-manager.com/security-response'
      }
    );
  }

  getSeverityColor(severity) {
    const colors = {
      critical: '#FF0000',
      error: '#FF6B47',
      warning: '#FFB366',
      info: '#36C5F0'
    };
    return colors[severity] || colors.info;
  }

  getSeverityEmoji(severity) {
    const emojis = {
      critical: '🚨',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return emojis[severity] || emojis.info;
  }

  // Schedule daily/weekly reports
  async sendDailyReport(metrics) {
    const message = `*Daily Performance Report*\n\n${metrics.map(m => `*${m.name}:* ${m.value}`).join('\n')}`;

    await this.slack.chat.postMessage({
      channel: this.channels.monitoring,
      text: message,
      attachments: [{
        color: '#36C5F0',
        footer: 'Daily Performance Report',
        ts: Math.floor(Date.now() / 1000)
      }]
    });
  }

  async sendWeeklyReport(summary) {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Weekly Performance Summary'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: summary.overview
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Uptime:* ${summary.uptime}%`
          },
          {
            type: 'mrkdwn',
            text: `*Total Requests:* ${summary.totalRequests}`
          },
          {
            type: 'mrkdwn',
            text: `*Avg Response Time:* ${summary.avgResponseTime}ms`
          },
          {
            type: 'mrkdwn',
            text: `*Error Rate:* ${summary.errorRate}%`
          }
        ]
      }
    ];

    await this.slack.chat.postMessage({
      channel: this.channels.monitoring,
      blocks
    });
  }
}

module.exports = new SlackNotificationService();