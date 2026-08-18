import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, User, ArrowLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function ForgotPasswordPage() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/request-password-reset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ username }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal mengirim permintaan');
      }

      toast.success('Permintaan reset password telah dikirim ke Super Admin');
      setSubmitted(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Gagal mengirim permintaan');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-green-700 p-8 text-center">
              <CheckCircle className="w-16 h-16 text-white mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-white mb-2">Permintaan Terkirim</h1>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className="text-gray-600">
                Permintaan reset password Anda telah dikirim ke Super Admin.
              </p>
              <p className="text-sm text-gray-500">
                Silakan tunggu konfirmasi dari Super Admin melalui menu Manajemen User.
              </p>
              <p className="text-xs text-gray-400 mt-4">
                Anda akan kembali ke halaman login dalam beberapa detik...
              </p>
              <Link
                to="/login"
                className="inline-block mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Kembali ke Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-center">
            <img
              src="/logo-login copy.png"
              alt="Logo TTU"
              className="w-24 h-24 mx-auto mb-4 drop-shadow-lg"
            />
            <h1 className="text-2xl font-bold text-white mb-2">Lupa Password</h1>
            <p className="text-blue-100 text-sm">Sistem Manajemen Parkir</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8">
            <p className="text-sm text-gray-600 mb-6">
              Masukkan username atau NIP Anda untuk mengajukan permintaan reset password.
              Super Admin akan mengkonfirmasi permintaan Anda.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username / NIP
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Masukkan username atau NIP"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memproses...' : 'Ajukan Permintaan Reset'}
            </button>

            <div className="mt-6 pt-6 border-t">
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
