import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { auth } from '../firebase-config';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase-config';

function VoucherInput() {
  const [code, setCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [timer, setTimer] = useState(null);
  const [isValidVoucher, setIsValidVoucher] = useState(false);
  const [voucherId, setVoucherId] = useState(null);
  const navigate = useNavigate();

  const audioRef = useRef(null);
  const beepTimeoutRef = useRef(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false); // State baru untuk melacak status unlock audio

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // --- PERBAIKAN UTAMA: Mencoba membuka kunci audio context pada interaksi pengguna ---
      if (!audioUnlocked) {
        const silentAudio = new Audio();
        // Gunakan MP3 data URI yang sangat singkat dan senyap. Ini seringkali cukup untuk membuka kunci.
        silentAudio.src = 'data:audio/mpeg;base64,SUQzBAAAAAAAIExBTUUzLjEwMFVVVVVVVUVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVWVjMTEyVVVVVVVVVVVVVXVWdnAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADEuMTAw';
        silentAudio.volume = 0; // Pastikan suaranya senyap

        silentAudio.play().then(() => {
          setAudioUnlocked(true);
          console.log("Audio context berhasil dibuka kuncinya.");
        }).catch(err => {
          console.warn("Gagal membuka kunci audio context (mungkin sudah dibuka atau ada kebijakan blocking lain):", err);
          // Jika gagal, set audioUnlocked ke true agar tidak mencoba lagi dan log masalahnya.
          // Atau bisa juga tetap false dan mencoba lagi di interaksi berikutnya jika diperlukan.
          // Untuk saat ini, kita anggap interaksi pertama sudah dicoba.
          setAudioUnlocked(true); // Asumsikan berhasil setelah percobaan pertama untuk tidak memblokir
        });
      }
      // --- AKHIR PERBAIKAN UTAMA ---

      const response = await axios.post('http://localhost:3001/validate-voucher', { code });
      setTimer(response.data.remainingTime);
      setVoucherId(response.data.voucherId);
      setMessage('');
      setIsValidVoucher(true);
    } catch (error) {
      setMessage(error.response?.data || 'Kode voucher tidak valid');
      setIsValidVoucher(false);
      console.error('Error validating voucher:', error);
    }
  };

  const handleCall = () => {
    if (!phoneNumber.match(/^\+?\d{10,13}$/)) {
      setMessage('Masukkan nomor telepon yang valid (10-13 digit)');
      return;
    }
    window.open(`https://wa.me/${phoneNumber.replace(/\D/g, '')}`, '_blank');
  };

  const handleStopSession = async () => {
    // Hentikan suara beep jika sedang berbunyi
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (beepTimeoutRef.current) {
      clearTimeout(beepTimeoutRef.current);
      beepTimeoutRef.current = null;
    }

    try {
      await axios.post('http://localhost:3001/stop-session', { voucherId, remainingTime: timer });
      setMessage('Sesi dihentikan, sisa waktu tersimpan');
      setIsValidVoucher(false);
      setPhoneNumber('');
      setTimer(null);
      setVoucherId(null);
      setCode('');
    } catch (error) {
      setMessage('Gagal menghentikan sesi');
      console.error('Error stopping session:', error);
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

  useEffect(() => {
    let unsubscribe;
    let interval;

    if (isValidVoucher && voucherId) {
      const voucherRef = doc(db, 'vouchers', voucherId);

      unsubscribe = onSnapshot(voucherRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const currentRemainingTime = data.remainingTime;

          setTimer(currentRemainingTime);

          const isSessionStopped = data.sessionStartTime === null;

          if (isSessionStopped) {
            let terminationMessage = 'Sesi telah berhenti.';
            if (data.terminatedAt) {
              terminationMessage = 'Sesi dihentikan oleh admin, masukkan kode voucher untuk melanjutkan.';
            } else if (data.used && data.remainingTime <= 0) {
              terminationMessage = 'Sesi telah berakhir, voucher tidak dapat digunakan lagi.';
            } else if (data.remainingTime > 0) {
              terminationMessage = 'Sesi dihentikan, sisa waktu tersimpan.';
            }

            setMessage(terminationMessage);
            setIsValidVoucher(false);
            setPhoneNumber('');
            setTimer(null);
            setVoucherId(null);
            setCode('');

            // HENTIKAN BEEP JIKA SESI BERHENTI KARENA ADMIN/LAINNYA
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
              audioRef.current = null;
            }
            if (beepTimeoutRef.current) {
              clearTimeout(beepTimeoutRef.current);
              beepTimeoutRef.current = null;
            }
          }
        } else {
          setMessage('Voucher tidak ditemukan atau telah dihapus.');
          setIsValidVoucher(false);
          setPhoneNumber('');
          setTimer(null);
          setVoucherId(null);
          setCode('');
        }
      }, (error) => {
        console.error('Error listening to voucher updates:', error);
        setMessage('Gagal memuat data voucher. Coba lagi.');
      });

      interval = setInterval(() => {
        setTimer(prevTimer => {
          if (prevTimer > 0) {
            return prevTimer - 1;
          } else if (prevTimer === 0) {
            // --- LOGIKA BEEP DENGAN BATASAN DURASI & CEK UNLOCK AUDIO ---
            // Hanya putar jika belum berbunyi DAN audio context sudah dibuka
            if (!audioRef.current && audioUnlocked) {
              audioRef.current = new Audio('/assets/beep.mp3');
              audioRef.current.loop = true; // Putar berulang
              audioRef.current.play().catch(err => console.error('Error playing beep sound after unlock:', err));

              // Hentikan setelah 15 detik
              beepTimeoutRef.current = setTimeout(() => {
                if (audioRef.current) {
                  audioRef.current.pause();
                  audioRef.current.currentTime = 0; // Reset waktu audio
                  audioRef.current = null; // Hapus referensi audio
                }
                beepTimeoutRef.current = null; // Hapus referensi timeout
              }, 15000); // 15 detik
            } else if (!audioUnlocked) {
              console.warn("Suara beep tidak diputar: konteks audio belum dibuka oleh interaksi pengguna.");
              // Opsional: tampilkan pesan ke user untuk memastikan mereka mengklik sesuatu.
            }
            // --- AKHIR LOGIKA BEEP ---

            // Kirim sinyal ke backend bahwa waktu sudah habis
            axios.post('http://localhost:3001/stop-session', { voucherId, remainingTime: 0 })
              .then(() => console.log('Session ended gracefully by timer.'))
              .catch(err => console.error('Error sending end session signal:', err));

            setMessage('Sesi telah berakhir, voucher tidak dapat digunakan lagi');
            setIsValidVoucher(false);
            setPhoneNumber('');
            setVoucherId(null);
            setCode('');
            return 0;
          }
          return prevTimer;
        });
      }, 1000);
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (interval) clearInterval(interval);

      // --- CLEANUP BEEP PADA UNMOUNT ---
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      if (beepTimeoutRef.current) {
        clearTimeout(beepTimeoutRef.current);
        beepTimeoutRef.current = null;
      }
      // --- AKHIR CLEANUP BEEP ---
    };
  }, [isValidVoucher, voucherId, navigate, audioUnlocked]); // Tambahkan audioUnlocked ke dependencies

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
      <h2 className="text-2xl font-bold mb-4">Masukkan Kode Voucher</h2>
      <div className="w-80">
        {!isValidVoucher ? (
          <form
            onSubmit={handleSubmit}
            className="flex animate-fade-in"
          >
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Kode Voucher"
              className="border p-2 mr-2 rounded flex-grow"
              required
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Submit
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center animate-fade-in">
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Nomor Tujuan (contoh: +6281234567890)"
              className="border p-2 mb-2 rounded w-full"
              required
            />
            <div className="flex w-full space-x-2">
              <button
                onClick={handleCall}
                className="bg-green-500 text-white px-4 py-2 rounded flex-grow"
              >
                Call
              </button>
              <button
                onClick={handleStopSession}
                className="bg-red-500 text-white px-4 py-2 rounded flex-grow"
              >
                Hentikan Sesi
              </button>
            </div>
            {timer !== null && (
              <p className="mt-2 text-gray-700">
                Sisa waktu: {Math.floor(timer / 60)} menit {timer % 60} detik
              </p>
            )}
          </div>
        )}
      </div>
      {message && (
        <p className={`${message.includes('berakhir') || message.includes('dihentikan') || message.includes('tersimpan') ? 'text-blue-600' : 'text-red-500'} mt-2`}>
          {message}
        </p>
      )}
      <style jsx global>{`
        .animate-fade-in {
          animation: fadeIn 300ms ease-in forwards;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default VoucherInput;