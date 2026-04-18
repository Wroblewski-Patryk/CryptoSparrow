import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormAlert } from './FormAlert';
import { FormField } from './FormField';
import { FormGrid } from './FormGrid';
import { FormPageShell } from './FormPageShell';
import { FormSectionCard } from './FormSectionCard';
import { FormValidationSummary } from './FormValidationSummary';

describe('Form primitives', () => {
  it('renders form page shell header and actions', () => {
    render(
      <FormPageShell
        title='Create Bot'
        description='Configure runtime and controls.'
        headerActions={<button type='button'>Back</button>}
      >
        <div>Body</div>
      </FormPageShell>
    );

    expect(screen.getByRole('heading', { name: 'Create Bot' })).toBeInTheDocument();
    expect(screen.getByText('Configure runtime and controls.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('renders section card and grid classes', () => {
    const { container } = render(
      <FormSectionCard title='General'>
        <FormGrid columns={3}>
          <div>Field A</div>
          <div>Field B</div>
        </FormGrid>
      </FormSectionCard>
    );

    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
    expect(screen.getByText('Field A')).toBeInTheDocument();
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('xl:grid-cols-3');
  });

  it('renders field metadata and error state', () => {
    render(
      <FormField label='Name' htmlFor='name-input' required hint='Visible in list.' error='Name is required.'>
        <input id='name-input' />
      </FormField>
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('Visible in list.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.');
  });

  it('renders alert variants and summary list', () => {
    render(
      <>
        <FormAlert variant='warning' title='Check configuration'>
          Review leverage and limits.
        </FormAlert>
        <FormValidationSummary errors={['Name is required.', 'Pick at least one symbol.']} />
      </>
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveClass('alert-warning');
    expect(within(alerts[1]).getByText('Name is required.')).toBeInTheDocument();
    expect(within(alerts[1]).getByText('Pick at least one symbol.')).toBeInTheDocument();
  });

  it('hides validation summary when there are no errors', () => {
    render(<FormValidationSummary errors={[]} />);
    expect(screen.queryByTestId('form-validation-summary')).not.toBeInTheDocument();
  });
});

