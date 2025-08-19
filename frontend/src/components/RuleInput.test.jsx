import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RuleInput from '../RuleInput';
import { ruleService } from '../../services/api';

// Mock the API service
jest.mock('../../services/api', () => ({
  ruleService: {
    parseRule: jest.fn(),
    getRules: jest.fn(),
    deleteRule: jest.fn(),
    updateRule: jest.fn(),
  }
}));

describe('RuleInput Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders rule input form correctly', () => {
      render(<RuleInput />);
      
      expect(screen.getByText('AI Schedule Manager - Rule Creator')).toBeInTheDocument();
      expect(screen.getByText('Create Scheduling Rule')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Example: Sarah can't work past 5pm/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Parse Rule/i })).toBeInTheDocument();
    });

    test('displays example rules', () => {
      render(<RuleInput />);
      
      expect(screen.getByText('Quick Examples:')).toBeInTheDocument();
      expect(screen.getByText("Sarah can't work past 5pm on weekdays due to childcare")).toBeInTheDocument();
      expect(screen.getByText('John prefers morning shifts on weekends')).toBeInTheDocument();
    });

    test('shows info panel with rule types', () => {
      render(<RuleInput />);
      
      expect(screen.getByText('How It Works')).toBeInTheDocument();
      expect(screen.getByText('Availability')).toBeInTheDocument();
      expect(screen.getByText('Preference')).toBeInTheDocument();
      expect(screen.getByText('Requirement')).toBeInTheDocument();
      expect(screen.getByText('Restriction')).toBeInTheDocument();
    });
  });

  describe('Rule Parsing', () => {
    test('successfully parses a rule', async () => {
      const mockParsedRule = {
        id: 1,
        rule_type: 'availability',
        employee: 'Sarah Johnson',
        constraints: [{ type: 'time', value: '17:00' }],
        original_text: "Sarah can't work past 5pm",
      };

      ruleService.parseRule.mockResolvedValue(mockParsedRule);
      
      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm/);
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      
      await userEvent.type(input, "Sarah can't work past 5pm");
      await userEvent.click(parseButton);
      
      await waitFor(() => {
        expect(ruleService.parseRule).toHaveBeenCalledWith("Sarah can't work past 5pm");
      });
    });

    test('handles parsing errors gracefully', async () => {
      ruleService.parseRule.mockRejectedValue(new Error('Failed to parse rule'));
      
      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm/);
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      
      await userEvent.type(input, 'Invalid rule text');
      await userEvent.click(parseButton);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to parse rule')).toBeInTheDocument();
      });
    });

    test('disables parse button when input is empty', () => {
      render(<RuleInput />);
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      expect(parseButton).toBeDisabled();
    });

    test('shows loading state during parsing', async () => {
      ruleService.parseRule.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm/);
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      
      await userEvent.type(input, 'Test rule');
      await userEvent.click(parseButton);
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Rule Management', () => {
    test('adds rule to active rules list', async () => {
      const mockParsedRule = {
        rule_type: 'availability',
        employee: 'Sarah Johnson',
        constraints: [],
      };

      ruleService.parseRule.mockResolvedValue(mockParsedRule);
      
      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm/);
      await userEvent.type(input, "Sarah can't work past 5pm");
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      await userEvent.click(parseButton);
      
      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /Confirm & Add/i });
        expect(confirmButton).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: /Confirm & Add/i });
      await userEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByText("Sarah can't work past 5pm")).toBeInTheDocument();
      });
    });

    test('deletes rule from active rules list', async () => {
      const mockParsedRule = {
        rule_type: 'availability',
        employee: 'John Smith',
        constraints: [],
      };

      ruleService.parseRule.mockResolvedValue(mockParsedRule);
      
      render(<RuleInput />);
      
      // Add a rule first
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm/);
      await userEvent.type(input, 'John needs mornings off');
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      await userEvent.click(parseButton);
      
      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /Confirm & Add/i });
        expect(confirmButton).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: /Confirm & Add/i });
      await userEvent.click(confirmButton);
      
      // Now delete the rule
      await waitFor(() => {
        const deleteButtons = screen.getAllByTestId('DeleteIcon');
        expect(deleteButtons.length).toBeGreaterThan(0);
      });
      
      const deleteButtons = screen.getAllByTestId('DeleteIcon');
      await userEvent.click(deleteButtons[0]);
      
      await waitFor(() => {
        expect(screen.queryByText('John needs mornings off')).not.toBeInTheDocument();
      });
    });

    test('toggles rule active status', async () => {
      const mockParsedRule = {
        rule_type: 'preference',
        employee: 'Mike Davis',
        constraints: [],
      };

      ruleService.parseRule.mockResolvedValue(mockParsedRule);
      
      render(<RuleInput />);
      
      // Add a rule
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm/);
      await userEvent.type(input, 'Mike prefers evenings');
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      await userEvent.click(parseButton);
      
      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /Confirm & Add/i });
        expect(confirmButton).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: /Confirm & Add/i });
      await userEvent.click(confirmButton);
      
      // Toggle active status
      await waitFor(() => {
        const toggleButtons = screen.getAllByTestId('CheckIcon');
        expect(toggleButtons.length).toBeGreaterThan(0);
      });
      
      const toggleButtons = screen.getAllByTestId('CheckIcon');
      await userEvent.click(toggleButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText('Inactive')).toBeInTheDocument();
      });
    });
  });

  describe('Quick Examples', () => {
    test('clicking example fills input field', async () => {
      render(<RuleInput />);
      
      const exampleChip = screen.getByText('John prefers morning shifts on weekends');
      await userEvent.click(exampleChip);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm/);
      expect(input.value).toBe('John prefers morning shifts on weekends');
    });
  });

  describe('Preview Dialog', () => {
    test('shows preview dialog after parsing', async () => {
      const mockParsedRule = {
        rule_type: 'requirement',
        employee: null,
        constraints: [{ type: 'staffing', value: '3' }],
      };

      ruleService.parseRule.mockResolvedValue(mockParsedRule);
      
      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm/);
      await userEvent.type(input, 'Need 3 people during lunch');
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      await userEvent.click(parseButton);
      
      await waitFor(() => {
        expect(screen.getByText('Rule Preview')).toBeInTheDocument();
        expect(screen.getByText('Rule parsed successfully!')).toBeInTheDocument();
        expect(screen.getByText('requirement')).toBeInTheDocument();
      });
    });

    test('can cancel preview dialog', async () => {
      const mockParsedRule = {
        rule_type: 'availability',
        employee: 'Sarah Johnson',
        constraints: [],
      };

      ruleService.parseRule.mockResolvedValue(mockParsedRule);
      
      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm/);
      await userEvent.type(input, "Sarah can't work evenings");
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      await userEvent.click(parseButton);
      
      await waitFor(() => {
        expect(screen.getByText('Rule Preview')).toBeInTheDocument();
      });
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await userEvent.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Rule Preview')).not.toBeInTheDocument();
      });
    });
  });

  describe('Notifications', () => {
    test('shows success notification when rule is added', async () => {
      const mockParsedRule = {
        rule_type: 'availability',
        employee: 'Sarah Johnson',
        constraints: [],
      };

      ruleService.parseRule.mockResolvedValue(mockParsedRule);
      
      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm/);
      await userEvent.type(input, "Sarah can't work past 5pm");
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      await userEvent.click(parseButton);
      
      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /Confirm & Add/i });
        expect(confirmButton).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: /Confirm & Add/i });
      await userEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByText('Rule added successfully')).toBeInTheDocument();
      });
    });

    test('shows error notification on parse failure', async () => {
      ruleService.parseRule.mockRejectedValue(new Error('Parse failed'));
      
      render(<RuleInput />);
      
      const input = screen.getByPlaceholderText(/Example: Sarah can't work past 5pm/);
      await userEvent.type(input, 'Invalid rule');
      
      const parseButton = screen.getByRole('button', { name: /Parse Rule/i });
      await userEvent.click(parseButton);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to parse rule')).toBeInTheDocument();
      });
    });
  });
});