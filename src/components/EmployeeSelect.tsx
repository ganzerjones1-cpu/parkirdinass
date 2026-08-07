import React from 'react';
import type { Employee } from '../lib/supabaseHelpers';

type Props = {
  employees: Employee[];
  value?: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  name?: string;
  required?: boolean;
};

export default function EmployeeSelect({
  employees,
  value,
  onChange,
  placeholder = 'Pilih Sopir',
  name,
  required,
}: Props) {
  // employees yang diberikan diharapkan sudah difilter untuk deleted_at IS NULL
  return (
    <select
      name={name}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      required={required}
      aria-label={placeholder}
      className="w-full border rounded px-3 py-2"
    >
      <option value="">{placeholder}</option>
      {employees.map((emp) => {
        const label = (emp.nama || emp.name || emp.nip || emp.id).toString();
        return (
          <option key={emp.id} value={emp.id}>
            {label}
          </option>
        );
      })}
    </select>
  );
}
