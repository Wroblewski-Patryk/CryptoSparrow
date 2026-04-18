import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CompoundField,
  NumberField,
  RadioGroupField,
  RangeField,
  SelectField,
  TextareaField,
  TextField,
  ToggleField,
} from './FormFields';

describe('Form field primitives', () => {
  it('handles text, number, select, and textarea updates', () => {
    const onTextChange = vi.fn();
    const onNumberChange = vi.fn();
    const onSelectChange = vi.fn();
    const onTextareaChange = vi.fn();

    render(
      <>
        <TextField id='name' label='Name' value='Alpha' onChange={onTextChange} />
        <NumberField id='qty' label='Quantity' value='2' onChange={onNumberChange} />
        <SelectField
          id='mode'
          label='Mode'
          value='PAPER'
          onChange={onSelectChange}
          options={[
            { value: 'PAPER', label: 'Paper' },
            { value: 'LIVE', label: 'Live' },
          ]}
        />
        <TextareaField id='notes' label='Notes' value='Initial' onChange={onTextareaChange} />
      </>
    );

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Beta' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'LIVE' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Updated' } });

    expect(onTextChange).toHaveBeenCalledWith('Beta');
    expect(onNumberChange).toHaveBeenCalledWith('3');
    expect(onSelectChange).toHaveBeenCalledWith('LIVE');
    expect(onTextareaChange).toHaveBeenCalledWith('Updated');
  });

  it('handles toggle and radio group selections', () => {
    const onToggleChange = vi.fn();
    const onRadioChange = vi.fn();

    render(
      <>
        <ToggleField id='enabled' label='Enabled' checked={false} onChange={onToggleChange} />
        <RadioGroupField
          id='side'
          label='Side'
          value='BUY'
          onChange={onRadioChange}
          options={[
            { value: 'BUY', label: 'Buy' },
            { value: 'SELL', label: 'Sell' },
          ]}
        />
      </>
    );

    fireEvent.click(screen.getByLabelText('Enabled'));
    fireEvent.click(screen.getByLabelText('Sell'));

    expect(onToggleChange).toHaveBeenCalledWith(true);
    expect(onRadioChange).toHaveBeenCalledWith('SELL');
  });

  it('handles range updates and value display', () => {
    const onRangeChange = vi.fn();

    render(<RangeField id='risk' label='Risk' value={10} min={1} max={20} onChange={onRangeChange} />);

    fireEvent.change(screen.getByLabelText('Risk'), { target: { value: '12' } });
    expect(onRangeChange).toHaveBeenCalledWith(12);
    expect(screen.getByText('Value: 10')).toBeInTheDocument();
  });

  it('renders compound field with nested controls', () => {
    render(
      <CompoundField label='Advanced' hint='Set both values.' columns={2}>
        <div>Left</div>
        <div>Right</div>
      </CompoundField>
    );

    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('Set both values.')).toBeInTheDocument();
    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
  });
});

