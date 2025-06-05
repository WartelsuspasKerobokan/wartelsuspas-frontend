import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase-config';
import { signOut } from 'firebase/auth';

function VoucherGenerator() {
  const [formData, setFormData] = useState({
    wbpName: '',
    room: '',
    phoneNumber: '',
    relation: '',
    duration: '600', // Default ke 10 menit (600 detik)
    cost: '5000'
  });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  // --- Semua durasi didefinisikan dalam DETIK ---
  const durationOptions = [
    { duration: 5, cost: 500, label: '5 Detik - Rp500 (untuk pengujian)' }, // 5 detik
    { duration: 5 * 60, cost: 2500, label: '5 Menit - Rp2.500' }, // 300 detik
    { duration: 10 * 60, cost: 5000, label: '10 Menit - Rp5.000' }, // 600 detik
    { duration: 15 * 60, cost: 7500, label: '15 Menit - Rp7.500' }, // 900 detik
    { duration: 20 * 60, cost: 10000, label: '20 Menit - Rp10.000' }, // 1200 detik
    { duration: 30 * 60, cost: 15000, label: '30 Menit - Rp15.000' }  // 1800 detik
  ];
  // --- Akhir definisi durasi ---

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = auth.currentUser;
      if (!user) {
        setMessage('Anda harus login sebagai admin terlebih dahulu');
        return;
      }
      const token = await user.getIdToken();
      // Durasi yang dikirim ke backend sudah dalam detik
      const durationInSeconds = parseFloat(formData.duration);
      const response = await axios.post('http://localhost:3001/generate-voucher', {
        ...formData,
        duration: durationInSeconds // Kirim durasi dalam detik ke backend
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setMessage(`Voucher berhasil dibuat: ${response.data.code}`);
      setTimeout(() => navigate('/admin/dashboard'), 2000);
    } catch (error) {
      console.error('Error generating voucher:', error);
      setMessage(error.response?.data || 'Gagal membuat voucher');
    }
  };

  const handleChange = (e) => {
    if (e.target.name === 'duration') {
      const selectedOption = durationOptions.find(opt => opt.duration.toString() === e.target.value);
      setFormData({
        ...formData,
        duration: selectedOption.duration.toString(), // Simpan durasi dalam detik (sebagai string)
        cost: selectedOption.cost.toString()
      });
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      setMessage('Gagal logout');
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="absolute top-4 right-4">
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>
      <h2 className="text-2xl font-bold mb-4">Generate Voucher</h2>
      <form onSubmit={handleSubmit} className="flex flex-col w-80">
        <input
          type="text"
          name="wbpName"
          value={formData.wbpName}
          onChange={handleChange}
          placeholder="Nama WBP"
          className="border p-2 mb-2 rounded"
          required
        />
        <input
          type="text"
          name="room"
          value={formData.room}
          onChange={handleChange}
          placeholder="Kamar"
          className="border p-2 mb-2 rounded"
          required
        />
        <input
          type="text"
          name="phoneNumber"
          value={formData.phoneNumber}
          onChange={handleChange}
          placeholder="Nomor Telepon Tujuan"
          className="border p-2 mb-2 rounded"
          required
        />
        <input
          type="text"
          name="relation"
          value={formData.relation}
          onChange={handleChange}
          placeholder="Relasi"
          className="border p-2 mb-2 rounded"
          required
        />
        <select
          name="duration"
          value={formData.duration}
          onChange={handleChange}
          className="border p-2 mb-2 rounded"
          required
        >
          {durationOptions.map(opt => (
            <option key={opt.duration} value={opt.duration}>
              {opt.label}
            </option>
          ))}
        </select>
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
          Buat Voucher
        </button>
      </form>
      {message && <p className={message.includes('berhasil') ? 'text-green-500' : 'text-red-500'} mt-2>{message}</p>}
    </div>
  );
}

export default VoucherGenerator;
