import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Car, Users, FileText, AlertTriangle, CheckCircle, Wrench, TrendingUp } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { id } from 'date-fns/locale';

interface Stats {
  totalVehicles: number;
  totalEmployees: number;
  permitsThisMonth: number;
  vehiclesGood: number;
  vehiclesLightDamage: number;
  vehiclesHeavyDamage: number;
  activeVehicles: number;
  blockedVehicles: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Get all vehicles
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('*')
        .is('deleted_at', null);

      // Get all employees
      const { data: employees } = await supabase
        .from('employees')
        .select('*')
        .is('deleted_at', null);

      // Get permits this month
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data: permits } = await supabase
        .from('permits')
        .select('*')
        .gte('created_at', firstDayOfMonth.toISOString());

      const vehiclesGood = vehicles?.filter(v => v.kondisi_aset_terakhir === 'Baik').length || 0;
      const vehiclesLightDamage = vehicles?.filter(v => v.kondisi_aset_terakhir === 'Rusak Ringan').length || 0;
      const vehiclesHeavyDamage = vehicles?.filter(v => v.kondisi_aset_terakhir === 'Rusak Berat').length || 0;
      const activeVehicles = vehicles?.filter(v => v.status_qr === 'Aktif').length || 0;
      const blockedVehicles = vehicles?.filter(v => v.status_qr === 'Terblokir').length || 0;

      setStats({
        totalVehicles: vehicles?.length || 0,
        totalEmployees: employees?.length || 0,
        permitsThisMonth: permits?.length || 0,
        vehiclesGood,
        vehiclesLightDamage,
        vehiclesHeavyDamage,
        activeVehicles,
        blockedVehicles,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold mb-2">Dashboard Admin Parkir</h1>
        <p className="text-blue-100">
          {format(new Date(), "EEEE, dd MMMM yyyy", { locale: id })}
        </p>
      </div>

      {/* Stats Cards - Block Pamflet */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Kendaraan */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Car className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500 font-medium">Total</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-bold text-gray-900">{stats?.totalVehicles || 0}</h3>
            <p className="text-sm text-gray-600">Kendaraan Dinas</p>
          </div>
        </div>

        {/* Total Pegawai */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs text-gray-500 font-medium">Total</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-bold text-gray-900">{stats?.totalEmployees || 0}</h3>
            <p className="text-sm text-gray-600">Pegawai & Sopir</p>
          </div>
        </div>

        {/* Izin Bulan Ini */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="text-xs text-gray-500 font-medium">Bulan Ini</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-bold text-gray-900">{stats?.permitsThisMonth || 0}</h3>
            <p className="text-sm text-gray-600">Pengajuan E-Izin</p>
          </div>
        </div>

        {/* Kendaraan Aktif */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-xs text-gray-500 font-medium">Status</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-bold text-gray-900">{stats?.activeVehicles || 0}</h3>
            <p className="text-sm text-gray-600">QR Code Aktif</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kondisi Kendaraan - Circle Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Kondisi Kendaraan</h2>
              <p className="text-sm text-gray-600">Status aset terbaru</p>
            </div>
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Wrench className="w-5 h-5 text-gray-600" />
            </div>
          </div>

          {/* Circle Donut Chart */}
          <div className="flex items-center justify-center mb-6">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#f3f4f6"
                  strokeWidth="12"
                />
                {/* Good condition - green */}
                {stats && (
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="12"
                    strokeDasharray={`${(stats.vehiclesGood / stats.totalVehicles) * 251.2} 251.2`}
                    strokeLinecap="round"
                  />
                )}
                {/* Light damage - yellow */}
                {stats && (
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="12"
                    strokeDasharray={`${(stats.vehiclesLightDamage / stats.totalVehicles) * 251.2} 251.2`}
                    strokeDashoffset={`-${(stats.vehiclesGood / stats.totalVehicles) * 251.2}`}
                    strokeLinecap="round"
                  />
                )}
                {/* Heavy damage - red */}
                {stats && (
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="12"
                    strokeDasharray={`${(stats.vehiclesHeavyDamage / stats.totalVehicles) * 251.2} 251.2`}
                    strokeDashoffset={`-${((stats.vehiclesGood + stats.vehiclesLightDamage) / stats.totalVehicles) * 251.2}`}
                    strokeLinecap="round"
                  />
                )}
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-gray-900">{stats?.totalVehicles || 0}</span>
                <span className="text-xs text-gray-600">Total</span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{stats?.vehiclesGood || 0}</p>
                <p className="text-xs text-gray-600">Baik</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{stats?.vehiclesLightDamage || 0}</p>
                <p className="text-xs text-gray-600">Rusak Ringan</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{stats?.vehiclesHeavyDamage || 0}</p>
                <p className="text-xs text-gray-600">Rusak Berat</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status QR Code - Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Status QR Code</h2>
              <p className="text-sm text-gray-600">Kendaraan aktif vs terblokir</p>
            </div>
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-gray-600" />
            </div>
          </div>

          {/* Bar Chart */}
          <div className="space-y-4">
            {/* Active */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Aktif</span>
                <span className="text-sm font-bold text-gray-900">{stats?.activeVehicles || 0}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-8 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                  style={{ width: stats ? `${(stats.activeVehicles / stats.totalVehicles) * 100}%` : '0%' }}
                >
                  {stats && stats.activeVehicles > 0 && (
                    <span className="text-xs font-bold text-white">
                      {Math.round((stats.activeVehicles / stats.totalVehicles) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Blocked */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Terblokir</span>
                <span className="text-sm font-bold text-gray-900">{stats?.blockedVehicles || 0}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-8 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-red-500 to-red-600 h-full rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                  style={{ width: stats ? `${(stats.blockedVehicles / stats.totalVehicles) * 100}%` : '0%' }}
                >
                  {stats && stats.blockedVehicles > 0 && (
                    <span className="text-xs font-bold text-white">
                      {Math.round((stats.blockedVehicles / stats.totalVehicles) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Alert for blocked vehicles */}
          {stats && stats.blockedVehicles > 0 && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    Perhatian!
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    Terdapat {stats.blockedVehicles} kendaraan dengan QR Code terblokir akibat pelanggaran.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Vehicle Condition Summary - Block Pamflet */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Ringkasan Kondisi Aset</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Good */}
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border-2 border-emerald-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <span className="text-4xl font-bold text-emerald-700">{stats?.vehiclesGood || 0}</span>
            </div>
            <h3 className="text-lg font-bold text-emerald-900 mb-1">Baik</h3>
            <p className="text-sm text-emerald-700">
              {stats ? Math.round((stats.vehiclesGood / stats.totalVehicles) * 100) : 0}% dari total kendaraan
            </p>
            <div className="mt-4 pt-4 border-t border-emerald-300">
              <div className="flex items-center gap-2 text-xs text-emerald-600">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span>Siap digunakan</span>
              </div>
            </div>
          </div>

          {/* Light Damage */}
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border-2 border-yellow-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-yellow-500 rounded-full flex items-center justify-center">
                <Wrench className="w-7 h-7 text-white" />
              </div>
              <span className="text-4xl font-bold text-yellow-700">{stats?.vehiclesLightDamage || 0}</span>
            </div>
            <h3 className="text-lg font-bold text-yellow-900 mb-1">Rusak Ringan</h3>
            <p className="text-sm text-yellow-700">
              {stats ? Math.round((stats.vehiclesLightDamage / stats.totalVehicles) * 100) : 0}% dari total kendaraan
            </p>
            <div className="mt-4 pt-4 border-t border-yellow-300">
              <div className="flex items-center gap-2 text-xs text-yellow-600">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <span>Perlu perawatan</span>
              </div>
            </div>
          </div>

          {/* Heavy Damage */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border-2 border-red-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-white" />
              </div>
              <span className="text-4xl font-bold text-red-700">{stats?.vehiclesHeavyDamage || 0}</span>
            </div>
            <h3 className="text-lg font-bold text-red-900 mb-1">Rusak Berat</h3>
            <p className="text-sm text-red-700">
              {stats ? Math.round((stats.vehiclesHeavyDamage / stats.totalVehicles) * 100) : 0}% dari total kendaraan
            </p>
            <div className="mt-4 pt-4 border-t border-red-300">
              <div className="flex items-center gap-2 text-xs text-red-600">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span>Perlu perbaikan besar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
