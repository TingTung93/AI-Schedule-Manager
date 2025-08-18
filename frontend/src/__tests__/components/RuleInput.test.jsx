/**
 * Unit tests for RuleInput component
 * Tests natural language rule input, parsing, and management functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RuleInput from '../../components/RuleInput';

// Mock fetch API
global.fetch = jest.fn();

describe('RuleInput Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders component with all main sections', () => {
      render(<RuleInput />);
      
      expect(screen.getByText('AI Schedule Manager - Rule Creator')).toBeInTheDocument();
      expect(screen.getByText('Create Scheduling Rule')).toBeInTheDocument();
      expect(screen.getByText('Active Rules (0)')).toBeInTheDocument();
      expect(screen.getByText('How It Works')).toBeInTheDocument();
    });

    test('displays placeholder text in input field', () => {
      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      expect(input).toBeInTheDocument();
    });

    test('renders example rule chips', () => {
      render(<RuleInput />);
      
      expect(screen.getByText("Sarah can't work past 5pm on weekdays due to childcare")).toBeInTheDocument();
      expect(screen.getByText("John prefers morning shifts on weekends")).toBeInTheDocument();
      expect(screen.getByText("Mike needs Mondays off for college classes")).toBeInTheDocument();
    });

    test('displays rule type badges in info panel', () => {
      render(<RuleInput />);
      
      expect(screen.getByText('Availability')).toBeInTheDocument();
      expect(screen.getByText('Preference')).toBeInTheDocument();
      expect(screen.getByText('Requirement')).toBeInTheDocument();
      expect(screen.getByText('Restriction')).toBeInTheDocument();
    });
  });

  describe('Rule Input Interaction', () => {
    test('updates input field when typing', async () => {
      const user = userEvent.setup();
      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      await user.type(input, 'Test rule input');
      
      expect(input).toHaveValue('Test rule input');
    });

    test('populates input when clicking example chip', async () => {
      const user = userEvent.setup();
      render(<RuleInput />);
      
      const exampleChip = screen.getByText("John prefers morning shifts on weekends");
      await user.click(exampleChip);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      expect(input).toHaveValue("John prefers morning shifts on weekends");
    });

    test('disables parse button when input is empty', () => {
      render(<RuleInput />);
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      expect(parseButton).toBeDisabled();
    });

    test('enables parse button when input has text', async () => {
      const user = userEvent.setup();
      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      await user.type(input, 'Test rule');
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      expect(parseButton).toBeEnabled();
    });
  });

  describe('Rule Parsing', () => {
    test('calls API when parse button is clicked', async () => {
      const user = userEvent.setup();
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rule_type: 'availability',
          employee: 'Sarah',
          constraints: [{ type: 'time', value: '17:00' }]
        })
      });

      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      await user.type(input, "Sarah can't work past 5pm");
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      await user.click(parseButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/rules/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rule_text: "Sarah can't work past 5pm" })
        });
      });
    });

    test('shows loading state while parsing', async () => {
      const user = userEvent.setup();
      fetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      await user.type(input, 'Test rule');
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      await user.click(parseButton);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(parseButton).toBeDisabled();
    });

    test('shows preview dialog on successful parse', async () => {
      const user = userEvent.setup();
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rule_type: 'preference',
          employee: 'John',
          constraints: []
        })
      });

      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      await user.type(input, 'John prefers morning shifts');
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      await user.click(parseButton);

      await waitFor(() => {
        expect(screen.getByText('Rule Preview')).toBeInTheDocument();
        expect(screen.getByText('Rule parsed successfully!')).toBeInTheDocument();
      });
    });

    test('shows error notification on parse failure', async () => {
      const user = userEvent.setup();
      fetch.mockRejectedValueOnce(new Error('API Error'));

      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      await user.type(input, 'Invalid rule');
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      await user.click(parseButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to parse rule')).toBeInTheDocument();
      });
    });
  });

  describe('Rule Management', () => {
    test('adds rule to list when confirmed', async () => {
      const user = userEvent.setup();
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rule_type: 'availability',
          employee: 'Sarah',
          constraints: []
        })
      });

      render(<RuleInput />);
      
      // Parse rule
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      await user.type(input, "Sarah can't work weekends");
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      await user.click(parseButton);

      // Wait for preview dialog
      await waitFor(() => {
        expect(screen.getByText('Rule Preview')).toBeInTheDocument();
      });

      // Confirm rule
      const confirmButton = screen.getByRole('button', { name: /Confirm & Add/i });
      await user.click(confirmButton);

      // Check rule is added to list
      await waitFor(() => {
        expect(screen.getByText("Sarah can't work weekends")).toBeInTheDocument();
        expect(screen.getByText('Active Rules (1)')).toBeInTheDocument();
      });
    });

    test('clears input after adding rule', async () => {
      const user = userEvent.setup();
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rule_type: 'preference',
          employee: 'Mike',
          constraints: []
        })
      });

      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      await user.type(input, 'Mike prefers mornings');
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      await user.click(parseButton);

      await waitFor(() => {
        expect(screen.getByText('Rule Preview')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /Confirm & Add/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    test('toggles rule active status', async () => {
      const user = userEvent.setup();
      
      // Add a rule first
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rule_type: 'availability',
          employee: 'Test',
          constraints: []
        })
      });

      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      await user.type(input, 'Test rule');
      await user.click(screen.getByRole('button', { name: /Parse Rule/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Rule Preview')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /Confirm & Add/i }));

      // Find and click toggle button
      await waitFor(() => {
        const listItem = screen.getByText('Test rule').closest('li');
        const toggleButton = within(listItem).getAllByRole('button')[0];
        fireEvent.click(toggleButton);
      });

      // Check for inactive chip
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    test('deletes rule from list', async () => {
      const user = userEvent.setup();
      
      // Add a rule first
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rule_type: 'preference',
          employee: 'Delete Test',
          constraints: []
        })
      });

      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      await user.type(input, 'Rule to delete');
      await user.click(screen.getByRole('button', { name: /Parse Rule/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Rule Preview')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /Confirm & Add/i }));

      // Find and click delete button
      await waitFor(() => {
        const listItem = screen.getByText('Rule to delete').closest('li');
        const deleteButton = within(listItem).getByTestId('DeleteIcon').closest('button');
        fireEvent.click(deleteButton);
      });

      // Check rule is removed
      expect(screen.queryByText('Rule to delete')).not.toBeInTheDocument();
      expect(screen.getByText('Active Rules (0)')).toBeInTheDocument();
    });

    test('shows empty state when no rules', () => {
      render(<RuleInput />);
      
      expect(screen.getByText('No rules created yet. Add your first rule above!')).toBeInTheDocument();
    });
  });

  describe('Preview Dialog', () => {
    test('closes preview dialog on cancel', async () => {
      const user = userEvent.setup();
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rule_type: 'requirement',
          constraints: []
        })
      });

      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      await user.type(input, 'Need 3 people');
      await user.click(screen.getByRole('button', { name: /Parse Rule/i }));

      await waitFor(() => {
        expect(screen.getByText('Rule Preview')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Rule Preview')).not.toBeInTheDocument();
      });
    });

    test('displays parsed rule details in preview', async () => {
      const user = userEvent.setup();
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rule_type: 'restriction',
          employee: 'Jane',
          constraints: [
            { type: 'hours', value: 40 }
          ]
        })
      });

      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      await user.type(input, 'Jane maximum 40 hours');
      await user.click(screen.getByRole('button', { name: /Parse Rule/i }));

      await waitFor(() => {
        expect(screen.getByText('Type:')).toBeInTheDocument();
        expect(screen.getByText('restriction')).toBeInTheDocument();
        expect(screen.getByText('Employee:')).toBeInTheDocument();
        expect(screen.getByText('Jane')).toBeInTheDocument();
        expect(screen.getByText('Constraints:')).toBeInTheDocument();
        expect(screen.getByText('1 found')).toBeInTheDocument();
      });
    });
  });

  describe('Notifications', () => {
    test('shows success notification when rule is added', async () => {
      const user = userEvent.setup();
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rule_type: 'availability',
          employee: 'Test',
          constraints: []
        })
      });

      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      await user.type(input, 'Test rule');
      await user.click(screen.getByRole('button', { name: /Parse Rule/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Rule Preview')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /Confirm & Add/i }));

      await waitFor(() => {
        expect(screen.getByText('Rule added successfully')).toBeInTheDocument();
      });
    });

    test('shows info notification when rule is removed', async () => {
      const user = userEvent.setup();
      
      // Add a rule first
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rule_type: 'preference',
          employee: 'Test',
          constraints: []
        })
      });

      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm on weekdays/i);
      await user.type(input, 'Test rule');
      await user.click(screen.getByRole('button', { name: /Parse Rule/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Rule Preview')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /Confirm & Add/i }));

      // Delete the rule
      await waitFor(() => {
        const listItem = screen.getByText('Test rule').closest('li');
        const deleteButton = within(listItem).getByTestId('DeleteIcon').closest('button');
        fireEvent.click(deleteButton);
      });

      expect(screen.getByText('Rule removed')).toBeInTheDocument();
    });
  });
});