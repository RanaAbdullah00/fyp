import React, { useEffect, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import ReviewsSection from '../../components/reviews/ReviewsSection.jsx';

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const Profile = () => {
  const { user, login } = useAuth();
  const { request } = useApi();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    cnic: '',
    address: '',
    bio: '',
    profileImage: '',
    cnicFrontImage: '',
    cnicBackImage: ''
  });
  const [loading, setLoading] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      try {
        const res = await request({ method: 'GET', url: '/users/me' });
        const u = res?.user || user;
        setForm({
          name: u.name || '',
          email: u.email || '',
          phone: u.phone || '',
          cnic: u.cnic || '',
          address: u.address || '',
          bio: u.bio || '',
          profileImage: u.profileImage || '',
          cnicFrontImage: u.cnicFrontImage || '',
          cnicBackImage: u.cnicBackImage || ''
        });
        setProfileComplete(Boolean(u.profileComplete));
      } catch (e) {
        // fall back to local user
        setForm((prev) => ({
          ...prev,
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          cnic: user.cnic || ''
        }));
      }
    };
    run();
  }, [user, request]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await request({
        method: 'PUT',
        url: '/users/me',
        data: {
          name: form.name,
          address: form.address,
          bio: form.bio,
          profileImage: form.profileImage,
          cnicFrontImage: form.cnicFrontImage,
          cnicBackImage: form.cnicBackImage
        }
      });
      const updated = res?.user;
      if (updated) login({ user: { ...user, ...updated }, currentRole: user.activeRole });
      setProfileComplete(Boolean(updated?.profileComplete));
      notifySuccess('Profile saved.');
    } catch (err) {
      notifyError(err?.response?.data?.message || err?.response?.data?.error || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <Loader />;

  return (
    <div className="container py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Profile</h5>
        {profileComplete ? <span className="badge bg-success">Complete ✓</span> : <span className="badge bg-warning text-dark">Incomplete</span>}
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
                {form.profileImage ? (
                  <img src={form.profileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = await fileToDataUrl(f);
                  setForm((p) => ({ ...p, profileImage: url }));
                }}
              />
            </div>
            <div className="mt-3">
              <label className="form-label small fw-semibold">CNIC front image *</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="form-control form-control-sm"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = await fileToDataUrl(f);
                  setForm((p) => ({ ...p, cnicFrontImage: url }));
                }}
              />
              {form.cnicFrontImage ? <img src={form.cnicFrontImage} alt="CNIC front" className="mt-2" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--pak-border)' }} /> : null}
            </div>
            <div className="mt-3">
              <label className="form-label small fw-semibold">CNIC back image *</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="form-control form-control-sm"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = await fileToDataUrl(f);
                  setForm((p) => ({ ...p, cnicBackImage: url }));
                }}
              />
              {form.cnicBackImage ? <img src={form.cnicBackImage} alt="CNIC back" className="mt-2" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--pak-border)' }} /> : null}
            </div>
          </div>
          <div className="col-md-8">
            <div className="row g-2">
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Name</label>
                <input name="name" className="form-control form-control-sm" value={form.name} onChange={handleChange} />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Email</label>
                <input className="form-control form-control-sm" value={form.email} disabled />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Phone</label>
                <input className="form-control form-control-sm" value={form.phone} disabled />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">CNIC</label>
                <input className="form-control form-control-sm" value={form.cnic} disabled />
              </div>
              <div className="col-12">
                <label className="form-label small fw-semibold">Address</label>
                <input name="address" className="form-control form-control-sm" value={form.address} onChange={handleChange} />
              </div>
              <div className="col-12">
                <label className="form-label small fw-semibold">Bio</label>
                <textarea name="bio" className="form-control form-control-sm" rows={3} value={form.bio} onChange={handleChange} />
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
