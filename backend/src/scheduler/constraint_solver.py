from ortools.sat.python import cp_model
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timedelta, date, time
import logging
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

class ShiftType(Enum):
    MORNING = "morning"  # 6am - 2pm
    AFTERNOON = "afternoon"  # 2pm - 10pm
    NIGHT = "night"  # 10pm - 6am
    CUSTOM = "custom"

@dataclass
class Employee:
    id: str
    name: str
    role: str
    min_hours_week: int
    max_hours_week: int
    hourly_rate: float
    skills: List[str]
    availability: Dict[int, List[Tuple[int, int]]]  # day -> [(start_hour, end_hour)]

@dataclass
class Shift:
    id: str
    day: int  # 0-6 (Monday-Sunday)
    start_hour: int  # 0-23
    end_hour: int  # 0-23
    required_role: str
    required_skills: List[str]
    min_staff: int
    max_staff: int

@dataclass
class SchedulingConstraint:
    employee_id: Optional[str]
    constraint_type: str  # 'availability', 'preference', 'requirement'
    day: Optional[int]
    start_time: Optional[int]
    end_time: Optional[int]
    priority: int  # 1-10, higher is more important
    metadata: Dict[str, Any]

class ScheduleOptimizer:
    """
    Constraint-based schedule optimizer using Google OR-Tools.
    Handles complex scheduling requirements with multiple objectives.
    """
    
    def __init__(self):
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        self.assignments = {}  # (employee_id, shift_id) -> BoolVar
        self.shift_hours = {}  # shift_id -> hours
        self.employee_weekly_hours = {}  # employee_id -> IntVar
        
    def generate_schedule(
        self,
        employees: List[Employee],
        shifts: List[Shift],
        constraints: List[SchedulingConstraint],
        start_date: date,
        num_weeks: int = 1
    ) -> Dict[str, Any]:
        """
        Generate an optimal schedule based on constraints.
        
        Returns:
            Dictionary containing schedule assignments and metrics
        """
        logger.info(f"Generating schedule for {len(employees)} employees, {len(shifts)} shifts")
        
        # Reset model for new schedule
        self.model = cp_model.CpModel()
        self.assignments = {}
        self.shift_hours = {}
        self.employee_weekly_hours = {}
        
        # Create decision variables
        self._create_variables(employees, shifts)
        
        # Add constraints
        self._add_hard_constraints(employees, shifts, constraints)
        self._add_soft_constraints(employees, shifts, constraints)
        
        # Define objective function
        self._create_objective(employees, shifts, constraints)
        
        # Solve
        self.solver.parameters.max_time_in_seconds = 30.0
        self.solver.parameters.num_search_workers = 8
        
        status = self.solver.Solve(self.model)
        
        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            return self._extract_solution(employees, shifts, start_date, status)
        else:
            logger.error(f"No solution found. Status: {status}")
            return self._generate_fallback_schedule(employees, shifts, start_date)
    
    def _create_variables(self, employees: List[Employee], shifts: List[Shift]):
        """Create decision variables for the model"""
        
        # Binary variables for shift assignments
        for emp in employees:
            for shift in shifts:
                var = self.model.NewBoolVar(f'shift_{emp.id}_{shift.id}')
                self.assignments[(emp.id, shift.id)] = var
        
        # Calculate shift hours
        for shift in shifts:
            hours = shift.end_hour - shift.start_hour
            if hours < 0:  # Overnight shift
                hours += 24
            self.shift_hours[shift.id] = hours
        
        # Track weekly hours per employee
        for emp in employees:
            weekly_hours = self.model.NewIntVar(
                0, emp.max_hours_week, f'weekly_hours_{emp.id}'
            )
            self.employee_weekly_hours[emp.id] = weekly_hours
            
            # Link weekly hours to assignments
            total_hours = sum(
                self.assignments[(emp.id, shift.id)] * self.shift_hours[shift.id]
                for shift in shifts
            )
            self.model.Add(weekly_hours == total_hours)
    
    def _add_hard_constraints(self, employees: List[Employee], shifts: List[Shift], constraints: List[SchedulingConstraint]):
        """Add hard constraints that must be satisfied"""
        
        # 1. Minimum and maximum staff per shift
        for shift in shifts:
            assigned_count = sum(
                self.assignments[(emp.id, shift.id)]
                for emp in employees
            )
            self.model.Add(assigned_count >= shift.min_staff)
            self.model.Add(assigned_count <= shift.max_staff)
        
        # 2. Employee availability constraints
        for emp in employees:
            for shift in shifts:
                if not self._is_available(emp, shift):
                    self.model.Add(self.assignments[(emp.id, shift.id)] == 0)
        
        # 3. Weekly hour limits
        for emp in employees:
            self.model.Add(self.employee_weekly_hours[emp.id] >= emp.min_hours_week)
            self.model.Add(self.employee_weekly_hours[emp.id] <= emp.max_hours_week)
        
        # 4. No double-booking (one shift per day per employee)
        for emp in employees:
            for day in range(7):
                day_shifts = [s for s in shifts if s.day == day]
                if len(day_shifts) > 1:
                    self.model.Add(
                        sum(self.assignments[(emp.id, s.id)] for s in day_shifts) <= 1
                    )
        
        # 5. Role and skill requirements
        for shift in shifts:
            for emp in employees:
                if not self._has_required_qualifications(emp, shift):
                    self.model.Add(self.assignments[(emp.id, shift.id)] == 0)
        
        # 6. Custom constraints from parsed rules
        for constraint in constraints:
            self._apply_custom_constraint(constraint, employees, shifts)
        
        # 7. Rest periods (minimum 8 hours between shifts)
        self._add_rest_period_constraints(employees, shifts)
    
    def _add_soft_constraints(self, employees: List[Employee], shifts: List[Shift], constraints: List[SchedulingConstraint]):
        """Add soft constraints (preferences) with penalty weights"""
        
        penalties = []
        
        # Preference constraints from parsed rules
        for constraint in constraints:
            if constraint.constraint_type == 'preference':
                penalty = self._create_preference_penalty(constraint, employees, shifts)
                if penalty:
                    penalties.append(penalty)
        
        # Fair distribution of weekend shifts
        weekend_penalty = self._create_weekend_fairness_penalty(employees, shifts)
        if weekend_penalty:
            penalties.append(weekend_penalty)
        
        # Consistent scheduling (same shifts week to week)
        consistency_penalty = self._create_consistency_penalty(employees, shifts)
        if consistency_penalty:
            penalties.append(consistency_penalty)
        
        return penalties
    
    def _create_objective(self, employees: List[Employee], shifts: List[Shift], constraints: List[SchedulingConstraint]):
        """Create multi-objective optimization function"""
        
        objective_terms = []
        
        # 1. Minimize labor costs
        cost_term = sum(
            self.assignments[(emp.id, shift.id)] * 
            self.shift_hours[shift.id] * 
            int(emp.hourly_rate * 100)  # Convert to cents to avoid float
            for emp in employees
            for shift in shifts
        )
        objective_terms.append(cost_term)
        
        # 2. Maximize employee satisfaction (honor preferences)
        satisfaction_penalty = 0
        for constraint in constraints:
            if constraint.constraint_type == 'preference':
                penalty = self._calculate_preference_violation(constraint, employees, shifts)
                satisfaction_penalty += penalty * constraint.priority
        
        if satisfaction_penalty:
            objective_terms.append(satisfaction_penalty)
        
        # 3. Balance workload fairly
        workload_variance = self._calculate_workload_variance(employees)
        if workload_variance:
            objective_terms.append(workload_variance * 10)  # Weight factor
        
        # Minimize combined objective
        self.model.Minimize(sum(objective_terms))
    
    def _is_available(self, employee: Employee, shift: Shift) -> bool:
        """Check if employee is available for a shift"""
        if shift.day not in employee.availability:
            return False
        
        for start, end in employee.availability[shift.day]:
            if start <= shift.start_hour < end and start < shift.end_hour <= end:
                return True
        
        return False
    
    def _has_required_qualifications(self, employee: Employee, shift: Shift) -> bool:
        """Check if employee has required role and skills"""
        if shift.required_role and employee.role != shift.required_role:
            return False
        
        for skill in shift.required_skills:
            if skill not in employee.skills:
                return False
        
        return True
    
    def _apply_custom_constraint(self, constraint: SchedulingConstraint, employees: List[Employee], shifts: List[Shift]):
        """Apply a custom constraint from parsed rules"""
        
        if constraint.employee_id:
            # Find the employee
            emp = next((e for e in employees if e.id == constraint.employee_id), None)
            if not emp:
                return
            
            # Apply time-based constraints
            if constraint.constraint_type == 'availability':
                for shift in shifts:
                    if constraint.day is not None and shift.day != constraint.day:
                        continue
                    
                    # Check time overlap
                    if constraint.start_time and shift.end_hour <= constraint.start_time:
                        continue
                    if constraint.end_time and shift.start_hour >= constraint.end_time:
                        continue
                    
                    # Employee cannot work this shift
                    self.model.Add(self.assignments[(emp.id, shift.id)] == 0)
    
    def _add_rest_period_constraints(self, employees: List[Employee], shifts: List[Shift]):
        """Ensure minimum rest period between consecutive shifts"""
        
        MIN_REST_HOURS = 8
        
        for emp in employees:
            # Group shifts by consecutive days
            for day in range(7):
                next_day = (day + 1) % 7
                
                today_shifts = [s for s in shifts if s.day == day]
                tomorrow_shifts = [s for s in shifts if s.day == next_day]
                
                for t_shift in today_shifts:
                    for tm_shift in tomorrow_shifts:
                        # Calculate rest period
                        rest_hours = (24 - t_shift.end_hour) + tm_shift.start_hour
                        
                        if rest_hours < MIN_REST_HOURS:
                            # Cannot work both shifts
                            self.model.Add(
                                self.assignments[(emp.id, t_shift.id)] + 
                                self.assignments[(emp.id, tm_shift.id)] <= 1
                            )
    
    def _create_preference_penalty(self, constraint: SchedulingConstraint, employees: List[Employee], shifts: List[Shift]) -> Optional[Any]:
        """Create penalty for violating preference constraints"""
        
        if not constraint.employee_id:
            return None
        
        penalties = []
        
        for shift in shifts:
            if constraint.day is not None and shift.day != constraint.day:
                continue
            
            # Check if shift violates preference
            violates = False
            
            if 'preferred_hours' in constraint.metadata:
                pref_start, pref_end = constraint.metadata['preferred_hours'].split('-')
                pref_start_hour = int(pref_start.split(':')[0])
                pref_end_hour = int(pref_end.split(':')[0])
                
                if shift.start_hour < pref_start_hour or shift.end_hour > pref_end_hour:
                    violates = True
            
            if violates:
                penalty_var = self.model.NewBoolVar(f'pref_penalty_{constraint.employee_id}_{shift.id}')
                self.model.Add(penalty_var == self.assignments[(constraint.employee_id, shift.id)])
                penalties.append(penalty_var * constraint.priority)
        
        return sum(penalties) if penalties else None
    
    def _create_weekend_fairness_penalty(self, employees: List[Employee], shifts: List[Shift]) -> Optional[Any]:
        """Penalize uneven distribution of weekend shifts"""
        
        weekend_shifts = [s for s in shifts if s.day in [5, 6]]  # Saturday, Sunday
        
        if not weekend_shifts:
            return None
        
        weekend_counts = {}
        for emp in employees:
            count = sum(
                self.assignments[(emp.id, s.id)]
                for s in weekend_shifts
            )
            weekend_counts[emp.id] = count
        
        # Calculate variance
        avg = len(weekend_shifts) // len(employees)
        variance_terms = [
            self.model.NewIntVar(0, 100, f'weekend_var_{emp.id}')
            for emp in employees
        ]
        
        for i, emp in enumerate(employees):
            diff = weekend_counts[emp.id] - avg
            self.model.Add(variance_terms[i] >= diff)
            self.model.Add(variance_terms[i] >= -diff)
        
        return sum(variance_terms)
    
    def _create_consistency_penalty(self, employees: List[Employee], shifts: List[Shift]) -> Optional[Any]:
        """Penalize changes from previous week's schedule"""
        # This would need historical data - placeholder for now
        return None
    
    def _calculate_preference_violation(self, constraint: SchedulingConstraint, employees: List[Employee], shifts: List[Shift]) -> int:
        """Calculate penalty for violating a preference"""
        return 0  # Placeholder
    
    def _calculate_workload_variance(self, employees: List[Employee]) -> Any:
        """Calculate variance in employee workloads"""
        
        # Create variables for absolute differences from average
        avg_hours = sum(self.employee_weekly_hours.values()) // len(employees)
        
        variance_terms = []
        for emp in employees:
            diff_var = self.model.NewIntVar(-100, 100, f'hour_diff_{emp.id}')
            abs_diff = self.model.NewIntVar(0, 100, f'abs_diff_{emp.id}')
            
            self.model.Add(diff_var == self.employee_weekly_hours[emp.id] - avg_hours)
            self.model.AddAbsEquality(abs_diff, diff_var)
            
            variance_terms.append(abs_diff)
        
        return sum(variance_terms)
    
    def _extract_solution(self, employees: List[Employee], shifts: List[Shift], start_date: date, status) -> Dict[str, Any]:
        """Extract the solution from the solver"""
        
        schedule = {
            'status': 'optimal' if status == cp_model.OPTIMAL else 'feasible',
            'start_date': start_date.isoformat(),
            'assignments': [],
            'metrics': {},
            'employee_hours': {},
            'total_cost': 0
        }
        
        # Extract assignments
        for emp in employees:
            emp_hours = 0
            emp_cost = 0
            
            for shift in shifts:
                if self.solver.BooleanValue(self.assignments[(emp.id, shift.id)]):
                    shift_date = start_date + timedelta(days=shift.day)
                    
                    assignment = {
                        'employee_id': emp.id,
                        'employee_name': emp.name,
                        'shift_id': shift.id,
                        'date': shift_date.isoformat(),
                        'start_time': f"{shift.start_hour:02d}:00",
                        'end_time': f"{shift.end_hour:02d}:00",
                        'hours': self.shift_hours[shift.id]
                    }
                    
                    schedule['assignments'].append(assignment)
                    emp_hours += self.shift_hours[shift.id]
                    emp_cost += self.shift_hours[shift.id] * emp.hourly_rate
            
            schedule['employee_hours'][emp.id] = emp_hours
            schedule['total_cost'] += emp_cost
        
        # Calculate metrics
        schedule['metrics'] = {
            'total_assignments': len(schedule['assignments']),
            'total_hours': sum(schedule['employee_hours'].values()),
            'avg_hours_per_employee': sum(schedule['employee_hours'].values()) / len(employees),
            'coverage_rate': len(schedule['assignments']) / (len(shifts) * len(employees)),
            'optimization_time': self.solver.WallTime(),
            'objective_value': self.solver.ObjectiveValue()
        }
        
        return schedule
    
    def _generate_fallback_schedule(self, employees: List[Employee], shifts: List[Shift], start_date: date) -> Dict[str, Any]:
        """Generate a basic fallback schedule if optimization fails"""
        
        logger.warning("Generating fallback schedule")
        
        schedule = {
            'status': 'fallback',
            'start_date': start_date.isoformat(),
            'assignments': [],
            'metrics': {},
            'employee_hours': {emp.id: 0 for emp in employees},
            'total_cost': 0
        }
        
        # Simple round-robin assignment
        emp_index = 0
        
        for shift in shifts:
            assigned = 0
            attempts = 0
            
            while assigned < shift.min_staff and attempts < len(employees):
                emp = employees[emp_index % len(employees)]
                
                # Check basic availability
                if self._is_available(emp, shift) and self._has_required_qualifications(emp, shift):
                    shift_date = start_date + timedelta(days=shift.day)
                    
                    assignment = {
                        'employee_id': emp.id,
                        'employee_name': emp.name,
                        'shift_id': shift.id,
                        'date': shift_date.isoformat(),
                        'start_time': f"{shift.start_hour:02d}:00",
                        'end_time': f"{shift.end_hour:02d}:00",
                        'hours': self.shift_hours[shift.id]
                    }
                    
                    schedule['assignments'].append(assignment)
                    schedule['employee_hours'][emp.id] += self.shift_hours[shift.id]
                    schedule['total_cost'] += self.shift_hours[shift.id] * emp.hourly_rate
                    assigned += 1
                
                emp_index += 1
                attempts += 1
        
        return schedule