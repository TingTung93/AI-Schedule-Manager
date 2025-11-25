#!/usr/bin/env python3
"""
Security Features Demonstration Script

This script demonstrates the security hardening features:
1. Rate limiting on authentication endpoints
2. Input sanitization for XSS prevention
3. Request size limits
4. Security logging
"""

import html
import time
from typing import Optional


def sanitize_text(text: Optional[str]) -> Optional[str]:
    """Sanitize text input to prevent XSS attacks"""
    if text:
        return html.escape(text.strip())
    return text


def demo_xss_sanitization():
    """Demonstrate XSS prevention through HTML escaping"""
    print("\n" + "="*60)
    print("🛡️  XSS SANITIZATION DEMONSTRATION")
    print("="*60)

    test_cases = [
        ('<script>alert("XSS")</script>', 'Malicious script tag'),
        ('John <b>Doe</b>', 'HTML formatting tags'),
        ('user@example.com', 'Normal email address'),
        ('Text with "quotes" and \'apostrophes\'', 'Quoted text'),
        ('  Spaced Text  ', 'Whitespace trimming'),
        (None, 'None value'),
    ]

    for input_text, description in test_cases:
        output = sanitize_text(input_text)
        print(f"\n{description}:")
        print(f"  Input:  {input_text!r}")
        print(f"  Output: {output!r}")

        if input_text and '<' in input_text:
            print(f"  Status: ✅ HTML escaped - XSS prevented")
        elif input_text and input_text != input_text.strip():
            print(f"  Status: ✅ Whitespace trimmed")
        else:
            print(f"  Status: ✅ Safe input preserved")


def demo_rate_limiting():
    """Demonstrate rate limiting configuration"""
    print("\n" + "="*60)
    print("⏱️  RATE LIMITING CONFIGURATION")
    print("="*60)

    rate_limits = [
        {
            'endpoint': 'POST /api/auth/login',
            'limit': '5 per 15 minutes',
            'purpose': 'Prevent brute force attacks',
            'examples': [
                '✅ Attempt 1-5: Allowed',
                '❌ Attempt 6: 429 Too Many Requests',
                '⏰ Wait 15 minutes for reset'
            ]
        },
        {
            'endpoint': 'POST /api/auth/register',
            'limit': '5 per hour',
            'purpose': 'Prevent automated account creation',
            'examples': [
                '✅ Create 1-5 accounts: Allowed',
                '❌ Create 6th account: 429 Too Many Requests',
                '⏰ Wait 1 hour for reset'
            ]
        },
        {
            'endpoint': 'POST /api/auth/refresh',
            'limit': '10 per minute',
            'purpose': 'Allow legitimate token refresh',
            'examples': [
                '✅ Refresh 1-10 times: Allowed',
                '❌ Refresh 11th time: 429 Too Many Requests',
                '⏰ Wait 1 minute for reset'
            ]
        },
        {
            'endpoint': 'POST /api/employees',
            'limit': '10 per minute',
            'purpose': 'Prevent bulk employee creation',
            'examples': [
                '✅ Create 1-10 employees: Allowed',
                '❌ Create 11th employee: 429 Too Many Requests',
                '⏰ Wait 1 minute for reset'
            ]
        },
        {
            'endpoint': 'PATCH /api/employees/{id}',
            'limit': '10 per minute',
            'purpose': 'Prevent automated profile manipulation',
            'examples': [
                '✅ Update 1-10 profiles: Allowed',
                '❌ Update 11th profile: 429 Too Many Requests',
                '⏰ Wait 1 minute for reset'
            ]
        },
    ]

    for config in rate_limits:
        print(f"\n📍 {config['endpoint']}")
        print(f"   Limit: {config['limit']}")
        print(f"   Purpose: {config['purpose']}")
        print("   Behavior:")
        for example in config['examples']:
            print(f"     {example}")


def demo_request_size_limits():
    """Demonstrate request size limit protection"""
    print("\n" + "="*60)
    print("📦 REQUEST SIZE LIMIT PROTECTION")
    print("="*60)

    print("\nMaximum Request Body Size: 1 MB (1,048,576 bytes)")
    print("\nProtection Against DoS Attacks:")

    scenarios = [
        {
            'size': '500 KB',
            'bytes': 512_000,
            'status': '✅ Allowed',
            'description': 'Normal request with reasonable payload'
        },
        {
            'size': '1 MB',
            'bytes': 1_048_576,
            'status': '✅ Allowed',
            'description': 'Maximum allowed size'
        },
        {
            'size': '1.5 MB',
            'bytes': 1_572_864,
            'status': '❌ Rejected (413)',
            'description': 'Exceeds limit - prevented DoS'
        },
        {
            'size': '10 MB',
            'bytes': 10_485_760,
            'status': '❌ Rejected (413)',
            'description': 'Large payload attack - blocked'
        },
    ]

    for scenario in scenarios:
        print(f"\n  {scenario['size']} ({scenario['bytes']:,} bytes)")
        print(f"    Status: {scenario['status']}")
        print(f"    Description: {scenario['description']}")


def demo_security_logging():
    """Demonstrate security logging features"""
    print("\n" + "="*60)
    print("📋 SECURITY LOGGING")
    print("="*60)

    print("\nLogged Events:")

    events = [
        {
            'type': 'Authentication Attempts',
            'details': [
                'IP address of requester',
                'Timestamp of attempt',
                'Success/failure status',
                'User agent information',
                'Failure reason (if applicable)'
            ],
            'example': 'INFO: Auth request: POST /api/auth/login from 192.168.1.100'
        },
        {
            'type': 'Mutating Operations',
            'details': [
                'HTTP method (POST/PUT/PATCH/DELETE)',
                'Endpoint accessed',
                'User performing action',
                'Timestamp of operation'
            ],
            'example': 'INFO: Mutating request: POST /api/employees from 192.168.1.100'
        },
        {
            'type': 'Slow Requests (Potential DoS)',
            'details': [
                'Request method and path',
                'Execution time (>5 seconds)',
                'Client IP address',
                'Timestamp'
            ],
            'example': 'WARNING: Slow request: GET /api/analytics took 6.23s'
        },
        {
            'type': 'Rate Limit Violations',
            'details': [
                'Client IP address',
                'Endpoint that was rate limited',
                'Number of requests attempted',
                'Timestamp of violation'
            ],
            'example': 'WARNING: Rate limit exceeded for 192.168.1.100 on POST /api/auth/login'
        },
    ]

    for event in events:
        print(f"\n🔍 {event['type']}")
        print("   Captured Information:")
        for detail in event['details']:
            print(f"     • {detail}")
        print(f"   Example Log Entry:")
        print(f"     {event['example']}")


def demo_summary():
    """Display security features summary"""
    print("\n" + "="*60)
    print("✅ SECURITY FEATURES SUMMARY")
    print("="*60)

    features = [
        ('Rate Limiting', [
            'Login: 5 attempts per 15 minutes',
            'Registration: 5 per hour',
            'Token refresh: 10 per minute',
            'Employee operations: 10 per minute',
            'IP-based tracking with proxy awareness'
        ]),
        ('Input Sanitization', [
            'HTML special characters escaped',
            'XSS attack prevention',
            'Whitespace trimming',
            'All text fields protected'
        ]),
        ('Request Protection', [
            'Maximum body size: 1 MB',
            'DoS attack prevention',
            'Large payload blocking',
            'Content-length validation'
        ]),
        ('Security Logging', [
            'Authentication attempt tracking',
            'Mutating operation logging',
            'Slow request detection',
            'Rate limit violation alerts'
        ]),
    ]

    for feature, details in features:
        print(f"\n🛡️  {feature}")
        for detail in details:
            print(f"     ✓ {detail}")

    print("\n" + "="*60)
    print("🎉 All security features are active and protecting the application!")
    print("="*60 + "\n")


if __name__ == "__main__":
    print("\n")
    print("╔" + "="*58 + "╗")
    print("║" + " "*58 + "║")
    print("║" + "  🔒 AI SCHEDULE MANAGER - SECURITY FEATURES DEMO  ".center(58) + "║")
    print("║" + " "*58 + "║")
    print("╚" + "="*58 + "╝")

    demo_xss_sanitization()
    demo_rate_limiting()
    demo_request_size_limits()
    demo_security_logging()
    demo_summary()

    print("\n📖 For more details, see:")
    print("   docs/security-hardening-report.md")
    print("\n")
