import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase-config';
import { collection, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import axios from 'axios';

function AdminDashboard() {
  const [vouchers, setVouchers] = useState([]);
  const [localTimers, setLocalTimers] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const audioRef = useRef(null);
  const beepTimeoutRef = useRef(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false); // State untuk melacak status unlock audio

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user || !(await user.getIdTokenResult()).claims.admin) {
        navigate('/admin/login');
      }
    });

    const unsubscribeVouchers = onSnapshot(collection(db, 'vouchers'), (snapshot) => {
      const voucherList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVouchers(voucherList);

      setLocalTimers(prevTimers => {
        const newTimers = { ...prevTimers };
        voucherList.forEach(v => {
          // Jika sesi aktif, tambahkan/pertahankan di timer lokal
          if (v.sessionStartTime && v.remainingTime > 0 && !v.used && !v.terminatedAt) {
            if (newTimers[v.id] === undefined || newTimers[v.id] !== v.remainingTime) {
                newTimers[v.id] = v.remainingTime;
            }
          } else {
            // Jika sesi tidak aktif, sudah digunakan, atau dihentikan, hapus dari timer lokal
            delete newTimers[v.id];

            // Hentikan beep jika sesi berhenti/dihapus dari luar
            if (audioRef.current && audioRef.current._voucherId === v.id) { // Cek jika beep ini untuk voucher yang sama
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current = null;
                if (beepTimeoutRef.current) {
                    clearTimeout(beepTimeoutRef.current);
                    beepTimeoutRef.current = null;
                }
            }
          }
        });
        // Hapus juga timer yang tidak lagi ada di voucherList (mungkin voucher dihapus)
        Object.keys(newTimers).forEach(timerId => {
          if (!voucherList.some(v => v.id === timerId)) {
            delete newTimers[timerId];
          }
        });
        return newTimers;
      });

      if (snapshot.empty) {
        setVouchers([]);
        setLocalTimers({});
      }
    }, (err) => {
      if (err.code === 'unavailable' || err.code === 'permission-denied') {
        setError('Gagal memuat data voucher karena masalah koneksi atau izin');
        console.error('Firestore error:', err);
      }
    });

    // Interval untuk mengurangi timer lokal setiap detik
    const interval = setInterval(() => {
      setLocalTimers(prev => {
        const updatedTimers = { ...prev };
        Object.keys(updatedTimers).forEach(id => {
          // Logika beep di sini ketika timer mencapai 0
          if (updatedTimers[id] === 1 && audioUnlocked) { // Akan menjadi 0 di detik berikutnya
            if (!audioRef.current) { // Hanya putar jika belum ada beep lain yang aktif
              audioRef.current = new Audio('/assets/beep.mp3');
              audioRef.current.loop = true; // Putar berulang
              audioRef.current._voucherId = id; // Tandai audio ini untuk voucher mana
              audioRef.current.play().catch(err => console.error('Error playing beep sound in AdminDashboard:', err));

              // Hentikan setelah 15 detik
              beepTimeoutRef.current = setTimeout(() => {
                if (audioRef.current && audioRef.current._voucherId === id) {
                  audioRef.current.pause();
                  audioRef.current.currentTime = 0;
                  audioRef.current = null;
                }
                beepTimeoutRef.current = null;
              }, 15000); // 15 detik
            }
          }

          if (updatedTimers[id] > 0) {
            updatedTimers[id] -= 1;
          } else {
            delete updatedTimers[id];
          }
        });
        return updatedTimers;
      });
    }, 1000);

    return () => {
      unsubscribeAuth();
      unsubscribeVouchers();
      clearInterval(interval);

      // CLEANUP BEEP PADA UNMOUNT
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      if (beepTimeoutRef.current) {
        clearTimeout(beepTimeoutRef.current);
        beepTimeoutRef.current = null;
      }
    };
  }, [navigate, audioUnlocked]); // audioUnlocked sebagai dependency

  // Handler untuk menghentikan sesi secara manual dari admin
  const handleStopSession = async (voucherId, currentRemainingTime) => {
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/stop-session`, { // Menggunakan variabel lingkungan untuk URL API
        voucherId,
        remainingTime: currentRemainingTime
      });
      // Setelah berhenti, hentikan juga beep jika sedang berbunyi untuk voucher ini
      if (audioRef.current && audioRef.current._voucherId === voucherId) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
        if (beepTimeoutRef.current) {
            clearTimeout(beepTimeoutRef.current);
            beepTimeoutRef.current = null;
        }
      }
    } catch (error) {
      setError('Gagal menghentikan sesi');
      console.error('Error stopping session:', error);
    }
  };

  // Handler untuk logout admin
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      setError('Gagal logout');
      console.error('Error logging out:', error);
    }
  };

  // Fungsi pembantu untuk format durasi/waktu (misal: "10 menit 30 detik")
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

  // Fungsi untuk mencoba membuka kunci audio context browser
  const unlockAudioContext = () => {
    if (!audioUnlocked) {
      const silentAudio = new Audio();
      // Menggunakan data URI MP3 senyap yang sangat singkat untuk memicu interaksi audio
      silentAudio.src = 'data:audio/mpeg;base64,SUQzBAAAAAAAIExBTUUzLjEwMFVVVVVVVUVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVWVjMTEyVVVVVVVVVVVVVXVWdnAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADEuMTAw';
      silentAudio.volume = 0; // Pastikan suaranya senyap

      silentAudio.play().then(() => {
        setAudioUnlocked(true);
        console.log("Audio context berhasil dibuka kuncinya di AdminDashboard.");
      }).catch(err => {
        console.warn("Gagal membuka kunci audio context di AdminDashboard:", err);
        setAudioUnlocked(true); // Asumsikan berhasil setelah percobaan pertama
      });
    }
  };

  return (
    // Menambahkan onClick ke div paling luar untuk memicu unlockAudioContext
    <div className="min-h-screen flex flex-col items-center bg-gray-100 p-4" onClick={unlockAudioContext}>
      <div className="absolute top-4 right-4">
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>
      <h2 className="text-2xl font-bold mb-4">Dashboard Admin</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <div className="mb-4">
        <button
          onClick={() => navigate('/admin/voucher')}
          className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
        >
          Buat Voucher
        </button>
        <button
          onClick={() => navigate('/admin/reports')}
          className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
        >
          Laporan
        </button>
        <button
          onClick={() => navigate('/admin/revenue')}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Rekam Pendapatan
        </button>
      </div>
      <table className="w-full max-w-4xl bg-white shadow rounded">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2">Kode</th>
            <th className="p-2">Nama WBP</th>
            <th className="p-2">Kamar</th>
            <th className="p-2">No. Telepon</th>
            <th className="p-2">Relasi</th>
            <th className="p-2">Durasi</th>
            <th className="p-2">Biaya</th>
            <th className="p-2">Dibuat</th>
            <th className="p-2">Status</th>
            <th className="p-2">Sisa Waktu</th>
            <th className="p-2">Aksi</th>
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
              <td className="p-2">{v.phoneNumber}</td>
              <td className="p-2">{v.relation}</td>
              <td className="p-2">{formatDuration(v.duration)}</td> {/* Menampilkan durasi menggunakan formatDuration */}
              <td className="p-2">Rp {v.cost}</td>
              <td className="p-2">
                {v.createdAt ? v.createdAt.toDate().toLocaleString() : 'N/A'}
              </td>
              <td className="p-2">
                {v.used ? 'Selesai' : v.sessionStartTime && !v.terminatedAt ? 'Aktif' : 'Belum Digunakan'}
              </td>
              <td className="p-2">
                {v.sessionStartTime && !v.terminatedAt && v.remainingTime > 0
                  ? formatDuration(localTimers[v.id] !== undefined ? localTimers[v.id] : v.remainingTime) // Menampilkan sisa waktu menggunakan formatDuration
                  : '-'}
              </td>
              <td className="p-2">
                {v.sessionStartTime && !v.terminatedAt && v.remainingTime > 0 && !v.used && (
                  <button
                    onClick={() => handleStopSession(v.id, localTimers[v.id] !== undefined ? localTimers[v.id] : v.remainingTime)}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Hentikan
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminDashboard;