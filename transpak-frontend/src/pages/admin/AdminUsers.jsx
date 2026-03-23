import React, { useEffect, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';

const AdminUsers = () => {
  const { request, loading } = useApi();
  const [users, setUsers] = useState([]);

  const refresh = async () => {
    const data = await request({ url: '/admin/users' });
    setUsers(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const setBlocked = async (id, blocked) => {
    try {
      const res = await request({ method: 'PATCH', url: `/admin/users/${id}/block`, data: { blocked } });
      const u = res?.user;
      setUsers((prev) => prev.map((x) => (x.id === id ? { ...x, blocked: u?.blocked ?? blocked } : x)));
      notifySuccess(blocked ? 'User blocked' : 'User unblocked');
    } catch (e) {
      notifyError('Update failed');
    }
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">Users</h5>
      {loading && users.length === 0 ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : users.length === 0 ? (
        <div className="text-muted text-center py-5">No users.</div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover table-sm mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th className="ps-3 py-3">Name</th>
                  <th className="py-3">Email</th>
                  <th className="py-3 d-none d-md-table-cell">CNIC</th>
                  <th className="py-3">Roles</th>
                  <th className="pe-3 py-3 text-end">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="ps-3 py-3 fw-semibold">{u.name}</td>
                    <td className="py-3"><small>{u.email}</small></td>
                    <td className="py-3 d-none d-md-table-cell"><small className="text-muted">{u.cnic}</small></td>
                    <td className="py-3"><span className="badge bg-secondary">{(u.roles || []).join(', ')}</span></td>
                    <td className="pe-3 py-3 text-end">
                      <Button
                        variant={u.blocked ? 'success' : 'outline-danger'}
                        size="sm"
                        onClick={() => setBlocked(u.id, !u.blocked)}
                        className="rounded-lg"
                      >
                        {u.blocked ? 'Unblock' : 'Block'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AdminUsers;

