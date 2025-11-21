import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Button,
  TextField,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Chip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import SearchIcon from '@mui/icons-material/Search';
import api from '../../services/api';

/**
 * UnassignedEmployeesList Component
 *
 * Displays and manages employees without department assignments.
 *
 * Features:
 * - List all unassigned employees
 * - Quick assign button (opens department selector)
 * - Bulk assign selected employees
 * - Search by name, email, role
 * - Sort by hire date, name, role
 * - Pagination support
 * - Inline department selection
 *
 * @param {Object} props
 * @param {Function} [props.onAssign] - Callback when employee assigned
 * @param {Function} [props.onBulkAssign] - Callback to open bulk assignment modal
 */
const UnassignedEmployeesList = ({ onAssign, onBulkAssign }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('firstName');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [assigningId, setAssigningId] = useState(null);

  // Fetch unassigned employees
  const fetchUnassignedEmployees = async () => {
    setLoading(true);
    setError(null);

    try {
      const [employeesRes, departmentsRes] = await Promise.all([
        api.get('/api/employees/unassigned', {
          params: {
            skip: page * rowsPerPage,
            limit: rowsPerPage,
            sort: sortOrder === 'desc' ? `-${sortBy}` : sortBy,
          }
        }),
        api.get('/api/departments', { params: { active: true } })
      ]);

      setEmployees(employeesRes.data.items || employeesRes.data);
      setDepartments(departmentsRes.data.items || departmentsRes.data);
    } catch (err) {
      console.error('Failed to fetch unassigned employees:', err);
      setError(err.response?.data?.detail || 'Failed to load unassigned employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnassignedEmployees();
  }, [page, rowsPerPage, sortBy, sortOrder]);

  // Filter employees by search query
  const filteredEmployees = employees.filter(emp => {
    const query = searchQuery.toLowerCase();
    return (
      emp.firstName?.toLowerCase().includes(query) ||
      emp.lastName?.toLowerCase().includes(query) ||
      emp.email?.toLowerCase().includes(query) ||
      emp.role?.toLowerCase().includes(query)
    );
  });

  // Toggle employee selection
  const handleToggleEmployee = (employeeId) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  // Select all
  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedEmployees(filteredEmployees.map(emp => emp.id));
    } else {
      setSelectedEmployees([]);
    }
  };

  // Quick assign single employee
  const handleQuickAssign = async (employeeId, departmentId) => {
    setAssigningId(employeeId);
    try {
      await api.patch(`/api/employees/${employeeId}`, {
        departmentId: departmentId,
      });

      // Remove from list
      setEmployees(prev => prev.filter(emp => emp.id !== employeeId));
      setSelectedEmployees(prev => prev.filter(id => id !== employeeId));

      if (onAssign) {
        onAssign({ employeeId, departmentId });
      }
    } catch (err) {
      console.error('Failed to assign employee:', err);
      setError(err.response?.data?.detail || 'Failed to assign employee');
    } finally {
      setAssigningId(null);
    }
  };

  // Handle bulk assign
  const handleBulkAssignClick = () => {
    if (onBulkAssign && selectedEmployees.length > 0) {
      onBulkAssign(selectedEmployees);
    }
  };

  // Handle sort
  const handleSort = (column) => {
    const isAsc = sortBy === column && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortBy(column);
  };

  // Handle pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (loading && employees.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <IconButton color="inherit" size="small" onClick={fetchUnassignedEmployees}>
            <RefreshIcon />
          </IconButton>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h6" component="h2">
            Unassigned Employees
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {filteredEmployees.length} employee(s) without department assignment
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchUnassignedEmployees} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {selectedEmployees.length > 0 && (
            <Button
              variant="contained"
              startIcon={<GroupAddIcon />}
              onClick={handleBulkAssignClick}
            >
              Bulk Assign ({selectedEmployees.length})
            </Button>
          )}
        </Box>
      </Box>

      {/* Search */}
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search by name, email, or role..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
        }}
        sx={{ mb: 2 }}
        size="small"
      />

      {/* Table */}
      {filteredEmployees.length === 0 ? (
        <Alert severity="success">
          All employees are assigned to departments!
        </Alert>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={
                        selectedEmployees.length > 0 &&
                        selectedEmployees.length < filteredEmployees.length
                      }
                      checked={
                        filteredEmployees.length > 0 &&
                        selectedEmployees.length === filteredEmployees.length
                      }
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'firstName'}
                      direction={sortBy === 'firstName' ? sortOrder : 'asc'}
                      onClick={() => handleSort('firstName')}
                    >
                      Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'role'}
                      direction={sortBy === 'role' ? sortOrder : 'asc'}
                      onClick={() => handleSort('role')}
                    >
                      Role
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'hireDate'}
                      direction={sortBy === 'hireDate' ? sortOrder : 'asc'}
                      onClick={() => handleSort('hireDate')}
                    >
                      Hire Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Quick Assign</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow
                    key={employee.id}
                    hover
                    selected={selectedEmployees.includes(employee.id)}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedEmployees.includes(employee.id)}
                        onChange={() => handleToggleEmployee(employee.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {employee.firstName} {employee.lastName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {employee.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={employee.role || 'No role'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {employee.hireDate
                          ? new Date(employee.hireDate).toLocaleDateString()
                          : 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={employee.active ? 'Active' : 'Inactive'}
                        size="small"
                        color={employee.active ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box display="flex" gap={1} justifyContent="flex-end" alignItems="center">
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                          <Select
                            displayEmpty
                            value=""
                            onChange={(e) => handleQuickAssign(employee.id, e.target.value)}
                            disabled={assigningId === employee.id}
                            renderValue={() => 'Select Department'}
                          >
                            {departments.map(dept => (
                              <MenuItem key={dept.id} value={dept.id}>
                                {dept.name}
                                {dept.employeeCount !== undefined &&
                                  ` (${dept.employeeCount} employees)`}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        {assigningId === employee.id && (
                          <CircularProgress size={20} />
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[10, 20, 50, 100]}
            component="div"
            count={filteredEmployees.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Card>
      )}
    </Box>
  );
};

export default UnassignedEmployeesList;
