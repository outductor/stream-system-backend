import { useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { reservationsApi } from '../api/client';
import type { Reservation } from '../types/api';

interface DeleteConfirmDialogProps {
  reservation: Reservation;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteConfirmDialog({ reservation, onClose, onSuccess }: DeleteConfirmDialogProps) {
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await reservationsApi.deleteReservation(reservation.id, passcode);
      onSuccess();
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('暗証番号が正しくありません');
      } else {
        setError('削除に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="delete-dialog-overlay" onClick={onClose}>
      <div className="delete-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>予約を削除しますか？</h3>
        
        <div className="reservation-info">
          <p><strong>DJ名:</strong> {reservation.djName}</p>
          <p><strong>時間:</strong> {Temporal.Instant.from(reservation.startTime).toZonedDateTimeISO('Asia/Tokyo').toPlainTime().toString({ smallestUnit: 'minute' })} - {Temporal.Instant.from(reservation.endTime).toZonedDateTimeISO('Asia/Tokyo').toPlainTime().toString({ smallestUnit: 'minute' })}</p>
        </div>

        <form onSubmit={handleDelete}>
          <div className="form-group">
            <label htmlFor="delete-passcode">暗証番号（4桁）</label>
            <input
              id="delete-passcode"
              type="text"
              value={passcode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPasscode(value);
              }}
              pattern="[0-9]{4}"
              maxLength={4}
              required
              placeholder="登録時の4桁の数字"
              autoFocus
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              キャンセル
            </button>
            <button type="submit" className="delete-button" disabled={loading || passcode.length !== 4}>
              {loading ? '削除中...' : '削除する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}