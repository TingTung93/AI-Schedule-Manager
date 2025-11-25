#!/usr/bin/env python3
"""
Test script for server-side search, filtering, and sorting
"""
import requests
import json
from typing import Optional

BASE_URL = "http://localhost:8000"

def login(email: str = "admin@example.com", password: str = "Admin123!"):
    """Login and get access token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password}
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    else:
        print(f"Login failed: {response.status_code} - {response.text}")
        return None

def test_employees_endpoint(
    token: str,
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    department_id: Optional[int] = None,
    sort_by: str = 'first_name',
    sort_order: str = 'asc',
    skip: int = 0,
    limit: int = 100
):
    """Test the employees endpoint with various parameters"""
    params = {
        'skip': skip,
        'limit': limit,
        'sort_by': sort_by,
        'sort_order': sort_order
    }

    if search:
        params['search'] = search
    if role:
        params['role'] = role
    if is_active is not None:
        params['is_active'] = is_active
    if department_id is not None:
        params['department_id'] = department_id

    headers = {"Authorization": f"Bearer {token}"}

    print(f"\n{'='*80}")
    print(f"Testing with parameters: {params}")
    print(f"{'='*80}")

    response = requests.get(
        f"{BASE_URL}/api/employees",
        params=params,
        headers=headers
    )

    if response.status_code == 200:
        data = response.json()
        print(f"✓ Success! Total: {data.get('total')}, Returned: {len(data.get('employees', []))}")

        # Print first 3 employees as sample
        employees = data.get('employees', [])
        print(f"\nFirst {min(3, len(employees))} employees:")
        for i, emp in enumerate(employees[:3], 1):
            print(f"  {i}. {emp.get('first_name')} {emp.get('last_name')} - {emp.get('email')}")

        return data
    else:
        print(f"✗ Failed: {response.status_code}")
        print(f"Error: {response.text}")
        return None

def main():
    print("Starting server-side search and filter tests...")

    # Login
    token = login()
    if not token:
        print("Failed to login. Exiting.")
        return

    print(f"✓ Successfully logged in")

    # Test 1: Get all employees (baseline)
    print("\n" + "="*80)
    print("TEST 1: Get all employees (no filters)")
    print("="*80)
    test_employees_endpoint(token)

    # Test 2: Search by name
    print("\n" + "="*80)
    print("TEST 2: Search for 'admin'")
    print("="*80)
    test_employees_endpoint(token, search="admin")

    # Test 3: Filter by active status
    print("\n" + "="*80)
    print("TEST 3: Filter active employees only")
    print("="*80)
    test_employees_endpoint(token, is_active=True)

    # Test 4: Filter by role
    print("\n" + "="*80)
    print("TEST 4: Filter by role='admin'")
    print("="*80)
    test_employees_endpoint(token, role="admin")

    # Test 5: Sort by last_name descending
    print("\n" + "="*80)
    print("TEST 5: Sort by last_name (descending)")
    print("="*80)
    test_employees_endpoint(token, sort_by="last_name", sort_order="desc")

    # Test 6: Sort by email ascending
    print("\n" + "="*80)
    print("TEST 6: Sort by email (ascending)")
    print("="*80)
    test_employees_endpoint(token, sort_by="email", sort_order="asc")

    # Test 7: Combined filters and search
    print("\n" + "="*80)
    print("TEST 7: Search + Filter + Sort (search='admin', is_active=True, sort=email)")
    print("="*80)
    test_employees_endpoint(
        token,
        search="admin",
        is_active=True,
        sort_by="email",
        sort_order="asc"
    )

    # Test 8: Pagination
    print("\n" + "="*80)
    print("TEST 8: Pagination (skip=0, limit=2)")
    print("="*80)
    test_employees_endpoint(token, skip=0, limit=2)

    print("\n" + "="*80)
    print("All tests completed!")
    print("="*80)

if __name__ == "__main__":
    main()
