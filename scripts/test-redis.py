#!/usr/bin/env python3
"""
Test Redis Connection
Run with: python scripts/test-redis.py
"""

import sys
from pathlib import Path

# Add backend/src to path
backend_src = Path(__file__).parent.parent / "backend" / "src"
sys.path.insert(0, str(backend_src))


def test_redis_connection():
    """Test Redis connection"""

    print("=" * 60)
    print("Redis Connection Test")
    print("=" * 60)
    print()

    try:
        import redis

        # Try to connect
        print("🔌 Connecting to Redis...")
        r = redis.from_url("redis://localhost:6379/0")

        # Test ping
        print("🏓 Testing ping...")
        response = r.ping()
        if response:
            print("✅ Redis is responding")

        # Test set/get
        print()
        print("🧪 Testing set/get operations...")
        test_key = "test:connection"
        test_value = "Hello from Schedule Manager!"

        r.set(test_key, test_value)
        print(f"✅ Set key '{test_key}'")

        retrieved = r.get(test_key)
        if retrieved:
            print(f"✅ Get key '{test_key}': {retrieved.decode('utf-8')}")

        r.delete(test_key)
        print(f"✅ Deleted key '{test_key}'")

        # Test TTL
        print()
        print("⏱️  Testing TTL (time-to-live)...")
        ttl_key = "test:ttl"
        r.setex(ttl_key, 60, "Expires in 60 seconds")
        ttl = r.ttl(ttl_key)
        print(f"✅ Key '{ttl_key}' TTL: {ttl} seconds")
        r.delete(ttl_key)

        # Get info
        print()
        print("📊 Redis server info:")
        info = r.info()
        print(f"   Version: {info['redis_version']}")
        print(f"   Mode: {info['redis_mode']}")
        print(f"   Connected clients: {info['connected_clients']}")
        print(f"   Used memory: {info['used_memory_human']}")
        print(f"   Total commands: {info['total_commands_processed']}")

        # Test hash operations (useful for caching)
        print()
        print("🗂️  Testing hash operations...")
        hash_key = "test:user:1"
        r.hset(hash_key, mapping={
            "id": "1",
            "email": "test@example.com",
            "role": "admin"
        })
        print(f"✅ Created hash '{hash_key}'")

        user_data = r.hgetall(hash_key)
        print(f"✅ Retrieved hash data:")
        for key, value in user_data.items():
            print(f"      {key.decode('utf-8')}: {value.decode('utf-8')}")

        r.delete(hash_key)
        print(f"✅ Deleted hash '{hash_key}'")

        print()
        print("=" * 60)
        print("✅ All Redis tests passed!")
        print("=" * 60)
        print()
        print("Redis is ready for use with Schedule Manager!")
        print()
        print("Use cases:")
        print("  - Session caching")
        print("  - Schedule caching")
        print("  - Rate limiting")
        print("  - Real-time updates")

    except ImportError:
        print("❌ Redis Python package not installed!")
        print()
        print("Install with:")
        print("   pip install redis")
        sys.exit(1)

    except redis.ConnectionError as e:
        print(f"❌ Could not connect to Redis!")
        print()
        print(f"Error: {e}")
        print()
        print("Troubleshooting:")
        print("1. Check if Redis is running:")
        print("   sudo service redis-server status")
        print()
        print("2. Start Redis if not running:")
        print("   sudo service redis-server start")
        print()
        print("3. Test connection manually:")
        print("   redis-cli ping")
        sys.exit(1)

    except Exception as e:
        print(f"❌ Redis test failed!")
        print()
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    test_redis_connection()
