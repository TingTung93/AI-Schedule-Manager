"""
Password reset email template.
"""

from typing import Dict, Any


def get_password_reset_template() -> Dict[str, Any]:
    """
    Get password reset email template structure.

    Returns:
        Dict containing template metadata and content
    """
    return {
        "name": "password_reset",
        "subject": "Reset Your Password - AI Schedule Manager",
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
            background-color: #4F46E5;
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
            background-color: #4F46E5;
            color: white !important;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 12px;
            color: #666;
        }
        .warning {
            background-color: #FEF3C7;
            border-left: 4px solid #F59E0B;
            padding: 15px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Password Reset Request</h1>
    </div>
    <div class="content">
        <p>Hello,</p>

        <p>We received a request to reset your password for your AI Schedule Manager account.</p>

        <p>Click the button below to reset your password:</p>

        <div style="text-align: center;">
            <a href="{{ reset_url }}" class="button">Reset Password</a>
        </div>

        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #4F46E5;">{{ reset_url }}</p>

        <div class="warning">
            <strong>Security Notice:</strong>
            <ul>
                <li>This link will expire in {{ expiry_hours }} hours</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Never share this link with anyone</li>
            </ul>
        </div>

        <p>If you're having trouble with the button above, copy and paste the URL into your web browser.</p>

        <p>Best regards,<br>AI Schedule Manager Team</p>
    </div>
    <div class="footer">
        <p>This is an automated message, please do not reply to this email.</p>
        <p>&copy; 2025 AI Schedule Manager. All rights reserved.</p>
    </div>
</body>
</html>
""",
        "text": """
Password Reset Request

Hello,

We received a request to reset your password for your AI Schedule Manager account.

To reset your password, please visit the following link:
{{ reset_url }}

SECURITY NOTICE:
- This link will expire in {{ expiry_hours }} hours
- If you didn't request this reset, please ignore this email
- Never share this link with anyone

If you're having trouble, copy and paste the URL into your web browser.

Best regards,
AI Schedule Manager Team

---
This is an automated message, please do not reply to this email.
© 2025 AI Schedule Manager. All rights reserved.
""",
        "variables": {
            "reset_url": "URL for password reset",
            "expiry_hours": "Number of hours until link expires (default: 24)"
        }
    }


def get_welcome_template() -> Dict[str, Any]:
    """
    Get welcome email template structure.

    Returns:
        Dict containing template metadata and content
    """
    return {
        "name": "welcome",
        "subject": "Welcome to AI Schedule Manager!",
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
            background-color: #4F46E5;
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
            background-color: #4F46E5;
            color: white !important;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to AI Schedule Manager!</h1>
    </div>
    <div class="content">
        <p>Hello {{ user_name }},</p>

        <p>Thank you for registering with AI Schedule Manager! We're excited to have you on board.</p>

        <p>Your account has been successfully created. You can now:</p>
        <ul>
            <li>View and manage your schedule</li>
            <li>Update your availability</li>
            <li>Receive shift notifications</li>
            <li>Track your work hours</li>
        </ul>

        <div style="text-align: center;">
            <a href="{{ app_url }}" class="button">Go to Dashboard</a>
        </div>

        <p>If you have any questions, please don't hesitate to reach out to your manager or our support team.</p>

        <p>Best regards,<br>AI Schedule Manager Team</p>
    </div>
</body>
</html>
""",
        "text": """
Welcome to AI Schedule Manager!

Hello {{ user_name }},

Thank you for registering with AI Schedule Manager! We're excited to have you on board.

Your account has been successfully created. You can now:
- View and manage your schedule
- Update your availability
- Receive shift notifications
- Track your work hours

Visit {{ app_url }} to get started.

If you have any questions, please don't hesitate to reach out to your manager or our support team.

Best regards,
AI Schedule Manager Team
""",
        "variables": {
            "user_name": "User's full name",
            "app_url": "URL to the application dashboard"
        }
    }
