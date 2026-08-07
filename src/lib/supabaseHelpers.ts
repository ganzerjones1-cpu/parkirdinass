import { supabase } from './supabase'; // sesuaikan path kalau berbeda

export type Employee = {
  id: string;
  nama?: string;
  name?: string;
  nip?: string | null;
  deleted_at?: string | null;
  [k: string]: any;
};

export type Vehicle = {
  id: string;
  no_polisi?: string;
  tipe?: string;
  deleted_at?: string | null;
  [k: string]: any;
};

export type Pair = {
  id: string;
  vehicle_id: string;
  employee_id: string;
  active?: boolean;
  deleted_at?: string | null;
  [k: string]: any;
};

export async function fetchActiveEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from<Employee>('employees')
    .select('*')
    .is('deleted_at', null);

  if (error) throw error;
  return data ?? [];
}

export async function fetchActiveVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from<Vehicle>('vehicles')
    .select('*')
    .is('deleted_at', null);

  if (error) throw error;
  return data ?? [];
}

export async function fetchActivePairs(): Promise<Pair[]> {
  // Ambil pairs yang masih aktif (active = true) dan tidak dihapus
  const { data, error } = await supabase
    .from<Pair>('pairs')
    .select('*')
    .eq('active', true)
    .is('deleted_at', null);

  if (error) throw error;
  return data ?? [];
}
