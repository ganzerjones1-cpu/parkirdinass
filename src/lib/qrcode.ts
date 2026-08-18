import QRCode from 'qrcode';
import type { Vehicle, Employee, VehicleDriverPair } from '../types/database';

export async function generateQRCode(
  vehicle: Vehicle,
  employee: Employee,
  pairId: string
): Promise<string> {
  const qrData = JSON.stringify({
    vehicle_id: vehicle.id,
    employee_id: employee.id,
    pair_id: pairId,
    no_polisi: vehicle.no_polisi,
    nama: employee.nama_lengkap,
    nip: employee.nip,
    timestamp: Date.now(),
  });

  const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  return qrCodeDataUrl;
}

export function parseQRCode(qrString: string): {
  vehicle_id: string;
  employee_id: string;
  pair_id: string;
  no_polisi: string;
  nama: string;
  nip: string;
  timestamp: number;
} | null {
  try {
    const data = JSON.parse(qrString);
    return data;
  } catch (error) {
    console.error('Error parsing QR code:', error);
    return null;
  }
}

export function formatQRCodeForDisplay(pair: VehicleDriverPair): string {
  return `QR-${pair.qr_code}`;
}
