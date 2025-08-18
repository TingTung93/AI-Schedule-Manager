"""Constraint solver for schedule optimization using OR-Tools."""
import logging
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, date, time, timedelta
from enum import Enum

try:
    from ortools.sat.python import cp_model
except ImportError:
    cp_model = None
    logging.warning("OR-Tools not installed, constraint solver will not work")

logger = logging.getLogger(__name__)


class ShiftType(Enum):
    """Types of shifts."""
    MORNING = "morning"
    AFTERNOON = "afternoon"
    EVENING = "evening"
    NIGHT = "night"
    FULL_DAY = "full_day"


@dataclass
class Employee:
    """Employee data class."""
    id: str
    name: str
    qualifications: List[str] = field(default_factory=list)
    availability: Dict[str, List[Tuple[time, time]]] = field(default_factory=dict)
    preferences: Dict[str, Any] = field(default_factory=dict)
    max_hours_per_week: int = 40
    min_hours_per_week: int = 0


@dataclass
class Shift:
    """Shift data class."""
    id: str
    date: date
    start_time: time
    end_time: time
    required_qualifications: List[str] = field(default_factory=list)
    min_employees: int = 1
    max_employees: int = 10
    shift_type: ShiftType = ShiftType.FULL_DAY
    
    def get_duration_hours(self) -> float:
        """Calculate shift duration in hours."""
        start_dt = datetime.combine(self.date, self.start_time)
        end_dt = datetime.combine(self.date, self.end_time)
        if end_dt < start_dt:  # Handle overnight shifts
            end_dt += timedelta(days=1)
        duration = end_dt - start_dt
        return duration.total_seconds() / 3600


@dataclass
class SchedulingConstraint:
    """Custom scheduling constraint."""
    id: str
    name: str
    type: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    priority: int = 1  # Higher priority = more important
    
    def apply(self, model: Any, variables: Dict, context: Dict) -> bool:
        """Apply the constraint to the model."""
        # This will be overridden by specific constraint implementations
        return True


class ScheduleOptimizer:
    """Optimizer for generating optimal schedules."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the schedule optimizer."""
        self.config = config or {}
        self.model = None
        self.solver = None
        self.variables = {}
        self.solution = None
        
    def generate_schedule(
        self,
        employees: List[Employee],
        shifts: List[Shift],
        constraints: Optional[List[SchedulingConstraint]] = None,
        preferences: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate an optimal schedule."""
        if not cp_model:
            return self._generate_fallback_schedule(employees, shifts)
        
        # Edge cases
        if not employees:
            return {
                'status': 'error',
                'message': 'No employees available',
                'schedule': []
            }
        
        if not shifts:
            return {
                'status': 'error',
                'message': 'No shifts to schedule',
                'schedule': []
            }
        
        # Initialize model
        self.model = cp_model.CpModel()
        
        # Create variables
        self._create_variables(employees, shifts)
        
        # Apply constraints
        self._apply_hard_constraints(employees, shifts)
        
        # Apply custom constraints
        if constraints:
            for constraint in constraints:
                self._apply_custom_constraint(constraint, employees, shifts)
        
        # Create objective function
        self._create_objective_function(employees, shifts, preferences)
        
        # Solve
        self.solver = cp_model.CpSolver()
        self.solver.parameters.max_time_in_seconds = self.config.get('max_solve_time', 30)
        
        status = self.solver.Solve(self.model)
        
        # Extract solution
        result = self._extract_solution(status, employees, shifts)
        
        return result
    
    def _create_variables(self, employees: List[Employee], shifts: List[Shift]):
        """Create decision variables for the model."""
        self.variables['assignments'] = {}
        
        for emp in employees:
            for shift in shifts:
                var_name = f"emp_{emp.id}_shift_{shift.id}"
                self.variables['assignments'][(emp.id, shift.id)] = \
                    self.model.NewBoolVar(var_name)
    
    def _apply_hard_constraints(self, employees: List[Employee], shifts: List[Shift]):
        """Apply hard constraints that must be satisfied."""
        # 1. Shift coverage constraints
        for shift in shifts:
            shift_vars = []
            for emp in employees:
                if self._has_required_qualifications(emp, shift):
                    shift_vars.append(self.variables['assignments'][(emp.id, shift.id)])
            
            if shift_vars:
                # Minimum employees per shift
                self.model.Add(sum(shift_vars) >= shift.min_employees)
                # Maximum employees per shift
                self.model.Add(sum(shift_vars) <= shift.max_employees)
        
        # 2. Employee availability constraints
        for emp in employees:
            for shift in shifts:
                if not self._is_available(emp, shift):
                    self.model.Add(
                        self.variables['assignments'][(emp.id, shift.id)] == 0
                    )
        
        # 3. Maximum hours per week constraint
        for emp in employees:
            weekly_hours = []
            for shift in shifts:
                hours = shift.get_duration_hours()
                weekly_hours.append(
                    self.variables['assignments'][(emp.id, shift.id)] * int(hours)
                )
            
            if weekly_hours:
                self.model.Add(sum(weekly_hours) <= emp.max_hours_per_week)
                self.model.Add(sum(weekly_hours) >= emp.min_hours_per_week)
        
        # 4. No double booking - employee can't work overlapping shifts
        for emp in employees:
            for i, shift1 in enumerate(shifts):
                for shift2 in shifts[i+1:]:
                    if self._shifts_overlap(shift1, shift2):
                        self.model.Add(
                            self.variables['assignments'][(emp.id, shift1.id)] +
                            self.variables['assignments'][(emp.id, shift2.id)] <= 1
                        )
        
        # 5. Rest period constraints
        self._add_rest_period_constraints(employees, shifts)
    
    def _apply_custom_constraint(
        self,
        constraint: SchedulingConstraint,
        employees: List[Employee],
        shifts: List[Shift]
    ):
        """Apply a custom constraint to the model."""
        context = {
            'employees': employees,
            'shifts': shifts,
            'model': self.model,
            'variables': self.variables
        }
        
        try:
            constraint.apply(self.model, self.variables, context)
        except Exception as e:
            logger.warning(f"Failed to apply constraint {constraint.name}: {e}")
    
    def _create_objective_function(
        self,
        employees: List[Employee],
        shifts: List[Shift],
        preferences: Optional[Dict[str, Any]] = None
    ):
        """Create the objective function to optimize."""
        objective_terms = []
        
        # 1. Minimize preference violations
        preference_penalty = self._create_preference_penalty(employees, shifts)
        if preference_penalty:
            objective_terms.extend(preference_penalty)
        
        # 2. Balance workload across employees
        workload_variance = self._calculate_workload_variance(employees, shifts)
        if workload_variance:
            objective_terms.append(workload_variance)
        
        # 3. Maximize coverage (prefer more employees when possible)
        for shift in shifts:
            for emp in employees:
                if self._has_required_qualifications(emp, shift):
                    # Small positive weight for assignments
                    objective_terms.append(
                        self.variables['assignments'][(emp.id, shift.id)] * 1
                    )
        
        # 4. Fairness in weekend shifts
        weekend_fairness = self._create_weekend_fairness_penalty(employees, shifts)
        if weekend_fairness:
            objective_terms.extend(weekend_fairness)
        
        if objective_terms:
            self.model.Minimize(sum(objective_terms))
    
    def _create_preference_penalty(
        self,
        employees: List[Employee],
        shifts: List[Shift]
    ) -> List[Any]:
        """Create penalty terms for violating employee preferences."""
        penalties = []
        
        for emp in employees:
            for shift in shifts:
                penalty = 0
                
                # Check shift type preference
                if 'preferred_shift_type' in emp.preferences:
                    if shift.shift_type.value != emp.preferences['preferred_shift_type']:
                        penalty += 10
                
                # Check day preference
                if 'preferred_days' in emp.preferences:
                    day_name = shift.date.strftime('%A').lower()
                    if day_name not in emp.preferences['preferred_days']:
                        penalty += 5
                
                # Apply penalty if assigned against preference
                if penalty > 0:
                    penalties.append(
                        self.variables['assignments'][(emp.id, shift.id)] * penalty
                    )
        
        return penalties
    
    def _create_weekend_fairness_penalty(
        self,
        employees: List[Employee],
        shifts: List[Shift]
    ) -> List[Any]:
        """Create penalty to ensure fair distribution of weekend shifts."""
        penalties = []
        
        # Count weekend shifts per employee
        weekend_counts = {}
        for emp in employees:
            weekend_shifts = []
            for shift in shifts:
                if shift.date.weekday() >= 5:  # Saturday = 5, Sunday = 6
                    weekend_shifts.append(
                        self.variables['assignments'][(emp.id, shift.id)]
                    )
            
            if weekend_shifts:
                weekend_counts[emp.id] = sum(weekend_shifts)
        
        # Penalize deviation from average
        if weekend_counts:
            avg_var = self.model.NewIntVar(0, len(shifts), 'avg_weekend')
            self.model.Add(avg_var == sum(weekend_counts.values()) // len(employees))
            
            for emp_id, count in weekend_counts.items():
                deviation = self.model.NewIntVar(0, len(shifts), f'dev_{emp_id}')
                self.model.AddAbsEquality(deviation, count - avg_var)
                penalties.append(deviation * 5)
        
        return penalties
    
    def _calculate_workload_variance(
        self,
        employees: List[Employee],
        shifts: List[Shift]
    ) -> Optional[Any]:
        """Calculate variance in workload to promote fairness."""
        if not employees or not shifts:
            return None
        
        # Calculate total hours per employee
        total_hours = {}
        for emp in employees:
            emp_hours = []
            for shift in shifts:
                hours = shift.get_duration_hours()
                emp_hours.append(
                    self.variables['assignments'][(emp.id, shift.id)] * int(hours)
                )
            
            if emp_hours:
                total_hours[emp.id] = sum(emp_hours)
        
        if not total_hours:
            return None
        
        # Calculate variance (simplified - minimize max-min difference)
        if len(total_hours) > 1:
            hours_list = list(total_hours.values())
            max_hours = self.model.NewIntVar(0, 100, 'max_hours')
            min_hours = self.model.NewIntVar(0, 100, 'min_hours')
            
            self.model.AddMaxEquality(max_hours, hours_list)
            self.model.AddMinEquality(min_hours, hours_list)
            
            variance = self.model.NewIntVar(0, 100, 'hours_variance')
            self.model.Add(variance == max_hours - min_hours)
            
            return variance * 10  # Weight for variance penalty
        
        return None
    
    def _add_rest_period_constraints(
        self,
        employees: List[Employee],
        shifts: List[Shift]
    ):
        """Add constraints for minimum rest periods between shifts."""
        min_rest_hours = self.config.get('min_rest_hours', 8)
        
        for emp in employees:
            # Sort shifts by date and start time
            sorted_shifts = sorted(shifts, key=lambda s: (s.date, s.start_time))
            
            for i in range(len(sorted_shifts) - 1):
                shift1 = sorted_shifts[i]
                shift2 = sorted_shifts[i + 1]
                
                # Calculate time between shifts
                end1 = datetime.combine(shift1.date, shift1.end_time)
                start2 = datetime.combine(shift2.date, shift2.start_time)
                
                if shift1.end_time > shift1.start_time:
                    # Normal shift
                    rest_time = (start2 - end1).total_seconds() / 3600
                else:
                    # Overnight shift
                    end1 += timedelta(days=1)
                    rest_time = (start2 - end1).total_seconds() / 3600
                
                # If rest time is less than minimum, can't work both shifts
                if 0 < rest_time < min_rest_hours:
                    self.model.Add(
                        self.variables['assignments'][(emp.id, shift1.id)] +
                        self.variables['assignments'][(emp.id, shift2.id)] <= 1
                    )
    
    def _extract_solution(
        self,
        status: Any,
        employees: List[Employee],
        shifts: List[Shift]
    ) -> Dict[str, Any]:
        """Extract the solution from the solver."""
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            schedule = []
            
            for shift in shifts:
                assigned_employees = []
                for emp in employees:
                    if self.solver.Value(
                        self.variables['assignments'][(emp.id, shift.id)]
                    ):
                        assigned_employees.append({
                            'id': emp.id,
                            'name': emp.name
                        })
                
                schedule.append({
                    'shift_id': shift.id,
                    'date': shift.date.isoformat(),
                    'start_time': shift.start_time.isoformat(),
                    'end_time': shift.end_time.isoformat(),
                    'assigned_employees': assigned_employees
                })
            
            return {
                'status': 'optimal' if status == cp_model.OPTIMAL else 'feasible',
                'schedule': schedule,
                'statistics': {
                    'solve_time': self.solver.WallTime(),
                    'objective_value': self.solver.ObjectiveValue() if status == cp_model.OPTIMAL else None
                }
            }
        
        elif status == cp_model.INFEASIBLE:
            return {
                'status': 'infeasible',
                'message': 'No feasible schedule found with given constraints',
                'schedule': []
            }
        
        else:
            return {
                'status': 'unknown',
                'message': 'Solver returned unknown status',
                'schedule': []
            }
    
    def _generate_fallback_schedule(
        self,
        employees: List[Employee],
        shifts: List[Shift]
    ) -> Dict[str, Any]:
        """Generate a simple fallback schedule when OR-Tools is not available."""
        schedule = []
        
        for shift in shifts:
            # Simple round-robin assignment
            available_employees = [
                emp for emp in employees
                if self._is_available(emp, shift) and
                self._has_required_qualifications(emp, shift)
            ]
            
            assigned = available_employees[:shift.min_employees]
            
            schedule.append({
                'shift_id': shift.id,
                'date': shift.date.isoformat(),
                'start_time': shift.start_time.isoformat(),
                'end_time': shift.end_time.isoformat(),
                'assigned_employees': [
                    {'id': emp.id, 'name': emp.name}
                    for emp in assigned
                ]
            })
        
        return {
            'status': 'fallback',
            'message': 'Using simple fallback scheduler',
            'schedule': schedule
        }
    
    def _is_available(self, employee: Employee, shift: Shift) -> bool:
        """Check if an employee is available for a shift."""
        day_name = shift.date.strftime('%A')
        
        if day_name in employee.availability:
            # Check if shift time falls within available hours
            for start, end in employee.availability[day_name]:
                if start <= shift.start_time and end >= shift.end_time:
                    return True
        
        # If no specific availability, assume available
        if not employee.availability:
            return True
        
        return False
    
    def _has_required_qualifications(
        self,
        employee: Employee,
        shift: Shift
    ) -> bool:
        """Check if an employee has required qualifications for a shift."""
        if not shift.required_qualifications:
            return True
        
        return all(
            qual in employee.qualifications
            for qual in shift.required_qualifications
        )
    
    def _shifts_overlap(self, shift1: Shift, shift2: Shift) -> bool:
        """Check if two shifts overlap in time."""
        if shift1.date != shift2.date:
            return False
        
        # Convert to datetime for comparison
        start1 = datetime.combine(shift1.date, shift1.start_time)
        end1 = datetime.combine(shift1.date, shift1.end_time)
        start2 = datetime.combine(shift2.date, shift2.start_time)
        end2 = datetime.combine(shift2.date, shift2.end_time)
        
        # Handle overnight shifts
        if shift1.end_time < shift1.start_time:
            end1 += timedelta(days=1)
        if shift2.end_time < shift2.start_time:
            end2 += timedelta(days=1)
        
        return start1 < end2 and start2 < end1
    
    def get_shift_hours(self, shift: Shift) -> float:
        """Calculate the duration of a shift in hours."""
        return shift.get_duration_hours()