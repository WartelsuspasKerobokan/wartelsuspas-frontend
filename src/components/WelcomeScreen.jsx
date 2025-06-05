import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { auth } from '../firebase-config';

function WelcomeScreen() {
  const [admins, setAdmins] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const response = await axios.get('http://localhost:3001/admins', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAdmins(response.data);
      } catch (err) {
        setError('Gagal memuat daftar admin');
      }
    };
    fetchAdmins();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-3xl font-bold mb-4">Selamat Datang di Wartelsuspas</h1>
      <p className="mb-4">Gunakan voucher untuk melakukan panggilan ke keluarga Anda.</p>
      <Link to="/voucher" className="bg-blue-500 text-white px-4 py-2 rounded mb-4">
        Masukkan Kode Voucher
      </Link>
      <p className="mb-2">Petugas Lapas?</p>
      <Link to="/admin/login" className="bg-green-500 text-white px-4 py-2 rounded mb-4">
        Login sebagai Admin
      </Link>
      {admins.length > 0 && (
        <div className="text-center">
          <p className="mb-2">Admin yang tersedia:</p>
          <ul className="list-disc">
            {admins.map(admin => (
              <li key={admin.uid} className="text-gray-700">{admin.email}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}

export default WelcomeScreen;