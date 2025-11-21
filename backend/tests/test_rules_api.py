"""
Tests for Rules API endpoints
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Rule
from src.schemas import RuleCreate, RuleUpdate


class TestRulesAPI:
    """Test suite for Rules API endpoints"""

    @pytest.mark.asyncio
    async def test_get_rules_empty(self, client: AsyncClient):
        """Test getting rules when none exist"""
        response = await client.get("/api/rules/")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_rule(self, client: AsyncClient, test_employee):
        """Test creating a new rule"""
        rule_data = {
            "rule_type": "restriction",
            "original_text": "Maximum 40 hours per week",
            "constraints": {"max_hours": 40, "period": "week"},
            "priority": 5,
            "employee_id": test_employee.id,
            "active": True,
        }

        response = await client.post("/api/rules/", json=rule_data)
        assert response.status_code == 201
        data = response.json()
        assert data["rule_type"] == "restriction"
        assert data["employee_id"] == test_employee.id
        assert data["active"] is True

    @pytest.mark.asyncio
    async def test_create_global_rule(self, client: AsyncClient):
        """Test creating a global rule (no employee_id)"""
        rule_data = {
            "rule_type": "requirement",
            "original_text": "All staff must have food handler certification",
            "constraints": {"certification": "food_handler"},
            "priority": 3,
            "active": True,
        }

        response = await client.post("/api/rules/", json=rule_data)
        assert response.status_code == 201
        data = response.json()
        assert data["employee_id"] is None
        assert data["rule_type"] == "requirement"

    @pytest.mark.asyncio
    async def test_get_rule_by_id(self, client: AsyncClient, test_rule):
        """Test getting a specific rule by ID"""
        response = await client.get(f"/api/rules/{test_rule.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_rule.id
        assert data["rule_type"] == test_rule.rule_type

    @pytest.mark.asyncio
    async def test_get_rule_not_found(self, client: AsyncClient):
        """Test getting a non-existent rule"""
        response = await client.get("/api/rules/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_rule(self, client: AsyncClient, test_rule):
        """Test updating an existing rule"""
        update_data = {
            "original_text": "Updated rule text",
            "priority": 4,
            "active": False,
        }

        response = await client.put(f"/api/rules/{test_rule.id}", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["original_text"] == "Updated rule text"
        assert data["priority"] == 4
        assert data["active"] is False

    @pytest.mark.asyncio
    async def test_delete_rule(self, client: AsyncClient, test_rule):
        """Test deleting a rule"""
        response = await client.delete(f"/api/rules/{test_rule.id}")
        assert response.status_code == 204

        # Verify it's deleted
        response = await client.get(f"/api/rules/{test_rule.id}")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_filter_by_employee(self, client: AsyncClient, test_employee, test_rule):
        """Test filtering rules by employee"""
        response = await client.get(f"/api/rules/?employee_id={test_employee.id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        assert all(r["employee_id"] == test_employee.id for r in data)

    @pytest.mark.asyncio
    async def test_filter_by_rule_type(self, client: AsyncClient):
        """Test filtering rules by type"""
        response = await client.get("/api/rules/?rule_type=restriction")
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            assert all(r["rule_type"] == "restriction" for r in data)

    @pytest.mark.asyncio
    async def test_filter_by_active(self, client: AsyncClient):
        """Test filtering rules by active status"""
        response = await client.get("/api/rules/?active=true")
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            assert all(r["active"] is True for r in data)

    @pytest.mark.asyncio
    async def test_bulk_create_rules(self, client: AsyncClient, test_employee):
        """Test creating multiple rules at once"""
        rules_data = [
            {
                "rule_type": "restriction",
                "original_text": "Max 8 hours per day",
                "constraints": {"max_hours": 8, "period": "day"},
                "priority": 5,
                "employee_id": test_employee.id,
                "active": True,
            },
            {
                "rule_type": "preference",
                "original_text": "Prefers morning shifts",
                "constraints": {"preferred_time": "morning"},
                "priority": 2,
                "employee_id": test_employee.id,
                "active": True,
            },
            {
                "rule_type": "availability",
                "original_text": "Not available on Sundays",
                "constraints": {"unavailable_days": ["sunday"]},
                "priority": 4,
                "employee_id": test_employee.id,
                "active": True,
            },
        ]

        response = await client.post("/api/rules/bulk", json=rules_data)
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 3
        assert all(r["employee_id"] == test_employee.id for r in data)

    @pytest.mark.asyncio
    async def test_get_employee_rules(self, client: AsyncClient, test_employee, test_rule):
        """Test getting all rules for a specific employee"""
        response = await client.get(f"/api/rules/employee/{test_employee.id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should include employee-specific rules
        employee_rules = [r for r in data if r["employee_id"] == test_employee.id]
        assert len(employee_rules) > 0

    @pytest.mark.asyncio
    async def test_pagination(self, client: AsyncClient):
        """Test pagination parameters"""
        response = await client.get("/api/rules/?skip=0&limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5

    @pytest.mark.asyncio
    async def test_create_rule_invalid_employee(self, client: AsyncClient):
        """Test creating a rule with non-existent employee"""
        rule_data = {
            "rule_type": "restriction",
            "original_text": "Test rule",
            "constraints": {},
            "priority": 3,
            "employee_id": 99999,
            "active": True,
        }

        response = await client.post("/api/rules/", json=rule_data)
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


@pytest.fixture
async def test_rule(db_session: AsyncSession, test_employee):
    """Create a test rule"""
    from src.services.crud import crud_rule
    from src.schemas import RuleCreate

    rule_data = RuleCreate(
        rule_type="restriction",
        original_text="Test rule",
        constraints={"test": "value"},
        priority=3,
        employee_id=test_employee.id,
        active=True,
    )

    rule = await crud_rule.create(db_session, rule_data)
    yield rule

    # Cleanup
    try:
        await crud_rule.remove(db_session, rule.id)
    except Exception:
        pass
