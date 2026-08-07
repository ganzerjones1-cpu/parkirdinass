export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          password: string;
          role: UserRole;
          status_akun: AccountStatus;
          foto: string | null;
          nama_lengkap: string | null;
          auth_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          password: string;
          role?: UserRole;
          status_akun?: AccountStatus;
          foto?: string | null;
          nama_lengkap?: string | null;
          auth_id?: string | null;
        };
        Update: {
          id?: string;
          username?: string;
          password?: string;
          role?: UserRole;
          status_akun?: AccountStatus;
          foto?: string | null;
          nama_lengkap?: string | null;
          auth_id?: string | null;
        };
      };
      vehicles: {
        Row: {
          id: string;
          no_polisi: string;
          nama_instansi: string;
          jenis_kendaraan: VehicleType;
          tipe_merk: string;
          kondisi_aset_terakhir: AssetCondition;
          status_qr: QRStatus;
          foto_kendaraan: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          no_polisi: string;
          nama_instansi: string;
          jenis_kendaraan: VehicleType;
          tipe_merk: string;
          kondisi_aset_terakhir?: AssetCondition;
          status_qr?: QRStatus;
          foto_kendaraan?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          no_polisi?: string;
          nama_instansi?: string;
          jenis_kendaraan?: VehicleType;
          tipe_merk?: string;
          kondisi_aset_terakhir?: AssetCondition;
          status_qr?: QRStatus;
          foto_kendaraan?: string | null;
          deleted_at?: string | null;
        };
      };
      employees: {
        Row: {
          id: string;
          nip: string;
          nama_lengkap: string;
          jabatan_pangkat: string;
          no_kontak_wa: string | null;
          user_id: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nip: string;
          nama_lengkap: string;
          jabatan_pangkat: string;
          no_kontak_wa?: string | null;
          user_id?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          nip?: string;
          nama_lengkap?: string;
          jabatan_pangkat?: string;
          no_kontak_wa?: string | null;
          user_id?: string | null;
          deleted_at?: string | null;
        };
      };
      vehicle_driver_pairs: {
        Row: {
          id: string;
          vehicle_id: string;
          employee_id: string;
          qr_code: string;
          is_primary_driver: boolean;
          active_until: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          employee_id: string;
          qr_code: string;
          is_primary_driver?: boolean;
          active_until?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          employee_id?: string;
          qr_code?: string;
          is_primary_driver?: boolean;
          active_until?: string | null;
          deleted_at?: string | null;
        };
      };
      parking_logs: {
        Row: {
          id: string;
          pair_id: string;
          check_in_time: string | null;
          check_out_time: string | null;
          check_in_condition: AssetCondition;
          check_out_condition: AssetCondition | null;
          checked_in_by: string | null;
          checked_out_by: string | null;
          purpose: string | null;
          status: ParkingStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pair_id: string;
          check_in_time?: string | null;
          check_out_time?: string | null;
          check_in_condition?: AssetCondition;
          check_out_condition?: AssetCondition | null;
          checked_in_by?: string | null;
          checked_out_by?: string | null;
          purpose?: string | null;
          status?: ParkingStatus;
        };
        Update: {
          id?: string;
          pair_id?: string;
          check_in_time?: string | null;
          check_out_time?: string | null;
          check_in_condition?: AssetCondition;
          check_out_condition?: AssetCondition | null;
          checked_in_by?: string | null;
          checked_out_by?: string | null;
          purpose?: string | null;
          status?: ParkingStatus;
        };
      };
      permits: {
        Row: {
          id: string;
          employee_id: string;
          vehicle_id: string;
          start_date: string;
          end_date: string;
          purpose: string;
          spt_document_url: string | null;
          status: PermitStatus;
          approved_by: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          vehicle_id: string;
          start_date: string;
          end_date: string;
          purpose: string;
          spt_document_url?: string | null;
          status?: PermitStatus;
          approved_by?: string | null;
          rejection_reason?: string | null;
        };
        Update: {
          id?: string;
          employee_id?: string;
          vehicle_id?: string;
          start_date?: string;
          end_date?: string;
          purpose?: string;
          spt_document_url?: string | null;
          status?: PermitStatus;
          approved_by?: string | null;
          rejection_reason?: string | null;
        };
      };
      violations: {
        Row: {
          id: string;
          pair_id: string;
          parking_log_id: string | null;
          violation_date: string;
          violation_type: ViolationType;
          week_number: number;
          is_consecutive: boolean;
          consecutive_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          pair_id: string;
          parking_log_id?: string | null;
          violation_date: string;
          violation_type?: ViolationType;
          week_number: number;
          is_consecutive?: boolean;
          consecutive_count?: number;
        };
        Update: {
          id?: string;
          pair_id?: string;
          parking_log_id?: string | null;
          violation_date?: string;
          violation_type?: ViolationType;
          week_number?: number;
          is_consecutive?: boolean;
          consecutive_count?: number;
        };
      };
    };
    Enums: {
      user_role: UserRole;
      account_status: AccountStatus;
      vehicle_type: VehicleType;
      asset_condition: AssetCondition;
      qr_status: QRStatus;
      parking_status: ParkingStatus;
      permit_status: PermitStatus;
      violation_type: ViolationType;
    };
  };
}

export type UserRole = 'super_admin' | 'admin_parkir' | 'user_pegawai';
export type AccountStatus = 'Aktif' | 'Non-Aktif';
export type VehicleType = 'Roda 4' | 'Roda 2' | 'Truk' | 'Ambulans';
export type AssetCondition = 'Baik' | 'Rusak Ringan' | 'Rusak Berat';
export type QRStatus = 'Aktif' | 'Terblokir';
export type ParkingStatus = 'Di_Lahan' | 'Di_Luar_Lahan';
export type PermitStatus = 'Menunggu' | 'Disetujui' | 'Ditolak';
export type ViolationType = 'Parkir_Libur_Tanpa_Izin' | 'Keterlambatan_Kembali' | 'Pelanggaran_Lain';

export type User = Database['public']['Tables']['users']['Row'];
export type Vehicle = Database['public']['Tables']['vehicles']['Row'];
export type Employee = Database['public']['Tables']['employees']['Row'];
export type VehicleDriverPair = Database['public']['Tables']['vehicle_driver_pairs']['Row'];
export type ParkingLog = Database['public']['Tables']['parking_logs']['Row'];
export type Permit = Database['public']['Tables']['permits']['Row'];
export type Violation = Database['public']['Tables']['violations']['Row'];

export interface UserWithEmployee extends User {
  employee?: Employee;
}

export interface VehiclePairWithDetails extends VehicleDriverPair {
  vehicle: Vehicle;
  employee: Employee;
  parking_logs?: ParkingLog[];
}

export interface ViolationWithDetails extends Violation {
  pair: VehicleDriverPair & {
    vehicle: Vehicle;
    employee: Employee;
  };
  parking_log?: ParkingLog;
}
