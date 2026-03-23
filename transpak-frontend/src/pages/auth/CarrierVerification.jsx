import React, { useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import Card from '../../components/ui/Card.jsx';
import { notifySuccess, notifyError } from '../../components/ui/ToastProvider.jsx';
import Badge from '../../components/ui/Badge.jsx';

// Carrier verification form for compliance.
const CarrierVerification = () => {
  const [form, setForm] = useState({
    companyName: '',
    cnic: '',
    phone: '',
    vehicleCount: '',
    documents: null
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('pending');

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      setForm((prev) => ({ ...prev, documents: files[0] }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // TODO: API call to authService.verifyCarrier(form)
      console.log('Verification payload:', form);
      setStatus('submitted');
      notifySuccess('Verification submitted. Admin will review within 24 hours.');
    } catch (err) {
      notifyError('Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-3">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">
          <Card>
            <div className="text-center mb-4">
              <h5>Carrier Verification</h5>
              <Badge variant="warning">{status.toUpperCase()}</Badge>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Company name</label>
                <input
                  name="companyName"
                  className="form-control"
                  value={form.companyName}
                  onChange={handleChange}
                  placeholder="Your logistics company"
                  required
                />
              </div>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">CNIC</label>
                  <input
                    name="cnic"
                    className="form-control"
                    value={form.cnic}
                    onChange={handleChange}
                    placeholder="35202-XXXXXXX-X"
                    required
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Phone</label>
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
              <div className="mb-3">
                <label className="form-label">Number of vehicles</label>
                <input
                  name="vehicleCount"
                  type="number"
                  className="form-control"
                  value={form.vehicleCount}
                  onChange={handleChange}
                  placeholder="5"
                  min="1"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="form-label">NTN / Company documents (PDF)</label>
                <input
                  name="documents"
                  type="file"
                  accept=".pdf"
                  className="form-control"
                  onChange={handleChange}
                />
              </div>
              <Button
                variant="primary"
                type="submit"
                className="w-100"
                disabled={loading || status === 'submitted'}
              >
                {loading ? <Loader light /> : status === 'submitted' ? 'Submitted!' : 'Submit for Verification'}
              </Button>
            </form>
            <div className="text-center mt-3 small text-muted">
              Admin approval required before accessing carrier features
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CarrierVerification;

