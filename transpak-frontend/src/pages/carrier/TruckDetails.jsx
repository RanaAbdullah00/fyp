import React, { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';

const emptyForm = {
  id: null,
  engineNumber: '',
  truckType: 'Truck',
  capacity: '',
  licensePlate: '',
  truckCardFrontImage: '',
  truckCardBackImage: ''
};

const isTruckComplete = (t) =>
  t && (t.engineNumber || t.truckNumber) && (t.truckCardFrontImage || t.truckFrontImage) && (t.truckCardBackImage || t.truckBackImage);

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const TruckDetails = () => {
  const { request, loading } = useApi();
  const [trucks, setTrucks] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const editing = useMemo(() => Boolean(form.id), [form.id]);

  const refresh = async () => {
    const data = await request({ method: 'GET', url: '/trucks/mine' });
    setTrucks(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const startEdit = (t) => {
    setForm({
      id: t.id,
      engineNumber: t.engineNumber || t.truckNumber || '',
      truckType: t.truckType || 'Truck',
      capacity: String(t.capacity ?? ''),
      licensePlate: t.licensePlate || '',
      truckCardFrontImage: t.truckCardFrontImage || t.truckFrontImage || '',
      truckCardBackImage: t.truckCardBackImage || t.truckBackImage || ''
    });
  };

  const reset = () => setForm(emptyForm);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        engineNumber: form.engineNumber.trim(),
        truckType: form.truckType.trim(),
        capacity: Number(form.capacity || 0),
        licensePlate: form.licensePlate.trim(),
        truckCardFrontImage: form.truckCardFrontImage,
        truckCardBackImage: form.truckCardBackImage
      };

      if (!payload.engineNumber || !payload.truckType || !payload.licensePlate || !payload.truckCardFrontImage || !payload.truckCardBackImage) {
        notifyError('Engine number, type, license plate, and both truck card images are required.');
        return;
      }

      if (editing) {
        await request({ method: 'PUT', url: `/trucks/${form.id}`, data: payload });
        notifySuccess('Truck updated.');
      } else {
        await request({ method: 'POST', url: '/trucks', data: payload });
        notifySuccess('Truck added.');
      }
      reset();
      await refresh();
    } catch (err) {
      notifyError(err?.response?.data?.error || 'Truck save failed');
    }
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">Truck details</h5>

      <div className="row g-3">
        <div className="col-lg-5">
          <Card className="p-3">
            <h6 className="mb-3">{editing ? 'Edit truck' : 'Add truck'}</h6>
            <form onSubmit={submit}>
              <div className="mb-2">
                <label className="form-label small fw-semibold">Engine Number *</label>
                <input name="engineNumber" className="form-control form-control-sm" value={form.engineNumber} onChange={onChange} placeholder="e.g. EN-12345" />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold">Truck Type *</label>
                <select name="truckType" className="form-select form-select-sm" value={form.truckType} onChange={onChange}>
                  <option>Truck</option>
                  <option>Trailer</option>
                  <option>Container</option>
                  <option>Flatbed</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold">Capacity (tons)</label>
                <input name="capacity" type="number" className="form-control form-control-sm" value={form.capacity} onChange={onChange} min="0" />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold">License Plate *</label>
                <input name="licensePlate" className="form-control form-control-sm" value={form.licensePlate} onChange={onChange} />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold">Truck Card Front Image *</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="form-control form-control-sm"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await fileToDataUrl(f);
                    setForm((p) => ({ ...p, truckCardFrontImage: url }));
                  }}
                />
                {form.truckCardFrontImage ? (
                  <img src={form.truckCardFrontImage} alt="Truck card front" className="mt-2" style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--pak-border)' }} />
                ) : null}
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Truck Card Back Image *</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="form-control form-control-sm"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await fileToDataUrl(f);
                    setForm((p) => ({ ...p, truckCardBackImage: url }));
                  }}
                />
                {form.truckCardBackImage ? (
                  <img src={form.truckCardBackImage} alt="Truck card back" className="mt-2" style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--pak-border)' }} />
                ) : null}
              </div>
              <div className="d-flex gap-2">
                <Button variant="primary" type="submit" disabled={loading}>
                  {loading ? <Loader light size="sm" /> : editing ? 'Save changes' : 'Add truck'}
                </Button>
                <Button variant="outline-secondary" type="button" onClick={reset}>
                  Reset
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="col-lg-7">
          <Card className="p-3">
            <h6 className="mb-3">My trucks</h6>
            {loading && trucks.length === 0 ? (
              <div className="d-flex justify-content-center py-4">
                <Loader />
              </div>
            ) : trucks.length === 0 ? (
              <div className="text-muted small">No trucks added yet.</div>
            ) : (
              <div className="list-group list-group-flush">
                {trucks.map((t) => (
                  <div key={t.id} className="list-group-item px-0">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="fw-semibold d-flex align-items-center gap-2">
                          <span>{t.engineNumber || t.truckNumber}</span>
                          {isTruckComplete(t) && <span className="badge bg-success" style={{ fontSize: 9 }}>✓</span>}
                        </div>
                        <div className="small text-muted">
                          {t.truckType} · {t.capacity || 0}t · {t.licensePlate}
                        </div>
                      </div>
                      <Button variant="outline-primary" size="sm" onClick={() => startEdit(t)}>
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TruckDetails;

