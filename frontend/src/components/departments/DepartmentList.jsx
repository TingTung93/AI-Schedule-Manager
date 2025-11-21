/**
 * DepartmentList Component
 *
 * Displays a list of departments with search, sort, and action capabilities.
 */

import React, { useState, useMemo } from 'react';

const DepartmentList = ({
  departments = [],
  loading = false,
  error = null,
  selectedId = null,
  onSelect,
  onEdit,
  onDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortAscending, setSortAscending] = useState(true);

  // Filter and sort departments
  const filteredAndSortedDepartments = useMemo(() => {
    let result = [...departments];

    // Filter by search term
    if (searchTerm) {
      result = result.filter(dept =>
        dept.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort by name
    result.sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return sortAscending ? comparison : -comparison;
    });

    return result;
  }, [departments, searchTerm, sortAscending]);

  const handleDelete = (department) => {
    if (window.confirm(`Are you sure you want to delete ${department.name}?`)) {
      onDelete?.(department.id);
    }
  };

  const handleSort = () => {
    setSortAscending(!sortAscending);
  };

  if (loading) {
    return (
      <div className="department-list-loading">
        <p>Loading departments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="department-list-error">
        <p>{error}</p>
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <div className="department-list-empty">
        <p>No departments available</p>
      </div>
    );
  }

  return (
    <div className="department-list">
      {/* Search and Sort Controls */}
      <div className="department-list-controls">
        <input
          type="text"
          placeholder="Search departments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="department-search"
        />
        <button
          onClick={handleSort}
          className="department-sort-button"
          aria-label="Sort departments"
        >
          Sort {sortAscending ? '↑' : '↓'}
        </button>
      </div>

      {/* Department Items */}
      <div className="department-list-items">
        {filteredAndSortedDepartments.map((department) => (
          <div
            key={department.id}
            className={`department-item ${selectedId === department.id ? 'selected' : ''}`}
            onClick={() => onSelect?.(department)}
          >
            <div className="department-info">
              <h3 data-testid="department-name">{department.name}</h3>
              <p className="department-stats">
                Employees: {department.employee_count || 0}
                {department.manager_id && ` | Manager ID: ${department.manager_id}`}
              </p>
            </div>

            <div className="department-actions">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(department);
                  }}
                  className="department-edit-button"
                  aria-label={`Edit ${department.name}`}
                >
                  Edit
                </button>
              )}

              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(department);
                  }}
                  className="department-delete-button"
                  aria-label={`Delete ${department.name}`}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredAndSortedDepartments.length === 0 && searchTerm && (
        <div className="department-list-no-results">
          <p>No departments match your search</p>
        </div>
      )}
    </div>
  );
};

export default DepartmentList;
