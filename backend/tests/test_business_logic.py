"""
Comprehensive business logic tests for schedule generation and optimization.
Tests constraint solving, rule processing, and scheduling algorithms.
"""

import pytest
import asyncio
from datetime import datetime, timedelta, time, date
from decimal import Decimal
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from typing import List, Dict, Any

from src.scheduler.constraint_solver import ConstraintSolver, ScheduleOptimizer
from src.nlp.rule_parser import RuleParser, ParsedRule
from src.services.nlp_optimizer import NLPOptimizer, OptimizationResult
from src.models.employee import Employee, EmployeeAvailability
from src.models.schedule import Schedule, Shift, ShiftAssignment
from src.models.rule import Rule, Constraint


class TestConstraintSolver:
    """Test constraint solving algorithms."""

    @pytest.fixture
    def solver(self):
        """Create constraint solver instance."""
        return ConstraintSolver()

    @pytest.fixture
    def sample_employees(self):
        """Sample employees for testing."""
        return [
            Employee(
                id="emp-1",
                name="John Doe",
                email="john@example.com",
                role="Server",
                hourly_rate=Decimal("15.00"),
                min_hours_week=20,
                max_hours_week=40
            ),
            Employee(
                id="emp-2",
                name="Jane Smith",
                email="jane@example.com",
                role="Cook",
                hourly_rate=Decimal("18.00"),
                min_hours_week=30,
                max_hours_week=40
            ),
            Employee(
                id="emp-3",
                name="Bob Wilson",
                email="bob@example.com",
                role="Cashier",
                hourly_rate=Decimal("14.00"),
                min_hours_week=15,
                max_hours_week=35
            )
        ]

    @pytest.fixture
    def sample_shifts(self):
        """Sample shifts for testing."""
        base_date = date(2024, 1, 15)
        return [
            Shift(
                id="shift-1",
                schedule_id="schedule-1",
                date=base_date,
                start_time=time(9, 0),
                end_time=time(17, 0),
                position="Server",
                required_employees=2
            ),
            Shift(
                id="shift-2",
                schedule_id="schedule-1",
                date=base_date,
                start_time=time(17, 0),
                end_time=time(23, 0),
                position="Server",
                required_employees=1
            ),
            Shift(
                id="shift-3",
                schedule_id="schedule-1",
                date=base_date + timedelta(days=1),
                start_time=time(9, 0),
                end_time=time(17, 0),
                position="Cook",
                required_employees=1
            )
        ]

    @pytest.fixture
    def sample_constraints(self):
        """Sample constraints for testing."""
        return [
            Constraint(
                id="constraint-1",
                constraint_type="availability",
                parameters={
                    "employee_id": "emp-1",
                    "day_of_week": 0,  # Monday
                    "start_time": "09:00",
                    "end_time": "17:00"
                }
            ),
            Constraint(
                id="constraint-2",
                constraint_type="max_hours",
                parameters={
                    "employee_id": "emp-1",
                    "max_hours_day": 8
                }
            ),
            Constraint(
                id="constraint-3",
                constraint_type="skill_requirement",
                parameters={
                    "position": "Cook",
                    "required_skills": ["cooking", "food_safety"]
                }
            )
        ]

    def test_solver_initialization(self, solver):
        """Test constraint solver initialization."""
        assert solver is not None
        assert hasattr(solver, 'solve')
        assert hasattr(solver, 'add_constraint')
        assert hasattr(solver, 'validate_solution')

    def test_add_constraint(self, solver, sample_constraints):
        """Test adding constraints to solver."""
        for constraint in sample_constraints:
            solver.add_constraint(constraint)

        assert len(solver.constraints) == len(sample_constraints)
        assert solver.constraints[0].constraint_type == "availability"

    def test_basic_schedule_solving(self, solver, sample_employees, sample_shifts):
        """Test basic schedule solving without constraints."""
        solution = solver.solve(
            employees=sample_employees,
            shifts=sample_shifts,
            constraints=[]
        )

        assert solution is not None
        assert 'assignments' in solution
        assert 'status' in solution
        assert solution['status'] in ['optimal', 'feasible', 'infeasible']

    def test_availability_constraint_enforcement(self, solver, sample_employees, sample_shifts):
        """Test that availability constraints are enforced."""
        # Create constraint: emp-1 only available 9-17 on Monday
        availability_constraint = Constraint(
            constraint_type="availability",
            parameters={
                "employee_id": "emp-1",
                "day_of_week": 0,  # Monday
                "start_time": "09:00",
                "end_time": "17:00"
            }
        )

        solution = solver.solve(
            employees=sample_employees,
            shifts=sample_shifts,
            constraints=[availability_constraint]
        )

        # Verify emp-1 is not assigned to evening shifts
        for assignment in solution['assignments']:
            if (assignment['employee_id'] == 'emp-1' and
                assignment['shift_id'] == 'shift-2'):  # Evening shift
                assert False, "Employee assigned outside availability"

    def test_max_hours_constraint(self, solver, sample_employees):
        """Test maximum hours constraint enforcement."""
        # Create shifts that would exceed max hours
        long_shifts = []
        base_date = date(2024, 1, 15)

        for day in range(7):
            shift = Shift(
                id=f"shift-{day}",
                schedule_id="schedule-1",
                date=base_date + timedelta(days=day),
                start_time=time(9, 0),
                end_time=time(21, 0),  # 12 hour shifts
                position="Server",
                required_employees=1
            )
            long_shifts.append(shift)

        max_hours_constraint = Constraint(
            constraint_type="max_hours_week",
            parameters={
                "employee_id": "emp-1",
                "max_hours": 40
            }
        )

        solution = solver.solve(
            employees=sample_employees,
            shifts=long_shifts,
            constraints=[max_hours_constraint]
        )

        # Calculate total hours for emp-1
        emp_1_hours = 0
        for assignment in solution['assignments']:
            if assignment['employee_id'] == 'emp-1':
                emp_1_hours += 12  # Each shift is 12 hours

        assert emp_1_hours <= 40, f"Employee assigned {emp_1_hours} hours, exceeds limit"

    def test_skill_requirement_constraint(self, solver, sample_employees):
        """Test skill requirement constraint enforcement."""
        # Create shift requiring cooking skills
        cooking_shift = Shift(
            id="cook-shift-1",
            schedule_id="schedule-1",
            date=date(2024, 1, 15),
            start_time=time(10, 0),
            end_time=time(18, 0),
            position="Cook",
            required_employees=1
        )

        skill_constraint = Constraint(
            constraint_type="skill_requirement",
            parameters={
                "position": "Cook",
                "required_skills": ["cooking", "food_safety"]
            }
        )

        # Mock employee skills
        sample_employees[1].skills = ["cooking", "food_safety", "management"]
        sample_employees[0].skills = ["customer_service"]

        solution = solver.solve(
            employees=sample_employees,
            shifts=[cooking_shift],
            constraints=[skill_constraint]
        )

        # Verify only qualified employee is assigned
        for assignment in solution['assignments']:
            if assignment['shift_id'] == 'cook-shift-1':
                assigned_employee = next(
                    e for e in sample_employees
                    if e.id == assignment['employee_id']
                )
                assert "cooking" in assigned_employee.skills

    def test_minimum_staffing_constraint(self, solver, sample_employees):
        """Test minimum staffing level constraint."""
        understaffed_shift = Shift(
            id="busy-shift",
            schedule_id="schedule-1",
            date=date(2024, 1, 15),
            start_time=time(12, 0),
            end_time=time(14, 0),  # Lunch rush
            position="Server",
            required_employees=3  # Need 3 servers
        )

        min_staffing_constraint = Constraint(
            constraint_type="min_staffing",
            parameters={
                "shift_id": "busy-shift",
                "min_employees": 3
            }
        )

        solution = solver.solve(
            employees=sample_employees,
            shifts=[understaffed_shift],
            constraints=[min_staffing_constraint]
        )

        # Count assignments for this shift
        shift_assignments = [
            a for a in solution['assignments']
            if a['shift_id'] == 'busy-shift'
        ]

        if solution['status'] == 'optimal':
            assert len(shift_assignments) >= 3
        else:
            # Should be marked as infeasible if can't meet requirement
            assert solution['status'] == 'infeasible'

    def test_consecutive_shift_constraint(self, solver, sample_employees):
        """Test constraint preventing consecutive shifts."""
        # Create back-to-back shifts
        shift1 = Shift(
            id="shift-morning",
            schedule_id="schedule-1",
            date=date(2024, 1, 15),
            start_time=time(6, 0),
            end_time=time(14, 0),
            position="Server",
            required_employees=1
        )

        shift2 = Shift(
            id="shift-afternoon",
            schedule_id="schedule-1",
            date=date(2024, 1, 15),
            start_time=time(14, 0),
            end_time=time(22, 0),
            position="Server",
            required_employees=1
        )

        no_consecutive_constraint = Constraint(
            constraint_type="no_consecutive_shifts",
            parameters={
                "min_break_hours": 8
            }
        )

        solution = solver.solve(
            employees=sample_employees,
            shifts=[shift1, shift2],
            constraints=[no_consecutive_constraint]
        )

        # Check that no employee works both shifts
        morning_employees = {
            a['employee_id'] for a in solution['assignments']
            if a['shift_id'] == 'shift-morning'
        }
        afternoon_employees = {
            a['employee_id'] for a in solution['assignments']
            if a['shift_id'] == 'shift-afternoon'
        }

        overlap = morning_employees.intersection(afternoon_employees)
        assert len(overlap) == 0, "Employee assigned consecutive shifts"

    def test_fair_distribution_optimization(self, solver, sample_employees):
        """Test fair hour distribution optimization."""
        # Create multiple shifts
        shifts = []
        base_date = date(2024, 1, 15)

        for day in range(7):
            for shift_num in range(2):
                shift = Shift(
                    id=f"shift-{day}-{shift_num}",
                    schedule_id="schedule-1",
                    date=base_date + timedelta(days=day),
                    start_time=time(9, 0) if shift_num == 0 else time(17, 0),
                    end_time=time(17, 0) if shift_num == 0 else time(23, 0),
                    position="Server",
                    required_employees=1
                )
                shifts.append(shift)

        fair_distribution_constraint = Constraint(
            constraint_type="fair_distribution",
            parameters={
                "variance_threshold": 0.2  # Max 20% variance in hours
            }
        )

        solution = solver.solve(
            employees=sample_employees,
            shifts=shifts,
            constraints=[fair_distribution_constraint]
        )

        # Calculate hours per employee
        employee_hours = {}
        for assignment in solution['assignments']:
            emp_id = assignment['employee_id']
            if emp_id not in employee_hours:
                employee_hours[emp_id] = 0
            employee_hours[emp_id] += 8  # Each shift is 8 hours

        if len(employee_hours) > 1:
            hours_list = list(employee_hours.values())
            avg_hours = sum(hours_list) / len(hours_list)
            variance = max(hours_list) - min(hours_list)

            # Variance should be reasonable
            assert variance / avg_hours <= 0.5  # Within 50% seems reasonable

    def test_solver_performance_with_large_input(self, solver):
        """Test solver performance with larger datasets."""
        import time

        # Create larger dataset
        employees = []
        for i in range(50):
            emp = Employee(
                id=f"emp-{i}",
                name=f"Employee {i}",
                email=f"emp{i}@example.com",
                role="Server",
                hourly_rate=Decimal("15.00"),
                max_hours_week=40
            )
            employees.append(emp)

        shifts = []
        base_date = date(2024, 1, 15)
        for day in range(7):
            for hour in range(0, 24, 8):  # 3 shifts per day
                shift = Shift(
                    id=f"shift-{day}-{hour}",
                    schedule_id="schedule-1",
                    date=base_date + timedelta(days=day),
                    start_time=time(hour, 0),
                    end_time=time((hour + 8) % 24, 0),
                    position="Server",
                    required_employees=3
                )
                shifts.append(shift)

        start_time = time.time()
        solution = solver.solve(
            employees=employees,
            shifts=shifts,
            constraints=[],
            timeout_seconds=30  # Give reasonable time limit
        )
        end_time = time.time()

        assert solution is not None
        assert end_time - start_time < 30  # Should complete within timeout
        assert solution['status'] in ['optimal', 'feasible']

    def test_infeasible_schedule_detection(self, solver, sample_employees):
        """Test detection of infeasible schedule requirements."""
        # Create impossible constraints
        impossible_shift = Shift(
            id="impossible-shift",
            schedule_id="schedule-1",
            date=date(2024, 1, 15),
            start_time=time(9, 0),
            end_time=time(17, 0),
            position="Server",
            required_employees=10  # More than available employees
        )

        solution = solver.solve(
            employees=sample_employees,
            shifts=[impossible_shift],
            constraints=[]
        )

        # Should detect infeasibility
        assert solution['status'] == 'infeasible'
        assert 'reason' in solution

    def test_solution_validation(self, solver, sample_employees, sample_shifts, sample_constraints):
        """Test solution validation functionality."""
        solution = solver.solve(
            employees=sample_employees,
            shifts=sample_shifts,
            constraints=sample_constraints
        )

        is_valid, violations = solver.validate_solution(
            solution, sample_constraints
        )

        if solution['status'] == 'optimal':
            assert is_valid, f"Optimal solution has violations: {violations}"

        # Test validation with invalid solution
        invalid_solution = {
            'assignments': [
                {
                    'employee_id': 'emp-1',
                    'shift_id': 'shift-1',
                    'start_time': '09:00',
                    'end_time': '25:00'  # Invalid time
                }
            ],
            'status': 'test'
        }

        is_valid, violations = solver.validate_solution(
            invalid_solution, sample_constraints
        )
        assert not is_valid
        assert len(violations) > 0


class TestRuleParser:
    """Test natural language rule parsing."""

    @pytest.fixture
    def parser(self):
        """Create rule parser instance."""
        return RuleParser()

    def test_parser_initialization(self, parser):
        """Test parser initialization."""
        assert parser is not None
        assert hasattr(parser, 'parse')
        assert hasattr(parser, 'extract_entities')

    def test_parse_availability_rule(self, parser):
        """Test parsing availability rules."""
        rule_text = "Sarah can't work past 5pm on weekdays due to childcare"

        parsed = parser.parse(rule_text)

        assert isinstance(parsed, ParsedRule)
        assert parsed.rule_type == "availability"
        assert parsed.employee_name == "Sarah"
        assert "5pm" in parsed.constraints or "17:00" in str(parsed.constraints)
        assert "weekdays" in str(parsed.constraints).lower()

    def test_parse_preference_rule(self, parser):
        """Test parsing preference rules."""
        rule_text = "John prefers morning shifts on weekends"

        parsed = parser.parse(rule_text)

        assert parsed.rule_type == "preference"
        assert parsed.employee_name == "John"
        assert "morning" in str(parsed.constraints).lower()
        assert "weekend" in str(parsed.constraints).lower()

    def test_parse_requirement_rule(self, parser):
        """Test parsing requirement rules."""
        rule_text = "We need at least 3 people during lunch hours (11am-2pm)"

        parsed = parser.parse(rule_text)

        assert parsed.rule_type == "requirement"
        assert parsed.min_employees >= 3
        assert "11am" in str(parsed.constraints) or "11:00" in str(parsed.constraints)
        assert "2pm" in str(parsed.constraints) or "14:00" in str(parsed.constraints)

    def test_parse_restriction_rule(self, parser):
        """Test parsing restriction rules."""
        rule_text = "No one should work more than 40 hours per week"

        parsed = parser.parse(rule_text)

        assert parsed.rule_type == "restriction"
        assert "40" in str(parsed.constraints)
        assert "week" in str(parsed.constraints).lower()

    def test_parse_complex_rule(self, parser):
        """Test parsing complex rules with multiple constraints."""
        rule_text = "Maria can only work afternoons after 2pm on Tuesday and Thursday, and prefers no more than 6 hour shifts"

        parsed = parser.parse(rule_text)

        assert parsed.employee_name == "Maria"
        assert len(parsed.constraints) >= 2
        assert "2pm" in str(parsed.constraints) or "14:00" in str(parsed.constraints)
        assert "tuesday" in str(parsed.constraints).lower()
        assert "thursday" in str(parsed.constraints).lower()

    def test_time_extraction(self, parser):
        """Test time extraction from rules."""
        test_cases = [
            ("work until 5pm", ["17:00"]),
            ("available from 9am to 6pm", ["09:00", "18:00"]),
            ("lunch break at 12:30", ["12:30"]),
            ("night shift 11pm-7am", ["23:00", "07:00"])
        ]

        for rule_text, expected_times in test_cases:
            parsed = parser.parse(rule_text)
            constraint_str = str(parsed.constraints)

            for expected_time in expected_times:
                assert expected_time in constraint_str

    def test_day_extraction(self, parser):
        """Test day extraction from rules."""
        test_cases = [
            ("work on Monday", ["monday"]),
            ("weekends only", ["saturday", "sunday"]),
            ("Tuesday through Friday", ["tuesday", "wednesday", "thursday", "friday"]),
            ("weekdays", ["monday", "tuesday", "wednesday", "thursday", "friday"])
        ]

        for rule_text, expected_days in test_cases:
            parsed = parser.parse(rule_text)
            constraint_str = str(parsed.constraints).lower()

            for expected_day in expected_days:
                assert expected_day in constraint_str

    def test_employee_name_extraction(self, parser):
        """Test employee name extraction."""
        test_cases = [
            ("Sarah can't work evenings", "Sarah"),
            ("John Smith prefers mornings", "John Smith"),
            ("Dr. Wilson needs flexible hours", "Dr. Wilson"),
            ("Mary-Jane O'Connor is available", "Mary-Jane O'Connor")
        ]

        for rule_text, expected_name in test_cases:
            parsed = parser.parse(rule_text)
            assert parsed.employee_name == expected_name

    def test_skill_requirement_extraction(self, parser):
        """Test skill requirement extraction."""
        rule_text = "Kitchen shifts require food safety certification and 2 years cooking experience"

        parsed = parser.parse(rule_text)

        assert "food safety" in str(parsed.constraints).lower()
        assert "cooking" in str(parsed.constraints).lower()
        assert "2 years" in str(parsed.constraints) or "experience" in str(parsed.constraints).lower()

    def test_numeric_constraint_extraction(self, parser):
        """Test numeric constraint extraction."""
        test_cases = [
            ("at least 3 people", 3),
            ("maximum 8 hours", 8),
            ("no more than 40 hours per week", 40),
            ("minimum 2 servers during lunch", 2)
        ]

        for rule_text, expected_number in test_cases:
            parsed = parser.parse(rule_text)
            constraint_str = str(parsed.constraints)
            assert str(expected_number) in constraint_str

    def test_parse_invalid_rule(self, parser):
        """Test parsing invalid or unclear rules."""
        invalid_rules = [
            "",  # Empty rule
            "random text with no meaning",
            "maybe sometimes perhaps",
            "!@#$%^&*()"
        ]

        for invalid_rule in invalid_rules:
            parsed = parser.parse(invalid_rule)
            # Should handle gracefully, possibly with unknown type
            assert parsed is not None
            assert hasattr(parsed, 'rule_type')

    def test_ambiguous_rule_handling(self, parser):
        """Test handling of ambiguous rules."""
        ambiguous_rule = "John works sometimes in the morning maybe on weekends"

        parsed = parser.parse(ambiguous_rule)

        # Should extract what it can
        assert parsed.employee_name == "John"
        # May have lower confidence or special handling for ambiguity
        if hasattr(parsed, 'confidence'):
            assert parsed.confidence < 1.0


class TestNLPOptimizer:
    """Test NLP-based schedule optimization."""

    @pytest.fixture
    def optimizer(self):
        """Create NLP optimizer instance."""
        return NLPOptimizer()

    @pytest.fixture
    def sample_schedule_data(self):
        """Sample schedule data for optimization."""
        return {
            'employees': [
                {'id': 'emp-1', 'name': 'John', 'role': 'Server', 'hourly_rate': 15.0},
                {'id': 'emp-2', 'name': 'Jane', 'role': 'Cook', 'hourly_rate': 18.0}
            ],
            'shifts': [
                {
                    'id': 'shift-1',
                    'date': '2024-01-15',
                    'start_time': '09:00',
                    'end_time': '17:00',
                    'position': 'Server'
                }
            ],
            'assignments': [
                {'employee_id': 'emp-1', 'shift_id': 'shift-1'}
            ]
        }

    def test_optimizer_initialization(self, optimizer):
        """Test optimizer initialization."""
        assert optimizer is not None
        assert hasattr(optimizer, 'optimize')
        assert hasattr(optimizer, 'calculate_metrics')

    def test_cost_optimization(self, optimizer, sample_schedule_data):
        """Test cost optimization functionality."""
        result = optimizer.optimize(
            schedule_data=sample_schedule_data,
            optimization_goals=['minimize_cost']
        )

        assert isinstance(result, OptimizationResult)
        assert result.status in ['optimal', 'improved', 'no_change']
        assert 'cost_savings' in result.metrics
        assert result.metrics['cost_savings'] >= 0

    def test_coverage_optimization(self, optimizer, sample_schedule_data):
        """Test coverage optimization."""
        result = optimizer.optimize(
            schedule_data=sample_schedule_data,
            optimization_goals=['maximize_coverage']
        )

        assert 'coverage_percentage' in result.metrics
        assert 0 <= result.metrics['coverage_percentage'] <= 100

    def test_fairness_optimization(self, optimizer, sample_schedule_data):
        """Test fairness optimization."""
        result = optimizer.optimize(
            schedule_data=sample_schedule_data,
            optimization_goals=['improve_fairness']
        )

        assert 'fairness_score' in result.metrics
        assert 0 <= result.metrics['fairness_score'] <= 1

    def test_multi_objective_optimization(self, optimizer, sample_schedule_data):
        """Test multi-objective optimization."""
        result = optimizer.optimize(
            schedule_data=sample_schedule_data,
            optimization_goals=['minimize_cost', 'maximize_coverage', 'improve_fairness']
        )

        assert result is not None
        assert len(result.metrics) >= 3
        assert 'cost_savings' in result.metrics
        assert 'coverage_percentage' in result.metrics
        assert 'fairness_score' in result.metrics

    def test_constraint_satisfaction_during_optimization(self, optimizer, sample_schedule_data):
        """Test that optimization respects constraints."""
        constraints = [
            {
                'type': 'max_hours',
                'employee_id': 'emp-1',
                'max_hours_week': 30
            }
        ]

        result = optimizer.optimize(
            schedule_data=sample_schedule_data,
            optimization_goals=['minimize_cost'],
            constraints=constraints
        )

        # Verify constraints are satisfied
        assert result.constraint_violations == 0

    def test_optimization_with_preferences(self, optimizer, sample_schedule_data):
        """Test optimization considering employee preferences."""
        preferences = [
            {
                'employee_id': 'emp-1',
                'preferred_days': ['monday', 'tuesday', 'wednesday'],
                'preferred_shifts': ['morning'],
                'weight': 0.8
            }
        ]

        result = optimizer.optimize(
            schedule_data=sample_schedule_data,
            optimization_goals=['maximize_satisfaction'],
            preferences=preferences
        )

        assert 'satisfaction_score' in result.metrics
        assert result.metrics['satisfaction_score'] >= 0


class TestBusinessLogicIntegration:
    """Test integration between different business logic components."""

    def test_rule_parser_to_constraint_solver_integration(self):
        """Test integration between rule parser and constraint solver."""
        parser = RuleParser()
        solver = ConstraintSolver()

        # Parse a rule
        rule_text = "Sarah can't work past 5pm on weekdays"
        parsed_rule = parser.parse(rule_text)

        # Convert to constraint
        constraint = Constraint(
            constraint_type="availability",
            parameters={
                "employee_name": parsed_rule.employee_name,
                "max_end_time": "17:00",
                "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
            }
        )

        # Add to solver
        solver.add_constraint(constraint)

        assert len(solver.constraints) == 1
        assert solver.constraints[0].parameters["employee_name"] == "Sarah"

    def test_end_to_end_schedule_generation(self):
        """Test complete schedule generation workflow."""
        # 1. Parse rules
        parser = RuleParser()
        rules = [
            "Sarah can't work past 5pm on weekdays",
            "John prefers morning shifts",
            "We need at least 2 people during lunch (12pm-2pm)"
        ]

        parsed_rules = [parser.parse(rule) for rule in rules]

        # 2. Convert to constraints
        constraints = []
        for parsed_rule in parsed_rules:
            if parsed_rule.rule_type == "availability":
                constraints.append(
                    Constraint(
                        constraint_type="availability",
                        parameters={"employee_name": parsed_rule.employee_name}
                    )
                )

        # 3. Solve schedule
        solver = ConstraintSolver()
        employees = [
            Employee(id="sarah", name="Sarah", email="sarah@example.com"),
            Employee(id="john", name="John", email="john@example.com")
        ]

        shifts = [
            Shift(
                id="lunch-shift",
                date=date(2024, 1, 15),
                start_time=time(12, 0),
                end_time=time(14, 0),
                required_employees=2
            )
        ]

        solution = solver.solve(employees, shifts, constraints)

        # 4. Optimize
        optimizer = NLPOptimizer()
        optimized = optimizer.optimize(
            schedule_data=solution,
            optimization_goals=['minimize_cost', 'maximize_coverage']
        )

        assert solution is not None
        assert optimized is not None
        assert optimized.status in ['optimal', 'improved', 'no_change']

    def test_performance_with_realistic_data_size(self):
        """Test performance with realistic business data sizes."""
        import time

        # Simulate realistic business size:
        # - 25 employees
        # - 50 shifts per week
        # - 20 rules

        start_time = time.time()

        # Create test data
        employees = [
            Employee(
                id=f"emp-{i}",
                name=f"Employee {i}",
                email=f"emp{i}@example.com",
                role="Staff"
            ) for i in range(25)
        ]

        shifts = []
        base_date = date(2024, 1, 15)
        for day in range(7):
            for shift_num in range(7):  # ~7 shifts per day
                shift = Shift(
                    id=f"shift-{day}-{shift_num}",
                    date=base_date + timedelta(days=day),
                    start_time=time(8 + shift_num * 2, 0),
                    end_time=time(10 + shift_num * 2, 0),
                    required_employees=2
                )
                shifts.append(shift)

        constraints = [
            Constraint(
                constraint_type="max_hours_week",
                parameters={"max_hours": 40}
            ) for _ in range(20)
        ]

        # Solve
        solver = ConstraintSolver()
        solution = solver.solve(employees, shifts, constraints, timeout_seconds=60)

        end_time = time.time()

        assert solution is not None
        assert end_time - start_time < 60  # Should complete within reasonable time
        assert solution['status'] in ['optimal', 'feasible']