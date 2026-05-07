import React, { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import ReviewsSection from '../../components/reviews/ReviewsSection.jsx';

const CNIC_REGEX = /^[0-9]{5}-[0-9]{7}-[0-9]{1}$/;

const Profile = () => {
  const { user, login } = useAuth();
  const { request } = useApi();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    cnic_number: '',
    cnic_image: '',
    profile_image: ''
  });
  const [files, setFiles] = useState({ cnic_image: null, profile_image: null });
  const [cnicLocked, setCnicLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      try {
        const u = await request({ method: 'GET', url: '/profile' });
        setForm({
          full_name: u.full_name || '',
          email: u.email || '',
          phone: u.phone || '',
          cnic_number: u.cnic_number || '',
          cnic_image: u.cnic_image || '',
          profile_image: u.profile_image || ''
        });
        setCnicLocked(Boolean(u.cnic_number));
        setProfileComplete(Boolean(u.is_profile_complete));
      } catch (e) {
        setForm((prev) => ({ ...prev, email: user.email || '' }));
      }
    };
    run();
  }, [user, request]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const canEditCnic = !cnicLocked;
  const cnicValid = useMemo(() => {
    if (!form.cnic_number) return true;
    return CNIC_REGEX.test(String(form.cnic_number).trim());
  }, [form.cnic_number]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      if (form.full_name) fd.append('full_name', form.full_name);
      if (form.phone) fd.append('phone', form.phone);
      if (canEditCnic && form.cnic_number) fd.append('cnic_number', form.cnic_number);
      if (files.profile_image) fd.append('profile_image', files.profile_image);
      if (files.cnic_image) fd.append('cnic_image', files.cnic_image);

      const updated = await request({
        method: 'PUT',
        url: '/profile/update',
        data: fd
      });
      if (updated) {
        setForm((p) => ({
          ...p,
          full_name: updated.full_name || '',
          phone: updated.phone || '',
          cnic_number: updated.cnic_number || '',
          cnic_image: updated.cnic_image || '',
          profile_image: updated.profile_image || ''
        }));
        setCnicLocked(Boolean(updated.cnic_number));
        setProfileComplete(Boolean(updated.is_profile_complete));
        // keep AuthContext user hydrated (best-effort)
        login({ user: { ...user, name: updated.full_name || user?.name, profileComplete: Boolean(updated.is_profile_complete) }, currentRole: user.activeRole });
      }
      notifySuccess('Profile saved.');
    } catch (err) {
      notifyError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <Loader />;

  return (
    <div className="container py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Profile</h5>
        {profileComplete ? (
          <span className="badge bg-success">Profile Completed</span>
        ) : (
          <span className="badge bg-danger">Incomplete Profile</span>
        )}
      </div>

      <Card className="p-3">
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label small fw-semibold">Profile photo (DP)</label>
            <div className="mb-3">
              <div
                className="rounded-circle overflow-hidden border"
                style={{ width: 72, height: 72, borderColor: 'var(--pak-border)' }}
              >
                {form.profile_image ? (
                  <img src={form.profile_image} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className="w-100 h-100 d-flex align-items-center justify-content-center bg-light text-muted small">No photo</div>
                )}
              </div>
            </div>
            <label className="form-label small fw-semibold">Upload profile image</label>
            <div className="d-flex gap-2">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="form-control form-control-sm"
                onChange={(e) => setFiles((p) => ({ ...p, profile_image: e.target.files?.[0] || null }))}
              />
            </div>
            <div className="mt-3">
              <label className="form-label small fw-semibold">CNIC image *</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="form-control form-control-sm"
                onChange={(e) => setFiles((p) => ({ ...p, cnic_image: e.target.files?.[0] || null }))}
              />
              {form.cnic_image ? <img src={form.cnic_image} alt="CNIC" className="mt-2" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--pak-border)' }} /> : null}
            </div>
          </div>
          <div className="col-md-8">
            <div className="row g-2">
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Full name</label>
                <input name="full_name" className="form-control form-control-sm" value={form.full_name} onChange={handleChange} />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Email</label>
                <input className="form-control form-control-sm" value={form.email} disabled />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Phone</label>
                <input name="phone" className="form-control form-control-sm" value={form.phone} onChange={handleChange} />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">CNIC</label>
                <input
                  name="cnic_number"
                  className={`form-control form-control-sm ${cnicValid ? '' : 'is-invalid'}`}
                  value={form.cnic_number}
                  onChange={handleChange}
                  disabled={!canEditCnic}
                  placeholder="12345-1234567-1"
                />
                {!cnicValid ? <div className="invalid-feedback">CNIC must be XXXXX-XXXXXXX-X</div> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-end mt-3">
          <Button variant="primary" onClick={handleSave} disabled={loading}>
            {loading ? <Loader light size="sm" /> : 'Save'}
          </Button>
        </div>
      </Card>

      {user?.id && <ReviewsSection userId={user.id} />}
    </div>
  );
};

export default Profile;
