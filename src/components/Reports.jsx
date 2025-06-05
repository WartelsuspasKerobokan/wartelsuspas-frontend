import { useState, useEffect } from 'react';
import { db, auth } from '../firebase-config';
import { collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function Reports() {
  const [vouchers, setVouchers] = useState([]);
  const [filter, setFilter] = useState('today');
  const [specificDate, setSpecificDate] = useState(new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || !(await user.getIdTokenResult()).claims.admin) {
        navigate('/admin/login');
      } else {
        fetchVouchers();
      }
    });
    return () => unsubscribe();
  }, [navigate, filter, specificDate, month, year]);

  const fetchVouchers = async () => {
    try {
      const vouchersCollection = collection(db, 'vouchers');
      const snapshot = await getDocs(vouchersCollection);
      let voucherList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Logika filter laporan
      if (filter === 'today') {
        const today = new Date();
        voucherList = voucherList.filter(v =>
          v.createdAt?.toDate().toDateString() === today.toDateString()
        );
      } else if (filter === 'specific') {
        const selectedDate = new Date(specificDate);
        voucherList = voucherList.filter(v =>
          v.createdAt?.toDate().toDateString() === selectedDate.toDateString()
        );
      } else if (filter === 'month') {
        voucherList = voucherList.filter(v =>
          v.createdAt?.toDate().getMonth() + 1 === Number(month) &&
          v.createdAt?.toDate().getFullYear() === Number(year)
        );
      } else if (filter === 'year') {
        voucherList = voucherList.filter(v =>
          v.createdAt?.toDate().getFullYear() === Number(year)
        );
      }
      setVouchers(voucherList);
    } catch (err) {
      setError('Gagal memuat laporan');
      console.error('Error fetching vouchers:', err);
    }
  };

  // --- Fungsi pembantu untuk format durasi/waktu ---
  const formatDuration = (totalSeconds) => {
    if (totalSeconds === 0) return '0 detik';

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    let result = '';
    if (minutes > 0) {
      result += `${minutes} menit`;
    }
    if (seconds > 0) {
      if (result !== '') result += ' ';
      result += `${seconds} detik`;
    }
    return result.trim();
  };
  // --- Akhir fungsi pembantu ---

  // Fungsi untuk ekspor laporan ke Excel
  const exportToExcel = () => {
    const ws = utils.json_to_sheet([
      { '': `Laporan Penjualan Voucher - ${getDateIndicator().text}` },
      ...vouchers.map(v => ({
        Kode: v.code,
        'Nama WBP': v.wbpName,
        Kamar: v.room,
        Harga: `Rp ${v.cost}`,
        Status: v.used ? 'Selesai' : v.sessionStartTime ? 'Aktif' : 'Belum Digunakan',
        'No. Telepon': v.phoneNumber,
        Relasi: v.relation,
        'Durasi': formatDuration(v.duration), // Menggunakan formatDuration untuk ekspor
        Dibuat: v.createdAt ? v.createdAt.toDate().toLocaleString() : 'N/A'
      }))
    ]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Laporan Voucher');
    writeFile(wb, `Laporan_Voucher_${getDateIndicator().text.replace(/\s/g, '_')}.xlsx`);
  };

  // Fungsi untuk ekspor laporan ke PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text(`Laporan Penjualan Voucher - ${getDateIndicator().text}`, 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [['Kode', 'Nama WBP', 'Kamar', 'Harga', 'Status', 'No. Telepon', 'Relasi', 'Durasi', 'Dibuat']],
      body: vouchers.map(v => [
        v.code,
        v.wbpName,
        v.room,
        `Rp ${v.cost}`,
        v.used ? 'Selesai' : v.sessionStartTime ? 'Aktif' : 'Belum Digunakan',
        v.phoneNumber,
        v.relation,
        formatDuration(v.duration), // Menggunakan formatDuration untuk ekspor
        v.createdAt ? v.createdAt.toDate().toLocaleString() : 'N/A'
      ])
    });
    doc.save(`Laporan_Voucher_${getDateIndicator().text.replace(/\s/g, '_')}.pdf`);
  };

  // Fungsi untuk mendapatkan indikator tanggal/bulan/tahun untuk laporan
  const getDateIndicator = () => {
    const now = new Date();
    if (filter === 'today') {
      return {
        text: now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        color: 'bg-blue-500'
      };
    } else if (filter === 'specific') {
      return {
        text: new Date(specificDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        color: 'bg-teal-500'
      };
    } else if (filter === 'month') {
      return {
        text: `${months[month - 1]} ${year}`,
        color: 'bg-green-500'
      };
    } else if (filter === 'year') {
      return {
        text: `${year}`,
        color: 'bg-yellow-500'
      };
    } else {
      return {
        text: 'Semua Waktu',
        color: 'bg-purple-500'
      };
    }
  };

  // Handler untuk logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      setError('Gagal logout');
      console.error('Error logging out:', error);
    }
  };

  const dateIndicator = getDateIndicator();

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-100 p-4">
      <div className="absolute top-4 right-4">
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>
      <h2 className="text-2xl font-bold mb-4">Laporan Penjualan Voucher</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <div className="mb-4 flex flex-col items-center">
        <div className="flex mb-2 space-x-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="today">Hari Ini</option>
            <option value="specific">Tanggal Spesifik</option>
            <option value="month">Bulan</option>
            <option value="year">Tahun</option>
            <option value="all">Semua Waktu</option>
          </select>
          {filter === 'specific' && (
            <input
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className="border p-2 rounded"
            />
          )}
          {filter === 'month' && (
            <>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="border p-2 rounded"
              >
                {months.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="Tahun"
                className="border p-2 rounded w-24"
              />
            </>
          )}
          {filter === 'year' && (
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Tahun"
              className="border p-2 rounded w-24"
            />
          )}
        </div>
        <div className="flex">
          <button
            onClick={exportToExcel}
            className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
          >
            Ekspor ke Excel
          </button>
          <button
            onClick={exportToPDF}
            className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
          >
            Ekspor ke PDF
          </button>
          <button
            onClick={() => window.print()}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Cetak
          </button>
        </div>
      </div>
      <div className="mb-4">
        <span className={`${dateIndicator.color} text-white px-3 py-1 rounded-full font-semibold`}>
          {dateIndicator.text}
        </span>
      </div>
      <table className="w-full max-w-4xl bg-white shadow rounded">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2">Kode</th>
            <th className="p-2">Nama WBP</th>
            <th className="p-2">Kamar</th>
            <th className="p-2">Harga</th>
            <th className="p-2">Status</th>
            <th className="p-2">No. Telepon</th>
            <th className="p-2">Relasi</th>
            <th className="p-2">Durasi</th>
            <th className="p-2">Dibuat</th>
          </tr>
        </thead>
        <tbody>
          {vouchers.map(v => (
            <tr
              key={v.id}
              className={v.used ? 'text-red-500' : ''}
            >
              <td className="p-2">{v.code}</td>
              <td className="p-2">{v.wbpName}</td>
              <td className="p-2">{v.room}</td>
              <td className="p-2">Rp {v.cost}</td>
              <td className="p-2">
                {v.used ? 'Selesai' : v.sessionStartTime ? 'Aktif' : 'Belum Digunakan'}
              </td>
              <td className="p-2">{v.phoneNumber}</td>
              <td className="p-2">{v.relation}</td>
              <td className="p-2">
                {formatDuration(v.duration)} {/* Menampilkan durasi menggunakan formatDuration */}
              </td>
              <td className="p-2">
                {v.createdAt ? v.createdAt.toDate().toLocaleString() : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Reports;