"""
Schedule notification email templates.
"""

from typing import Dict, Any


def get_schedule_published_template() -> Dict[str, Any]:
    """
    Get schedule published notification template.

    Returns:
        Dict containing template metadata and content
    """
    return {
        "name": "schedule_published",
        "subject": "Your Schedule for Week of {{ week_start }} is Now Available",
        "html": """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #10B981;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #f9f9f9;
            padding: 30px;
            border: 1px solid #ddd;
            border-radius: 0 0 5px 5px;
        }
        .button {
            display: inline-block;
            background-color: #10B981;
            color: white !important;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
        .schedule-summary {
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .shift-item {
            padding: 10px;
            margin: 10px 0;
            border-left: 4px solid #10B981;
            background-color: #F0FDF4;
        }
        .info-box {
            background-color: #DBEAFE;
            border-left: 4px solid #3B82F6;
            padding: 15px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📅 New Schedule Published</h1>
    </div>
    <div class="content">
        <p>Hello {{ employee_name }},</p>

        <p>Your schedule for the week of <strong>{{ week_start }}</strong> to <strong>{{ week_end }}</strong> is now available.</p>

        <div class="schedule-summary">
            <h3>Your Shifts This Week:</h3>
            {% for shift in shifts %}
            <div class="shift-item">
                <strong>{{ shift.day }}</strong> - {{ shift.date }}<br>
                {{ shift.start_time }} - {{ shift.end_time }}<br>
                <em>{{ shift.department }} - {{ shift.shift_name }}</em>
            </div>
            {% endfor %}

            <p style="margin-top: 20px;">
                <strong>Total Hours:</strong> {{ total_hours }} hours
            </p>
        </div>

        <div class="info-box">
            <strong>Important:</strong>
            <ul>
                <li>Please review your schedule and report any conflicts immediately</li>
                <li>Set reminders for your shifts</li>
                <li>Contact your manager if you have any questions</li>
            </ul>
        </div>

        <div style="text-align: center;">
            <a href="{{ schedule_url }}" class="button">View Full Schedule</a>
        </div>

        <p>If you need to request any changes, please contact your manager as soon as possible.</p>

        <p>Best regards,<br>{{ manager_name }}<br>{{ department_name }}</p>
    </div>
</body>
</html>
""",
        "text": """
New Schedule Published

Hello {{ employee_name }},

Your schedule for the week of {{ week_start }} to {{ week_end }} is now available.

YOUR SHIFTS THIS WEEK:
{% for shift in shifts %}
{{ shift.day }} - {{ shift.date }}
{{ shift.start_time }} - {{ shift.end_time }}
{{ shift.department }} - {{ shift.shift_name }}

{% endfor %}

Total Hours: {{ total_hours }} hours

IMPORTANT:
- Please review your schedule and report any conflicts immediately
- Set reminders for your shifts
- Contact your manager if you have any questions

View your full schedule at: {{ schedule_url }}

If you need to request any changes, please contact your manager as soon as possible.

Best regards,
{{ manager_name }}
{{ department_name }}
""",
        "variables": {
            "employee_name": "Employee's full name",
            "week_start": "Week start date",
            "week_end": "Week end date",
            "shifts": "List of shift objects with day, date, times, department, shift_name",
            "total_hours": "Total hours for the week",
            "schedule_url": "URL to view full schedule",
            "manager_name": "Manager's name",
            "department_name": "Department name"
        }
    }


def get_schedule_changed_template() -> Dict[str, Any]:
    """
    Get schedule changed notification template.

    Returns:
        Dict containing template metadata and content
    """
    return {
        "name": "schedule_changed",
        "subject": "⚠️ Schedule Update: Changes to Your {{ week_start }} Schedule",
        "html": """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #F59E0B;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #f9f9f9;
            padding: 30px;
            border: 1px solid #ddd;
            border-radius: 0 0 5px 5px;
        }
        .button {
            display: inline-block;
            background-color: #F59E0B;
            color: white !important;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
        .warning {
            background-color: #FEF3C7;
            border-left: 4px solid #F59E0B;
            padding: 15px;
            margin: 20px 0;
        }
        .changes {
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚠️ Schedule Updated</h1>
    </div>
    <div class="content">
        <p>Hello {{ employee_name }},</p>

        <div class="warning">
            <strong>Important:</strong> Your schedule for the week of {{ week_start }} has been updated.
        </div>

        <p>The following changes have been made:</p>

        <div class="changes">
            {% for change in changes %}
            <p><strong>{{ change.type }}:</strong> {{ change.description }}</p>
            {% endfor %}
        </div>

        <div style="text-align: center;">
            <a href="{{ schedule_url }}" class="button">View Updated Schedule</a>
        </div>

        <p>Please review the changes and contact your manager immediately if there are any conflicts.</p>

        <p>Best regards,<br>{{ manager_name }}</p>
    </div>
</body>
</html>
""",
        "text": """
Schedule Updated

Hello {{ employee_name }},

IMPORTANT: Your schedule for the week of {{ week_start }} has been updated.

CHANGES:
{% for change in changes %}
{{ change.type }}: {{ change.description }}
{% endfor %}

View your updated schedule at: {{ schedule_url }}

Please review the changes and contact your manager immediately if there are any conflicts.

Best regards,
{{ manager_name }}
""",
        "variables": {
            "employee_name": "Employee's full name",
            "week_start": "Week start date",
            "changes": "List of change objects with type and description",
            "schedule_url": "URL to view updated schedule",
            "manager_name": "Manager's name"
        }
    }


def get_shift_reminder_template() -> Dict[str, Any]:
    """
    Get shift reminder notification template.

    Returns:
        Dict containing template metadata and content
    """
    return {
        "name": "shift_reminder",
        "subject": "🔔 Reminder: Your Shift Tomorrow at {{ start_time }}",
        "html": """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #3B82F6;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #f9f9f9;
            padding: 30px;
            border: 1px solid #ddd;
            border-radius: 0 0 5px 5px;
        }
        .shift-details {
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #3B82F6;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔔 Shift Reminder</h1>
    </div>
    <div class="content">
        <p>Hello {{ employee_name }},</p>

        <p>This is a friendly reminder about your upcoming shift:</p>

        <div class="shift-details">
            <p><strong>Date:</strong> {{ shift_date }}</p>
            <p><strong>Time:</strong> {{ start_time }} - {{ end_time }}</p>
            <p><strong>Location:</strong> {{ department_name }}</p>
            <p><strong>Shift:</strong> {{ shift_name }}</p>
            {% if notes %}
            <p><strong>Notes:</strong> {{ notes }}</p>
            {% endif %}
        </div>

        <p>See you tomorrow!</p>

        <p>Best regards,<br>{{ manager_name }}</p>
    </div>
</body>
</html>
""",
        "text": """
Shift Reminder

Hello {{ employee_name }},

This is a friendly reminder about your upcoming shift:

Date: {{ shift_date }}
Time: {{ start_time }} - {{ end_time }}
Location: {{ department_name }}
Shift: {{ shift_name }}
{% if notes %}
Notes: {{ notes }}
{% endif %}

See you tomorrow!

Best regards,
{{ manager_name }}
""",
        "variables": {
            "employee_name": "Employee's full name",
            "shift_date": "Shift date",
            "start_time": "Shift start time",
            "end_time": "Shift end time",
            "department_name": "Department name",
            "shift_name": "Shift name",
            "notes": "Optional shift notes",
            "manager_name": "Manager's name"
        }
    }
