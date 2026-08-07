import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { Vehicle, VehicleType, AssetCondition } from '../../types/database';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Car,
  AlertTriangle,
  Upload,
  ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export function VehicleManagement() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    no_polisi: '',
    nama_instansi: '',
    jenis_kendaraan: 'Roda 4' as VehicleType,
    tipe_merk: '',
    kondisi_aset_terakhir: 'Baik' as AssetCondition,
    foto_kendaraan: null as string | null,
  });

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Gagal memuat data kendaraan');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setUploadingPhoto(true);

    try {
      const folderId = selectedVehicle?.id || `new_${Date.now()}`;
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${folderId}/vehicle_${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from('vehicles')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('vehicles')
        .getPublicUrl(data.path);

      setFormData((prev) => ({ ...prev, foto_kendaraan: urlData.publicUrl }));
      toast.success('Foto berhasil diupload');
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast.error(error.message || 'Gagal mengupload foto');
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (selectedVehicle) {
        // Update existing vehicle
        const { error } = await supabase
          .from('vehicles')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedVehicle.id);

        if (error) throw error;
        toast.success('Kendaraan berhasil diperbarui');
      } else {
        // Create new vehicle
        const { error } = await supabase.from('vehicles').insert(formData);

        if (error) throw error;
        toast.success('Kendaraan berhasil ditambahkan');
      }

      setShowModal(false);
      resetForm();
      fetchVehicles();
    } catch (error: any) {
      console.error('Error saving vehicle:', error);
      toast.error(error.message || 'Gagal menyimpan kendaraan');
    }
  };

  const handleDelete = async () => {
    if (!selectedVehicle) return;

    try {
      const { error } = await supabase
        .from('vehicles')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedVehicle.id);

      if (error) throw error;
      toast.success('Kendaraan berhasil dihapus (soft delete)');
      setShowDeleteModal(false);
      setSelectedVehicle(null);
      fetchVehicles();
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      toast.error('Gagal menghapus kendaraan');
    }
  };

  const resetForm = () => {
    setFormData({
      no_polisi: '',
      nama_instansi: '',
      jenis_kendaraan: 'Roda 4',
      tipe_merk: '',
      kondisi_aset_terakhir: 'Baik',
      foto_kendaraan: null,
    });
    setSelectedVehicle(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openEditModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({
      no_polisi: vehicle.no_polisi,
      nama_instansi: vehicle.nama_instansi,
      jenis_kendaraan: vehicle.jenis_kendaraan,
      tipe_merk: vehicle.tipe_merk,
      kondisi_aset_terakhir: vehicle.kondisi_aset_terakhir,
      foto_kendaraan: vehicle.foto_kendaraan || null,
    });
    setPhotoPreview(vehicle.foto_kendaraan || null);
    setShowModal(true);
  };

  const openDeleteModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setShowDeleteModal(true);
  };

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.no_polisi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.nama_instansi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.tipe_merk.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Kendaraan</h1>
          <p className="text-gray-600 mt-1">Kelola data aset kendaraan dinas</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Tambah Kendaraan
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari nomor polisi, instansi, atau tipe..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Foto
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  No. Polisi
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Instansi
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                  Tipe / Merk
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                  Jenis
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                  Kondisi
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                  Status QR
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              ) : filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Tidak ada data kendaraan
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      {vehicle.foto_kendaraan ? (
                        <img
                          src={vehicle.foto_kendaraan}
                          alt={vehicle.no_polisi}
                          className="w-14 h-14 rounded-lg object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                          <Car className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{vehicle.no_polisi}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{vehicle.nama_instansi}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">
                      {vehicle.tipe_merk}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">
                      {vehicle.jenis_kendaraan}
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          vehicle.kondisi_aset_terakhir === 'Baik'
                            ? 'bg-green-100 text-green-700'
                            : vehicle.kondisi_aset_terakhir === 'Rusak Ringan'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {vehicle.kondisi_aset_terakhir}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          vehicle.status_qr === 'Aktiv'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {vehicle.status_qr}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(vehicle)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(vehicle)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowModal(false)}
            />
            <div className="inline-block w-full max-w-lg p-6 my-8 text-left align-middle bg-white shadow-xl rounded-2xl relative max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedVehicle ? 'Edit Kendaraan' : 'Tambah Kendaraan Baru'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Photo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Foto Kendaraan
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoSelect}
                        className="hidden"
                        id="vehicle-photo-input"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingPhoto ? 'Mengupload...' : 'Pilih Foto'}
                      </button>
                      <p className="text-xs text-gray-500 mt-1">
                        JPG, PNG, atau WebP. Maks 5MB.
                      </p>
                      {formData.foto_kendaraan && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, foto_kendaraan: null });
                            setPhotoPreview(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-xs text-red-600 hover:text-red-700 mt-1"
                        >
                          Hapus foto
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nomor Polisi *
                  </label>
                  <input
                    type="text"
                    value={formData.no_polisi}
                    onChange={(e) =>
                      setFormData({ ...formData, no_polisi: e.target.value.toUpperCase() })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="DH 8039 WE"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Instansi *
                  </label>
                  <input
                    type="text"
                    value={formData.nama_instansi}
                    onChange={(e) => setFormData({ ...formData, nama_instansi: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Dinas Perhubungan"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jenis Kendaraan *
                  </label>
                  <select
                    value={formData.jenis_kendaraan}
                    onChange={(e) =>
                      setFormData({ ...formData, jenis_kendaraan: e.target.value as VehicleType })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Roda 4">Roda 4 (Mobil Dinas)</option>
                    <option value="Roda 2">Roda 2 (Motor Dinas)</option>
                    <option value="Truk">Truk</option>
                    <option value="Ambulans">Ambulans</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipe / Merk *
                  </label>
                  <input
                    type="text"
                    value={formData.tipe_merk}
                    onChange={(e) => setFormData({ ...formData, tipe_merk: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Toyota Avanza 2020"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kondisi Aset
                  </label>
                  <select
                    value={formData.kondisi_aset_terakhir}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        kondisi_aset_terakhir: e.target.value as AssetCondition,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Baik">Baik</option>
                    <option value="Rusak Ringan">Rusak Ringan</option>
                    <option value="Rusak Berat">Rusak Berat</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingPhoto}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {selectedVehicle ? 'Simpan Perubahan' : 'Tambah Kendaraan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowDeleteModal(false)}
            />
            <div className="inline-block w-full max-w-md p-6 my-8 text-left align-middle bg-white shadow-xl rounded-2xl relative">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Hapus Kendaraan?</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Apakah Anda yakin ingin menghapus kendaraan{' '}
                  <span className="font-semibold">{selectedVehicle?.no_polisi}</span>?
                </p>
                <p className="text-xs text-gray-500 mb-6">
                  Tindakan ini akan menonaktifkan fungsi scan QR terkait. Data akan di-soft delete
                  dan dapat dipulihkan oleh Super Admin.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
