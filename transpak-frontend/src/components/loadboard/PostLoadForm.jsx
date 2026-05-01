import React, { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';

const defaultForm = () => ({
  cargo: '',
  origin: '',
  destination: '',
  weight: '',
  vehicleType: 'Truck',
  expectedPrice: '',
  pickupDate: '',
  deadlineHours: '2'
});

// Form used by shippers to post or edit a load.
const PostLoadForm = ({ onSubmit, initialValues = null, submitLabel = 'Post load' }) => {
  const [form, setForm] = useState(() => ({
    ...defaultForm(),
    ...(initialValues || {})
  }));

  useEffect(() => {
    if (initialValues && typeof initialValues === 'object') {
      setForm({ ...defaultForm(), ...initialValues });
    }
  }, [initialValues]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const pickup = String(form.pickupDate || '').trim();
    const today = new Date();
    const todayStr = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
      .toISOString()
      .slice(0, 10);
    if (pickup && pickup <= todayStr) {
      alert('Pickup date must be in the future.');
      return;
    }
    onSubmit?.(form);
  };

  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const minPickupDate =
    initialValues?.pickupDate && String(initialValues.pickupDate) < tomorrow
      ? String(initialValues.pickupDate)
      : tomorrow;

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-2">
        <label className="form-label small">Cargo description</label>
        <input
          name="cargo"
          className="form-control form-control-sm rounded-3"
          placeholder="e.g. 20ft container, FMCG goods"
          value={form.cargo}
          onChange={handleChange}
          required
        />
      </div>
      <div className="row g-2">
        <div className="col-6">
          <label className="form-label small">Pickup city</label>
          <input
            name="origin"
            className="form-control form-control-sm rounded-3"
            placeholder="Lahore"
            value={form.origin}
            onChange={handleChange}
            required
          />
        </div>
        <div className="col-6">
          <label className="form-label small">Dropoff city</label>
          <input
            name="destination"
            className="form-control form-control-sm rounded-3"
            placeholder="Karachi"
            value={form.destination}
            onChange={handleChange}
            required
          />
        </div>
      </div>
      <div className="row g-2 mt-1">
        <div className="col-6">
          <label className="form-label small">Weight (tons)</label>
          <input
            type="number"
            name="weight"
            className="form-control form-control-sm rounded-3"
            placeholder="e.g. 18"
            value={form.weight}
            onChange={handleChange}
            required
          />
        </div>
        <div className="col-6">
          <label className="form-label small">Vehicle type</label>
          <select
            name="vehicleType"
            className="form-select form-select-sm rounded-3"
            value={form.vehicleType}
            onChange={handleChange}
          >
            <option>Truck</option>
            <option>Trailer</option>
            <option>Container</option>
            <option>Flatbed</option>
          </select>
        </div>
      </div>
      <div className="row g-2 mt-1">
        <div className="col-6">
          <label className="form-label small">Expected price (PKR)</label>
          <input
            type="number"
            name="expectedPrice"
            className="form-control form-control-sm rounded-3"
            placeholder="e.g. 120000"
            value={form.expectedPrice}
            onChange={handleChange}
            required
          />
        </div>
        <div className="col-6">
          <label className="form-label small">Pickup date</label>
          <input
            type="date"
            name="pickupDate"
            className="form-control form-control-sm rounded-3"
            value={form.pickupDate}
            onChange={handleChange}
            min={minPickupDate}
            required
          />
        </div>
        <div className="col-6">
          <label className="form-label small">Bidding deadline (hours)</label>
          <select
            name="deadlineHours"
            className="form-select form-select-sm rounded-3"
            value={form.deadlineHours}
            onChange={handleChange}
            required
          >
            <option value="2">2 hours</option>
            <option value="4">4 hours</option>
            <option value="8">8 hours</option>
            <option value="24">24 hours</option>
          </select>
        </div>
      </div>
      <Button variant="primary" className="w-100 mt-3 py-2 rounded-lg" type="submit">
        {submitLabel}
      </Button>
    </form>
  );
};

export default PostLoadForm;

