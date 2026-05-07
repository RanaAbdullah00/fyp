import React, { useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import Card from '../../components/ui/Card.jsx';
import { notifyError } from '../../components/ui/ToastProvider.jsx';

// AddTruck form for carriers to register fleet vehicles.
const AddTruck = () => {
  const [form, setForm] = useState({
    type: '',
    capacity: '',
    licensePlate: '',
    driverName: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Fleet is managed via the Carrier → Truck details screen (uploads + verification).
      notifyError('Please use Carrier → Truck details to add trucks with documents.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">Add new truck</h5>
      <Card>
        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Truck type</label>
              <select
                name="type"
                className="form-select"
                value={form.type}
                onChange={handleChange}
                required
              >
                <option value="">Select type</option>
                <option value="truck">Truck</option>
                <option value="trailer">Trailer</option>
                <option value="container">Container</option>
                <option value="flatbed">Flatbed</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Capacity (tons)</label>
              <input
                name="capacity"
                type="number"
                className="form-control"
                value={form.capacity}
                onChange={handleChange}
                placeholder="e.g. 20"
                required
              />
            </div>
            <div className="col-12">
              <label className="form-label">License plate</label>
              <input
                name="licensePlate"
                className="form-control"
                value={form.licensePlate}
                onChange={handleChange}
                placeholder="e.g. ABC-123"
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Driver name</label>
              <input
                name="driverName"
                className="form-control"
                value={form.driverName}
                onChange={handleChange}
                placeholder="Full name"
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Driver phone</label>
              <input
                name="phone"
                type="tel"
                className="form-control"
                value={form.phone}
                onChange={handleChange}
                placeholder="03XX-XXXXXXX"
                required
              />
            </div>
          </div>
          <div className="mt-4">
            <Button variant="primary" type="submit" disabled={loading} className="me-2">
              {loading ? <Loader light small /> : 'Add truck'}
            </Button>
            <Button variant="outline-secondary" type="button" onClick={() => setForm({})} disabled={loading}>
              Reset
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AddTruck;

